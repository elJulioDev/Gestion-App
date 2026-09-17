/* archivo.js — Gallery view with lightbox */
const csrf = document.querySelector('[name=csrfmiddlewaretoken]').value;
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ── State ────────────────────────────────────────────────── */
let allFiles = [];           
let filteredFiles = [];      
let currentFolder = 'all';   
let lightboxIndex = 0;       

/* ── Helpers ──────────────────────────────────────────────── */
function debounce(fn, ms = 300) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function throttleRAF(fn) {
    let pending = false;
    return (...a) => { if (pending) return; pending = true; requestAnimationFrame(() => { fn(...a); pending = false; }); };
}
const BATCH_SIZE = 8;

function toast(msg, tipo = 'success') {
    const container = $('#toast-container');
    const el = document.createElement('div');
    el.className = `toast is-${tipo}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.style.animation = 'toast-out 0.25s forwards'; el.addEventListener('animationend', () => el.remove()); }, 2200);
}

async function post(url, data) {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => fd.append(k, v));
    const r = await fetch(url, { method: 'POST', headers: { 'X-CSRFToken': csrf }, body: fd });
    return r.json();
}

function postJSON(url, data) {
    return fetch(url, { method: 'POST', headers: { 'X-CSRFToken': csrf, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
}

function openBackdrop(id)  { document.getElementById(id).classList.add('is-open'); }
function closeBackdrop(id) { document.getElementById(id).classList.remove('is-open'); }

function bindClose(backdropId, ...btnIds) {
    const bd = document.getElementById(backdropId);
    btnIds.forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('click', () => closeBackdrop(backdropId)); });
    bd.addEventListener('click', e => { if (e.target === bd) closeBackdrop(backdropId); });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function isMobile() { return window.innerWidth <= 768; }

/* ── Image retry on load failure ──────────────────────────── */
function retryImage(img) {
    const maxRetries = 3;
    const current = parseInt(img.dataset.retries || '0', 10);
    if (current >= maxRetries) return;
    img.dataset.retries = current + 1;
    setTimeout(() => { img.src = img.src; }, 1000 * (current + 1));
}

/* ── GIF optimization via wsrv.nl proxy ───────────────────── */
function isGifUrl(url) {
    return url && /\.(gif|gifv)(\?|$)/i.test(url);
}

// wsrv.nl public proxy — optimizado: ofuscación + lazy + no-referrer
const PROXY_SKIP_DOMAINS = ['files.catbox.moe', 'catbox.moe'];

function getThumbUrl(url, width = 300, options = {}) {
    if (!url) return '';
    try {
        const host = new URL(url).hostname;
        if (PROXY_SKIP_DOMAINS.some(d => host === d || host.endsWith('.' + d))) return url;
    } catch {}
    const cleanUrl = url.replace(/^https?:\/\//, '');
    const params = new URLSearchParams({
        url: cleanUrl,
        w: width,
        output: 'webp',
        q: '50'
    });
    if (options.firstFrame) params.set('n', '1');
    return `https://wsrv.nl/?${params}`;
}

/* ── Long-press modal (mobile) ──────────────────────────── */
let lpTimer = null, lpCard = null;
const lpBackdrop = $('#archivo-lp-backdrop');
const lpEdit = $('#archivo-lp-edit');
const lpDelete = $('#archivo-lp-delete');

function openLongpressModal(card) {
    lpCard = card;
    const isFolder = card.classList.contains('sidebar-folder');
    lpSubfolder.style.display = isFolder ? 'flex' : 'none';
    if (isFolder) {
        lpEdit.querySelector('span').textContent = 'Renombrar';
    } else {
        lpEdit.querySelector('span').textContent = 'Editar';
    }
    lpBackdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';
}
function closeLongpressModal() {
    lpBackdrop.classList.remove('is-open');
    document.body.style.overflow = '';
    lpCard = null;
}
lpBackdrop.addEventListener('click', e => { if (e.target === lpBackdrop) closeLongpressModal(); });

const lpSubfolder = $('#archivo-lp-subfolder');
lpSubfolder.addEventListener('click', () => {
    if (!lpCard) return;
    const folderId = lpCard.dataset.folder || lpCard.dataset.id;
    const nombre = lpCard.querySelector('.sidebar-item-name')?.textContent?.trim() || '';
    closeLongpressModal();
    openSubfolderModal(folderId, nombre);
});
lpEdit.addEventListener('click', () => {
    if (!lpCard) return;
    if (lpCard.classList.contains('sidebar-folder')) {
        const id = lpCard.dataset.id;
        const nombre = lpCard.querySelector('.sidebar-item-name')?.textContent?.trim() || '';
        openEditFolderModal(id, nombre);
    } else {
        openEditModal(lpCard.dataset.id);
    }
    closeLongpressModal();
});
lpDelete.addEventListener('click', () => {
    if (!lpCard) return;
    if (lpCard.classList.contains('sidebar-folder')) {
        const id = lpCard.dataset.id;
        const nombre = lpCard.querySelector('.sidebar-item-name')?.textContent?.trim() || 'esta carpeta';
        openDelFolderModal(id, nombre);
    } else {
        openDelFileModal(lpCard.dataset.id);
    }
    closeLongpressModal();
});

