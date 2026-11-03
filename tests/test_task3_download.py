import os
import unittest

ACTIVITY_PATH = "android/app/src/main/java/com/descargador/MainActivity.java"

class TestTask3Download(unittest.TestCase):
    def test_has_download_manager_reference(self):
        with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("DownloadManager", content, "Falta referencia a DownloadManager")

    def test_has_should_override_url_loading(self):
        with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("shouldOverrideUrlLoading", content, "Falta referencia a shouldOverrideUrlLoading")

    def test_has_permission_request_for_storage(self):
        with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        # Verificamos que hay una referencia a permisos o a requestPermissions
        self.assertTrue(
            "requestPermissions" in content or "WRITE_EXTERNAL_STORAGE" in content,
            "Falta referencia a manejo de permisos de almacenamiento"
        )

if __name__ == "__main__":
    unittest.main()
