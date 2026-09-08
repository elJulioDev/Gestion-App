/* ════════════════════════════════════════════════════════════
   video_browser.js — Categorías desde BD privada
   ════════════════════════════════════════════════════════════ */
'use strict';

const $ = id => document.getElementById(id);

// ── Refs ──────────────────────────────────────────────────────
const searchInput     = $('vb-search');
const clearBtn        = $('vb-clear');
const sortSelect      = $('vb-sort');
const grid            = $('vb-grid');
const spinner         = $('vb-spinner');
const emptyState      = $('vb-empty');
const errorState      = $('vb-error');
const errorMsg        = $('vb-error-msg');
const pagination      = $('vb-pagination');
const prevBtn         = $('vb-prev');
const nextBtn         = $('vb-next');
const pageInfo        = $('vb-page-info');
const toastContainer  = $('toast-container');

const sidebarEl       = $('vb-sidebar');
const sidebarToggle   = $('vb-sidebar-toggle');
const toggleCount     = $('toggle-count');
const overlay         = $('vb-overlay');
const catFilter       = $('vb-cat-filter');
const sidebarClearBtn = $('vb-sidebar-clear-btn');
const catLoading      = $('vb-cat-loading');
const catList         = $('vb-cat-list');

const activeBar       = $('vb-active-bar');
const activePills     = $('vb-active-pills');
const clearAllBtn     = $('vb-clear-all');

const addBackdrop     = $('add-modal-backdrop');
const addClose        = $('add-modal-close');
const addCancel       = $('add-modal-cancel');
const addConfirm      = $('add-modal-confirm');
const amTitulo        = $('am-titulo');
const amUrl           = $('am-url');
const amCarpeta       = $('am-carpeta');

// ── Estado ────────────────────────────────────────────────────
let activeTags    = new Set();
let currentQuery  = '';
let currentPage   = 1;
let totalPages    = 1;
let debounceTimer = null;
const PER_PAGE    = 24;

// ══════════════════════════════════════════════════════════════
// OPTIMIZACIÓN 1: Cache en memoria con TTL
// ══════════════════════════════════════════════════════════════
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const _cache = new Map();

function cacheKey(query, page, order) {
    return `${query}|${page}|${order}`;
}

function cacheGet(query, page, order) {
    const key = cacheKey(query, page, order);
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
    return entry.data;
}

function cacheSet(query, page, order, data) {
    // Limitar tamaño máximo del cache a 60 entradas
    if (_cache.size >= 60) {
        const oldest = _cache.keys().next().value;
        _cache.delete(oldest);
    }
    _cache.set(cacheKey(query, page, order), { ts: Date.now(), data });
}

// ══════════════════════════════════════════════════════════════
// OPTIMIZACIÓN 2: AbortController — cancela requests anteriores
// ══════════════════════════════════════════════════════════════
let _currentAbort = null;

function abortPrevious() {
    if (_currentAbort) { _currentAbort.abort(); _currentAbort = null; }
}

// ══════════════════════════════════════════════════════════════
// OPTIMIZACIÓN 3: Debounce al togglear categorías
// ══════════════════════════════════════════════════════════════
let _catDebounce = null;

function scheduleSearch() {
    clearTimeout(_catDebounce);
    _catDebounce = setTimeout(runSearch, 300);
}

// ── Prefetch próxima página (silencioso) ──────────────────────
function prefetchNextPage(query, page, order) {
    const next = page + 1;
    if (next > totalPages) return;
    if (cacheGet(query, next, order)) return; // ya está cacheado

    // Lanzar sin esperar, sin mostrar spinner, sin actualizar UI
    setTimeout(async () => {
        try {
            const params = new URLSearchParams({ q: query, page: next, per_page: PER_PAGE, order });
            const res  = await fetch(`${VB_CONFIG.searchUrl}?${params}`);
            const data = await res.json();
            if (data.ok) cacheSet(query, next, order, data);
        } catch { /* silencioso */ }
    }, 800); // espera 800ms para no solapar con el request activo
}

const ICON_PLUS  = `<i data-lucide="plus" style="width:10px;height:10px"></i>`;
const ICON_CHECK = `<i data-lucide="check" style="width:10px;height:10px"></i>`;

