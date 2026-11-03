# larptok (APK Android)

Aplicación Android llamada **larptok** para descargar videos/reels públicos de Instagram, TikTok y Facebook, imágenes (posts, historias, portadas de reels) y videos de comentarios pegando el enlace directamente. Incluye una barra inferior de cinco pestañas (Inicio, Descargas, Favoritos, Historial y Ajustes) con badges, y **0 publicidad** en toda la app.

La app carga la publicación pública en un WebView y descarga el archivo que la página expone. Según la plataforma y el tipo de publicación, **el archivo puede incluir marca de agua**; larptok no aloja ni procesa el contenido en un servidor propio.

## ⚠️ Advertencia de uso

- Esta app carga la página pública original en un WebView y descarga los archivos que la página expone; no garantiza funcionamiento permanente ni que todas las publicaciones sean descargables.
- Descargar contenido sin autorización viola los términos de servicio de Instagram, TikTok y Facebook. Usa esta app solo para contenido público y de forma personal, no masiva.
- El usuario asume toda responsabilidad por el uso de esta herramienta.

## Cómo instalar la APK

1. Habilita "Fuentes desconocidas" en tu teléfono Android: **Ajustes → Seguridad → Fuentes desconocidas** (o **Instalar apps desconocidas** según tu versión de Android).
2. Generá el APK con `cd android && ./gradlew assembleDebug` (en Windows: `gradlew.bat assembleDebug`). El archivo queda en `android/app/build/outputs/apk/debug/app-debug.apk`.
3. Para distribuir una versión final, generá `./gradlew assembleRelease` y firmá el APK con tu keystore antes de instalarlo.
4. Abre el archivo `.apk` desde la carpeta de Descargas para instalarlo.
5. Una vez instalada, pega el link de la publicación pública en la app y presiona "Procesar link" para descargar.

## Requisitos mínimos

- Android 8.0 (API 26) o superior.
- En Android 9 o inferior se solicita permiso de almacenamiento; en Android 10 o superior las descargas se guardan directamente en la carpeta Descargas.

## Icono de la app

El manifest ya referencia el icono en `android/app/src/main/res/drawable/ic_launcher.png`. Reemplazá ese archivo por la imagen cuadrada en formato PNG que quieras usar como icono de `larptok`; el archivo actual es solo un placeholder.

## Notas técnicas

- La app no requiere un backend propio; abre la publicación pública en un WebView y usa `DownloadManager` para guardar el archivo expuesto por la página.
- Favoritos e Historial son pestañas de vista previa ("Próximamente") en esta versión; Descargas muestra cuántas descargas se iniciaron en la sesión.
- En Ajustes podés elegir una foto de perfil desde la galería. La imagen se guarda localmente con permiso persistente y se puede quitar en cualquier momento; no se sube a ningún servidor.
- El proyecto incluye Gradle wrapper y `settings.gradle`; solo necesitás el Android SDK instalado (API 34 y build-tools 35). El APK de release se genera sin firmar: firmalo con tu keystore antes de distribuirlo.
- El APK de depuración ya se puede generar con `gradlew assembleDebug`; requiere Android SDK (API 34) y Java 17.