document.addEventListener('touchstart', e => {
    if (!isMobile()) return;
    if (selectMode) return;
    const card = e.target.closest('.pw-card');
    const sidebarFolder = e.target.closest('.sidebar-folder');
    if (card) {
        if (e.target.closest('.pw-card-action')) return;
        lpTimer = setTimeout(() => openLongpressModal(card), 500);
    } else if (sidebarFolder) {
        if (e.target.closest('.sidebar-item-action')) return;
        lpTimer = setTimeout(() => openLongpressModal(sidebarFolder), 500);
    }
}, { passive: true });
document.addEventListener('touchend',    () => { clearTimeout(lpTimer); }, { passive: true });
document.addEventListener('touchmove',   () => { clearTimeout(lpTimer); }, { passive: true });

/* ── Sidebar Toggle ───────────────────────────────────────── */
const sidebar        = $('#archivo-sidebar');
const sidebarOverlay = $('#archivo-sidebar-overlay');
const sidebarToggle  = $('#archivo-sidebar-toggle');

function openSidebar() { sidebar.classList.remove('is-collapsed'); sidebarOverlay.classList.add('is-visible'); document.body.style.overflow = 'hidden'; }
function closeSidebar() { sidebar.classList.add('is-collapsed'); sidebarOverlay.classList.remove('is-visible'); document.body.style.overflow = ''; }
function toggleSidebar() { sidebar.classList.contains('is-collapsed') ? openSidebar() : closeSidebar(); }

function initSidebarState() {
    if (isMobile()) { sidebar.classList.add('is-collapsed'); }
    else { sidebar.classList.remove('is-collapsed'); sidebarOverlay.classList.remove('is-visible'); document.body.style.overflow = ''; }
}
sidebarToggle.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);
window.addEventListener('resize', throttleRAF(initSidebarState));
initSidebarState();

/* ── Search ───────────────────────────────────────────────── */
const searchInput = $('#archivo-search');
const searchClear = $('#archivo-clear');

function triggerSearch(q) {
    const query = q.toLowerCase().trim();
    searchClear.style.display = query ? 'flex' : 'none';
    filteredFiles = query ? allFiles.filter(f => f.titulo.toLowerCase().includes(query)) : allFiles;
    renderGrid();
    updateCount();
}

searchInput.addEventListener('input', debounce(e => triggerSearch(e.target.value), 300));
searchClear.addEventListener('click', () => { searchInput.value = ''; triggerSearch(''); searchInput.focus(); });

/* ── Folder tree helpers ──────────────────────────────────── */
const carpetasTree = ARCHIVO_CONFIG.carpetasTree || [];

function getDescendantIds(folderId) {
    const ids = [String(folderId)];
    function walk(nodes) {
        for (const n of nodes) {
            if (String(n.id) === String(folderId)) {
                function collectDescendants(items) {
                    for (const item of items) {
                        ids.push(String(item.id));
                        collectDescendants(item.children || []);
                    }
                }
                collectDescendants(n.children || []);
                return true;
            }
            if (walk(n.children || [])) return true;
        }
        return false;
    }
    walk(carpetasTree);
    return ids;
}

/* ── Folder filter ────────────────────────────────────────── */
$$('.sidebar-item[data-folder]').forEach(item => {
    item.addEventListener('click', e => {
        if (e.target.closest('.sidebar-item-action')) return;
        const folder = item.dataset.folder;
        currentFolder = folder;
        localStorage.setItem('archivo_folder', folder);
        $$('.sidebar-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        applyFolderFilter();
        if (isMobile()) closeSidebar();
    });
});

function applyFolderFilter() {
    if (currentFolder === 'all') {
        filteredFiles = searchInput.value.trim() ? allFiles.filter(f => f.titulo.toLowerCase().includes(searchInput.value.trim().toLowerCase())) : allFiles;
    } else {
        const validIds = getDescendantIds(currentFolder);
        filteredFiles = allFiles.filter(f => validIds.includes(String(f.carpeta_id)));
        if (searchInput.value.trim()) {
            filteredFiles = filteredFiles.filter(f => f.titulo.toLowerCase().includes(searchInput.value.trim().toLowerCase()));
        }
    }
    renderGrid();
    updateCount();
}

/* ── Mobile Search ─────────────────────────────────────────── */
const mobileSearchBtn   = $('#archivo-mobile-search-btn');
const mobileSearchBar   = $('#archivo-mobile-search-bar');
const mobileSearchInput = $('#archivo-mobile-search-input');
const mobileSearchClose = $('#archivo-mobile-search-close');

function openMobileSearch() {
    mobileSearchBar.classList.add('is-open');
    setTimeout(() => mobileSearchInput.focus(), 120);
}

function closeMobileSearch() {
    mobileSearchBar.classList.remove('is-open');
    mobileSearchInput.value = '';
    triggerSearch('');
}

mobileSearchBtn.addEventListener('click', openMobileSearch);
mobileSearchClose.addEventListener('click', closeMobileSearch);

mobileSearchInput.addEventListener('input', debounce(e => triggerSearch(e.target.value), 300));

/* ── Select Mode / Bulk Actions ────────────────────────────── */
const selectModeBtn     = $('#archivo-select-mode-btn');
const bulkBar           = $('#archivo-bulk-bar');
const bulkCount         = $('#archivo-bulk-count');
const bulkDeleteBtn     = $('#archivo-bulk-delete-btn');
const bulkCancelBtn     = $('#archivo-bulk-cancel-btn');
const bulkSelectAll     = $('#archivo-bulk-select-all');
const bulkMoveBtn       = $('#archivo-bulk-move-btn');
const bulkMoveSelected  = $('#archivo-bulk-move-selected');

bindClose('archivo-bulk-move-backdrop', 'archivo-bulk-move-close', 'archivo-bulk-move-cancel');

bulkMoveBtn.addEventListener('click', () => {
    const selected = getSelectedCards();
    if (selected.length === 0) return;
    $('#archivo-bulk-move-count').textContent = selected.length;
    bulkMoveSelected.value = '';
    $$('#archivo-move-tree .folder-tree-item').forEach(i => i.classList.remove('is-selected'));
    openBackdrop('archivo-bulk-move-backdrop');
});

/* Tree folder selector for bulk move */
$$('.folder-tree-item').forEach(item => {
    item.addEventListener('click', () => {
        $$('#archivo-move-tree .folder-tree-item').forEach(i => i.classList.remove('is-selected'));
        item.classList.add('is-selected');
        bulkMoveSelected.value = item.dataset.folderId;
    });
});

$('#archivo-bulk-move-confirm').addEventListener('click', async () => {
    const selected = getSelectedCards();
    const carpetaId = bulkMoveSelected.value;
    if (!carpetaId) return toast('Selecciona una carpeta destino', 'error');

    const btn = $('#archivo-bulk-move-confirm');
    btn.disabled = true;
    btn.textContent = 'Moviendo…';

    let ok = 0, fail = 0;
    for (let i = 0; i < selected.length; i += BATCH_SIZE) {
        const batch = selected.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(card => post(`/archivo/${card.dataset.id}/mover/`, { carpeta: carpetaId }))
        );
        results.forEach(r => r.status === 'fulfilled' && r.value.ok ? ok++ : fail++);
    }

    if (fail === 0) toast(`${ok} archivo(s) movido(s)`, 'success');
    else toast(`${ok} movidos, ${fail} con error`, 'error');
    location.reload();
});

