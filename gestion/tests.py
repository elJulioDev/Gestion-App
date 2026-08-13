from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from gestion.models import Carpeta, Marcador, ProveedorConfig
from gestion.thumbnail_checker import verificar_marcadores_ids


class VerificarMarcadoresTests(TestCase):
    def setUp(self):
        cfg = ProveedorConfig.load()
        cfg.url_pattern = r'video/([a-z0-9]+)'
        cfg.save()
        self.user = User.objects.create_user(username='u')
        self.carpeta = Carpeta.objects.create(usuario=self.user, nombre='c')

    def marcador(self, url, titulo):
        return Marcador.objects.create(
            usuario=self.user, carpeta=self.carpeta,
            titulo=titulo, url=url, icono='x',
        )

    @patch('gestion.icono_providers._proveedor_video')
    def test_solo_borra_videos_eliminados_del_proveedor(self, proveedor):
        activo = self.marcador('https://example.com/video/aaa', titulo='a')
        borrado = self.marcador('https://example.com/video/bbb', titulo='b')
        externo = self.marcador('https://example.com/pagina/ccc', titulo='c')
        proveedor.side_effect = lambda url, cfg: {'id': 1} if 'aaa' in url else None

        res = verificar_marcadores_ids(self.user, [activo.id, borrado.id, externo.id])

        activo.refresh_from_db()
        borrado.refresh_from_db()
        externo.refresh_from_db()
        self.assertEqual(res[activo.id], 'ok')
        self.assertEqual(res[borrado.id], 'borrado')
        self.assertEqual(res[externo.id], 'ok')
        self.assertFalse(activo.eliminado)
        self.assertTrue(activo.verificado)
        self.assertTrue(borrado.eliminado)
        self.assertTrue(borrado.verificado)
        self.assertFalse(externo.eliminado)
        self.assertTrue(externo.verificado)

    @patch('gestion.icono_providers._proveedor_video')
    def test_proveedor_inalcanzable_no_elimina(self, proveedor):
        activo = self.marcador('https://example.com/video/aaa', titulo='a')
        proveedor.side_effect = OSError('sin conexión')

        res = verificar_marcadores_ids(self.user, [activo.id])

        activo.refresh_from_db()
        self.assertEqual(res[activo.id], 'error')
        self.assertFalse(activo.eliminado)
        self.assertFalse(activo.verificado)
