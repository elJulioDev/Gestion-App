/* marcadores.js */
const csrf = document.querySelector('[name=csrfmiddlewaretoken]').value;
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ── Toast ───────────────────────────────────────────────── */
function toast(msg, tipo = 'success') {
    const container = $('#toast-container');
    const el = document.createElement('div');
    el.className = `toast is-${tipo}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
        el.style.animation = 'toast-out 0.25s forwards';
        el.addEventListener('animationend', () => el.remove());
    }, 2200);
}

/* ── Fetch helper ────────────────────────────────────────── */
async function post(url, data) {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => fd.append(k, v));
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrf },
        body: fd,
    });
    return r.json();
}

/* ── Helpers abre/cierra backdrop ───────────────────────── */
function openBackdrop(id)  { document.getElementById(id).classList.add('is-open'); }
function closeBackdrop(id) { document.getElementById(id).classList.remove('is-open'); }

function bindClose(backdropId, ...btnIds) {
    const bd = document.getElementById(backdropId);
    btnIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => closeBackdrop(backdropId));
    });
    bd.addEventListener('click', e => { if (e.target === bd) closeBackdrop(backdropId); });
}

/* ══════════════════════════════════════════════════════════
   SIDEBAR TOGGLE (móvil)
   ══════════════════════════════════════════════════════════ */
const sidebar        = $('#sidebar');
const sidebarOverlay = $('#sidebar-overlay');
const sidebarToggle  = $('#sidebar-toggle');

function isMobile() { return window.innerWidth <= 768; }

function openSidebar() {
    sidebar.classList.remove('is-collapsed');
    sidebarOverlay.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    sidebar.classList.add('is-collapsed');
    sidebarOverlay.classList.remove('is-visible');
    document.body.style.overflow = '';
}

function toggleSidebar() {
    if (sidebar.classList.contains('is-collapsed')) {
        openSidebar();
    } else {
        closeSidebar();
    }
}

// Inicializar: en móvil el sidebar empieza cerrado
function initSidebarState() {
    if (isMobile()) {
        sidebar.classList.add('is-collapsed');
    } else {
        sidebar.classList.remove('is-collapsed');
        sidebarOverlay.classList.remove('is-visible');
        document.body.style.overflow = '';
    }
}

sidebarToggle.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// Cierra sidebar al cambiar tamaño de pantalla
window.addEventListener('resize', initSidebarState);
initSidebarState();

/* ══════════════════════════════════════════════════════════
   BÚSQUEDA MÓVIL
   ══════════════════════════════════════════════════════════ */
const mobileSearchBtn   = $('#mobile-search-btn');
const mobileSearchBar   = $('#mobile-search-bar');
const mobileSearchInput = $('#mobile-search-input');
const mobileSearchClose = $('#mobile-search-close');

function openMobileSearch() {
    mobileSearchBar.classList.add('is-open');
    setTimeout(() => mobileSearchInput.focus(), 120);
}

function closeMobileSearch() {
    mobileSearchBar.classList.remove('is-open');
    mobileSearchInput.value = '';
    // Limpiar filtro al cerrar
    triggerSearch('');
}

mobileSearchBtn.addEventListener('click', openMobileSearch);
mobileSearchClose.addEventListener('click', closeMobileSearch);

// Sincroniza búsqueda móvil con la lógica de filtrado
mobileSearchInput.addEventListener('input', e => {
    triggerSearch(e.target.value);
});

/* ── Filtro por carpeta ──────────────────────────────────── */
$$('.sidebar-item[data-folder]').forEach(item => {
    item.addEventListener('click', e => {
        if (e.target.closest('.sidebar-item-action')) return;
        $$('.sidebar-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const folder = item.dataset.folder;
        $$('.bm-section').forEach(s => {
            s.classList.toggle('is-hidden', folder !== 'all' && s.dataset.section !== folder);
        });

        // En móvil: cierra el sidebar al seleccionar carpeta
        if (isMobile()) closeSidebar();
    });
});

/* ── Búsqueda (función central) ─────────────────────────── */
function triggerSearch(q) {
    const query = q.toLowerCase().trim();
    let any = false;

    $$('.bm-card').forEach(card => {
        const titulo = card.querySelector('.bm-title');
        const match  = !query || (titulo && titulo.textContent.toLowerCase().includes(query));
        card.classList.toggle('is-hidden', !match);
        if (match) any = true;
    });

    $('#no-results').style.display = (query && !any) ? 'flex' : 'none';

    $$('.bm-section').forEach(s => {
        const visible = [...s.querySelectorAll('.bm-card')].some(c => !c.classList.contains('is-hidden'));
        s.classList.toggle('is-hidden', query && !visible);
    });
}

$('#search-input').addEventListener('input', e => {
    triggerSearch(e.target.value);
    // Sincroniza con búsqueda móvil
    mobileSearchInput.value = e.target.value;
});

/* ── Modal Añadir ────────────────────────────────────────── */
function openModal() { openBackdrop('modal-backdrop'); }
function closeModal() {
    closeBackdrop('modal-backdrop');
    $('#bm-titulo').value = '';
    $('#bm-url').value = '';
    $('#folder-nombre').value = '';
}

$('#add-btn').addEventListener('click', openModal);
$('#modal-close').addEventListener('click', closeModal);
$('#modal-cancel').addEventListener('click', closeModal);
$('#modal-backdrop').addEventListener('click', e => { if (e.target === $('#modal-backdrop')) closeModal(); });

/* ── Tabs del modal Añadir ───────────────────────────────── */
$$('[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
        $$('[data-tab]').forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        const isFolder = tab.dataset.tab === 'folder';
        $('#content-bm').style.display     = isFolder ? 'none' : 'block';
        $('#content-folder').style.display = isFolder ? 'block' : 'none';
        $('#modal-title').textContent = isFolder ? 'Nueva carpeta' : 'Nuevo marcador';
    });
});

/* ── Guardar (Añadir) ────────────────────────────────────── */
$('#modal-save').addEventListener('click', async () => {
    const isFolder = $('#tab-folder').classList.contains('is-active');

    if (isFolder) {
        const nombre = $('#folder-nombre').value.trim();
        if (!nombre) return toast('Nombre requerido', 'error');
        const r = await post('/marcadores/carpeta/crear/', { nombre });
        if (r.ok) { toast('Carpeta creada'); location.reload(); }
        else toast(r.error || 'Error', 'error');
    } else {
        const titulo  = $('#bm-titulo').value.trim();
        const url     = $('#bm-url').value.trim();
        const carpeta = $('#bm-carpeta').value;
        if (!titulo || !url || !carpeta) return toast('Datos incompletos', 'error');
        const r = await post('/marcadores/crear/', { titulo, url, carpeta });
        if (r.ok) { toast('Marcador guardado'); location.reload(); }
        else toast(r.error || 'Error', 'error');
    }
});

/* ══════════════════════════════════════════════════════════
   Modal Editar marcador
   ══════════════════════════════════════════════════════════ */
function openEditModal(btn) {
    $('#edit-id').value      = btn.dataset.editBm;
    $('#edit-titulo').value  = btn.dataset.titulo;
    $('#edit-url').value     = btn.dataset.url;
    $('#edit-carpeta').value = btn.dataset.carpeta;
    openBackdrop('edit-backdrop');
    setTimeout(() => $('#edit-titulo').focus(), 80);
}
function closeEditModal() { closeBackdrop('edit-backdrop'); }

bindClose('edit-backdrop', 'edit-close', 'edit-cancel');

$('#edit-save').addEventListener('click', async () => {
    const id      = $('#edit-id').value;
    const titulo  = $('#edit-titulo').value.trim();
    const url     = $('#edit-url').value.trim();
    const carpeta = $('#edit-carpeta').value;
    if (!titulo || !url || !carpeta) return toast('Datos incompletos', 'error');
    const r = await post(`/marcadores/${id}/editar/`, { titulo, url, carpeta });
    if (r.ok) { toast('Marcador actualizado'); location.reload(); }
    else toast(r.error || 'Error al guardar', 'error');
});

/* ══════════════════════════════════════════════════════════
   Modal Confirmar eliminar marcador
   ══════════════════════════════════════════════════════════ */
function openDelBmModal(id, titulo) {
    $('#del-bm-id').value         = id;
    $('#del-bm-nombre').textContent = titulo;
    openBackdrop('del-bm-backdrop');
}
function closeDelBmModal() { closeBackdrop('del-bm-backdrop'); }

bindClose('del-bm-backdrop', 'del-bm-close', 'del-bm-cancel');

$('#del-bm-confirm').addEventListener('click', async () => {
    const id = $('#del-bm-id').value;
    const btn = $('#del-bm-confirm');
    btn.disabled = true;
    const r = await post(`/marcadores/${id}/eliminar/`, {});
    btn.disabled = false;
    if (r.ok) { toast('Marcador eliminado'); location.reload(); }
    else { toast('Error al eliminar', 'error'); closeDelBmModal(); }
});

/* ══════════════════════════════════════════════════════════
   Modal Editar carpeta
   ══════════════════════════════════════════════════════════ */
function openEditFolderModal(id, nombre) {
    $('#edit-folder-id').value     = id;
    $('#edit-folder-nombre').value = nombre;
    openBackdrop('edit-folder-backdrop');
    setTimeout(() => $('#edit-folder-nombre').focus(), 80);
}
function closeEditFolderModal() { closeBackdrop('edit-folder-backdrop'); }

bindClose('edit-folder-backdrop', 'edit-folder-close', 'edit-folder-cancel');

$('#edit-folder-save').addEventListener('click', async () => {
    const id     = $('#edit-folder-id').value;
    const nombre = $('#edit-folder-nombre').value.trim();
    if (!nombre) return toast('Nombre requerido', 'error');
    const btn = $('#edit-folder-save');
    btn.disabled = true;
    const r = await post(`/marcadores/carpeta/${id}/editar/`, { nombre });
    btn.disabled = false;
    if (r.ok) { toast('Carpeta renombrada'); location.reload(); }
    else toast(r.error || 'Error al guardar', 'error');
});

/* ══════════════════════════════════════════════════════════
   Modal Confirmar eliminar carpeta
   ══════════════════════════════════════════════════════════ */
function openDelFolderModal(id, nombre) {
    $('#del-folder-id').value          = id;
    $('#del-folder-nombre').textContent = nombre;
    openBackdrop('del-folder-backdrop');
}
function closeDelFolderModal() { closeBackdrop('del-folder-backdrop'); }

bindClose('del-folder-backdrop', 'del-folder-close', 'del-folder-cancel');

$('#del-folder-confirm').addEventListener('click', async () => {
    const id  = $('#del-folder-id').value;
    const btn = $('#del-folder-confirm');
    btn.disabled = true;
    const r = await post(`/marcadores/carpeta/${id}/eliminar/`, {});
    btn.disabled = false;
    if (r.ok) { toast('Carpeta eliminada'); location.reload(); }
    else { toast('Error al eliminar', 'error'); closeDelFolderModal(); }
});

/* ══════════════════════════════════════════════════════════
   Delegado: editar + eliminar (marcadores y carpetas)
   ══════════════════════════════════════════════════════════ */
document.addEventListener('click', async e => {
    if (document.body.classList.contains('select-mode')) return;

    /* ── Editar marcador ── */
    const editBtn = e.target.closest('[data-edit-bm]');
    if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        openEditModal(editBtn);
        return;
    }

    /* ── Eliminar marcador ── */
    const delBm = e.target.closest('[data-del-bm]');
    if (delBm) {
        e.preventDefault();
        e.stopPropagation();
        openDelBmModal(delBm.dataset.delBm, delBm.dataset.titulo);
        return;
    }

    /* ── Editar carpeta ── */
    const editFolder = e.target.closest('[data-edit-folder]');
    if (editFolder) {
        e.preventDefault();
        e.stopPropagation();
        openEditFolderModal(editFolder.dataset.editFolder, editFolder.dataset.nombre);
        return;
    }

    /* ── Eliminar carpeta ── */
    const delFolder = e.target.closest('[data-del-folder]');
    if (delFolder) {
        e.preventDefault();
        e.stopPropagation();
        const sidebarItem = delFolder.closest('.sidebar-item');
        const nombre = sidebarItem
            ? sidebarItem.querySelector('.sidebar-item-name').textContent.trim()
            : 'esta carpeta';
        openDelFolderModal(delFolder.dataset.delFolder, nombre);
        return;
    }
});

/* ══════════════════════════════════════════════════════════
   MODO SELECCIÓN MÚLTIPLE
   ══════════════════════════════════════════════════════════ */
const selectModeBtn = $('#select-mode-btn');
const bulkBar       = $('#bulk-bar');
const bulkCount     = $('#bulk-count');
const bulkDeleteBtn = $('#bulk-delete-btn');
const bulkCancelBtn = $('#bulk-cancel-btn');
const bulkSelectAll = $('#bulk-select-all');

const bulkMoveBtn    = $('#bulk-move-btn');
const bulkMoveSelect = $('#bulk-move-select');

bindClose('bulk-move-backdrop', 'bulk-move-close', 'bulk-move-cancel');

bulkMoveBtn.addEventListener('click', () => {
    const selected = getSelectedCards();
    if (selected.length === 0) return;
    $('#bulk-move-count').textContent = selected.length;
    bulkMoveSelect.value = '';
    openBackdrop('bulk-move-backdrop');
});

$('#bulk-move-confirm').addEventListener('click', async () => {
    const selected = getSelectedCards();
    const carpetaId = bulkMoveSelect.value;
    if (!carpetaId) return toast('Selecciona una carpeta destino', 'error');

    const btn = $('#bulk-move-confirm');
    btn.disabled = true;
    btn.textContent = 'Moviendo…';

    let ok = 0, fail = 0;
    for (const card of selected) {
        try {
            const r = await post(`/marcadores/${card.dataset.id}/mover/`, { carpeta: carpetaId });
            r.ok ? ok++ : fail++;
        } catch { fail++; }
    }

    if (fail === 0) toast(`${ok} marcador(es) movido(s)`, 'success');
    else toast(`${ok} movidos, ${fail} con error`, 'error');
    location.reload();
});

let selectMode = false;

function getSelectedCards() { return [...$$('.bm-card.is-selected')]; }
function getVisibleCards() {
    return [...$$('.bm-card')].filter(card => {
        const section = card.closest('.bm-section');
        return !card.classList.contains('is-hidden')
            && (!section || !section.classList.contains('is-hidden'));
    });
}

function updateBulkBar() {
    const selected = getSelectedCards();
    const count = selected.length;
    bulkCount.textContent = count === 1 ? '1 seleccionado' : `${count} seleccionados`;
    bulkBar.classList.toggle('is-visible', count > 0);

    const visible = getVisibleCards();
    const allSelected = visible.length > 0 && visible.every(c => c.classList.contains('is-selected'));
    const span = bulkSelectAll.querySelector('span');
    if (span) span.textContent = allSelected ? 'Deseleccionar todo' : 'Seleccionar todo';
    bulkSelectAll.title = allSelected ? 'Deseleccionar todo' : 'Seleccionar todo';
}

function enterSelectMode() {
    selectMode = true;
    document.body.classList.add('select-mode');
    selectModeBtn.classList.add('is-active');
    selectModeBtn.title = 'Salir de selección';
}

function exitSelectMode() {
    selectMode = false;
    document.body.classList.remove('select-mode');
    selectModeBtn.classList.remove('is-active');
    selectModeBtn.title = 'Selección múltiple';
    $$('.bm-card.is-selected').forEach(c => c.classList.remove('is-selected'));
    bulkBar.classList.remove('is-visible');
}

selectModeBtn.addEventListener('click', () => {
    selectMode ? exitSelectMode() : enterSelectMode();
});

document.addEventListener('click', e => {
    if (!selectMode) return;
    const card = e.target.closest('.bm-card');
    if (!card) return;
    e.preventDefault();
    e.stopPropagation();
    card.classList.toggle('is-selected');
    updateBulkBar();
});

bulkSelectAll.addEventListener('click', () => {
    const visible = getVisibleCards();
    const allSelected = visible.every(c => c.classList.contains('is-selected'));
    visible.forEach(c => c.classList.toggle('is-selected', !allSelected));
    updateBulkBar();
});

bulkCancelBtn.addEventListener('click', exitSelectMode);

bindClose('bulk-del-backdrop', 'bulk-del-close', 'bulk-del-cancel');

bulkDeleteBtn.addEventListener('click', () => {
    const selected = getSelectedCards();
    if (selected.length === 0) return;
    const plural = selected.length === 1 ? '1 marcador' : `${selected.length} marcadores`;
    $('#bulk-del-count-text').textContent = plural;
    openBackdrop('bulk-del-backdrop');
});

$('#bulk-del-confirm').addEventListener('click', async () => {
    const selected = getSelectedCards();
    const btn = $('#bulk-del-confirm');
    btn.disabled = true;
    btn.querySelector('span') && (btn.querySelector('span').textContent = 'Eliminando…');

    let ok = 0, fail = 0;
    for (const card of selected) {
        try {
            const r = await post(`/marcadores/${card.dataset.id}/eliminar/`, {});
            r.ok ? ok++ : fail++;
        } catch { fail++; }
    }

    closeBackdrop('bulk-del-backdrop');
    if (fail === 0) toast(`${ok} marcador${ok !== 1 ? 'es' : ''} eliminado${ok !== 1 ? 's' : ''}`, 'success');
    else toast(`${ok} eliminados, ${fail} con error`, 'error');
    location.reload();
});

/* ── Atajos de teclado ───────────────────────────────────── */
document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isMobile()) {
            openMobileSearch();
        } else {
            $('#search-input').focus();
        }
    }
    if (e.key === 'Escape') {
        if (selectMode) {
            exitSelectMode();
        } else if (mobileSearchBar.classList.contains('is-open')) {
            closeMobileSearch();
        } else if (isMobile() && !sidebar.classList.contains('is-collapsed')) {
            closeSidebar();
        } else {
            closeModal();
            closeEditModal();
            closeDelBmModal();
            closeEditFolderModal();
            closeDelFolderModal();
        }
    }
    if (selectMode && (e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        getVisibleCards().forEach(c => c.classList.add('is-selected'));
        updateBulkBar();
    }
});

// Obtener patrón del proveedor desde el servidor (solo autenticados)
let VIDEO_EXT_RE = null;
fetch('/api/videos/provider-config/', {
    headers: { 'X-CSRFToken': csrf }
})
.then(r => r.json())
.then(data => {
    if (data.ok && data.url_pattern) {
        VIDEO_EXT_RE = new RegExp(data.url_pattern, 'i');
    }
})
.catch(() => {});

// Interceptar clic en cards de video reconocidos
document.addEventListener('click', e => {
    if (!VIDEO_EXT_RE) return;
    if (document.body.classList.contains('select-mode')) return;
    if (e.target.closest('.bm-action-btn')) return;

    const card = e.target.closest('.bm-card.is-video');
    if (!card) return;

    const match = VIDEO_EXT_RE.exec(card.href);
    if (!match) return;

    e.preventDefault();
    window.location.href = `/video/${match[1]}/`;
}, true);