let selectMode = false;

function getSelectedCards() { return [...$$('.pw-card.is-selected')]; }
function getVisibleCards() {
    return [...$$('.pw-card')].filter(card => {
        const section = card.closest('.bm-section');
        return section && section.style.display !== 'none' && !card.classList.contains('is-hidden');
    });
}

function updateBulkBar() {
    const selected = getSelectedCards();
    const count = selected.length;
    bulkCount.textContent = count === 1 ? '1 seleccionado' : `${count} seleccionados`;
    bulkBar.classList.toggle('is-visible', count > 0);
}

function enterSelectMode() {
    selectMode = true;
    document.body.classList.add('select-mode');
    selectModeBtn.classList.add('is-active');
    selectModeBtn.title = 'Salir de selección';
    updateBulkBar();
}

function exitSelectMode() {
    selectMode = false;
    document.body.classList.remove('select-mode');
    selectModeBtn.classList.remove('is-active');
    selectModeBtn.title = 'Selección múltiple';
    $$('.pw-card.is-selected').forEach(c => c.classList.remove('is-selected'));
    bulkBar.classList.remove('is-visible');
}

selectModeBtn.addEventListener('click', () => {
    selectMode ? exitSelectMode() : enterSelectMode();
});

bulkSelectAll.addEventListener('click', () => {
    const visible = getVisibleCards();
    const allSelected = visible.every(c => c.classList.contains('is-selected'));
    visible.forEach(c => c.classList.toggle('is-selected', !allSelected));
    updateBulkBar();
});

bulkCancelBtn.addEventListener('click', exitSelectMode);

bindClose('archivo-bulk-del-backdrop', 'archivo-bulk-del-close', 'archivo-bulk-del-cancel');

bulkDeleteBtn.addEventListener('click', () => {
    const selected = getSelectedCards();
    if (selected.length === 0) return;
    const plural = selected.length === 1 ? '1 archivo' : `${selected.length} archivos`;
    $('#archivo-bulk-del-count-text').textContent = plural;
    openBackdrop('archivo-bulk-del-backdrop');
});

$('#archivo-bulk-del-confirm').addEventListener('click', async () => {
    const selected = getSelectedCards();
    const btn = $('#archivo-bulk-del-confirm');
    btn.disabled = true;

    let ok = 0, fail = 0;
    for (let i = 0; i < selected.length; i += BATCH_SIZE) {
        const batch = selected.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(card => post(`/archivo/${card.dataset.id}/eliminar/`, {}))
        );
        results.forEach(r => r.status === 'fulfilled' && r.value.ok ? ok++ : fail++);
    }

    closeBackdrop('archivo-bulk-del-backdrop');
    if (fail === 0) toast(`${ok} archivo(s) eliminado(s)`, 'success');
    else toast(`${ok} eliminados, ${fail} con error`, 'error');
    location.reload();
});

/* ── Load data from DOM (server-rendered initial) ────────── */
function collectInitialFiles() {
    allFiles = [];
    $$('.pw-card').forEach(card => {
        allFiles.push({
            id: card.dataset.id,
            titulo: card.dataset.titulo || '',
            url_archivo: card.dataset.url,
            tipo: card.dataset.tipo,
            carpeta_id: card.dataset.folder,
            thumbnail: card.dataset.thumbnail || '',
            is_gif: card.dataset.isGif === 'true',
        });
    });
}

