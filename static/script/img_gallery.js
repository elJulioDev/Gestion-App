/* ════════════════════════════════════════════════════════════
   img_gallery.js — Galería de posts (images/gifs/videos)
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
const lbVideo        = $('pw-lightbox-video');
const lbTitle        = $('pw-lightbox-title');
const lbCounter      = $('pw-lightbox-counter');
const lbLoading      = $('pw-lightbox-loading');

// ── Media type detection ──────────────────────────────────────
const VIDEO_EXT = /\.(mp4|webm|mkv)$/i;
const GIF_EXT   = /\.gif$/i;

function classifyPost(p) {
    const url = p.file_url || '';
    if (VIDEO_EXT.test(url)) return 'video';
    if (GIF_EXT.test(url))   return 'gif';
    return 'image';
}

// ── State ─────────────────────────────────────────────────────
let allPosts     = [];
let currentPid   = 0;
let currentQuery = '';
let loading      = false;
let lbIndex      = -1;
let lbOpen       = false;
let lbSwipeTimer = null;
const BATCH      = 42;

// ── Init ──────────────────────────────────────────────────────
document.title = `${PW_CONFIG.artistName}`;
loadPosts(0);

// ── Sidebar toggle ──────────────────────────────────────────
const pwSidebar        = document.getElementById('pw-folder-sidebar');
const pwSidebarOverlay = document.getElementById('pw-sidebar-overlay');
const pwSidebarToggle  = document.getElementById('pw-sidebar-toggle');

function pwIsMobile() { return window.innerWidth <= 768; }

function pwOpenSidebar() {
    if (!pwSidebar) return;
    pwSidebar.classList.remove('is-collapsed');
    if (pwSidebarOverlay) pwSidebarOverlay.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
}

function pwCloseSidebar() {
    if (!pwSidebar) return;
    pwSidebar.classList.add('is-collapsed');
    if (pwSidebarOverlay) pwSidebarOverlay.classList.remove('is-visible');
    document.body.style.overflow = '';
}

if (pwSidebar && pwIsMobile()) pwSidebar.classList.add('is-collapsed');

if (pwSidebarToggle) {
    pwSidebarToggle.addEventListener('click', () => {
        if (pwSidebar.classList.contains('is-collapsed')) pwOpenSidebar();
        else pwCloseSidebar();
    });
}
if (pwSidebarOverlay) {
    pwSidebarOverlay.addEventListener('click', pwCloseSidebar);
}
window.addEventListener('resize', () => {
    if (!pwIsMobile() && pwSidebar) {
        pwSidebar.classList.remove('is-collapsed');
        if (pwSidebarOverlay) pwSidebarOverlay.classList.remove('is-visible');
        document.body.style.overflow = '';
    }
});

// ── Posts ─────────────────────────────────────────────────────
async function loadPosts(pid, append = false) {
    if (loading) return;
    loading = true;

    if (!append) {
        setView('spinner');
        allPosts = [];
        currentPid = 0;
    }
    loadMoreWrap.style.display = 'none';

    try {
        let tags = PW_CONFIG.tag;
        if (currentQuery) tags += ` ${currentQuery}`;

        const params = new URLSearchParams({ tags, pid, limit: BATCH });
        const res  = await fetch(`${PW_CONFIG.searchUrl}?${params}`);
        const text = await res.text();

        if (!text.trim()) throw new Error('Respuesta vacía del servidor');

        let data;
        try { data = JSON.parse(text); }
        catch { throw new Error('Respuesta no válida del servidor'); }

        if (!data.ok) throw new Error(data.error || 'Error al cargar');

        const posts = (data.posts || []).map(p => ({ ...p, _type: classifyPost(p) }));

        if (append) {
            allPosts.push(...posts);
        } else {
            allPosts = posts;
        }

        currentPid = pid + 1;
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

// ── Render grid ───────────────────────────────────────────────
function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function typeIcon(type) {
    if (type === 'video') return '<i data-lucide="film" style="width:13px;height:13px"></i>';
    if (type === 'gif')   return '<i data-lucide="sparkles" style="width:13px;height:13px"></i>';
    return '<i data-lucide="image" style="width:13px;height:13px"></i>';
}

function renderGrid(posts, append) {
    if (!append) grid.innerHTML = '';

    if (!posts.length && !append) {
        emptyState.querySelector('p').textContent = 'Sin posts';
        setView('empty');
        return;
    }

    const html = posts.map(p => {
        const thumb = p.preview_url || p.sample_url || p.file_url || '';
        const badge = p._type === 'video'
            ? '<i data-lucide="film" class="pw-card-badge-icon"></i>'
            : p._type === 'gif'
            ? '<i data-lucide="sparkles" class="pw-card-badge-icon"></i>'
            : '';

        return `
        <article class="pw-card" data-id="${escHtml(p.id)}" data-idx="${allPosts.indexOf(p)}">
            <div class="pw-card-thumb">
                ${thumb ? `<img src="${escHtml(thumb)}" alt="Post ${escHtml(p.id)}" loading="lazy">` : `<div class="pw-card-noimg">Sin preview</div>`}
                ${badge}
                <div class="pw-card-overlay">
                    <button class="pw-overlay-btn js-view">
                        ${typeIcon(p._type)}
                        Ver
                    </button>
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

// ── Infinite scroll ────────────────────────────────────────────
const scrollObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !loading) loadPosts(currentPid, true);
}, { rootMargin: '400px' });
scrollObserver.observe(loadMoreWrap);

// ── Card click → lightbox ─────────────────────────────────────
grid.addEventListener('click', e => {
    const card = e.target.closest('.pw-card');
    if (!card) return;
    const idx = parseInt(card.dataset.idx, 10);
    if (!isNaN(idx)) openLightbox(idx);
});

// ── Lightbox ──────────────────────────────────────────────────
function openLightbox(idx) {
    const post = allPosts[idx];
    if (!post) return;

    lbIndex = idx;
    renderLightbox();
    lightbox.classList.add('is-open');
    lbOpen = true;
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.remove('is-open');
    lbOpen = false;
    document.body.style.overflow = '';
    lbImg.src = '';
    lbImg.style.display = 'none';
    lbVideo.pause();
    lbVideo.src = '';
    lbVideo.style.display = 'none';
}

function renderLightbox() {
    const post = allPosts[lbIndex];
    if (!post) return;

    const isVideo = post._type === 'video';
    const src = post.file_url || post.sample_url || '';

    lbLoading.classList.remove('is-hidden');
    lbTitle.textContent = `Score: ${post.score || 0} | ${post.rating || ''} | ${post._type}`;
    lbCounter.textContent = `${lbIndex + 1} / ${allPosts.length}`;
    lbPrev.style.display = allPosts.length > 1 ? '' : 'none';
    lbNext.style.display = allPosts.length > 1 ? '' : 'none';

    if (isVideo) {
        lbImg.style.display = 'none';
        lbImg.src = '';
        lbVideo.style.display = 'block';
        lbVideo.src = src;
        lbVideo.load();
        lbVideo.onloadeddata = () => {
            lbLoading.classList.add('is-hidden');
            lbVideo.play().catch(() => {});
        };
        lbVideo.onerror = () => {
            if (post.sample_url && lbVideo.src !== post.sample_url) {
                lbVideo.src = post.sample_url;
                lbVideo.load();
                return;
            }
            lbLoading.classList.add('is-hidden');
        };
    } else {
        lbVideo.style.display = 'none';
        lbVideo.pause();
        lbVideo.src = '';
        lbImg.style.display = 'block';
        lbImg.style.transition = 'none';
        lbImg.style.transform = 'translateX(0)';
        lbImg.style.opacity = '0';
        lbImg.dataset.triedSample = '';
        lbImg.dataset.triedThumb = '';
        lbImg.src = src;
        lbImg.alt = `Post ${post.id}`;
    }
}

lbImg.addEventListener('load', () => {
    lbLoading.classList.add('is-hidden');
    lbImg.style.opacity = '1';
});
lbImg.addEventListener('error', () => {
    const post = allPosts[lbIndex];
    if (post && !lbImg.dataset.triedSample && post.sample_url && lbImg.src !== post.sample_url) {
        lbImg.dataset.triedSample = '1';
        lbImg.src = post.sample_url;
        return;
    }
    if (post && !lbImg.dataset.triedThumb && post.preview_url && lbImg.src !== post.preview_url) {
        lbImg.dataset.triedThumb = '1';
        lbImg.src = post.preview_url;
        return;
    }
    lbLoading.classList.add('is-hidden');
    lbImg.style.opacity = '1';
});

function navigateLightbox(dir) {
    const post = allPosts[lbIndex];
    if (post && post._type === 'video') {
        lbVideo.pause();
        lbVideo.src = '';
        lbVideo.style.display = 'none';
    }
    lbImg.src = '';
    lbImg.style.display = 'none';

    if (dir > 0 && lbIndex < allPosts.length - 1) lbIndex++;
    else if (dir < 0 && lbIndex > 0) lbIndex--;
    renderLightbox();
}

lbClose.addEventListener('click', closeLightbox);
lbPrev.addEventListener('click', () => navigateLightbox(-1));
lbNext.addEventListener('click', () => navigateLightbox(1));
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

// ── Keyboard ──────────────────────────────────────────────────
document.addEventListener('keydown', async e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
    }

    if (lbOpen) {
        const k = e.key.toLowerCase();
        if (k === 'escape') { closeLightbox(); return; }
        if (k === 'arrowleft' || k === 'a') navigateLightbox(-1);
        if (k === 'arrowright' || k === 's') {
            if (lbIndex < allPosts.length - 1) navigateLightbox(1);
            else {
                const before = allPosts.length;
                await loadPosts(currentPid, true);
                if (allPosts.length > before) navigateLightbox(1);
            }
        }
        if (e.key === ' ') {
            const post = allPosts[lbIndex];
            if (post && post._type === 'video') {
                e.preventDefault();
                lbVideo.paused ? lbVideo.play() : lbVideo.pause();
            }
        }
    } else {
        if (e.key === 'Escape') closeLightbox();
        if (e.key.toLowerCase() === 'a' && allPosts.length) openLightbox(0);
    }
});

// ── Touch swipe (mobile) ──────────────────────────────────────
let lbSwipeX = 0;
let lbSwipeStartY = 0;
let lbSwiping = false;
let lbDirectionLocked = false;
let lbIsHorizontal = false;

const lbContent = $('pw-lightbox-content');

lbContent.addEventListener('touchstart', e => {
    if (allPosts.length <= 1) return;
    const t = e.touches;
    lbSwipeX = t[0].clientX;
    lbSwipeStartY = t[0].clientY;
    lbSwiping = true;
    lbDirectionLocked = false;
    lbIsHorizontal = false;
}, { passive: true });

lbContent.addEventListener('touchmove', e => {
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
    const atEnd = lbIndex === allPosts.length - 1 && dx < 0;
    const clamped = dx * (atStart || atEnd ? 0.3 : 1);
    const target = lbImg.style.display !== 'none' ? lbImg : lbVideo;
    target.style.transition = 'none';
    target.style.transform = `translateX(${clamped}px)`;
}, { passive: false });

lbContent.addEventListener('touchend', e => {
    if (!lbSwiping) return;
    lbSwiping = false;

    const dx = e.changedTouches[0].clientX - lbSwipeX;
    const threshold = 60;
    const target = lbImg.style.display !== 'none' ? lbImg : lbVideo;

    if (lbIsHorizontal && Math.abs(dx) >= threshold) {
        const dir = dx < 0 ? 1 : -1;
        const nextIdx = lbIndex + dir;
        if (nextIdx >= 0 && nextIdx < allPosts.length) {
            clearTimeout(lbSwipeTimer);
            target.style.transition = 'transform 0.25s ease';
            target.style.transform = `translateX(${-dir * 300}px)`;
            target.style.opacity = '0';
            lbSwipeTimer = setTimeout(() => {
                target.style.opacity = '1';
                navigateLightbox(dir);
            }, 250);
            return;
        }
    }

    target.style.transition = 'transform 0.2s ease';
    target.style.transform = 'translateX(0)';
});

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast is-${type}`;
    t.textContent = msg;
    toastContainer.appendChild(t);
    setTimeout(() => { t.style.animation = 'toast-out 0.3s forwards'; t.addEventListener('animationend', () => t.remove()); }, 3000);
}
