import json
import mimetypes
import threading
import requests as http_requests
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_http_methods
from django.db.models import Count, Q
from ..models import CarpetaArchivo, Archivo, ArchivoConfig

_PROXY_SKIP_DOMAINS = {'files.catbox.moe', 'catbox.moe'}

def _wsrv_thumb_url(url, width=300, is_gif=False):
    from urllib.parse import urlparse
    host = urlparse(url).hostname or ''
    if host in _PROXY_SKIP_DOMAINS or any(host.endswith('.' + d) for d in _PROXY_SKIP_DOMAINS):
        return url
    clean = url.replace('https://', '').replace('http://', '')
    params = {'url': clean, 'w': width, 'output': 'webp', 'q': '50'}
    if is_gif:
        params['n'] = '1'
    return 'https://wsrv.nl/?' + '&'.join(f'{k}={v}' for k, v in params.items())

_IMAGE_EXTS = {'.jpg', '.jpeg', '.jfif', '.png', '.gif', '.webp', '.bmp', '.svg'}
_VIDEO_EXTS = {'.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'}


def _detectar_tipo(filename):
    ext = '.' + filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext in _IMAGE_EXTS:
        return 'image'
    if ext in _VIDEO_EXTS:
        return 'video'
    return 'other'


@login_required(login_url='gestion:login')
def archivo_view(request):
    carpetas_qs = CarpetaArchivo.objects.filter(usuario=request.user).select_related('parent').order_by('orden', 'nombre').annotate(
        total=Count('archivos')
    )
    archivos = Archivo.objects.filter(usuario=request.user).select_related('carpeta').order_by('orden', 'titulo')
    total = archivos.count()

    for a in archivos:
        is_gif = a.url_archivo.lower().endswith(('.gif', '.gifv'))
        a.thumbnail_url = (f'data:image/webp;base64,{a.thumbnail_base64}' if a.thumbnail_base64 else '') or _wsrv_thumb_url(a.url_archivo, 300, is_gif)
        a.is_gif = is_gif

    from collections import defaultdict
    archivos_por_carpeta = defaultdict(list)
    for a in archivos:
        archivos_por_carpeta[a.carpeta_id].append(a)

    def build_tree(parent=None):
        items = []
        for c in carpetas_qs.filter(parent=parent):
            descendants = c.get_descendants()
            descendant_ids = [d.id for d in descendants] + [c.id]
            file_count = Archivo.objects.filter(carpeta_id__in=descendant_ids, usuario=request.user).count()
            children = build_tree(parent=c)
            items.append({
                'id': c.id,
                'nombre': c.nombre,
                'nivel': c.nivel,
                'total': file_count,
                'parent_id': c.parent_id,
                'children': children,
            })
        return items

    tree = build_tree()

    flat_tree = []
    def flatten_tree(items):
        for item in items:
            flat_tree.append(item)
            flatten_tree(item['children'])
    flatten_tree(tree)

    return render(request, 'gestion/archivo.html', {
        'carpetas': carpetas_qs,
        'carpetas_tree_json': json.dumps(tree, default=str),
        'carpetas_flat': flat_tree,
        'archivos_por_carpeta': dict(archivos_por_carpeta),
        'total': total,
    })


@login_required(login_url='gestion:login')
@require_POST
def crear_carpeta(request):
    nombre = (request.POST.get('nombre') or '').strip()
    parent_id = request.POST.get('parent_id')
    if not nombre:
        return JsonResponse({'ok': False, 'error': 'Nombre requerido'}, status=400)
    parent = None
    nivel = 0
    if parent_id:
        parent = get_object_or_404(CarpetaArchivo, pk=parent_id, usuario=request.user)
        nivel = parent.nivel + 1
    if CarpetaArchivo.objects.filter(usuario=request.user, nombre__iexact=nombre, parent=parent).exists():
        return JsonResponse({'ok': False, 'error': 'Ya existe'}, status=400)
    c = CarpetaArchivo.objects.create(usuario=request.user, nombre=nombre, parent=parent, nivel=nivel, orden=-1)
    return JsonResponse({'ok': True, 'id': c.id, 'nombre': c.nombre, 'nivel': c.nivel})