// ── Mobile ────────────────────────────────────────────────────
const isMobile = () => window.innerWidth <= 900;
let sidebarOpen = false;

function openSidebar()  { sidebarEl.classList.add('is-open'); overlay.classList.add('is-visible'); sidebarOpen = true; }
function closeSidebar() { sidebarEl.classList.remove('is-open'); overlay.classList.remove('is-visible'); sidebarOpen = false; }

sidebarToggle.addEventListener('click', () => {
    if (isMobile()) {
        sidebarOpen ? closeSidebar() : openSidebar();
    } else {
        sidebarEl.classList.toggle('is-collapsed');
    }
    sidebarToggle.classList.toggle('is-active', !sidebarEl.classList.contains('is-collapsed'));
});
overlay.addEventListener('click', closeSidebar);
window.addEventListener('resize', (() => { let r=false; return () => { if(r) return; r=true; requestAnimationFrame(()=>{ if(!isMobile()) closeSidebar(); updateActiveBarOffset(); r=false; }); }; })());

// ── Offset dinámico ───────────────────────────────────────────
function updateActiveBarOffset() {
    const h = activeBar.classList.contains('is-hidden') ? 0 : activeBar.offsetHeight;
    document.documentElement.style.setProperty('--active-bar-h', h + 'px');
}

// ── Cargar categorías desde endpoint privado ──────────────────
async function loadCategorias() {
    try {
        const res  = await fetch(VB_CONFIG.categoriasUrl);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Error');

        renderSidebar(data.categorias);
    } catch (err) {
        catLoading.innerHTML = `<span style="color:var(--red);font-size:12px;">Error al cargar categorías</span>`;
    }
}

function renderSidebar(categorias) {
    catLoading.style.display = 'none';
    catList.innerHTML = categorias.map(c => `
        <li class="vb-cat-item" data-tag="${escHtml(c.tag)}" data-label="${escHtml(c.nombre)}">
            <button class="vb-cat-add" tabindex="-1" aria-hidden="true">${ICON_PLUS}</button>
            <span class="vb-cat-name">${escHtml(c.nombre)}</span>
            <span class="vb-cat-count">${Number(c.conteo).toLocaleString('es-CL')}</span>
        </li>
    `).join('');
    catList.style.display = '';
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [catList] });
}

// ── Active tags ───────────────────────────────────────────────
function renderActiveTags() {
    const count = activeTags.size;

    activePills.innerHTML = '';
    activeTags.forEach(tag => {
        const pill = document.createElement('span');
        pill.className = 'vb-active-pill';
        pill.innerHTML = `${escHtml(tag)}<button title="Quitar" data-remove="${escHtml(tag)}">
            <i data-lucide="x" style="width:8px;height:8px"></i>
        </button>`;
        activePills.appendChild(pill);
    });

    activeBar.classList.toggle('is-hidden', count === 0);
    sidebarClearBtn.classList.toggle('is-visible', count > 0);
    toggleCount.textContent = count;
    sidebarToggle.classList.toggle('has-active', count > 0);

    document.querySelectorAll('.vb-cat-item').forEach(item => {
        const active = activeTags.has(item.dataset.tag);
        item.classList.toggle('is-active', active);
        const btn = item.querySelector('.vb-cat-add');
        if (btn) btn.innerHTML = active ? ICON_CHECK : ICON_PLUS;
    });

    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [activePills, catList] });
    setTimeout(updateActiveBarOffset, 50);
}

activePills.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    activeTags.delete(btn.dataset.remove);
    renderActiveTags();
    scheduleSearch(); // ← debounced
});

const clearAll = () => {
    clearTimeout(_catDebounce);
    abortPrevious();
    activeTags.clear();
    renderActiveTags();
    setView('empty');
    emptyState.querySelector('p').textContent = 'Selecciona una categoría del menú';
};
clearAllBtn.addEventListener('click', clearAll);
sidebarClearBtn.addEventListener('click', clearAll);

// ── Click en categoría (ahora con debounce) ───────────────────
document.addEventListener('click', e => {
    const item = e.target.closest('.vb-cat-item');
    if (!item) return;
    const tag = item.dataset.tag;
    activeTags.has(tag) ? activeTags.delete(tag) : activeTags.add(tag);
    renderActiveTags();
    searchInput.value = '';
    clearBtn.style.display = 'none';
    currentQuery = '';
    scheduleSearch(); // ← debounced: espera 300ms antes de disparar
    if (isMobile()) closeSidebar();
});

