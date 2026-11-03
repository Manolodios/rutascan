import os
import unittest

README_PATH = "README.md"

class TestTask5CompileAndDocs(unittest.TestCase):
    def test_readme_exists(self):
        self.assertTrue(os.path.exists(README_PATH), "Falta README.md con instrucciones de instalación")

    def test_readme_has_install_instructions(self):
        with open(README_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("APK", content, "Falta referencia a APK en README")
        self.assertIn("instalar", content.lower(), "Falta instrucciones de instalación")

if __name__ == "__main__":
    unittest.main()