@login_required(login_url='gestion:login')
@require_POST
def editar_carpeta(request, pk):
    c = get_object_or_404(CarpetaArchivo, pk=pk, usuario=request.user)
    nombre = (request.POST.get('nombre') or '').strip()
    parent_id = request.POST.get('parent_id')
    if not nombre:
        return JsonResponse({'ok': False, 'error': 'Nombre requerido'}, status=400)

    new_parent = None
    new_nivel = 0
    if parent_id:
        new_parent = get_object_or_404(CarpetaArchivo, pk=parent_id, usuario=request.user)
        if new_parent.pk == c.pk:
            return JsonResponse({'ok': False, 'error': 'No puedes mover una carpeta dentro de sí misma'}, status=400)
        if new_parent.pk in [d.pk for d in c.get_descendants()]:
            return JsonResponse({'ok': False, 'error': 'No puedes mover una carpeta dentro de una de sus sub-carpetas'}, status=400)
        new_nivel = new_parent.nivel + 1

    if CarpetaArchivo.objects.filter(usuario=request.user, nombre__iexact=nombre, parent=new_parent).exclude(pk=pk).exists():
        return JsonResponse({'ok': False, 'error': 'Ya existe una carpeta con ese nombre en ese nivel'}, status=400)

    c.nombre = nombre
    c.parent = new_parent
    c.nivel = new_nivel
    c.save()

    def update_nivel_descendants(folder):
        for h in folder.hijas.all():
            h.nivel = folder.nivel + 1
            h.save(update_fields=['nivel'])
            update_nivel_descendants(h)
    update_nivel_descendants(c)

    return JsonResponse({'ok': True, 'id': c.id, 'nombre': c.nombre})


@login_required(login_url='gestion:login')
@require_POST
def eliminar_carpeta(request, pk):
    c = get_object_or_404(CarpetaArchivo, pk=pk, usuario=request.user)
    c.delete()
    return JsonResponse({'ok': True})


@login_required(login_url='gestion:login')
@require_POST
def reordenar_carpetas(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'JSON inválido'}, status=400)
    items = data.get('items', [])
    if not items:
        return JsonResponse({'ok': False, 'error': 'Sin items'}, status=400)
    ids = [item['id'] for item in items]
    carpetas = CarpetaArchivo.objects.filter(pk__in=ids, usuario=request.user)
    carpetas_by_id = {c.pk: c for c in carpetas}
    for item in items:
        c = carpetas_by_id.get(item['id'])
        if c:
            c.orden = item['orden']
            c.save(update_fields=['orden'])
    return JsonResponse({'ok': True})


@login_required(login_url='gestion:login')
@require_POST
def upload_file(request):
    archivo = request.FILES.get('file')
    carpeta_id = request.POST.get('carpeta')
    titulo = (request.POST.get('titulo') or '').strip()

    if not archivo or not carpeta_id:
        return JsonResponse({'ok': False, 'error': 'Datos incompletos'}, status=400)

    carpeta = get_object_or_404(CarpetaArchivo, id=carpeta_id, usuario=request.user)
    cfg = ArchivoConfig.load()

    try:
        resp = http_requests.post(
            cfg.api_url,
            data={'reqtype': 'fileupload'},
            files={'fileToUpload': (archivo.name, archivo, archivo.content_type)},
            timeout=60,
        )
        if resp.status_code != 200 or not resp.text.startswith('http'):
            return JsonResponse({'ok': False, 'error': 'Error del proveedor'}, status=502)
        url_archivo = resp.text.strip()
    except http_requests.RequestException as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=502)

    nombre = titulo or archivo.name
    tipo = _detectar_tipo(archivo.name)
    a = Archivo.objects.create(
        titulo=nombre,
        url_archivo=url_archivo,
        nombre_original=archivo.name,
        tipo=tipo,
        carpeta=carpeta,
        usuario=request.user,
        orden=-1,
    )
    if tipo == 'image':
        _generar_thumbnail_async(a)
    return JsonResponse({
        'ok': True, 'id': a.id, 'titulo': a.titulo, 'url_archivo': a.url_archivo,
        'tipo': a.tipo, 'carpeta_id': carpeta.id,
    })


def _generar_thumbnail_async(archivo):
    def _work():
        try:
            r = http_requests.get(archivo.url_archivo, timeout=20, headers={'User-Agent': 'Mozilla/5.0'})
            if r.status_code != 200:
                return
            from io import BytesIO
            from PIL import Image
            img = Image.open(BytesIO(r.content))
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            img.thumbnail((200, 200))
            buf = BytesIO()
            img.save(buf, format='WEBP', quality=35, optimize=True)
            import base64
            b64 = base64.b64encode(buf.getvalue()).decode()
            archivo.thumbnail_base64 = b64
            archivo.save(update_fields=['thumbnail_base64'])
        except Exception:
            pass
    threading.Thread(target=_work, daemon=True).start()


