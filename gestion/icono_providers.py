import re
import json
import urllib.request
import urllib.parse


def _obtener_config():
    from gestion.models import ProveedorConfig
    return ProveedorConfig.load()


def _compile_pattern(pattern_str):
    return re.compile(pattern_str, re.I)


def _proveedor_thumb(url, cfg):
    pat = _compile_pattern(cfg.url_pattern)
    m = pat.search(url)
    if not m:
        return None

    video_id = m.group(1)
    api_url = (
        f"{cfg.api_url}{cfg.api_video_endpoint}"
        f"?id={video_id}"
    )

    for k, v in cfg.api_params.items():
        api_url += f"&{k}={v}"

    req = urllib.request.Request(api_url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                       'AppleWebKit/537.36 (KHTML, like Gecko) '
                       'Chrome/120.0.0.0 Safari/537.36'
    })

    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())

        if isinstance(data, list):
            return None
        if data.get('error'):
            return None

        thumb = (data.get('default_thumb') or {}).get('src')
        if thumb:
            return thumb

        thumbs = data.get('thumbs') or []
        if thumbs:
            return thumbs[0].get('src')

    except Exception:
        pass

    return None


def resolver_icono_externo(url, dominio):
    try:
        cfg = _obtener_config()
    except Exception:
        return None

    pat = _compile_pattern(cfg.url_pattern)
    if pat.search(url):
        return _proveedor_thumb(url, cfg)
    return None
