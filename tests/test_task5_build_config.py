import os
import unittest

BUILD_GRADLE_PATH = "android/app/build.gradle"

class TestTask5BuildConfig(unittest.TestCase):
    def test_build_gradle_exists(self):
        self.assertTrue(os.path.exists(BUILD_GRADLE_PATH), "Falta archivo android/app/build.gradle")

    def test_has_min_sdk_26(self):
        with open(BUILD_GRADLE_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("minSdk 26", content, "Falta minSdk 26 en build.gradle")

    def test_has_target_sdk_33(self):
        with open(BUILD_GRADLE_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("targetSdk 33", content, "Falta targetSdk 33 en build.gradle")

if __name__ == "__main__":
    unittest.main()
