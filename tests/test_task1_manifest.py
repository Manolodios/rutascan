import os
import unittest

MANIFEST_PATH = "android/app/src/main/AndroidManifest.xml"

class TestTask1Manifest(unittest.TestCase):
    def test_manifest_exists(self):
        self.assertTrue(os.path.exists(MANIFEST_PATH), f"Manifest no existe en {MANIFEST_PATH}")

    def test_has_internet_permission(self):
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("INTERNET", content, "Falta permiso INTERNET")

    def test_has_write_external_storage_permission(self):
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("WRITE_EXTERNAL_STORAGE", content, "Falta permiso WRITE_EXTERNAL_STORAGE")

    def test_has_read_external_storage_permission(self):
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("READ_EXTERNAL_STORAGE", content, "Falta permiso READ_EXTERNAL_STORAGE")

if __name__ == "__main__":
    unittest.main()
