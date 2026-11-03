# Descargador de Videos Públicos (APK Android)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una APK Android que permita pegar el enlace público de un video/reel de Instagram o TikTok, lo procese mediante un servicio web existente (tipo y2mate / ssyoutube) y permita descargar el archivo MP4 sin marca de agua al dispositivo.

**Architecture:** APK Android nativa con una interfaz simple (campo de texto + botón). Usa WebView para cargar un servicio web de descarga existente con la URL pre-llenada. Intercepta la descarga o usa DownloadManager para guardar el archivo en la carpeta de Descargas del teléfono. No requiere backend propio, depende de servicios externos.

**Nota:** Este plan asume que se está creando un nuevo proyecto Android (o que la estructura básica del proyecto con `gradlew` existe). Si no existe, debe crearse primero con Android Studio o con `gradlew init`.

**Tech Stack:** Android SDK (Java o Kotlin), Android WebView, DownloadManager, permisos de almacenamiento (READ_EXTERNAL_STORAGE / WRITE_EXTERNAL_STORAGE o MANAGE_EXTERNAL_STORAGE según versión de Android).

**Spec:** `docs/superpowers/specs/2026-11-03-descargador-videos-publicos-design.md`

## Global Constraints

- Plataforma: Android (APK), sin Play Store.
- Idioma de la app: Español.
- No descargar contenido privado ni que requiera login en la app.
- Distribución directa como archivo `.apk`.
- El scraping o procesamiento se delega a servicios web existentes (no se desarrolla backend propio para scraping de IG/TikTok).
- La app debe informar al usuario que el uso es personal y que viola los ToS de las plataformas; no debe promover uso masivo.
- La APK debe funcionar con Android 8.0 (API 26) o superior.

## Review Focus

- El servicio web externo cambia o deja de funcionar: la app debe manejar errores de carga en WebView (mostrar mensaje de error al usuario).
- La URL pegada no es válida o no es pública: la app debe validar que sea una URL de IG o TikTok antes de procesar.
- La descarga falla por falta de permisos: la app debe solicitar permisos en tiempo de ejecución y manejar la denegación.
- El archivo descargado no tiene marca de agua: esto depende del servicio externo; la app solo garantiza que descarga el archivo que el servicio devuelve.
- La interfaz debe ser simple: campo de texto, botón "Procesar", botón "Descargar", y una lista de descargas recientes (opcional, mínimo viable: solo campo + botón + mensaje de estado).

---

### Task 1: Configurar proyecto Android y manifest básico

**Files:**
- Create: `android/app/src/main/AndroidManifest.xml`
- Create: `android/app/src/main/res/layout/activity_main.xml`
- Create: `android/app/src/main/java/com/descargador/MainActivity.java` (o Kotlin)

**Interfaces:**
- Consumes: Especificación de diseño (`docs/superpowers/specs/2026-11-03-descargador-videos-publicos-design.md`)
- Produces: Proyecto Android básico con permisos declarados y layout base.

- [ ] **Step 1: Escribir el archivo `AndroidManifest.xml` con permisos de Internet y almacenamiento**

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.descargador.videos">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <application ... >
        <activity android:name=".MainActivity">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

- [ ] **Step 2: Crear layout básico `activity_main.xml` con `EditText` (URL), `Button` (Procesar), `WebView`, y `TextView` (estado)**

- [ ] **Step 3: Verificar que el proyecto compila sin errores (`gradlew assembleDebug`)**

- [ ] **Step 4: Commit inicial del proyecto Android**

---

### Task 2: Implementar la interfaz nativa y la WebView

**Files:**
- Modify: `android/app/src/main/java/com/descargador/MainActivity.java`
- Modify: `android/app/src/main/res/layout/activity_main.xml` (agregar IDs a los elementos)

**Interfaces:**
- Consumes: Layout de Task 1 (`EditText`, `Button`, `WebView`)
- Produces: `MainActivity` con referencias a los elementos de la UI y un `WebView` configurado con `WebViewClient` básico.

- [ ] **Step 1: Implementar `findViewById` para todos los elementos en `MainActivity`**

- [ ] **Step 2: Configurar `WebView` (habilitar JavaScript, configurar `WebSettings`) y asignar `WebViewClient` básico**

- [ ] **Step 3: Implementar `onClick` del botón "Procesar" que toma el texto del `EditText`, valida que sea URL de IG o TikTok (`contains("instagram.com")` o `contains("tiktok.com")`), y carga la URL en la `WebView` con un servicio web existente (ej. `https://y2mate.com/en/` o similar con la URL como parámetro, o simplemente carga la URL original y deja que el usuario use el servicio)**

Nota: Dado que no hay una API pública estable, la implementación más simple es que la `WebView` cargue la URL del video directamente, o cargue un servicio conocido con la URL como query param. El plan asume que el desarrollador puede usar una URL de servicio existente conocida o simplemente cargar la URL del video y dejar que el usuario use el servicio desde la WebView.

- [ ] **Step 4: Probar que el botón carga algo en la WebView sin crashear**

- [ ] **Step 5: Commit**

---

### Task 3: Interceptar descarga y usar DownloadManager

**Files:**
- Modify: `android/app/src/main/java/com/descargador/MainActivity.java`

