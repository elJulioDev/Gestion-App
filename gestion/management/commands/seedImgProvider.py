"""
Semilla para ImageProviderConfig.
Uso:
    python manage.py seedImgProvider
    python manage.py seedImgProvider --actualizar
Lee las variables de entorno IMG_* y las inserta en la BD.
"""
import os
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Semilla la configuración del proveedor de imágenes en la BD'

    def add_arguments(self, parser):
        parser.add_argument('--actualizar', action='store_true',
                            help='Sobrescribe el registro existente')

    def handle(self, *args, **options):
        from gestion.models import ImageProviderConfig

        api_url = os.environ.get('IMG_API_URL', '').rstrip('/')
        api_key = os.environ.get('IMG_API_KEY', '')
        user_id = os.environ.get('IMG_USER_ID', '')

        if not all([api_url, api_key, user_id]):
            self.stderr.write(
                'Faltan variables de entorno obligatorias:\n'
                '  IMG_API_URL, IMG_API_KEY, IMG_USER_ID'
            )
            return

        existing = ImageProviderConfig.objects.filter(pk=1).first()
        if existing and not options['actualizar']:
            self.stdout.write(self.style.WARNING(
                'Ya existe configuración. Usa --actualizar para sobrescribir.'
            ))
            return

        ImageProviderConfig.objects.update_or_create(
            pk=1,
            defaults={
                'api_url': api_url,
                'api_key': api_key,
                'user_id': user_id,
            }
        )

        self.stdout.write(self.style.SUCCESS('ImageProviderConfig semillada en la BD.'))
