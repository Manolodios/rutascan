# Diseño: APK Descargador de Videos Públicos (IG / TikTok)

Fecha: 2026-11-03
Estado: Pendiente de aprobación del usuario

## Intento y por qué
Crear una aplicación Android (APK) que permita a un usuario pegar el enlace público de un reel/video de Instagram o TikTok y descargarlo en formato MP4 sin marca de agua, guardándolo directamente en la galería del teléfono.
El usuario está cansado de las apps de Play Store que cobran por esta funcionalidad básica.

## Objetivos (actualizado según confirmación del usuario)
- Pegar URL pública de IG, TikTok o Facebook.
- Procesar el enlace y extraer el video original (sin watermark) en formato MP4.
- Descargar imágenes (posts, historias, portadas de reels) en formato JPG/PNG.
- Descargar videos de comentarios y reels con su portada.
- Interfaz simple en español, sin publicidad ni banners.
- 0 publicidad: ni anuncios ni servicios web con publicidad dentro de la app.

## No-objetivos / Anti-objetivos
- NO descargar contenido privado ni que requiera login del usuario en la app.
- NO hacer scraping automatizado masivo ni bots.
- NO distribuir por Google Play Store (se distribuye como archivo APK directamente).
- NO garantizar funcionamiento permanente (las plataformas cambian sus defensas constantemente; se requiere mantenimiento).
- NO violar términos de servicio sin advertencia (el usuario debe saber que es su responsabilidad).

## Restricciones y riesgos
- Instagram y TikTok protegen activamente sus APIs y bloquean requests no autenticadas. Un teléfono Android solo no puede hacer scraping efectivo hoy sin ser detectado.
- Se requiere un backend simple (o servicio web) que reciba la URL, haga la petición con manejo de cookies/headers y devuelva el archivo directo.
- El scraping sin autorización viola los ToS de Meta y ByteDance. El usuario asume el riesgo de uso personal, no masivo.
- La APK debe pedir permisos mínimos (solo almacenamiento).

## Enfoques considerados
1. **A — APK + Backend web:** La APK es una interfaz ligera (WebView o nativa) que envía la URL a un servicio web que hace el scraping y devuelve el archivo. Más realista y mantenible.
2. **B — Scraping 100% local:** La APK intenta conectarse directamente. Hoy casi imposible por medidas anti-bot. Se descarta.
3. **C — PWA (Web App):** Una página web instalada como app. Funciona igual, más fácil de actualizar, sin APK. El usuario pidió APK explícitamente, pero se menciona como alternativa si cambia de opinión.

**Enfoque elegido:** A (APK conectada a servicio web de procesamiento). Si el usuario no quiere un backend, se puede simplificar a una WebView que cargue un servicio externo existente, aunque eso limita el control.

## Partes decididas por el usuario / por defecto
- **Plataforma:** Android (APK), sin Play Store.
- **Idioma:** Español.
- **Contenido objetivo:** Reels, videos públicos, historias (stories), videos de comentarios, imágenes de posts y portadas de reels de IG y TikTok; también contenido público de Facebook (fb.watch). Sin login requerido en la app para ver el contenido.
- **0 publicidad:** La app no debe mostrar anuncios, banners ni usar servicios web que muestren publicidad. El usuario debe poder descargar sin ver anuncios dentro de la interfaz.
- **Distribución:** Archivo .apk directo.
- **Backend:** Se asume necesario. Si el usuario no quiere gestionar un backend, la app podría ser solo una interfaz que usa un servicio externo de scraping existente (con los riesgos que eso implica: que el servicio deje de funcionar o sea bloqueado).

## Lo que queda por definir / construir
- Confirmar si el usuario acepta tener un backend simple o prefiere depender de un servicio externo.
- Definir la tecnología de la APK (WebView simple en Android nativo, o React Native / Flutter para algo más pulido). Recomiendo WebView simple para rapidez.
- Definir dónde se alojará el backend (si aplica) o qué servicio de scraping externo se usará.
- Implementar la UI básica: campo de texto + botón "Descargar" + lista de descargas recientes.
- Manejar permisos de almacenamiento en Android.

## Tamaño del trabajo
Proyecto pequeño (un cambio grande, pero acotado). El diseño es corto. No requiere subagent de revisión de constructor porque es una app personal, no un producto empresarial.