@login_required(login_url='gestion:login')
@require_POST
def upload_url(request):
    url = (request.POST.get('url') or '').strip()
    carpeta_id = request.POST.get('carpeta')
    titulo = (request.POST.get('titulo') or '').strip()

    if not url or not carpeta_id:
        return JsonResponse({'ok': False, 'error': 'Datos incompletos'}, status=400)

    carpeta = get_object_or_404(CarpetaArchivo, id=carpeta_id, usuario=request.user)
    cfg = ArchivoConfig.load()

    try:
        resp = http_requests.post(
            cfg.api_url,
            data={'reqtype': 'urlupload', 'url': url},
            timeout=60,
        )
        if resp.status_code != 200 or not resp.text.startswith('http'):
            return JsonResponse({'ok': False, 'error': 'Error del proveedor'}, status=502)
        url_archivo = resp.text.strip()
    except http_requests.RequestException as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=502)

    nombre = titulo or url.split('/')[-1].split('?')[0] or 'archivo'
    tipo = _detectar_tipo(nombre)
    a = Archivo.objects.create(
        titulo=nombre,
        url_archivo=url_archivo,
        nombre_original=nombre,
        tipo=tipo,
        carpeta=carpeta,
        usuario=request.user,
        orden=-1,
    )
    if tipo == 'image':
        _generar_thumbnail_async(a)
    return JsonResponse({
        'ok': True, 'id': a.id, 'titulo': a.titulo, 'url_archivo': a.url_archivo,
        'tipo': a.tipo, 'carpeta_id': carpeta.id,
    })


@login_required(login_url='gestion:login')
@require_POST
def editar_archivo(request, pk):
    a = get_object_or_404(Archivo, pk=pk, usuario=request.user)

    if request.content_type == 'application/json':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            data = {}
    else:
        data = request.POST

    titulo = (data.get('titulo') or '').strip()
    carpeta_id = data.get('carpeta')

    if not titulo:
        return JsonResponse({'ok': False, 'error': 'Título requerido'}, status=400)

    if carpeta_id:
        carpeta = get_object_or_404(CarpetaArchivo, id=carpeta_id, usuario=request.user)
        a.carpeta = carpeta

    a.titulo = titulo
    a.save()
    return JsonResponse({'ok': True, 'id': a.id, 'titulo': a.titulo, 'carpeta_id': a.carpeta_id})


@login_required(login_url='gestion:login')
@require_POST
def eliminar_archivo(request, pk):
    a = get_object_or_404(Archivo, pk=pk, usuario=request.user)
    a.delete()
    return JsonResponse({'ok': True})


@login_required(login_url='gestion:login')
@require_POST
def reordenar_archivos(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'JSON inválido'}, status=400)
    items = data.get('items', [])
    if not items:
        return JsonResponse({'ok': False, 'error': 'Sin items'}, status=400)
    ids = [item['id'] for item in items]
    archivos = Archivo.objects.filter(pk__in=ids, usuario=request.user)
    archivos_by_id = {a.pk: a for a in archivos}
    for item in items:
        a = archivos_by_id.get(item['id'])
        if a:
            a.orden = item['orden']
            a.save(update_fields=['orden'])
    return JsonResponse({'ok': True})


@login_required(login_url='gestion:login')
@require_POST
def mover_archivo(request, pk):
    a = get_object_or_404(Archivo, pk=pk, usuario=request.user)

    if request.content_type == 'application/json':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            data = {}
    else:
        data = request.POST

    carpeta_id = data.get('carpeta')
    carpeta = get_object_or_404(CarpetaArchivo, pk=carpeta_id, usuario=request.user)
    a.carpeta = carpeta
    a.save()
    return JsonResponse({'ok': True})


@login_required(login_url='gestion:login')
@require_POST
def generar_thumbnail(request, pk):
    a = get_object_or_404(Archivo, pk=pk, usuario=request.user)
    
    if a.thumbnail_base64:
        return JsonResponse({'ok': True, 'thumbnail': a.thumbnail_base64})
    
    if a.tipo != 'image':
        return JsonResponse({'ok': False, 'error': 'Solo para imágenes'}, status=400)
    
    try:
        if request.content_type == 'application/json':
            import json
            data = json.loads(request.body)
        else:
            data = request.POST
        
        thumbnail = data.get('thumbnail')
        if not thumbnail or not thumbnail.startswith('data:image/'):
            return JsonResponse({'ok': False, 'error': 'Base64 inválido'}, status=400)
        
        raw = thumbnail.split(',', 1)[1] if ',' in thumbnail else thumbnail
        a.thumbnail_base64 = raw
        a.save(update_fields=['thumbnail_base64'])
        
        return JsonResponse({'ok': True, 'thumbnail': raw})
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=500)
