import os
import unittest

LAYOUT_PATH = "android/app/src/main/res/layout/activity_main.xml"
ACTIVITY_PATH = "android/app/src/main/java/com/descargador/MainActivity.java"
MANIFEST_PATH = "android/app/src/main/AndroidManifest.xml"
THEME_PATH = "android/app/src/main/res/values/themes.xml"
COLORS_PATH = "android/app/src/main/res/values/colors.xml"
DRAWABLE_DIR = "android/app/src/main/res/drawable"

TABS = ["Home", "Downloads", "Favorites", "History", "Settings"]
CONTENTS = ["Home", "Downloads", "Favorites", "History", "Settings"]
ICONS = ["Home", "Downloads", "Favorites", "History", "Settings"]


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


class TestTask8NativeTabs(unittest.TestCase):
    def test_layout_has_five_tab_items(self):
        layout = read(LAYOUT_PATH)
        for tab in TABS:
            self.assertIn('android:id="@+id/tab%s"' % tab, layout,
                          "Falta la pestaña %s en activity_main.xml" % tab)

    def test_layout_has_five_content_panels(self):
        layout = read(LAYOUT_PATH)
        for content in CONTENTS:
            self.assertIn('android:id="@+id/content%s"' % content, layout,
                          "Falta el panel content%s en activity_main.xml" % content)

    def test_layout_has_download_and_history_badges(self):
        layout = read(LAYOUT_PATH)
        self.assertIn('android:id="@+id/badgeDownloads"', layout, "Falta el badge de Descargas")
        self.assertIn('android:id="@+id/badgeHistory"', layout, "Falta el punto de Historial")
        self.assertIn('android:background="@drawable/bg_badge"', layout, "El badge de Descargas no usa bg_badge")
        self.assertIn('android:background="@drawable/bg_dot"', layout, "El punto de Historial no usa bg_dot")

    def test_tab_icons_exist(self):
        for tab in ICONS:
            path = os.path.join(DRAWABLE_DIR, "ic_tab_%s.xml" % tab.lower())
            self.assertTrue(os.path.exists(path), "Falta el icono %s" % path)

    def test_manifest_uses_larptok_theme(self):
        manifest = read(MANIFEST_PATH)
        self.assertIn('android:theme="@style/Theme.Larptok"', manifest,
                      "AndroidManifest.xml no usa Theme.Larptok")

    def test_theme_and_color_tokens_exist(self):
        theme = read(THEME_PATH)
        colors = read(COLORS_PATH)
        self.assertIn('name="Theme.Larptok"', theme, "Falta Theme.Larptok")
        for token in ["bg", "surface", "text_primary", "text_secondary", "accent_2", "badge"]:
            self.assertIn('name="%s"' % token, colors, "Falta el color %s" % token)

    def test_activity_wires_tabs_and_content_panels(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("selectTab", activity, "MainActivity no tiene selectTab")
        for tab in TABS:
            self.assertIn("R.id.tab%s" % tab, activity,
                          "MainActivity no referencia R.id.tab%s" % tab)
            self.assertIn("R.id.content%s" % tab, activity,
                          "MainActivity no referencia R.id.content%s" % tab)
            self.assertIn("R.id.icon%s" % tab, activity,
                          "MainActivity no referencia R.id.icon%s" % tab)
            self.assertIn("R.id.label%s" % tab, activity,
                          "MainActivity no referencia R.id.label%s" % tab)

    def test_activity_updates_badges(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("R.id.badgeDownloads", activity, "MainActivity no actualiza el badge de Descargas")
        self.assertIn("R.id.badgeHistory", activity, "MainActivity no actualiza el punto de Historial")
        self.assertIn("updateBadges", activity, "MainActivity no tiene updateBadges")

    def test_activity_accepts_instagram_tiktok_and_facebook(self):
        activity = read(ACTIVITY_PATH)
        for domain in ["instagram.com", "tiktok.com", "facebook.com", "fb.watch"]:
            self.assertIn(domain, activity, "MainActivity no acepta %s" % domain)

    def test_activity_detects_media_urls_with_query_strings(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("isMediaUrl", activity, "MainActivity no tiene isMediaUrl")
        for ext in [".mp4", ".jpg", ".jpeg", ".png", ".webp"]:
            self.assertIn('"%s"' % ext, activity, "MainActivity no reconoce %s" % ext)
        self.assertIn(".contains(", activity,
                      "La detección de medios debe usar contains() para tolerar query strings")

    def test_activity_handles_back_navigation(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("onBackPressed", activity, "MainActivity no maneja el botón atrás")
        self.assertIn("canGoBack", activity, "MainActivity no navega atrás en el WebView")

    def test_activity_requests_storage_permission_only_on_legacy_android(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("Build.VERSION.SDK_INT", activity,
                      "MainActivity no distingue versiones de Android para permisos")
        self.assertIn("Build.VERSION_CODES.P", activity,
                      "MainActivity no limita el permiso de almacenamiento a Android 9 o menor")


if __name__ == "__main__":
    unittest.main()