// ── Filtro sidebar ────────────────────────────────────────────
catFilter.addEventListener('input', () => {
    const q = catFilter.value.toLowerCase().trim();
    document.querySelectorAll('.vb-cat-item').forEach(item => {
        item.style.display = (!q || (item.dataset.label || '').toLowerCase().includes(q)) ? '' : 'none';
    });
});

// ── Búsqueda libre ────────────────────────────────────────────
searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim();
    clearBtn.style.display = val ? '' : 'none';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        currentQuery = val;
        if (val) fetchVideos(val, 1);
        else if (activeTags.size > 0) runSearch();
        else setView('empty');
    }, 500); // ligeramente aumentado de 420 a 500ms
});

clearBtn.addEventListener('click', () => {
    searchInput.value = ''; clearBtn.style.display = 'none'; currentQuery = '';
    if (activeTags.size > 0) runSearch();
    else { setView('empty'); emptyState.querySelector('p').textContent = 'Selecciona una categoría del menú'; }
});

sortSelect.addEventListener('change', () => { const q = buildQuery(); if (q) fetchVideos(q, 1); });

// ── Query ─────────────────────────────────────────────────────
function buildQuery() {
    if (currentQuery) return currentQuery;
    return [...activeTags].join(' ');
}

function runSearch() {
    const q = buildQuery();
    if (q) fetchVideos(q, 1);
    else setView('empty');
}

// ── Fetch videos (con cache + AbortController) ────────────────
async function fetchVideos(query, page = 1) {
    if (!query.trim()) { setView('empty'); return; }

    const order = sortSelect.value;

    // ── Hit de cache: sin request ─────────────────────────────
    const cached = cacheGet(query, page, order);
    if (cached) {
        currentPage = page;
        totalPages = cached.pages || 1;
        renderGrid(cached.videos || []);
        renderPagination(page, cached.count);
        if (page > 1) $('vb-main').scrollTop = 0;
        prefetchNextPage(query, page, order);
        return;
    }

    // ── Request real ──────────────────────────────────────────
    abortPrevious();
    _currentAbort = new AbortController();
    const signal = _currentAbort.signal;

    setView('spinner');
    currentPage = page;
    if (page > 1) $('vb-main').scrollTop = 0;

    try {
        const params = new URLSearchParams({ q: query, page, per_page: PER_PAGE, order });
        const res  = await fetch(`${VB_CONFIG.searchUrl}?${params}`, { signal });
        const data = await res.json();

        if (!data.ok) throw new Error(data.error || 'Error');

        totalPages = data.pages || Math.ceil((data.total || 0) / PER_PAGE) || 1;

        // Guardar en cache antes de renderizar
        cacheSet(query, page, order, data);

        renderGrid(data.videos || []);
        renderPagination(page, data.count);

        // Prefetch silencioso de página siguiente
        prefetchNextPage(query, page, order);

    } catch (err) {
        if (err.name === 'AbortError') return; // cancelado intencionalmente, ignorar
        errorMsg.textContent = err.message || 'Error al conectar';
        setView('error');
    } finally {
        _currentAbort = null;
    }
}

// ── Grid ──────────────────────────────────────────────────────
function formatViews(n) {
    const num = parseInt(n) || 0;
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000)     return (num / 1_000).toFixed(0) + 'k';
    return num.toString();
}
function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function renderGrid(videos) {
    if (!videos.length) { grid.innerHTML = ''; setView('empty'); emptyState.querySelector('p').textContent = 'Sin resultados'; return; }
    grid.innerHTML = videos.map(v => `
        <div class="vb-card" data-id="${escHtml(v.id)}" data-title="${escHtml(v.title)}" data-url="${escHtml(v.url)}">
            <div class="vb-card-thumb">
                <img src="${escHtml(v.thumb)}" alt="${escHtml(v.title)}" loading="lazy">
                <span class="vb-card-duration">${escHtml(v.duration)}</span>
                <div class="vb-card-overlay">
                    <button class="vb-overlay-btn js-play">
                        <i data-lucide="play" style="width:13px;height:13px"></i>
                        Ver
                    </button>
                    <button class="vb-overlay-btn is-save js-save">
                        <i data-lucide="plus" style="width:13px;height:13px"></i>
                        Guardar
                    </button>
                </div>
            </div>
            <div class="vb-card-body">
                <p class="vb-card-title">${escHtml(v.title)}</p>
                <div class="vb-card-meta">
                    <i data-lucide="eye" style="width:11px;height:11px"></i>
                    <span>${formatViews(v.views)} vistas</span>
                </div>
            </div>
        </div>
    `).join('');
    setView('grid');
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [grid] });
}
function setView(s) {
    [emptyState, spinner, grid, errorState, pagination].forEach(el => el.style.display = 'none');
    if (s === 'empty')   emptyState.style.display  = '';
    if (s === 'spinner') spinner.style.display      = '';
    if (s === 'grid')    grid.style.display         = '';
    if (s === 'error')   errorState.style.display   = '';
}

