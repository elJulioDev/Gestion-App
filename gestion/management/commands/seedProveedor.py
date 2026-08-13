"""
Semilla para ProveedorConfig.
Uso:
    python manage.py seedProveedor
    python manage.py seedProveedor --actualizar  # sobrescribe si ya existe
Lee las variables de entorno PROVEEDOR_* y las inserta en la BD.
Después de ejecutar, puedes eliminar esas variables de .env.
"""
import os
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Semilla la configuración del proveedor en la BD desde variables de entorno'

    def add_arguments(self, parser):
        parser.add_argument('--actualizar', action='store_true',
                            help='Sobrescribe el registro existente')

    def handle(self, *args, **options):
        from gestion.models import ProveedorConfig

        api_url = os.environ.get('PROVEEDOR_API_URL', '').rstrip('/')
        domain = os.environ.get('PROVEEDOR_DOMAIN', '')
        embed_url = os.environ.get('PROVEEDOR_EMBED_URL', '').rstrip('/')
        url_pattern = os.environ.get('PROVEEDOR_URL_PATTERN', '')
        api_params_raw = os.environ.get('PROVEEDOR_API_PARAMS', '{}')
        api_flags_raw = os.environ.get('PROVEEDOR_API_FLAGS', '{}')

        if not all([api_url, domain, embed_url, url_pattern]):
            self.stderr.write(
                'Faltan variables de entorno obligatorias:\n'
                '  PROVEEDOR_API_URL, PROVEEDOR_DOMAIN, PROVEEDOR_EMBED_URL, PROVEEDOR_URL_PATTERN'
            )
            return

        import json
        try:
            api_params = json.loads(api_params_raw)
        except json.JSONDecodeError:
            api_params = {}
        try:
            api_flags = json.loads(api_flags_raw)
        except json.JSONDecodeError:
            api_flags = {}

        existing = ProveedorConfig.objects.filter(pk=1).first()
        if existing and not options['actualizar']:
            self.stdout.write(self.style.WARNING(
                'Ya existe configuración. Usa --actualizar para sobrescribir.'
            ))
            return

        ProveedorConfig.objects.update_or_create(
            pk=1,
            defaults={
                'api_url': api_url,
                'domain': domain,
                'embed_url': embed_url,
                'url_pattern': url_pattern,
                'api_search_endpoint': os.environ.get(
                    'PROVEEDOR_SEARCH_ENDPOINT', '/api/v2/video/search/'
                ),
                'api_video_endpoint': os.environ.get(
                    'PROVEEDOR_VIDEO_ENDPOINT', '/api/v2/video/id/'
                ),
                'api_params': api_params,
                'api_extra_flags': api_flags,
            }
        )

        self.stdout.write(self.style.SUCCESS('ProveedorConfig semillada en la BD.'))
