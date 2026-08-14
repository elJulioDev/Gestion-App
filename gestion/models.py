from django.db import models
from django.contrib.auth.models import User


class ProveedorConfig(models.Model):
    """
    Configuración del proveedor de contenido.
    Singleton: solo debe existir un registro (pk=1).
    Todos los parámetros sensibles viven aquí, no en código fuente ni .env.
    """
    api_url = models.URLField(max_length=200, help_text='URL base de la API (sin barra final)')
    domain = models.CharField(max_length=100, help_text='Dominio del proveedor')
    embed_url = models.URLField(max_length=200, help_text='URL base para embeds (sin barra final)')
    url_pattern = models.TextField(help_text='Regex para identificar URLs del proveedor')
    api_search_endpoint = models.CharField(max_length=100, default='/api/v2/video/search/')
    api_video_endpoint = models.CharField(max_length=100, default='/api/v2/video/id/')
    api_params = models.JSONField(default=dict, help_text='Parámetros extra para la API (ej: thumbsize, format)')
    api_extra_flags = models.JSONField(default=dict, help_text='Flags adicionales de la API (ej: gay, lq)')

    class Meta:
        verbose_name = 'configuración del proveedor'
        verbose_name_plural = 'configuraciones del proveedor'

    def __str__(self):
        return f'Proveedor: {self.domain}'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Carpeta(models.Model):
    nombre = models.CharField(max_length=80)
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='carpetas')
    orden = models.PositiveIntegerField(default=0)
    creada = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['orden', 'nombre']
        unique_together = ('usuario', 'nombre')

    def __str__(self):
        return self.nombre


class Marcador(models.Model):
    titulo = models.CharField(max_length=120)
    url = models.URLField(max_length=500)
    icono = models.URLField(max_length=500, blank=True)
    carpeta = models.ForeignKey(Carpeta, on_delete=models.CASCADE, related_name='marcadores')
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='marcadores')
    orden = models.PositiveIntegerField(default=0)
    creado = models.DateTimeField(auto_now_add=True)
    eliminado = models.BooleanField(default=False, help_text='Soft-delete: video no disponible en el proveedor')
    verificado = models.BooleanField(default=False, help_text='True si ya se verificó que el icono/URL es válido')
    favorito = models.BooleanField(default=False)

    class Meta:
        ordering = ['orden', 'titulo']

    def __str__(self):
        return self.titulo

    def save(self, *args, **kwargs):
        if not self.icono and self.url:
            self.icono = self._resolver_icono()
        super().save(*args, **kwargs)

    def _resolver_icono(self):
        from urllib.parse import urlparse
        dominio = urlparse(self.url).netloc

        # Proveedor externo (archivo local, no incluido en el repositorio)
        try:
            from .icono_providers import resolver_icono_externo
            resultado = resolver_icono_externo(self.url, dominio)
            if resultado:
                return resultado
        except ImportError:
            pass

        return f'https://www.google.com/s2/favicons?domain={dominio}&sz=64'
    
class CategoriaBrowser(models.Model):
    nombre = models.CharField(max_length=80, help_text='Nombre visible en el sidebar')
    tag    = models.CharField(max_length=80, help_text='Query enviado a la API del proveedor')
    conteo = models.PositiveIntegerField(default=0, help_text='Cantidad referencial de videos')
    orden  = models.PositiveIntegerField(default=0)
    activa = models.BooleanField(default=True)

    class Meta:
        ordering = ['orden', 'nombre']

    def __str__(self):
        return self.nombre