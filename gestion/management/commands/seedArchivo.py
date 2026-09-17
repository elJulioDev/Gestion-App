"""
Semilla para ArchivoConfig.
Uso:
    python manage.py seedArchivo
    python manage.py seedArchivo --actualizar
Lee la variable de entorno ARCHIVO_API_URL y la inserta en la BD.
"""
import os
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Semilla la configuración del proveedor de archivos en la BD'

    def add_arguments(self, parser):
        parser.add_argument('--actualizar', action='store_true',
                            help='Sobrescribe el registro existente')

    def handle(self, *args, **options):
        from gestion.models import ArchivoConfig

        api_url = os.environ.get('ARCHIVO_API_URL', '').rstrip('/')

        if not api_url:
            self.stderr.write('Falta la variable de entorno obligatoria:\n  ARCHIVO_API_URL')
            return

        existing = ArchivoConfig.objects.filter(pk=1).first()
        if existing and not options['actualizar']:
            self.stdout.write(self.style.WARNING(
                'Ya existe configuración. Usa --actualizar para sobrescribir.'
            ))
            return

        ArchivoConfig.objects.update_or_create(
            pk=1,
            defaults={'api_url': api_url}
        )

        self.stdout.write(self.style.SUCCESS('ArchivoConfig semillada en la BD.'))
