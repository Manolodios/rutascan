import os
import unittest

ACTIVITY_PATH = "android/app/src/main/java/com/descargador/MainActivity.java"
LAYOUT_PATH = "android/app/src/main/res/layout/activity_main.xml"
STRINGS_PATH = "android/app/src/main/res/values/strings.xml"
THEMES_PATH = "android/app/src/main/res/values/themes.xml"
MANIFEST_PATH = "android/app/src/main/AndroidManifest.xml"
README_PATH = "README.md"


def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


class TestTask8ReviewFixes(unittest.TestCase):
    def test_storage_permission_denial_is_handled(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("hasStoragePermission", activity,
                      "Falta la comprobación de permiso de almacenamiento")
        self.assertIn("checkSelfPermission", activity,
                      "Falta checkSelfPermission para Android 8-9")
        self.assertIn("onRequestPermissionsResult", activity,
                      "Falta el callback de resultado de permisos")
        self.assertIn("SecurityException", activity,
                      "Falta manejo de SecurityException al encolar la descarga")
        self.assertIn("pendingDownloadUrl", activity,
                      "Falta reintentar la descarga después de conceder el permiso")

    def test_downloads_are_gated_by_storage_permission(self):
        activity = read(ACTIVITY_PATH)
        start = activity.index("private void startDownload")
        body = activity[start:]
        self.assertIn("hasStoragePermission()", body,
                      "startDownload debe verificar el permiso antes de encolar")

    def test_back_leaves_non_home_tab_before_webview_history(self):
        activity = read(ACTIVITY_PATH)
        start = activity.index("public void onBackPressed()")
        end = activity.index("\n    }", start)
        body = activity[start:end]
        self.assertLess(
            body.index("currentTab != TAB_HOME"),
            body.index("canGoBack"),
            "El botón atrás debe volver a Inicio antes de navegar el WebView oculto"
        )

    def test_page_load_error_is_not_overwritten_by_ready_status(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("pageLoadFailed", activity,
                      "Falta indicador de error de carga de página")
        self.assertIn("onPageStarted", activity,
                      "Falta reinicio del indicador de error en onPageStarted")
        self.assertIn("onReceivedHttpError", activity,
                      "Falta manejo de errores HTTP")
        self.assertIn("isForMainFrame", activity,
                      "Falta distinguir errores del marco principal")

    def test_download_state_survives_rotation(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("onSaveInstanceState", activity,
                      "Falta guardar el estado de la UI")
        self.assertIn("onRestoreInstanceState", activity,
                      "Falta restaurar el estado de la UI")
        self.assertIn("webView.saveState", activity,
                      "Falta guardar el estado del WebView")
        self.assertIn("webView.restoreState", activity,
                      "Falta restaurar el estado del WebView")

    def test_downloads_panel_reflects_session_count(self):
        layout = read(LAYOUT_PATH)
        activity = read(ACTIVITY_PATH)
        self.assertIn('android:id="@+id/tvDownloadsSummary"', layout,
                      "Falta el resumen de descargas en el panel Descargas")
        self.assertIn("R.id.tvDownloadsSummary", activity,
                      "MainActivity no actualiza el resumen de descargas")

    def test_url_validation_uses_uri_host_allowlist(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("Uri.parse", activity, "Falta parseo de URL con Uri")
        self.assertIn("getHost", activity, "Falta validación del host")
        self.assertIn("getUserInfo", activity, "Falta rechazo de userinfo en la URL")
        self.assertIn("https", activity, "Falta exigir HTTPS")
        self.assertIn("endsWith(\".\" + domain)", activity,
                      "La validación debe aceptar subdominios con límite de punto")

    def test_webview_blocks_file_and_content_access(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("setAllowFileAccess(false)", activity,
                      "WebView debe bloquear acceso a archivos")
        self.assertIn("setAllowContentAccess(false)", activity,
                      "WebView debe bloquear acceso a content://")

    def test_download_forwards_webview_user_agent(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("userAgent", activity, "Falta el user agent del WebView")
        self.assertIn('"User-Agent"', activity, "Falta el header User-Agent")

    def test_duplicate_downloads_are_suppressed(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("lastDownloadUrl", activity, "Falta deduplicación de descargas")
        self.assertIn("lastDownloadAt", activity, "Falta ventana de deduplicación")
        self.assertIn("DUPLICATE_WINDOW_MS", activity, "Falta constante de ventana de deduplicación")

    def test_webview_lifecycle_is_managed(self):
        activity = read(ACTIVITY_PATH)
        self.assertIn("webView.onPause()", activity, "Falta pausar el WebView")
        self.assertIn("webView.onResume()", activity, "Falta reanudar el WebView")
        self.assertIn("webView.destroy()", activity, "Falta destruir el WebView")
        self.assertIn("pauseTimers", activity, "Falta pausar timers del WebView")
        self.assertIn("resumeTimers", activity, "Falta reanudar timers del WebView")

    def test_gradle_project_scaffold_exists(self):
        required = [
            "android/settings.gradle",
            "android/build.gradle",
            "android/gradle.properties",
            "android/app/proguard-rules.pro",
            "android/gradlew",
            "android/gradlew.bat",
            "android/gradle/wrapper/gradle-wrapper.properties",
            "android/gradle/wrapper/gradle-wrapper.jar",
        ]
        for path in required:
            self.assertTrue(os.path.exists(path), "Falta el archivo de build %s" % path)

    def test_appcompat_theme_sets_color_accent(self):
        themes = read(THEMES_PATH)
        self.assertIn('<item name="colorAccent">@color/accent_2</item>', themes,
                      "Theme.Larptok debe definir colorAccent para AppCompat")

    def test_readme_is_honest_about_watermark_limitations(self):
        readme = read(README_PATH)
        self.assertIn("puede incluir marca de agua", readme,
                      "README debe aclarar que el archivo puede incluir marca de agua")

    def test_placeholder_tabs_are_labeled_as_upcoming(self):
        strings = read(STRINGS_PATH)
        self.assertIn("Próximamente", strings,
                      "Favoritos e Historial deben indicar que son próximamente")


if __name__ == "__main__":
    unittest.main()
