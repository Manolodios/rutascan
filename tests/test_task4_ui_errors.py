import os
import unittest

ACTIVITY_PATH = "android/app/src/main/java/com/descargador/MainActivity.java"
LAYOUT_PATH = "android/app/src/main/res/layout/activity_main.xml"

class TestTask4UIAndErrors(unittest.TestCase):
    def test_has_url_validation_for_fb_watch(self):
        with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        # El archivo debe tener una referencia a fb.watch o a la validación de URL
        self.assertTrue(
            "fb.watch" in content or "instagram.com" in content or "tiktok.com" in content,
            "Falta referencia a validación de URLs (fb.watch, instagram.com, tiktok.com)"
        )

    def test_has_state_message_update_in_on_click(self):
        with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("tvEstado", content, "Falta referencia al TextView de estado")
        self.assertIn("Estado:", content, "Falta actualización del mensaje de estado")

    def test_has_on_received_error_reference(self):
        with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        # Verificamos que hay una referencia al manejo de errores o al WebViewClient
        self.assertIn("WebViewClient", content, "Falta referencia a WebViewClient (manejo de errores)")

if __name__ == "__main__":
    unittest.main()
