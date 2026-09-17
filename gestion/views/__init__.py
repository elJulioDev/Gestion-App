from .auth import login_view, logout_view
from .dashboard import index_view
from .marcadores import (
    marcadores_view, crear_carpeta, editar_carpeta, crear_marcador,
    editar_marcador, eliminar_carpeta, eliminar_marcador, mover_marcador,
    reproductor_view, papelera_view, restaurar_marcador, eliminar_definitivo,
    verificar_marcadores_view, toggle_favorito,
    detectar_duplicados_view, eliminar_duplicados_view,
    reordenar_marcadores, reordenar_carpetas,
)
from .galeria import (
    gallery_view, gallery_profile_proxy, gallery_posts_proxy, gallery_config_view,
)
from .img_provider import img_config_view, img_gallery_view, img_search_proxy
from .archivo import (
    archivo_view, crear_carpeta as crear_carpeta_archivo, editar_carpeta as editar_carpeta_archivo,
    eliminar_carpeta as eliminar_carpeta_archivo, reordenar_carpetas as reordenar_carpetas_archivo,
    upload_file, upload_url, editar_archivo, eliminar_archivo, reordenar_archivos, mover_archivo,
)