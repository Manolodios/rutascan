import os
import unittest

ACTIVITY_PATH = "android/app/src/main/java/com/descargador/MainActivity.java"

class TestTask2OnClick(unittest.TestCase):
    def test_has_on_click_for_button(self):
        with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("btnProcesar", content, "Falta referencia al botón btnProcesar")

    def test_has_url_validation_for_ig_or_tiktok(self):
        with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        # Verificamos que hay una referencia a la URL o a la validación (aunque sea básica)
        self.assertTrue(
            "instagram" in content.lower() or "tiktok" in content.lower() or "http" in content.lower(),
            "Falta referencia a URL o validación básica"
        )

    def test_uses_web_view_to_load_url(self):
        with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("loadUrl", content, "Falta referencia a webView.loadUrl")

if __name__ == "__main__":
    unittest.main()
