/* ════════════════════════════════════════════════════════════
   galeria.js — Galería de posts
   ════════════════════════════════════════════════════════════ */
'use strict';

const $ = id => document.getElementById(id);

// ── Refs ──────────────────────────────────────────────────────
const searchInput    = $('pw-search');
const clearBtn       = $('pw-clear');
const grid           = $('pw-grid');
const spinner        = $('pw-spinner');
const emptyState     = $('pw-empty');
const errorState     = $('pw-error');
const errorMsg       = $('pw-error-msg');
const loadMoreWrap   = $('pw-load-more');
const loadMoreBtn    = $('pw-load-more-btn');
const creatorName    = $('pw-creator-name');
const postCount      = $('pw-post-count');
const toastContainer = $('toast-container');

const lightbox       = $('pw-lightbox');
const lbClose        = $('pw-lightbox-close');
const lbPrev         = $('pw-lightbox-prev');
const lbNext         = $('pw-lightbox-next');
const lbImg          = $('pw-lightbox-img');
const lbTitle        = $('pw-lightbox-title');
const lbCounter      = $('pw-lightbox-counter');
const lbLoading      = $('pw-lightbox-loading');

// ── State ─────────────────────────────────────────────────────
let allPosts     = [];
let currentOffset = 0;
let currentQuery  = '';
let loading       = false;
let lbIndex       = -1;
let lbPostIndex   = -1;
let lbImages      = [];
let lbOpen        = false;
let lbSwipeTimer  = null;
const BATCH       = 50;

// ── Init ──────────────────────────────────────────────────────
loadProfile();
loadPosts(0);

// ── Profile ───────────────────────────────────────────────────
async function loadProfile() {
    try {
        const res = await fetch(PW_CONFIG.profileUrl);
        const data = await res.json();
        if (data.ok && data.profile) {
            creatorName.textContent = data.profile.name || PW_CONFIG.creatorId;
            document.title = `${data.profile.name || 'Pawchive'} — Gallery`;
        }
    } catch { /* silent */ }
}

// ── Posts ─────────────────────────────────────────────────────
async function loadPosts(offset, append = false) {
    if (loading) return;
    loading = true;

    if (!append) {
        setView('spinner');
        allPosts = [];
        currentOffset = 0;
    }
    loadMoreWrap.style.display = 'none';

    try {
        const params = new URLSearchParams({ o: offset });
        if (currentQuery) params.set('q', currentQuery);

        const res  = await fetch(`${PW_CONFIG.postsUrl}?${params}`);
        const data = await res.json();

        if (!data.ok) throw new Error(data.error || 'Error al cargar');

        const posts = data.posts || [];

        if (append) {
            allPosts.push(...posts);
        } else {
            allPosts = posts;
        }

        currentOffset = offset + BATCH;
        renderGrid(posts, append);
        postCount.textContent = `${allPosts.length} posts`;

        if (posts.length >= BATCH) {
            loadMoreWrap.style.display = '';
        }

    } catch (err) {
        if (!append) {
            errorMsg.textContent = err.message || 'Error al conectar';
            setView('error');
        }
    } finally {
        loading = false;
    }
}

// ── Render ────────────────────────────────────────────────────
function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatDate(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return iso; }
}

function renderGrid(posts, append) {
    if (!append) grid.innerHTML = '';

    if (!posts.length && !append) {
        emptyState.querySelector('p').textContent = 'Sin posts';
        setView('empty');
        return;
    }

    const html = posts.map(p => {
        const allImgs = [];
        if (p.file?.thumb) allImgs.push(p.file.thumb);
        (p.attachments || []).forEach(a => { if (a.thumb) allImgs.push(a.thumb); });

        const thumb = allImgs[0] || '';
        const title = escHtml(p.title || 'Sin título');
        const date  = formatDate(p.published || p.added);
        const total = allImgs.length;
        const badge = total > 1 ? `<span class="pw-card-badge">${total} imgs</span>` : '';

        return `
        <article class="pw-card" data-id="${escHtml(p.id)}" data-title="${title}">
            <div class="pw-card-thumb">
                ${thumb ? `<img src="${escHtml(thumb)}" alt="${title}" loading="lazy">` : `<div class="pw-card-noimg">Sin imagen</div>`}
                ${badge}
                <div class="pw-card-overlay">
                    <button class="pw-overlay-btn js-view">
                        <i data-lucide="image" style="width:13px;height:13px"></i>
                        Ver
                    </button>
                </div>
            </div>
            <div class="pw-card-body">
                <p class="pw-card-title">${title}</p>
                <div class="pw-card-meta">
                    <i data-lucide="calendar" style="width:11px;height:11px"></i>
                    <span>${date}</span>
                </div>
            </div>
        </article>`;
    }).join('');

    if (append) {
        grid.insertAdjacentHTML('beforeend', html);
    } else {
        grid.innerHTML = html;
    }
    setView('grid');
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [grid] });
}

function setView(s) {
    [emptyState, spinner, grid, errorState].forEach(el => el.style.display = 'none');
    if (s === 'empty')  emptyState.style.display = '';
    if (s === 'spinner') spinner.style.display   = '';
    if (s === 'grid')   grid.style.display       = '';
    if (s === 'error')  errorState.style.display  = '';
}

