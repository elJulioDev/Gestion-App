from django.urls import path
from . import views

app_name = 'gestion'

urlpatterns = [
    path('', views.marcadores_view, name='index'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    path('marcadores/', views.marcadores_view, name='marcadores'),
    path('marcadores/carpeta/crear/', views.crear_carpeta, name='crear_carpeta'),
    path('marcadores/carpeta/<int:pk>/editar/', views.editar_carpeta, name='editar_carpeta'),
    path('marcadores/carpeta/<int:pk>/eliminar/', views.eliminar_carpeta, name='eliminar_carpeta'),
    path('marcadores/crear/', views.crear_marcador, name='crear_marcador'),
    path('marcadores/<int:pk>/eliminar/', views.eliminar_marcador, name='eliminar_marcador'),
    path('marcadores/<int:pk>/editar/', views.editar_marcador, name='editar_marcador'),
    path('marcadores/<int:pk>/mover/', views.mover_marcador, name='mover_marcador'),
    path('marcadores/papelera/', views.papelera_view, name='papelera'),
    path('marcadores/<int:pk>/restaurar/', views.restaurar_marcador, name='restaurar_marcador'),
    path('marcadores/<int:pk>/eliminar-definitivo/', views.eliminar_definitivo, name='eliminar_definitivo'),
    path('video/<str:video_id>/', views.reproductor_view, name='reproductor'),
]

from .views.video_browser import video_browser_view, video_search_proxy, categorias_proxy, provider_config_view
urlpatterns += [
    path('videos/', video_browser_view, name='video_browser'),
    path('api/videos/search/',     video_search_proxy, name='video_search_proxy'),
    path('api/videos/categorias/', categorias_proxy,   name='video_categorias'),
    path('api/videos/provider-config/', provider_config_view, name='provider_config'),
]