import logging
import urllib.request
import urllib.error
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

_BATCH_SIZE = 8
_TIMEOUT = 3
_ALLOWED_HOSTS = ('google.com', 'googleusercontent.com', 'gstatic.com')


def _check_icono_url(url):
    """Return True if the icono URL is reachable (HTTP 2xx)."""
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        return False
    if not any(parsed.hostname.endswith(h) for h in _ALLOWED_HOSTS if parsed.hostname):
        return False

    req = urllib.request.Request(url, method='HEAD', headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                       'AppleWebKit/537.36 (KHTML, like Gecko) '
                       'Chrome/120.0.0.0 Safari/537.36'
    })
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            return 200 <= resp.status < 400
    except (urllib.error.URLError, OSError):
        req.method = 'GET'
        req.add_header('Range', 'bytes=0-0')
        try:
            with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
                return 200 <= resp.status < 400
        except (urllib.error.URLError, OSError):
            return False


def verificar_marcadores(user):
    """Check a small batch of unverified bookmarks synchronously. Mark broken as eliminado."""
    from gestion.models import Marcador

    pendientes = list(
        Marcador.objects.filter(
            usuario=user,
            verificado=False,
            eliminado=False,
        ).exclude(icono='').values_list('id', 'icono')[:_BATCH_SIZE]
    )

    if not pendientes:
        return

    for marcador_id, icono in pendientes:
        ok = _check_icono_url(icono)
        Marcador.objects.filter(pk=marcador_id).update(
            verificado=True,
            eliminado=not ok,
        )
        if not ok:
            logger.info('Marcador %s eliminado (icono no disponible)', marcador_id)
