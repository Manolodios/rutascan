import os
import unittest

LAYOUT_PATH = "android/app/src/main/res/layout/activity_main.xml"
ACTIVITY_PATH = "android/app/src/main/java/com/descargador/MainActivity.java"
STRINGS_PATH = "android/app/src/main/res/values/strings.xml"
DRAWABLE_DIR = "android/app/src/main/res/drawable"


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


class TestTask9ProfilePhoto(unittest.TestCase):
    def test_settings_has_circular_avatar(self):
        layout = read(LAYOUT_PATH)
        self.assertIn('android:id="@+id/avatarContainer"', layout,
                      "Falta el contenedor del avatar en Ajustes")
        self.assertIn('android:id="@+id/imgAvatar"', layout,
                      "Falta el ImageView de la foto de perfil")
        self.assertIn('android:id="@+id/icAvatarPlaceholder"', layout,
                      "Falta el placeholder del avatar")
        self.assertIn('android:clipToOutline="true"', layout,
                      "El avatar debe recortarse en círculo")
        self.assertIn('android:scaleType="centerCrop"', layout,
                      "La foto de perfil debe recortarse con centerCrop")

    def test_settings_has_change_and_remove_actions(self):
        layout = read(LAYOUT_PATH)
        self.assertIn('android:id="@+id/tvProfileHint"', layout,
                      "Falta el texto de ayuda de la foto de perfil")
        self.assertIn('android:id="@+id/actionChangePhoto"', layout,
                      "Falta la acción para cambiar la foto")
        self.assertIn('android:id="@+id/actionRemovePhoto"', layout,
                      "Falta la acción para quitar la foto")

    def test_activity_opens_gallery_for_profile_photo(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("ActivityResultContracts.OpenDocument", activity,
                      "Falta el selector de imágenes del sistema")
        self.assertIn("registerForActivityResult", activity,
                      "Falta registrar el resultado del selector de imágenes")
        self.assertIn('new String[]{"image/*"}', activity,
                      "El selector debe limitarse a imágenes")
        self.assertIn("avatarPicker.launch", activity,
                      "Falta abrir el selector de imágenes")

    def test_activity_persists_avatar_with_persistable_permission(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("takePersistableUriPermission", activity,
                      "Falta conservar el permiso de lectura de la imagen")
        self.assertIn("FLAG_GRANT_READ_URI_PERMISSION", activity,
                      "Falta el flag de lectura para la imagen elegida")
        self.assertIn("getSharedPreferences", activity,
                      "Falta guardar la foto entre reinicios")
        self.assertIn('"avatar_uri"', activity,
                      "Falta la clave de preferencias de la foto de perfil")
        self.assertIn("putString", activity,
                      "Falta persistir la URI de la foto")

    def test_activity_loads_and_removes_avatar(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("loadAvatar", activity,
                      "Falta cargar la foto de perfil")
        self.assertIn("removeAvatar", activity,
                      "Falta quitar la foto de perfil")
        self.assertIn("BitmapFactory", activity,
                      "Falta decodificar la imagen de la galería")
        self.assertIn("openInputStream", activity,
                      "Falta abrir la imagen desde el content resolver")
        self.assertIn("inSampleSize", activity,
                      "La imagen debe reducirse para no gastar memoria")

    def test_activity_wires_avatar_actions(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("R.id.avatarContainer", activity,
                      "MainActivity no escucha el toque sobre el avatar")
        self.assertIn("R.id.actionChangePhoto", activity,
                      "MainActivity no escucha la acción de cambiar foto")
        self.assertIn("R.id.actionRemovePhoto", activity,
                      "MainActivity no escucha la acción de quitar foto")

    def test_profile_drawables_exist(self):
        for name in ["bg_avatar.xml", "ic_person.xml"]:
            path = os.path.join(DRAWABLE_DIR, name)
            self.assertTrue(os.path.exists(path), "Falta el drawable %s" % path)

    def test_profile_strings_exist(self):
        strings = read(STRINGS_PATH)
        for name in [
            "profile_photo_title",
            "profile_photo_hint",
            "profile_photo_hint_saved",
            "profile_photo_change",
            "profile_photo_remove",
            "profile_photo_error",
        ]:
            self.assertIn('name="%s"' % name, strings,
                          "Falta el string %s" % name)


if __name__ == "__main__":
    unittest.main()