/* ── Render grid ──────────────────────────────────────────── */
function renderGrid() {
    const empty = $('#archivo-empty');
    const sections = $$('.archivo-grid');

    if (filteredFiles.length === 0) {
        sections.forEach(s => {
            s.closest('.bm-section').style.display = 'none';
        });
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';

    const visibleFolderIds = new Set(filteredFiles.map(f => String(f.carpeta_id)));

    $$('.bm-section').forEach(section => {
        const folderId = section.dataset.section;
        if (!visibleFolderIds.has(folderId)) {
            section.style.display = 'none';
            return;
        }
        section.style.display = '';

        const grid = section.querySelector('.archivo-grid');
        const folderFiles = filteredFiles.filter(f => String(f.carpeta_id) === folderId);

        grid.innerHTML = folderFiles.map(f => `
            <article class="pw-card pw-card--${f.tipo}" data-id="${f.id}" data-folder="${f.carpeta_id}" data-url="${f.url_archivo}" data-tipo="${f.tipo}" data-titulo="${f.titulo}" tabindex="0">
                <div class="pw-check">
                    <i data-lucide="check" style="width:12px;height:12px"></i>
                </div>
                <div class="pw-card-thumb">
                    ${f.tipo === 'image' ? (() => {
                        const dbThumb = f.thumbnail || '';
                        if (dbThumb) {
                            const src = dbThumb.startsWith('data:') ? dbThumb : `data:image/webp;base64,${dbThumb}`;
                            return `<img src="${src}" alt="" loading="lazy" onerror="this.style.display='none'">`;
                        }
                        return '<div class="pw-card-noimg"><i data-lucide="image" style="width:32px;height:32px"></i></div>';
                    })() : ''}
                    ${f.tipo === 'video' ? `<video src="${f.url_archivo}" muted preload="none" playsinline></video>` : ''}
                    ${f.tipo === 'other' ? `<div class="pw-card-noimg"><i data-lucide="file" style="width:32px;height:32px"></i></div>` : ''}
                    ${f.tipo === 'video' ? '<i data-lucide="film" class="pw-card-badge-icon"></i>' :
                      f.tipo === 'image' ? '<i data-lucide="image" class="pw-card-badge-icon"></i>' :
                      '<i data-lucide="file" class="pw-card-badge-icon"></i>'}
                </div>
                <div class="pw-card-overlay">
                    <button class="pw-overlay-btn" title="Ver">
                        <i data-lucide="${f.tipo === 'video' ? 'film' : f.tipo === 'image' ? 'image' : 'file'}" style="width:14px;height:14px"></i> Ver
                    </button>
                </div>
                <div class="pw-card-actions">
                    <button class="pw-card-action" data-edit="${f.id}" title="Editar">
                        <i data-lucide="pencil" style="width:12px;height:12px"></i>
                    </button>
                    <button class="pw-card-action pw-card-action--danger" data-delete="${f.id}" title="Eliminar">
                        <i data-lucide="trash-2" style="width:12px;height:12px"></i>
                    </button>
                </div>
            </article>
        `).join('');

        const countBubble = section.querySelector('.count-bubble');
        if (countBubble) countBubble.textContent = folderFiles.length;

        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [grid] });
    });

    initVideoLazyLoad();
}

/* ── Lazy video loading ──────────────────────────────────── */
function initVideoLazyLoad() {
    if (!('IntersectionObserver' in window)) return;
    const videos = $$('.archivo-grid video[preload="none"]');
    if (!videos.length) return;
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) { e.target.preload = 'metadata'; obs.unobserve(e.target); }
        });
    }, { rootMargin: '200px' });
    videos.forEach(v => obs.observe(v));
}

/* ── Folder counts (updated after move/delete) ───────────── */
function updateFolderCounts() {
    $$('.bm-section').forEach(section => {
        const folderId = section.dataset.section;
        const count = section.querySelectorAll('.pw-card').length;
        const sidebarItem = $(`.sidebar-item[data-folder="${folderId}"]`);
        if (sidebarItem) {
            const bubble = sidebarItem.querySelector('.count-bubble');
            if (bubble) bubble.textContent = count;
        }
        const sectionBubble = section.querySelector('.count-bubble');
        if (sectionBubble) sectionBubble.textContent = count;
    });

    const totalCards = $$('.pw-card').length;
    const allBubble = $('.sidebar-item[data-folder="all"] .count-bubble');
    if (allBubble) allBubble.textContent = totalCards;
}

/* ── Lightbox ─────────────────────────────────────────────── */
const lightbox       = $('#archivo-lightbox');
const lbImg          = $('#archivo-lightbox-img');
const lbVideo        = $('#archivo-lightbox-video');
const lbLoading      = $('#archivo-lightbox-loading');
const lbTitle        = $('#archivo-lightbox-title');
const lbCounter      = $('#archivo-lightbox-counter');
const lbClose        = $('#archivo-lightbox-close');
const lbPrev         = $('#archivo-lightbox-prev');
const lbNext         = $('#archivo-lightbox-next');

function openLightbox(index) {
    if (index < 0 || index >= filteredFiles.length) return;
    lightboxIndex = index;
    lbImg.style.transform = '';
    lbImg.style.transition = '';
    lbImg.style.opacity = '';
    const f = filteredFiles[index];
    updateLightbox(f);
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.remove('is-open');
    lbImg.style.display = 'none';
    lbImg.style.transform = '';
    lbImg.style.transition = '';
    lbImg.style.opacity = '';
    lbVideo.style.display = 'none';
    lbVideo.pause();
    lbVideo.src = '';
    lbImg.src = '';
    document.body.style.overflow = '';
}

function updateLightbox(f) {
    lbTitle.textContent = f.titulo;
    lbCounter.textContent = `${lightboxIndex + 1} / ${filteredFiles.length}`;
    lbLoading.classList.remove('is-hidden');
    lbImg.style.transition = 'none';
    lbImg.style.transform = 'translateX(0)';
    lbImg.style.opacity = '0';

    if (f.tipo === 'image') {
        lbVideo.style.display = 'none';
        lbImg.style.display = 'none';
        lbImg.onload = () => { lbLoading.classList.add('is-hidden'); lbImg.style.display = 'block'; lbImg.style.opacity = '1'; };
        lbImg.src = f.url_archivo;
    } else if (f.tipo === 'video') {
        lbImg.style.display = 'none';
        lbVideo.style.display = 'block';
        lbVideo.src = f.url_archivo;
        lbVideo.onloadeddata = () => lbLoading.classList.add('is-hidden');
    } else {
        lbImg.style.display = 'none';
        lbVideo.style.display = 'none';
        lbLoading.classList.add('is-hidden');
    }
}