**Interfaces:**
- Consumes: `WebView` configurado en Task 2
- Produces: Capacidad de descargar archivos (o al menos que la WebView permita descargar). Si la WebView carga un servicio que ofrece descarga, el usuario puede descargar desde la WebView. Si queremos que sea más automático, podemos interceptar URLs que terminan en `.mp4` usando `WebViewClient.shouldOverrideUrlLoading` y lanzar `DownloadManager` con esa URL.

- [ ] **Step 1: Implementar `WebViewClient.shouldOverrideUrlLoading` para detectar URLs que terminan en `.mp4` o que contienen patrones de descarga**

- [ ] **Step 2: Si se detecta una URL de archivo, lanzar `DownloadManager.Request` con la URL y guardar en `Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)`**

- [ ] **Step 3: Solicitar permisos en tiempo de ejecución (`requestPermissions`) si es Android 6.0+**

- [ ] **Step 4: Probar que al hacer clic en un enlace `.mp4` dentro de la WebView, se inicia la descarga**

- [ ] **Step 5: Commit**

---

### Task 4: Mejorar la UI y agregar manejo de errores básico

**Files:**
- Modify: `android/app/src/main/res/layout/activity_main.xml`
- Modify: `android/app/src/main/java/com/descargador/MainActivity.java`

**Interfaces:**
- Consumes: MainActivity existente
- Produces: UI con mensaje de estado (cargando, error, descarga iniciada) y validación básica de URL.

- [ ] **Step 1: Agregar validación de URL en el botón: si no contiene `instagram.com`, `tiktok.com`, o `fb.watch`, mostrar un `Toast` de error**

- [ ] **Step 2: Actualizar `TextView` de estado con mensajes como "Procesando...", "Descarga iniciada", "Error: servicio no disponible"**

- [ ] **Step 3: Manejar errores de carga de WebView (`WebViewClient.onReceivedError`) y actualizar el `TextView` de estado**

- [ ] **Step 4: Probar con una URL pública de IG o TikTok**

- [ ] **Step 5: Commit**

---

### Task 5: Compilar APK final y documentar distribución

**Files:**
- Modify: `android/app/build.gradle` (verificar `minSdkVersion` y `targetSdkVersion`)
- Create: `README.md` (instrucciones de instalación del APK)

**Interfaces:**
- Consumes: Proyecto completo
- Produces: Archivo `.apk` compilado (`app-debug.apk` o `app-release.apk` con firma básica) y documentación básica.

- [ ] **Step 1: Ajustar `build.gradle` para `minSdkVersion 26`, `targetSdkVersion 33` (o lo que corresponda)**

- [ ] **Step 2: Compilar la APK (`gradlew assembleRelease`)**

- [ ] **Step 3: Crear `README.md` con instrucciones de instalación (cómo instalar APK en Android, habilitar "Fuentes desconocidas") y advertencia de uso personal**

- [ ] **Step 4: Verificar que el archivo `.apk` existe en `android/app/build/outputs/apk/`**

- [ ] **Step 5: Commit final**

---

### Task 6: Ampliar descarga a imágenes, historias, reels con portada y confirmar 0 publicidad

**Files:**
- Modify: `android/app/src/main/java/com/descargador/MainActivity.java`
- Modify: `android/app/src/main/res/layout/activity_main.xml` (opcional: agregar indicador de tipo de archivo)

**Interfaces:**
- Consumes: `MainActivity` existente (`WebViewClient`, `DownloadManager`, `requestPermissions`)
- Produces: Capacidad de descargar `.jpg`, `.png`, `.mp4`, `.jpeg` y confirmar que la interfaz no tiene anuncios ni banners.

- [ ] **Step 1: Actualizar `shouldOverrideUrlLoading` para detectar `.jpg`, `.jpeg`, `.png`, `.mp4`**

Según el código actual, agregar las extensiones `.jpg`, `.jpeg`, `.png` al bloque `if` en `shouldOverrideUrlLoading`.

- [ ] **Step 2: Agregar mensaje en `activity_main.xml` que confirme "0 publicidad — sin anuncios ni banners"**

Según el plan, agregar un `TextView` o actualizar el mensaje existente para confirmar que la app no tiene publicidad.

- [ ] **Step 3: Probar que al cargar una URL de imagen o historia, la descarga funciona sin errores**

- [ ] **Step 4: Confirmar que la interfaz no muestra anuncios ni banners**

Según el código, no hay referencias a anuncios, banners ni servicios con publicidad en la UI.

- [ ] **Step 5: Commit final de ampliación**

---

## Ejecución recomendada

Recomiendo **Native** (implementación en esta sesión paso a paso) porque es un proyecto pequeño con tareas secuenciales y dependencias claras entre la UI, la WebView y la descarga. El riesgo de error es bajo si se sigue el plan exactamente.

**Nota sobre servicios externos:** El plan asume que el usuario pegará una URL pública y que la app cargará un servicio web existente (como y2mate o ssyoutube) o la URL original en una WebView. Dado que estos servicios pueden cambiar o ser bloqueados, la app debe ser considerada una herramienta personal y no un producto garantizado. Si el usuario quiere un servicio más robusto, se requiere un backend propio con manejo de cookies y proxies, lo cual excede el alcance de esta APK simple.
