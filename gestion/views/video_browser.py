import json
import requests
from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST

from gestion.models import Carpeta, CategoriaBrowser, ProveedorConfig

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}


@login_required(login_url="gestion:login")
def video_browser_view(request):
    carpetas = Carpeta.objects.filter(usuario=request.user).order_by("orden", "nombre")
    carpetas_json = json.dumps([{"id": c.id, "nombre": c.nombre} for c in carpetas])
    return render(request, "gestion/video_browser.html", {
        "carpetas":      carpetas,
        "carpetas_json": carpetas_json,
    })


@login_required(login_url="gestion:login")
def categorias_proxy(request):
    cats = (
        CategoriaBrowser.objects
        .filter(activa=True)
        .order_by("orden", "nombre")
        .values("id", "nombre", "tag", "conteo")
    )
    return JsonResponse({"ok": True, "categorias": list(cats)})


@login_required(login_url="gestion:login")
def provider_config_view(request):
    cfg = ProveedorConfig.load()
    return JsonResponse({
        "ok": True,
        "url_pattern": cfg.url_pattern,
    })


@login_required(login_url="gestion:login")
def video_search_proxy(request):
    query    = request.GET.get("q", "").strip()
    page     = request.GET.get("page", "1")
    per_page = request.GET.get("per_page", "24")
    order    = request.GET.get("order", "latest")

    if not query:
        return JsonResponse({"ok": False, "error": "q requerido"}, status=400)
    if len(query) > 200:
        return JsonResponse({"ok": False, "error": "Query demasiado largo"}, status=400)

    try:
        page = max(1, min(int(page), 200))
    except (ValueError, TypeError):
        page = 1
    try:
        per_page = max(1, min(int(per_page), 50))
    except (ValueError, TypeError):
        per_page = 24

    if order not in ('latest', 'top-rated', 'most-viewed', 'top-weekly', 'top-monthly', 'longest', 'shortest'):
        order = 'latest'

    cfg = ProveedorConfig.load()

    if not cfg.api_url:
        return JsonResponse({"ok": False, "error": "API no configurada"}, status=500)

    params = {
        "query":    query,
        "per_page": per_page,
        "page":     page,
        "format":   "json",
        "order":    order,
    }
    params.update(cfg.api_params)
    params.update(cfg.api_extra_flags)

    try:
        url = f"{cfg.api_url}{cfg.api_search_endpoint}"
        r = requests.get(url, params=params, headers=_HEADERS, timeout=15)
        r.raise_for_status()
        data = r.json()

        videos = []
        for v in data.get("videos", []):
            videos.append({
                "id":       v.get("id", ""),
                "title":    v.get("title", ""),
                "thumb":    v.get("default_thumb", {}).get("src", ""),
                "duration": v.get("length_min", ""),
                "views":    v.get("views", ""),
                "url":      v.get("url", ""),
            })

        return JsonResponse({
            "ok":     True,
            "total":  data.get("total_count", 0),
            "pages":  data.get("total_pages", 1),
            "count":  data.get("count", 0),
            "page":   int(page),
            "videos": videos,
        })

    except requests.RequestException as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=502)
    except Exception:
        return JsonResponse({"ok": False, "error": "Error inesperado"}, status=500)


@login_required(login_url="gestion:login")
@require_POST
def fetch_video_title(request):
    url = request.POST.get("url", "").strip()
    if not url:
        return JsonResponse({"ok": False, "error": "URL requerida"}, status=400)

    try:
        from gestion.icono_providers import _proveedor_video
        from gestion.models import ProveedorConfig
        cfg = ProveedorConfig.load()
        data = _proveedor_video(url, cfg)
        if not data:
            return JsonResponse({"ok": False, "error": "Video no encontrado o eliminado"})
        return JsonResponse({"ok": True, "title": data.get("title", "")})
    except ValueError:
        return JsonResponse({"ok": False, "error": "URL no válida"}, status=400)
    except Exception:
        return JsonResponse({"ok": False, "error": "Error al obtener título"}, status=502)
