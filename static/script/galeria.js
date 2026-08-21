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
let lbImages      = [];
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
            allPosts = allPosts.concat(posts);
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
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.28 5.22a.75.75 0 0 1 0 1.06l-2.22 2.22 2.22 2.22a.75.75 0 1 1-1.06 1.06L7.5 9.06l-2.72 2.72a.75.75 0 1 1-1.06-1.06l2.72-2.72-2.72-2.72a.75.75 0 0 1 1.06-1.06L7.5 6.94l2.22-2.22a.75.75 0 0 1 1.06 0z"/></svg>
                        Ver
                    </button>
                </div>
            </div>
            <div class="pw-card-body">
                <p class="pw-card-title">${title}</p>
                <div class="pw-card-meta">
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 0 1 4.75 0zM2.5 7.5v6.75c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V7.5zm0-4v2.5h11V3.75a.25.25 0 0 0-.25-.25H2.75a.25.25 0 0 0-.25.25z"/></svg>
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

    lbIndex = 0;
    renderLightbox();
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
}

function renderLightbox() {
    const img = lbImages[lbIndex];
    if (!img) return;
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
    if (e.key === 'Escape') {
        if (lightbox.classList.contains('is-open')) closeLightbox();
    }
    if (lightbox.classList.contains('is-open')) {
        if (e.key === 'ArrowLeft')  { if (lbIndex > 0) { lbIndex--; renderLightbox(); } }
        if (e.key === 'ArrowRight') { if (lbIndex < lbImages.length - 1) { lbIndex++; renderLightbox(); } }
    }
});

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast is-${type}`;
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => { t.style.animation = 'toast-out 0.3s forwards'; t.addEventListener('animationend', () => t.remove()); }, 3000);
}