function navLightbox(dir) {
    const next = lightboxIndex + dir;
    if (next >= 0 && next < filteredFiles.length) openLightbox(next);
}

lbClose.addEventListener('click', closeLightbox);
lbPrev.addEventListener('click', () => navLightbox(-1));
lbNext.addEventListener('click', () => navLightbox(1));
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 'a' || e.key === 'A') {
        if (!lightbox.classList.contains('is-open')) { if (filteredFiles.length) openLightbox(0); }
        else navLightbox(-1);
        return;
    }
    if (e.key === 's' || e.key === 'S') {
        if (!lightbox.classList.contains('is-open')) { if (filteredFiles.length) openLightbox(0); }
        else navLightbox(1);
        return;
    }

    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navLightbox(-1);
    if (e.key === 'ArrowRight') navLightbox(1);
});

/* ── Touch swipe (mobile lightbox) ──────────────────────── */
let lbSwipeX = 0, lbSwipeStartY = 0, lbSwiping = false, lbDirectionLocked = false, lbIsHorizontal = false;

function getLbTarget() { return lbImg.style.display !== 'none' ? lbImg : lbVideo; }

lbImg.addEventListener('touchstart', e => {
    if (filteredFiles.length <= 1) return;
    const t = e.touches;
    lbSwipeX = t[0].clientX;
    lbSwipeStartY = t[0].clientY;
    lbSwiping = true;
    lbDirectionLocked = false;
    lbIsHorizontal = false;
    lbImg.style.transition = 'none';
}, { passive: true });

lbImg.addEventListener('touchmove', e => {
    if (!lbSwiping) return;
    const t = e.touches;
    const dx = t[0].clientX - lbSwipeX;
    const dy = t[0].clientY - lbSwipeStartY;

    if (!lbDirectionLocked) {
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            lbDirectionLocked = true;
            lbIsHorizontal = Math.abs(dx) > Math.abs(dy);
        }
        return;
    }
    if (!lbIsHorizontal) { lbSwiping = false; return; }

    e.preventDefault();
    const atStart = lightboxIndex === 0 && dx > 0;
    const atEnd = lightboxIndex === filteredFiles.length - 1 && dx < 0;
    const clamped = dx * (atStart || atEnd ? 0.3 : 1);
    lbImg.style.transform = `translateX(${clamped}px)`;
}, { passive: false });

lbImg.addEventListener('touchend', e => {
    if (!lbSwiping) return;
    lbSwiping = false;

    const dx = e.changedTouches[0].clientX - lbSwipeX;
    const threshold = 60;

    if (lbIsHorizontal && Math.abs(dx) >= threshold) {
        const dir = dx < 0 ? 1 : -1;
        const nextIdx = lightboxIndex + dir;
        if (nextIdx >= 0 && nextIdx < filteredFiles.length) {
            lbImg.style.transition = 'transform 0.25s ease';
            lbImg.style.transform = `translateX(${-dir * 300}px)`;
            lbImg.style.opacity = '0';
            setTimeout(() => { lbImg.style.opacity = '1'; navLightbox(dir); }, 250);
            return;
        }
    }
    lbImg.style.transition = 'transform 0.2s ease';
    lbImg.style.transform = 'translateX(0)';
});

/* ── Delegated click on grids ──────────────────────────────── */
document.addEventListener('click', e => {
    /* ── Select mode: toggle card ── */
    if (selectMode) {
        const card = e.target.closest('.pw-card');
        if (card) {
            e.preventDefault();
            e.stopPropagation();
            card.classList.toggle('is-selected');
            updateBulkBar();
        }
        return;
    }

    /* ── Action: edit card ── */
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) { e.stopPropagation(); openEditModal(editBtn.dataset.edit); return; }

    /* ── Action: delete card ── */
    const delBtn = e.target.closest('[data-delete]');
    if (delBtn) { e.stopPropagation(); openDelFileModal(delBtn.dataset.delete); return; }

    /* ── Card click → open lightbox ── */
    const card = e.target.closest('.pw-card');
    if (card) {
        const idx = filteredFiles.findIndex(f => String(f.id) === card.dataset.id);
        if (idx >= 0) openLightbox(idx);
        return;
    }

    /* ── Action: edit folder (sidebar) ── */
    const editFolder = e.target.closest('[data-edit-folder]');
    if (editFolder) { e.preventDefault(); e.stopPropagation(); openEditFolderModal(editFolder.dataset.editFolder, editFolder.dataset.nombre); return; }

    /* ── Action: delete folder (sidebar) ── */
    const delFolder = e.target.closest('[data-del-folder]');
    if (delFolder) { e.preventDefault(); e.stopPropagation();
        const sidebarItem = delFolder.closest('.sidebar-item');
        const nombre = sidebarItem ? sidebarItem.querySelector('.sidebar-item-name').textContent.trim() : 'esta carpeta';
        openDelFolderModal(delFolder.dataset.delFolder, nombre); return; }
});

/* ── Count badge ──────────────────────────────────────────── */
function updateCount() {
    const total = allFiles.length;
    const filtered = filteredFiles.length;
    $('#archivo-count').textContent = filtered === total ? `${total} archivos` : `${filtered} de ${total} archivos`;
    $('#archivo-empty').querySelector('p').textContent = filtered === 0 ? (allFiles.length === 0 ? 'No hay archivos' : 'Sin resultados') : '';
}

