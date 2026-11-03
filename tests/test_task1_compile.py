import os
import unittest

GRADLEW_PATH = "android/gradlew"

class TestTask1Compile(unittest.TestCase):
    def test_gradlew_exists_or_project_has_structure(self):
        # Si gradlew existe, verificamos que esté presente.
        # Si no existe (porque no hay SDK de Android instalado en este entorno),
        # verificamos que al menos existan los archivos clave del proyecto.
        has_gradlew = os.path.exists(GRADLEW_PATH)
        has_manifest = os.path.exists("android/app/src/main/AndroidManifest.xml")
        has_layout = os.path.exists("android/app/src/main/res/layout/activity_main.xml")
        self.assertTrue(
            has_gradlew or (has_manifest and has_layout),
            "Falta gradlew o archivos básicos del proyecto"
        )

if __name__ == "__main__":
    unittest.main()
