import json
import re
import requests
from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required

from gestion.models import ImageProviderConfig, Marcador

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}


@login_required(login_url="gestion:login")
def img_config_view(request):
    return JsonResponse({
        "ok": True,
        "url_pattern": r"rule34\.xxx.*[?&]tags=([^&]+)",
    })


@login_required(login_url="gestion:login")
def img_gallery_view(request, tag):
    artist_name = tag.replace('_', ' ').replace('-', ' ').title()
    folder_bookmarks = []
    folder_id = request.GET.get("folder")
    if folder_id:
        raw = list(
            Marcador.objects.filter(
                carpeta_id=folder_id,
                usuario=request.user,
                eliminado=False,
            ).values("id", "titulo", "url", "icono")
        )
        for bm in raw:
            bm["gallery_url"] = _resolve_gallery_url(bm["url"])
        folder_bookmarks = raw
    return render(request, "gestion/img_gallery.html", {
        "tag": tag,
        "artist_name": artist_name,
        "folder_bookmarks": folder_bookmarks,
        "folder_id": folder_id or "",
    })


@login_required(login_url="gestion:login")
def img_search_proxy(request):
    cfg = ImageProviderConfig.load()
    if not cfg.api_key:
        return JsonResponse({"ok": False, "error": "API no configurada"}, status=500)

    tags = request.GET.get("tags", "").strip()
    pid = request.GET.get("pid", "0")
    limit = request.GET.get("limit", "42")

    if not tags:
        return JsonResponse({"ok": False, "error": "tags requerido"}, status=400)

    try:
        pid = max(0, int(pid))
    except (ValueError, TypeError):
        pid = 0
    try:
        limit = max(1, min(int(limit), 1000))
    except (ValueError, TypeError):
        limit = 42

    params = {
        "page": "dapi",
        "s": "post",
        "q": "index",
        "tags": tags,
        "pid": pid,
        "limit": limit,
        "json": 1,
        "api_key": cfg.api_key,
        "user_id": cfg.user_id,
    }

    try:
        r = requests.get(
            cfg.api_url,
            params=params,
            headers=_HEADERS,
            timeout=15,
        )
        r.raise_for_status()

        text = r.text.strip()
        if not text or text == '""':
            return JsonResponse({"ok": True, "posts": [], "pid": pid, "count": 0})

        data = json.loads(text)

        if not isinstance(data, list):
            return JsonResponse({"ok": True, "posts": [], "pid": pid, "count": 0})

        posts = []
        for p in data:
            posts.append({
                "id": p.get("id", ""),
                "tags": p.get("tags", ""),
                "file_url": p.get("file_url", ""),
                "preview_url": p.get("preview_url", ""),
                "sample_url": p.get("sample_url", ""),
                "rating": p.get("rating", ""),
                "score": p.get("score", ""),
                "width": p.get("width", ""),
                "height": p.get("height", ""),
            })

        return JsonResponse({"ok": True, "posts": posts, "pid": pid, "count": len(posts)})

    except requests.RequestException as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=502)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"ok": True, "posts": [], "pid": pid, "count": 0})
    except Exception:
        return JsonResponse({"ok": False, "error": "Error inesperado"}, status=500)


_GALLERY_RE = re.compile(r'pawchive\.pw/(\w+)/user/(\d+)', re.I)
_IMG_RE = re.compile(r'rule34\.xxx.*[?&]tags=([^&]+)', re.I)


def _resolve_gallery_url(url):
    m = _GALLERY_RE.search(url)
    if m:
        return f"/galeria/{m.group(1)}/{m.group(2)}/"
    m = _IMG_RE.search(url)
    if m:
        return f"/img/{m.group(1)}/"
    return ""
