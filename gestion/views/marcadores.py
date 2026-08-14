import json
import re
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, QueryDict
from django.views.decorators.http import require_POST, require_http_methods
from django.db.models import Count, Prefetch, Case, When, Value, IntegerField, Q
from ..models import Carpeta, Marcador, ProveedorConfig
from ..thumbnail_checker import verificar_marcadores_ids

@login_required(login_url='gestion:login')
def marcadores_view(request):
    marcadores_qs = Marcador.objects.filter(
        usuario=request.user,
        eliminado=False,
    ).annotate(
        sin_miniatura=Case(
            When(Q(icono='') | Q(icono__contains='google.com/s2/favicons'), then=Value(1)),
            default=Value(0),
            output_field=IntegerField()
        )
    ).order_by('sin_miniatura', '-creado')

    # 2. Inyectamos este queryset a la consulta de las carpetas mediante prefetch_related
    carpetas = Carpeta.objects.filter(usuario=request.user).annotate(
        total=Count('marcadores', filter=Q(marcadores__eliminado=False))
    ).prefetch_related(
        Prefetch('marcadores', queryset=marcadores_qs)
    )

    return render(request, 'gestion/marcadores.html', {
        'carpetas': carpetas,
        'marcadores': marcadores_qs,
        'total': marcadores_qs.count(),
        'favoritos': Marcador.objects.filter(usuario=request.user, eliminado=False, favorito=True).count(),
    })

@login_required(login_url='gestion:login')
@require_POST
def crear_carpeta(request):
    nombre = (request.POST.get('nombre') or '').strip()
    if not nombre:
        return JsonResponse({'ok': False, 'error': 'Nombre requerido'}, status=400)
    if Carpeta.objects.filter(usuario=request.user, nombre__iexact=nombre).exists():
        return JsonResponse({'ok': False, 'error': 'Ya existe'}, status=400)
    c = Carpeta.objects.create(usuario=request.user, nombre=nombre)
    return JsonResponse({'ok': True, 'id': c.id, 'nombre': c.nombre})

@login_required(login_url='gestion:login')
@require_POST
def editar_carpeta(request, pk):
    c = get_object_or_404(Carpeta, pk=pk, usuario=request.user)
    nombre = (request.POST.get('nombre') or '').strip()
    if not nombre:
        return JsonResponse({'ok': False, 'error': 'Nombre requerido'}, status=400)
    if Carpeta.objects.filter(usuario=request.user, nombre__iexact=nombre).exclude(pk=pk).exists():
        return JsonResponse({'ok': False, 'error': 'Ya existe una carpeta con ese nombre'}, status=400)
    c.nombre = nombre
    c.save()
    return JsonResponse({'ok': True, 'id': c.id, 'nombre': c.nombre})

@login_required(login_url='gestion:login')
@require_POST
def crear_marcador(request):
    titulo = (request.POST.get('titulo') or '').strip()
    url = (request.POST.get('url') or '').strip()
    carpeta_id = request.POST.get('carpeta')
    if not (titulo and url and carpeta_id):
        return JsonResponse({'ok': False, 'error': 'Datos incompletos'}, status=400)
    carpeta = get_object_or_404(Carpeta, id=carpeta_id, usuario=request.user)
    m = Marcador.objects.create(usuario=request.user, carpeta=carpeta, titulo=titulo, url=url)
    return JsonResponse({
        'ok': True, 'id': m.id, 'titulo': m.titulo, 'url': m.url,
        'icono': m.icono, 'carpeta_id': carpeta.id,
    })