// ── Paginación ────────────────────────────────────────────────
function renderPagination(page, count) {
    if (totalPages <= 1 && count < PER_PAGE) { pagination.style.display = 'none'; return; }
    pageInfo.textContent = `Pág. ${page} / ${totalPages}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;
    pagination.style.display = '';
}
prevBtn.addEventListener('click', () => { if (currentPage > 1) fetchVideos(buildQuery(), currentPage - 1); });
nextBtn.addEventListener('click', () => { if (currentPage < totalPages) fetchVideos(buildQuery(), currentPage + 1); });

// ── Delegado cards ────────────────────────────────────────────
document.addEventListener('click', e => {
    const card = e.target.closest('.vb-card');
    if (!card) return;
    const { id, url, title } = card.dataset;
    if (e.target.closest('.js-save')) { e.stopPropagation(); openAddModal(title, url); return; }
    if (e.target.closest('.js-play') || e.target.closest('.vb-card-thumb')) { e.preventDefault(); if (id) window.location.href = `/video/${id}/`; }
});

// ── Modal ─────────────────────────────────────────────────────
function openAddModal(title, url) {
    amTitulo.value = title; amUrl.value = url;
    if (VB_CONFIG.carpetas?.length) {
        amCarpeta.innerHTML = '<option value="" disabled selected>Selecciona una carpeta…</option>';
        VB_CONFIG.carpetas.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.nombre; amCarpeta.appendChild(o); });
    }
    addBackdrop.classList.add('is-open');
    setTimeout(() => amTitulo.select(), 80);
}
function closeAddModal() { addBackdrop.classList.remove('is-open'); }
addClose.addEventListener('click', closeAddModal);
addCancel.addEventListener('click', closeAddModal);
addBackdrop.addEventListener('click', e => { if (e.target === addBackdrop) closeAddModal(); });
addConfirm.addEventListener('click', async () => {
    const titulo = amTitulo.value.trim(), url = amUrl.value.trim(), carpeta = amCarpeta.value;
    if (!titulo || !url) { toast('Completa título y URL', 'error'); return; }
    if (!carpeta)        { toast('Selecciona una carpeta', 'error'); return; }
    addConfirm.disabled = true; addConfirm.textContent = 'Guardando…';
    try {
        const res  = await fetch(VB_CONFIG.addUrl, { method: 'POST', headers: { 'X-CSRFToken': VB_CONFIG.csrfToken, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ titulo, url, carpeta }) });
        const data = await res.json();
        if (data.ok) { toast('Marcador guardado ✓', 'success'); closeAddModal(); }
        else toast(data.error || 'Error al guardar', 'error');
    } catch { toast('Error de red', 'error'); }
    finally { addConfirm.disabled = false; addConfirm.textContent = 'Guardar'; }
});

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast is-${type}`; t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => { t.style.animation = 'toast-out 0.3s forwards'; t.addEventListener('animationend', () => t.remove()); }, 3000);
}

// ── Teclado ───────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchInput.focus(); searchInput.select(); }
    if (e.key === 'Escape') {
        if (addBackdrop.classList.contains('is-open')) closeAddModal();
        else if (isMobile() && sidebarOpen) closeSidebar();
    }
});

// ── Init ──────────────────────────────────────────────────────
loadCategorias();
renderActiveTags();
updateActiveBarOffset();