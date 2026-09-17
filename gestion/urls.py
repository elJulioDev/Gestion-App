from django.urls import path
from . import views

app_name = 'gestion'

urlpatterns = [
    path('', views.marcadores_view, name='index'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    path('marcadores/', views.marcadores_view, name='marcadores'),
    path('marcadores/reordenar/', views.reordenar_marcadores, name='reordenar_marcadores'),
    path('marcadores/carpeta/reordenar/', views.reordenar_carpetas, name='reordenar_carpetas'),
    path('marcadores/carpeta/crear/', views.crear_carpeta, name='crear_carpeta'),
    path('marcadores/carpeta/<int:pk>/editar/', views.editar_carpeta, name='editar_carpeta'),
    path('marcadores/carpeta/<int:pk>/eliminar/', views.eliminar_carpeta, name='eliminar_carpeta'),
    path('marcadores/crear/', views.crear_marcador, name='crear_marcador'),
    path('marcadores/verificar/', views.verificar_marcadores_view, name='verificar_marcadores'),
    path('marcadores/<int:pk>/eliminar/', views.eliminar_marcador, name='eliminar_marcador'),
    path('marcadores/<int:pk>/editar/', views.editar_marcador, name='editar_marcador'),
    path('marcadores/<int:pk>/mover/', views.mover_marcador, name='mover_marcador'),
    path('marcadores/<int:pk>/favorito/', views.toggle_favorito, name='toggle_favorito'),
    path('marcadores/duplicados/', views.detectar_duplicados_view, name='detectar_duplicados'),
    path('marcadores/eliminar-duplicados/', views.eliminar_duplicados_view, name='eliminar_duplicados'),
    path('marcadores/papelera/', views.papelera_view, name='papelera'),
    path('marcadores/<int:pk>/restaurar/', views.restaurar_marcador, name='restaurar_marcador'),
    path('marcadores/<int:pk>/eliminar-definitivo/', views.eliminar_definitivo, name='eliminar_definitivo'),
    path('video/<str:video_id>/', views.reproductor_view, name='reproductor'),
]

from .views.video_browser import video_browser_view, video_search_proxy, categorias_proxy, provider_config_view, fetch_video_title
urlpatterns += [
    path('videos/', video_browser_view, name='video_browser'),
    path('api/videos/search/',     video_search_proxy, name='video_search_proxy'),
    path('api/videos/categorias/', categorias_proxy,   name='video_categorias'),
    path('api/videos/provider-config/', provider_config_view, name='provider_config'),
    path('api/videos/fetch-title/', fetch_video_title, name='fetch_video_title'),
]

from .views.galeria import gallery_view, gallery_profile_proxy, gallery_posts_proxy, gallery_config_view
urlpatterns += [
    path('galeria/<str:service>/<str:creator_id>/', gallery_view, name='gallery'),
    path('api/galeria/<str:service>/<str:creator_id>/profile/', gallery_profile_proxy, name='gallery_profile_proxy'),
    path('api/galeria/<str:service>/<str:creator_id>/posts/', gallery_posts_proxy, name='gallery_posts_proxy'),
    path('api/galeria/config/', gallery_config_view, name='gallery_config'),
]

# Imágenes
from .views.img_provider import img_config_view, img_gallery_view, img_search_proxy
urlpatterns += [
    path('img/<str:tag>/', img_gallery_view, name='img_gallery'),
    path('api/img/config/', img_config_view, name='img_config'),
    path('api/img/search/', img_search_proxy, name='img_search_proxy'),
]

# Archivo
from .views.archivo import (
    archivo_view, crear_carpeta, editar_carpeta,
    eliminar_carpeta, reordenar_carpetas,
    upload_file, upload_url, editar_archivo, eliminar_archivo,
    reordenar_archivos, mover_archivo, generar_thumbnail,
)
urlpatterns += [
    path('archivo/', archivo_view, name='archivo'),
    path('archivo/carpeta/crear/', crear_carpeta, name='archivo_crear_carpeta'),
    path('archivo/carpeta/<int:pk>/editar/', editar_carpeta, name='archivo_editar_carpeta'),
    path('archivo/carpeta/<int:pk>/eliminar/', eliminar_carpeta, name='archivo_eliminar_carpeta'),
    path('archivo/carpeta/reordenar/', reordenar_carpetas, name='archivo_reordenar_carpetas'),
    path('archivo/upload/', upload_file, name='archivo_upload'),
    path('archivo/upload-url/', upload_url, name='archivo_upload_url'),
    path('archivo/<int:pk>/editar/', editar_archivo, name='archivo_editar_archivo'),
    path('archivo/<int:pk>/eliminar/', eliminar_archivo, name='archivo_eliminar_archivo'),
    path('archivo/reordenar/', reordenar_archivos, name='archivo_reordenar_archivos'),
    path('archivo/<int:pk>/mover/', mover_archivo, name='archivo_mover_archivo'),
    path('archivo/<int:pk>/thumbnail/', generar_thumbnail, name='archivo_generar_thumbnail'),
]