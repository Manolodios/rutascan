import os
import unittest

ACTIVITY_PATH = "android/app/src/main/java/com/descargador/MainActivity.java"
LAYOUT_PATH = "android/app/src/main/res/layout/activity_main.xml"

class TestTask6Ampliacion(unittest.TestCase):
    def test_has_image_extensions_in_download_check(self):
        with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        # Verificamos que hay referencias a .jpg, .jpeg o .png en el archivo
        has_jpg = ".jpg" in content
        has_png = ".png" in content
        has_jpeg = ".jpeg" in content
        self.assertTrue(
            has_jpg or has_png or has_jpeg,
            "Falta referencia a extensiones de imagen (.jpg, .jpeg, .png) en MainActivity"
        )

    def test_has_zero_publicidad_confirmation(self):
        with open(LAYOUT_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("0 publicidad", content, "Falta confirmación de '0 publicidad' en el layout")

    def test_has_no_ads_in_activity(self):
        with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        # Confirmamos que no hay referencias explícitas a anuncios o banners
        # Evitamos confundir con palabras como "DownloadManager"
        lines = content.splitlines()
        for line in lines:
            lower_line = line.lower()
            if "publicidad" in lower_line or "anuncio" in lower_line or "banner" in lower_line or ("ad" == lower_line or lower_line.startswith("ad ") or lower_line.endswith(" ad")):
                if "download" not in lower_line and "shouldoverrideurlloading" not in lower_line:
                    self.fail(f"No debe haber referencias a anuncios en MainActivity: {line}")

if __name__ == "__main__":
    unittest.main()