@login_required(login_url='gestion:login')
@require_http_methods(["POST", "PUT"])
def editar_marcador(request, pk):
    m = get_object_or_404(Marcador, pk=pk, usuario=request.user)

    if request.content_type == 'application/json':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            data = {}
    else:
        data = request.POST if request.method == 'POST' else QueryDict(request.body)

    titulo = (data.get('titulo') or '').strip()
    url    = (data.get('url') or '').strip()
    carpeta_id = data.get('carpeta')

    if not (titulo and url and carpeta_id):
        return JsonResponse({'ok': False, 'error': 'Datos incompletos'}, status=400)

    carpeta = get_object_or_404(Carpeta, id=carpeta_id, usuario=request.user)

    # Re-resolver icono si cambió la URL
    url_anterior = Marcador.objects.filter(pk=pk).values_list('url', flat=True).first()
    if url != url_anterior:
        m.icono = ''
        m.verificado = False

    m.titulo  = titulo
    m.url     = url
    m.carpeta = carpeta
    m.save()

    return JsonResponse({
        'ok': True,
        'id': m.id,
        'titulo': m.titulo,
        'url': m.url,
        'carpeta_id': carpeta.id,
        'icono': m.icono,
    })

@login_required(login_url='gestion:login')
@require_POST
def verificar_marcadores_view(request):
    ids = [int(i) for i in (request.POST.get('ids') or '').split(',') if i.strip().isdigit()]
    if not ids:
        return JsonResponse({'ok': False, 'error': 'Sin marcadores para verificar'}, status=400)
    resultados = verificar_marcadores_ids(request.user, ids)
    return JsonResponse({
        'ok': True,
        'resultados': resultados,
        'borrados': sum(1 for v in resultados.values() if v == 'borrado'),
    })

@login_required(login_url='gestion:login')
@require_http_methods(["POST", "DELETE"])
def eliminar_marcador(request, pk):
    m = get_object_or_404(Marcador, pk=pk, usuario=request.user)
    m.delete()
    return JsonResponse({'ok': True})

@login_required(login_url='gestion:login')
@require_POST
def eliminar_carpeta(request, pk):
    c = get_object_or_404(Carpeta, pk=pk, usuario=request.user)
    c.delete()
    return JsonResponse({'ok': True})

@login_required(login_url='gestion:login')
@require_POST
def mover_marcador(request, pk):
    m = get_object_or_404(Marcador, pk=pk, usuario=request.user)
    carpeta_id = request.POST.get('carpeta')
    carpeta = get_object_or_404(Carpeta, pk=carpeta_id, usuario=request.user)
    m.carpeta = carpeta
    m.save()
    return JsonResponse({'ok': True})

@login_required(login_url='gestion:login')
def reproductor_view(request, video_id):
    if not re.fullmatch(r'[a-zA-Z0-9_-]+', video_id):
        from django.http import Http404
        raise Http404

    cfg = ProveedorConfig.load()
    url_final = f"{cfg.embed_url}/{video_id}/?autoplay=1"

    return render(request, 'gestion/reproductor.html', {
        'video_id': video_id,
        'embed_url': url_final
    })

@login_required(login_url='gestion:login')
def papelera_view(request):
    eliminados = Marcador.objects.filter(
        usuario=request.user,
        eliminado=True,
    ).select_related('carpeta').order_by('-creado')

    return render(request, 'gestion/papelera.html', {
        'eliminados': eliminados,
        'total': eliminados.count(),
    })

@login_required(login_url='gestion:login')
@require_POST
def restaurar_marcador(request, pk):
    m = get_object_or_404(Marcador, pk=pk, usuario=request.user, eliminado=True)
    m.eliminado = False
    m.verificado = False
    m.save()
    return JsonResponse({'ok': True})

@login_required(login_url='gestion:login')
@require_POST
def eliminar_definitivo(request, pk):
    m = get_object_or_404(Marcador, pk=pk, usuario=request.user, eliminado=True)
    m.delete()
    return JsonResponse({'ok': True})

@login_required(login_url='gestion:login')
@require_POST
def toggle_favorito(request, pk):
    m = get_object_or_404(Marcador, pk=pk, usuario=request.user, eliminado=False)
    m.favorito = not m.favorito
    m.save(update_fields=['favorito'])
    return JsonResponse({'ok': True, 'favorito': m.favorito})