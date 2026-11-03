import os
import unittest

ACTIVITY_PATH = "android/app/src/main/java/com/descargador/MainActivity.java"

class TestTask2MainActivity(unittest.TestCase):
    def test_activity_exists(self):
        self.assertTrue(
            os.path.exists(ACTIVITY_PATH),
            f"MainActivity no existe en {ACTIVITY_PATH}"
        )

    def test_has_find_view_by_id_for_edit_text(self):
        with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("findViewById", content, "Falta referencia a findViewById")
        self.assertIn("editUrl", content, "Falta referencia al EditText (editUrl)")

    def test_has_find_view_by_id_for_web_view(self):
        with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("webView", content, "Falta referencia al WebView (webView)")

if __name__ == "__main__":
    unittest.main()