// ── Search ────────────────────────────────────────────────────
let debounceTimer = null;

searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim();
    clearBtn.style.display = val ? '' : 'none';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        currentQuery = val;
        loadPosts(0);
    }, 500);
});

clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    currentQuery = '';
    loadPosts(0);
});

// ── Load more ─────────────────────────────────────────────────
loadMoreBtn.addEventListener('click', () => loadPosts(currentOffset, true));

// ── Card click → lightbox ─────────────────────────────────────
grid.addEventListener('click', e => {
    const card = e.target.closest('.pw-card');
    if (!card) return;
    const idx = allPosts.findIndex(p => String(p.id) === card.dataset.id);
    if (idx >= 0) openLightbox(idx);
});

// ── Lightbox ──────────────────────────────────────────────────
function openLightbox(idx) {
    const post = allPosts[idx];
    if (!post) return;

    lbImages = [];
    if (post.file?.url || post.file?.thumb) {
        lbImages.push({ url: post.file.url || '', thumb: post.file.thumb || '', title: post.title || '' });
    }
    (post.attachments || []).forEach(a => {
        if (a.url || a.thumb) lbImages.push({ url: a.url || '', thumb: a.thumb || '', title: post.title || '' });
    });
    if (!lbImages.length) return;

    lbPostIndex = idx;
    lbIndex = 0;
    renderLightbox();
    lightbox.classList.add('is-open');
    lbOpen = true;
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.remove('is-open');
    lbOpen = false;
    document.body.style.overflow = '';
}

function renderLightbox() {
    const img = lbImages[lbIndex];
    if (!img) return;
    lbImg.style.transition = 'none';
    lbImg.style.transform = 'translateX(0)';
    lbLoading.classList.remove('is-hidden');
    lbImg.style.opacity = '0';
    lbImg.dataset.triedThumb = '';
    lbImg.src = img.url || img.thumb;
    lbImg.alt = img.title;
    lbTitle.textContent = img.title;
    lbCounter.textContent = `${lbIndex + 1} / ${lbImages.length}`;
    lbPrev.style.display = lbImages.length > 1 ? '' : 'none';
    lbNext.style.display = lbImages.length > 1 ? '' : 'none';
}

lbImg.addEventListener('load', () => {
    lbLoading.classList.add('is-hidden');
    lbImg.style.opacity = '1';
});
lbImg.addEventListener('error', () => {
    const img = lbImages[lbIndex];
    if (img && !lbImg.dataset.triedThumb && img.thumb && img.thumb !== img.url) {
        lbImg.dataset.triedThumb = '1';
        lbImg.src = img.thumb;
        return;
    }
    lbLoading.classList.add('is-hidden');
    lbImg.style.opacity = '1';
});

lbClose.addEventListener('click', closeLightbox);
lbPrev.addEventListener('click', () => { if (lbIndex > 0) { lbIndex--; renderLightbox(); } });
lbNext.addEventListener('click', () => { if (lbIndex < lbImages.length - 1) { lbIndex++; renderLightbox(); } });
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

// ── Keyboard ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
    }

    if (lbOpen) {
        const k = e.key.toLowerCase();
        if (k === 'escape') { closeLightbox(); return; }
        if (k === 'arrowleft' || k === 'a') { if (lbIndex > 0) { lbIndex--; renderLightbox(); } }
        if (k === 'arrowright' || k === 's') { if (lbIndex < lbImages.length - 1) { lbIndex++; renderLightbox(); } }
        if (k === 'z' && lbPostIndex > 0) { openLightbox(lbPostIndex - 1); }
        if (k === 'x' && lbPostIndex < allPosts.length - 1) { openLightbox(lbPostIndex + 1); }
    } else {
        if (e.key === 'Escape') closeLightbox();
    }
});

// ── Touch swipe (mobile) ──────────────────────────────────────
let lbSwipeX = 0;
let lbSwipeStartY = 0;
let lbSwiping = false;
let lbDirectionLocked = false;
let lbIsHorizontal = false;

lbImg.addEventListener('touchstart', e => {
    if (lbImages.length <= 1) return;
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
    const atStart = lbIndex === 0 && dx > 0;
    const atEnd = lbIndex === lbImages.length - 1 && dx < 0;
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
        const target = lbIndex + dir;
        if (target >= 0 && target < lbImages.length) {
            clearTimeout(lbSwipeTimer);
            lbImg.style.transition = 'transform 0.25s ease';
            lbImg.style.transform = `translateX(${-dir * 300}px)`;
            lbImg.style.opacity = '0';
            lbSwipeTimer = setTimeout(() => {
                lbIndex = target;
                renderLightbox();
            }, 250);
            return;
        }
    }

    lbImg.style.transition = 'transform 0.2s ease';
    lbImg.style.transform = 'translateX(0)';
});

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast is-${type}`;
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => { t.style.animation = 'toast-out 0.3s forwards'; t.addEventListener('animationend', () => t.remove()); }, 3000);
}
