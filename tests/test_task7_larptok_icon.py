import os
import unittest

MANIFEST_PATH = "android/app/src/main/AndroidManifest.xml"
ICON_PATH = "android/app/src/main/res/drawable/ic_launcher.png"

class TestTask7LarptokIcon(unittest.TestCase):
    def test_app_name_is_larptok(self):
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn('android:label="larptok"', content, "Falta el nombre 'larptok' en AndroidManifest.xml")

    def test_icon_exists(self):
        self.assertTrue(os.path.exists(ICON_PATH), f"Falta el icono de la app en {ICON_PATH}")

    def test_manifest_references_icon(self):
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn('android:icon="@drawable/ic_launcher"', content,
                      "AndroidManifest.xml no usa el icono de la app")

if __name__ == "__main__":
    unittest.main()