/* ── Modal Añadir ─────────────────────────────────────────── */
let selectedFiles = [];

function openModal() {
    selectedFiles = [];
    renderFileList();
    $('#archivo-file-input').value = '';
    $('#archivo-folder-parent-id').value = '';
    $('#archivo-folder-parent-select').value = '';
    $('#archivo-folder-nombre').value = '';
    $('#archivo-folder-nombre').placeholder = 'Ej: Imágenes';
    $('#archivo-modal-title').textContent = 'Añadir';
    $$('[data-tab]').forEach(t => t.classList.remove('is-active'));
    $('#archivo-tab-file').classList.add('is-active');
    $('#archivo-content-file').style.display = 'block';
    $('#archivo-content-url').style.display = 'none';
    $('#archivo-content-folder').style.display = 'none';
    if (currentFolder !== 'all') {
        const fileCarpeta = $('#archivo-file-carpeta');
        const urlCarpeta = $('#archivo-url-carpeta');
        const folderParent = $('#archivo-folder-parent-select');
        if (fileCarpeta) fileCarpeta.value = currentFolder;
        if (urlCarpeta) urlCarpeta.value = currentFolder;
        if (folderParent) folderParent.value = currentFolder;
    }
    openBackdrop('archivo-modal-backdrop');
}

function closeModal() {
    closeBackdrop('archivo-modal-backdrop');
    selectedFiles = [];
    renderFileList();
    $('#archivo-url-url').value = '';
    $('#archivo-url-titulo').value = '';
    $('#archivo-folder-nombre').value = '';
    $('#archivo-folder-parent-id').value = '';
    $('#archivo-folder-parent-select').value = '';
    $('#archivo-file-input').value = '';
}

$('#archivo-add-btn').addEventListener('click', openModal);
$('#archivo-gen-thumbs-btn').addEventListener('click', async () => {
    const btn = $('#archivo-gen-thumbs-btn');
    btn.disabled = true; btn.textContent = 'Generando…';
    const imagenes = allFiles.filter(f => f.tipo === 'image' && !f.thumbnail);
    let ok = 0;
    for (const f of imagenes) {
        try {
            const isGif = isGifUrl(f.url_archivo);
            const proxyUrl = getThumbUrl(f.url_archivo, 300, { firstFrame: isGif });
            const resp = await fetch(proxyUrl, { referrerPolicy: 'no-referrer' });
            const blob = await resp.blob();
            const reader = new FileReader();
            const base64 = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            await post(`/archivo/${f.id}/thumbnail/`, { thumbnail: base64 });
            f.thumbnail = base64;
            ok++;
        } catch (e) { console.error(e); }
    }
    btn.disabled = false; btn.innerHTML = '<i data-lucide="image-plus" style="width:13px;height:13px"></i><span>Miniaturas</span>';
    toast(`${ok} miniaturas generadas`, 'success');
    if (typeof lucide !== 'undefined') lucide.createIcons();
});
$('#archivo-modal-close').addEventListener('click', closeModal);
$('#archivo-modal-cancel').addEventListener('click', closeModal);
$('#archivo-modal-backdrop').addEventListener('click', e => { if (e.target === $('#archivo-modal-backdrop')) closeModal(); });

$$('#archivo-tab-file, #archivo-tab-url, #archivo-tab-folder').forEach(tab => {
    tab.addEventListener('click', () => {
        $$('[data-tab]').forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        const t = tab.dataset.tab;
        $('#archivo-content-file').style.display  = t === 'file' ? 'block' : 'none';
        $('#archivo-content-url').style.display   = t === 'url' ? 'block' : 'none';
        $('#archivo-content-folder').style.display = t === 'folder' ? 'block' : 'none';
        $('#archivo-modal-title').textContent = t === 'file' ? 'Subir archivo' : t === 'url' ? 'Subir por URL' : 'Nueva carpeta';
    });
});

/* Dropzone */
const dropzone    = $('#archivo-upload-dropzone');
const fileInput   = $('#archivo-file-input');
const fileListEl  = $('#archivo-upload-file-list');

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('is-dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('is-dragover'); addFiles(e.dataTransfer.files); });

fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });

function addFiles(fileList) {
    for (const f of fileList) {
        if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) { toast(`${f.name}: tipo no soportado`, 'error'); continue; }
        if (selectedFiles.some(s => s.name === f.name && s.size === f.size)) continue;
        selectedFiles.push(f);
    }
    renderFileList();
}

function renderFileList() {
    fileListEl.innerHTML = '';
    selectedFiles.forEach((f, i) => {
        const item = document.createElement('div');
        item.className = 'upload-file-item';
        item.dataset.filename = f.name;
        item.innerHTML = `<i data-lucide="check" class="upload-check" style="width:12px;height:12px"></i><span class="upload-file-item-name">${f.name}</span><span class="upload-file-item-size">${formatBytes(f.size)}</span><button class="upload-file-item-remove" data-idx="${i}" type="button" title="Quitar"><i data-lucide="x" style="width:12px;height:12px"></i></button>`;
        fileListEl.appendChild(item);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [fileListEl] });
    fileListEl.querySelectorAll('.upload-file-item-remove').forEach(btn => { btn.addEventListener('click', () => { selectedFiles.splice(parseInt(btn.dataset.idx, 10), 1); renderFileList(); }); });
}

