import requests
from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required

from gestion.models import GaleriaConfig

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}


@login_required(login_url="gestion:login")
def gallery_view(request, service, creator_id):
    return render(request, "gestion/galeria.html", {
        "service": service,
        "creator_id": creator_id,
    })


@login_required(login_url="gestion:login")
def gallery_profile_proxy(request, service, creator_id):
    cfg = GaleriaConfig.load()
    if not cfg.api_url:
        return JsonResponse({"ok": False, "error": "API no configurada"}, status=500)

    try:
        r = requests.get(
            f"{cfg.api_url}/{service}/user/{creator_id}/profile",
            headers=_HEADERS, timeout=10,
        )
        if r.status_code == 404:
            return JsonResponse({"ok": False, "error": "Creator not found"}, status=404)
        r.raise_for_status()
        return JsonResponse({"ok": True, "profile": r.json()})
    except requests.RequestException as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=502)


@login_required(login_url="gestion:login")
def gallery_posts_proxy(request, service, creator_id):
    cfg = GaleriaConfig.load()
    if not cfg.api_url:
        return JsonResponse({"ok": False, "error": "API no configurada"}, status=500)

    q = request.GET.get("q", "").strip()
    o = request.GET.get("o", "0")

    try:
        o = max(0, int(o))
    except (ValueError, TypeError):
        o = 0
    o = (o // 50) * 50

    params = {"o": o}
    if q:
        params["q"] = q

    try:
        r = requests.get(
            f"{cfg.api_url}/{service}/user/{creator_id}",
            params=params, headers=_HEADERS, timeout=15,
        )
        if r.status_code == 404:
            return JsonResponse({"ok": False, "error": "Creator not found"}, status=404)
        r.raise_for_status()
        posts = r.json()

        for p in posts:
            _patch_media(p, cfg)

        return JsonResponse({"ok": True, "posts": posts, "offset": o})
    except requests.RequestException as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=502)


@login_required(login_url="gestion:login")
def gallery_config_view(request):
    cfg = GaleriaConfig.load()
    return JsonResponse({
        "ok": True,
        "url_pattern": cfg.url_pattern,
    })


def _patch_media(post, cfg):
    f = post.get("file")
    if f and f.get("path"):
        fname = f.get("name", "")
        f["url"] = f"{cfg.file_url}/data{f['path']}?f={fname}"
        f["thumb"] = f"{cfg.cdn_url}/thumbnail/data{f['path']}"

    for att in post.get("attachments", []):
        if att.get("path"):
            fname = att.get("name", "")
            att["url"] = f"{cfg.file_url}/data{att['path']}?f={fname}"
            att["thumb"] = f"{cfg.cdn_url}/thumbnail/data{att['path']}"
