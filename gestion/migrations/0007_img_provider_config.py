# Created by Django 6.0.4

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gestion', '0006_galeriaconfig'),
    ]

    operations = [
        migrations.CreateModel(
            name='ImageProviderConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('api_url', models.URLField(help_text='URL base de la API', max_length=200)),
                ('api_key', models.CharField(help_text='API key', max_length=200)),
                ('user_id', models.CharField(help_text='User ID', max_length=50)),
            ],
            options={
                'verbose_name': 'configuración del proveedor de imágenes',
                'verbose_name_plural': 'configuraciones del proveedor de imágenes',
            },
        ),
    ]