/* Save modal */
$('#archivo-modal-save').addEventListener('click', async () => {
    const activeTab = $('#archivo-tab-folder').classList.contains('is-active') ? 'folder' : $('#archivo-tab-url').classList.contains('is-active') ? 'url' : 'file';

    if (activeTab === 'folder') {
        const nombre = $('#archivo-folder-nombre').value.trim();
        if (!nombre) return toast('Nombre requerido', 'error');
        const parentId = $('#archivo-folder-parent-select').value || $('#archivo-folder-parent-id').value;
        const payload = { nombre };
        if (parentId) payload.parent_id = parentId;
        const r = await post('/archivo/carpeta/crear/', payload);
        if (r.ok) { toast('Carpeta creada'); location.reload(); } else toast(r.error || 'Error', 'error');
        return;
    }

    if (activeTab === 'url') {
        const url = $('#archivo-url-url').value.trim();
        const titulo = $('#archivo-url-titulo').value.trim();
        const carpeta = $('#archivo-url-carpeta').value;
        if (!url || !carpeta) return toast('URL y carpeta requeridas', 'error');
        const r = await post('/archivo/upload-url/', { url, titulo, carpeta });
        if (r.ok) { toast('Archivo subido'); location.reload(); } else toast(r.error || 'Error al subir', 'error');
        return;
    }

    if (selectedFiles.length === 0) return toast('Selecciona al menos un archivo', 'error');
    const carpeta = $('#archivo-file-carpeta').value;
    if (!carpeta) return toast('Selecciona una carpeta', 'error');

    const btn = $('#archivo-modal-save');
    const progressEl = $('#archivo-upload-progress');
    const fillEl = $('#archivo-upload-fill');
    const textEl = $('#archivo-upload-progress-text');
    btn.disabled = true; btn.textContent = 'Subiendo…';
    progressEl.style.display = '';
    fillEl.style.width = '0%';
    textEl.textContent = `0 / ${selectedFiles.length}`;

    const MAX_CONCURRENT = 3; // tolera ~3-5 conexiones simultáneas
    let done = 0, ok = 0, fail = 0;
    const queue = [...selectedFiles];

    async function uploadOne(file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('carpeta', carpeta);
        fd.append('titulo', file.name);
        const item = fileListEl.querySelector(`.upload-file-item[data-filename="${CSS.escape(file.name)}"]`);
        try {
            const res = await fetch('/archivo/upload/', { method: 'POST', headers: { 'X-CSRFToken': csrf }, body: fd });
            const r = await res.json();
            if (r.ok) {
                ok++;
                allFiles.push({
                    id: r.id, titulo: r.titulo, url_archivo: r.url_archivo,
                    tipo: r.tipo, carpeta_id: String(r.carpeta_id), thumbnail: '',
                    is_gif: r.tipo === 'image' && /\.gif(?:v)?$/i.test(r.url_archivo),
                });
                if (item) item.classList.add('is-done');
            } else { fail++; if (item) item.classList.add('is-error'); }
        } catch { fail++; if (item) item.classList.add('is-error'); }
    }

    async function worker() {
        while (queue.length > 0) {
            const file = queue.shift();
            await uploadOne(file);
            done++;
            fillEl.style.width = Math.round(done / selectedFiles.length * 100) + '%';
            textEl.textContent = `${done} / ${selectedFiles.length}`;
        }
    }

    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, selectedFiles.length) }, () => worker()));

    btn.disabled = false; btn.textContent = 'Subir / Crear';
    progressEl.style.display = 'none';
    if (fail === 0) toast(`${ok} archivo(s) subido(s)`, 'success');
    else toast(`${ok} subidos, ${fail} con error`, 'error');
    if (ok > 0) {
        filteredFiles = searchInput.value.trim()
            ? allFiles.filter(f => f.titulo.toLowerCase().includes(searchInput.value.trim().toLowerCase()))
            : [...allFiles];
        applyFolderFilter();
        updateFolderCounts();
        updateCount();
        closeModal();
    }
});

/* ── Modal Editar ─────────────────────────────────────────── */
function openEditModal(id) {
    const f = allFiles.find(x => String(x.id) === String(id));
    if (!f) return;
    $('#archivo-edit-id').value = id;
    $('#archivo-edit-titulo').value = f.titulo;
    $('#archivo-edit-carpeta').value = f.carpeta_id;
    openBackdrop('archivo-edit-backdrop');
    setTimeout(() => $('#archivo-edit-titulo').focus(), 80);
}
function closeEditModal() { closeBackdrop('archivo-edit-backdrop'); }
bindClose('archivo-edit-backdrop', 'archivo-edit-close', 'archivo-edit-cancel');

$('#archivo-edit-save').addEventListener('click', async () => {
    const id = $('#archivo-edit-id').value;
    const titulo = $('#archivo-edit-titulo').value.trim();
    const carpeta = $('#archivo-edit-carpeta').value;
    if (!titulo) return toast('Título requerido', 'error');
    const r = await post(`/archivo/${id}/editar/`, { titulo, carpeta });
    if (r.ok) { toast('Archivo actualizado'); location.reload(); } else toast(r.error || 'Error al guardar', 'error');
});

/* ── Modal Eliminar archivo ───────────────────────────────── */
function openDelFileModal(id) {
    const f = allFiles.find(x => String(x.id) === String(id));
    if (!f) return;
    $('#archivo-del-file-id').value = id;
    $('#archivo-del-file-nombre').textContent = f.titulo;
    openBackdrop('archivo-del-file-backdrop');
}
function closeDelFileModal() { closeBackdrop('archivo-del-file-backdrop'); }
bindClose('archivo-del-file-backdrop', 'archivo-del-file-close', 'archivo-del-file-cancel');

