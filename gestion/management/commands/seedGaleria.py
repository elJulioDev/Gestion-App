"""
Semilla para GaleriaConfig.
Uso:
    python manage.py seedGaleria
    python manage.py seedGaleria --actualizar
Lee las variables de entorno GALERIA_* y las inserta en la BD.
"""
import os
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Semilla la configuración de galería en la BD desde variables de entorno'

    def add_arguments(self, parser):
        parser.add_argument('--actualizar', action='store_true',
                            help='Sobrescribe el registro existente')

    def handle(self, *args, **options):
        from gestion.models import GaleriaConfig

        api_url = os.environ.get('GALERIA_API_URL', '').rstrip('/')
        cdn_url = os.environ.get('GALERIA_CDN_URL', '').rstrip('/')
        file_url = os.environ.get('GALERIA_FILE_URL', '').rstrip('/')
        url_pattern = os.environ.get('GALERIA_URL_PATTERN', '')

        if not all([api_url, cdn_url, file_url, url_pattern]):
            self.stderr.write(
                'Faltan variables de entorno obligatorias:\n'
                '  GALERIA_API_URL, GALERIA_CDN_URL, GALERIA_FILE_URL, GALERIA_URL_PATTERN'
            )
            return

        existing = GaleriaConfig.objects.filter(pk=1).first()
        if existing and not options['actualizar']:
            self.stdout.write(self.style.WARNING(
                'Ya existe configuración. Usa --actualizar para sobrescribir.'
            ))
            return

        GaleriaConfig.objects.update_or_create(
            pk=1,
            defaults={
                'api_url': api_url,
                'cdn_url': cdn_url,
                'file_url': file_url,
                'url_pattern': url_pattern,
            }
        )

        self.stdout.write(self.style.SUCCESS('GaleriaConfig semillada en la BD.'))
