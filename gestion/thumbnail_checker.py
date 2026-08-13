import logging
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

_MAX_WORKERS = 15


def _estado_marcador(url, cfg):
    """ok=video activo, borrado=eliminado del proveedor, error=no comprobable,
    None=no es una URL del proveedor."""
    from .icono_providers import _compile_pattern, _proveedor_video

    if not _compile_pattern(cfg.url_pattern).search(url):
        return None
    try:
        return 'ok' if _proveedor_video(url, cfg) is not None else 'borrado'
    except Exception:
        return 'error'


def _aplicar_estado(marcador_id, estado):
    from gestion.models import Marcador

    if estado is None:
        Marcador.objects.filter(pk=marcador_id).update(verificado=True)
    elif estado in ('ok', 'borrado'):
        Marcador.objects.filter(pk=marcador_id).update(
            verificado=True,
            eliminado=estado == 'borrado',
        )
        if estado == 'borrado':
            logger.info('Marcador %s eliminado (video borrado del proveedor)', marcador_id)


def verificar_marcadores_ids(user, ids):
    """Verifica los marcadores dados en paralelo y devuelve {id: 'ok'|'borrado'|'error'}."""
    from gestion.models import Marcador, ProveedorConfig

    try:
        cfg = ProveedorConfig.load()
    except Exception:
        return {i: 'error' for i in ids}

    marcadores = {
        m['id']: m['url']
        for m in Marcador.objects.filter(pk__in=ids, usuario=user).values('id', 'url')
    }

    def _procesar(marcador_id):
        url = marcadores.get(marcador_id)
        if url is None:
            return marcador_id, 'error'
        return marcador_id, _estado_marcador(url, cfg)

    resultado = {}
    with ThreadPoolExecutor(max_workers=min(len(marcadores) or 1, _MAX_WORKERS)) as pool:
        for marcador_id, estado in pool.map(_procesar, marcadores):
            _aplicar_estado(marcador_id, estado)
            resultado[marcador_id] = 'ok' if estado is None else estado
    return resultado