$('#archivo-del-file-confirm').addEventListener('click', async () => {
    const id = $('#archivo-del-file-id').value;
    const btn = $('#archivo-del-file-confirm');
    btn.disabled = true;
    const r = await post(`/archivo/${id}/eliminar/`, {});
    btn.disabled = false;
    if (r.ok) { toast('Archivo eliminado'); location.reload(); } else { toast('Error al eliminar', 'error'); closeDelFileModal(); }
});

/* ── Modal Editar carpeta ────────────────────────────────── */
function openEditFolderModal(id, nombre) {
    $('#archivo-edit-folder-id').value = id;
    $('#archivo-edit-folder-nombre').value = nombre;
    const sidebarItem = document.querySelector(`.sidebar-folder[data-id="${id}"]`);
    const currentParent = sidebarItem ? (sidebarItem.dataset.parent || '') : '';
    const parentSelect = $('#archivo-edit-folder-parent');
    parentSelect.value = currentParent;
    const descendantIds = getDescendantIds(id);
    parentSelect.querySelectorAll('option').forEach(opt => {
        if (opt.value === id || descendantIds.includes(opt.value)) {
            opt.disabled = true;
        } else {
            opt.disabled = false;
        }
    });
    openBackdrop('archivo-edit-folder-backdrop');
    setTimeout(() => $('#archivo-edit-folder-nombre').focus(), 80);
}
function closeEditFolderModal() { closeBackdrop('archivo-edit-folder-backdrop'); }
bindClose('archivo-edit-folder-backdrop', 'archivo-edit-folder-close', 'archivo-edit-folder-cancel');

$('#archivo-edit-folder-save').addEventListener('click', async () => {
    const id = $('#archivo-edit-folder-id').value;
    const nombre = $('#archivo-edit-folder-nombre').value.trim();
    const parentId = $('#archivo-edit-folder-parent').value;
    if (!nombre) return toast('Nombre requerido', 'error');
    if (parentId === id) return toast('No puedes mover una carpeta dentro de sí misma', 'error');
    const btn = $('#archivo-edit-folder-save'); btn.disabled = true;
    const r = await post(`/archivo/carpeta/${id}/editar/`, { nombre, parent_id: parentId });
    btn.disabled = false;
    if (r.ok) { toast('Carpeta actualizada'); location.reload(); } else toast(r.error || 'Error al guardar', 'error');
});

/* ── Modal Eliminar carpeta ───────────────────────────────── */
function openDelFolderModal(id, nombre) {
    $('#archivo-del-folder-id').value = id;
    $('#archivo-del-folder-nombre').textContent = nombre;
    openBackdrop('archivo-del-folder-backdrop');
}
function closeDelFolderModal() { closeBackdrop('archivo-del-folder-backdrop'); }
bindClose('archivo-del-folder-backdrop', 'archivo-del-folder-close', 'archivo-del-folder-cancel');

$('#archivo-del-folder-confirm').addEventListener('click', async () => {
    const id = $('#archivo-del-folder-id').value;
    const btn = $('#archivo-del-folder-confirm'); btn.disabled = true;
    const r = await post(`/archivo/carpeta/${id}/eliminar/`, {});
    btn.disabled = false;
    if (r.ok) { toast('Carpeta eliminada'); location.reload(); } else { toast('Error al eliminar', 'error'); closeDelFolderModal(); }
});

/* ── Modal Crear sub-carpeta ──────────────────────────────── */
function openSubfolderModal(parentId, parentNombre) {
    $('#archivo-folder-parent-id').value = parentId;
    $('#archivo-folder-parent-select').value = parentId;
    $('#archivo-folder-nombre').value = '';
    $('#archivo-folder-nombre').placeholder = `Sub-carpeta en ${parentNombre}`;
    $$('[data-tab]').forEach(t => t.classList.remove('is-active'));
    $('#archivo-tab-folder').classList.add('is-active');
    $('#archivo-content-file').style.display = 'none';
    $('#archivo-content-url').style.display = 'none';
    $('#archivo-content-folder').style.display = 'block';
    $('#archivo-modal-title').textContent = 'Nueva sub-carpeta';
    openBackdrop('archivo-modal-backdrop');
    setTimeout(() => $('#archivo-folder-nombre').focus(), 80);
}

/* ── Keyboard shortcuts ───────────────────────────────────── */
document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchInput.focus(); }
    if (e.key === 'Escape') {
        if (selectMode) { exitSelectMode(); }
        else if (lightbox.classList.contains('is-open')) closeLightbox();
        else if (isMobile() && !sidebar.classList.contains('is-collapsed')) closeSidebar();
        else {
            closeModal(); closeEditModal(); closeDelFileModal();
            closeEditFolderModal(); closeDelFolderModal();
            closeBackdrop('archivo-bulk-move-backdrop');
            closeBackdrop('archivo-bulk-del-backdrop');
        }
    }
    if (selectMode && (e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        getVisibleCards().forEach(c => c.classList.add('is-selected'));
        updateBulkBar();
    }
});

/* ── Init ─────────────────────────────────────────────────── */

collectInitialFiles();

// Restore folder from localStorage
const savedFolder = localStorage.getItem('archivo_folder');
if (savedFolder) {
    currentFolder = savedFolder;
    $$('.sidebar-item').forEach(i => i.classList.remove('active'));
    const target = document.querySelector(`.sidebar-item[data-folder="${currentFolder}"]`);
    if (target) target.classList.add('active');
}

applyFolderFilter();
updateCount();

// Eliminar el preload para que todo sea visible
document.body.classList.remove('preload');