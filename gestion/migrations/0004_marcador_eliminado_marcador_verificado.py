from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gestion', '0003_proveedorconfig'),
    ]

    operations = [
        migrations.AddField(
            model_name='marcador',
            name='eliminado',
            field=models.BooleanField(
                default=False,
                help_text='Soft-delete: video no disponible en el proveedor',
            ),
        ),
        migrations.AddField(
            model_name='marcador',
            name='verificado',
            field=models.BooleanField(
                default=False,
                help_text='True si ya se verificó que el icono/URL es válido',
            ),
        ),
    ]
