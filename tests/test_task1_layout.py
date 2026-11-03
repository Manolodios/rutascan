import os
import unittest
from xml.etree import ElementTree as ET

LAYOUT_PATH = "android/app/src/main/res/layout/activity_main.xml"

class TestTask1Layout(unittest.TestCase):
    def test_layout_exists(self):
        self.assertTrue(os.path.exists(LAYOUT_PATH), f"Layout no existe en {LAYOUT_PATH}")

    def test_has_edit_text(self):
        tree = ET.parse(LAYOUT_PATH)
        root = tree.getroot()
        tags = [elem.tag for elem in root.iter()]
        self.assertIn("EditText", tags, "Falta EditText")

    def test_has_button(self):
        tree = ET.parse(LAYOUT_PATH)
        root = tree.getroot()
        tags = [elem.tag for elem in root.iter()]
        self.assertIn("Button", tags, "Falta Button")

    def test_has_web_view(self):
        tree = ET.parse(LAYOUT_PATH)
        root = tree.getroot()
        tags = [elem.tag for elem in root.iter()]
        self.assertIn("WebView", tags, "Falta WebView")

    def test_has_text_view(self):
        tree = ET.parse(LAYOUT_PATH)
        root = tree.getroot()
        tags = [elem.tag for elem in root.iter()]
        self.assertIn("TextView", tags, "Falta TextView")

if __name__ == "__main__":
    unittest.main()
