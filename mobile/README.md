# RutaScan — App móvil (Flutter)

App offline-first para **conductores** y **bodega**: escaneo QR, GPS anti-fraude,
cola local de escaneos, prueba de entrega (firma/foto) y licencia con permiso
offline de 3 días.

## Requisitos

- Flutter **3.19+** (Dart 3.3+) con Android SDK
- Un dispositivo o emulador Android
- El backend RutaScan corriendo (ver `../README.md`)

### Toolchain instalado en este PC (Windows)

| Qué | Dónde | Versión |
| --- | --- | --- |
| Flutter SDK | `C:\src\flutter` (en el PATH) | 3.47.7 stable · Dart 3.13.5 |
| JDK | `C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot` (`JAVA_HOME`) | OpenJDK 17 LTS |
| Android SDK | `C:\Android\Sdk` (`ANDROID_HOME`) | platform 35/36, build-tools 36.0.0 |
| adb | `C:\Android\Sdk\platform-tools` (en el PATH) | r37 |

Verificar con `flutter doctor` (debe salir ✔ en *Android toolchain*).

## Puesta en marcha

```bash
cd mobile

# 1. Dependencias
flutter pub get

# 2. (Primera vez) generar las carpetas de plataforma Android.
#    El AndroidManifest.xml ya viene incluido con todos los permisos y NO se
#    sobrescribe (flutter create solo crea lo que falte).
flutter create --platforms=android .

# 3. Ejecutar contra el backend local
#    - Emulador Android: 10.0.2.2 apunta al PC anfitrión
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000

#    - Teléfono real en la misma red WiFi: use la IP LAN del PC
flutter run --dart-define=API_BASE_URL=http://192.168.1.50:8000
```

### Compilar el APK en este PC

```powershell
cd mobile
flutter build apk --release --dart-define=API_BASE_URL=http://192.168.1.139:8000
```

> El APK queda en `build/app/outputs/flutter-apk/app-release.apk`.

Para instalarlo: copie ese archivo al teléfono (cable o WhatsApp/Drive) y ábralo;
Android pedirá autorizar "instalar apps de origen desconocido" la primera vez.

**Para que el teléfono alcance el PC** (misma red WiFi):

1. Ejecute `..\PREPARAR CELULAR.bat` (abre el puerto 8000 en el firewall, pide
   permiso de administrador) — solo hace falta una vez.
2. Abra RutaScan en el PC (el backend ya escucha en toda la red local).
3. Compile/instale el APK con `API_BASE_URL=http://<IP-LAN-del-PC>:8000`
   (el propio `.bat` le muestra la IP).

> `pubspec.lock` **sí** se versiona: fija las versiones exactas de los plugins
> (`geolocator 12.0.0`, `mobile_scanner 5.2.3`, …) con las que compila el APK.

### Verificación del AndroidManifest

El archivo `android/app/src/main/AndroidManifest.xml` incluido en este repo ya
declara todo lo necesario. Si su instalación de Flutter regeneró el manifest
(p. ej. usó `flutter create --overwrite`), confirme que existan:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.VIBRATE"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
```

y en `<application ...>`:

```xml
android:usesCleartextTraffic="true"   <!-- solo para desarrollo con http:// -->
```

## Credenciales de demo

| Rol        | Cédula       | PIN  |
| ---------- | ------------ | ---- |
| DRIVER     | `52987641`   | 3456 |
| WAREHOUSE  | `79458123`   | 2345 |

Clave de licencia: `RUTA-4F7Q-2MX9-BN38`.

## Flujo de uso

1. **Inicio de sesión**: clave de licencia + cédula + PIN de 4 dígitos.
2. **CARGAR CAMIÓN** (verde): confirma mercancía que sube al vehículo (`LOAD`).
3. **ENTREGAR CLIENTE** (azul): registra entrega al cliente (`DELIVER`).
   Tras una entrega puede capturar **firma** y **foto** de evidencia.
4. **RECHAZAR ENTREGA** (naranja): motivo obligatorio; el ítem queda para
   devolución a inventario (`REJECT`).

Feedback físico del escaneo:

- **Éxito**: destello verde + vibración corta + pitido agudo (1568 Hz).
- **Error**: destello rojo + vibración larga + zumbido grave (320 Hz).

## Funcionamiento offline

- Cada escaneo lleva un `scan_uuid` generado en el dispositivo (clave de
  idempotencia server-side).
- Sin conexión, los escaneos van a una cola SQLite local (`pending_scans`) y se
  envían al volver la red con `POST /api/v1/mobile/deliveries/sync-batch`
  (una transacción atómica, resultado por ítem).
- Las evidencias (firma/foto) sin conexión se guardan en `pod_pending` y se
  suben/adjuntan automáticamente (`pod` + `pod-attach`).
- El **permiso offline** (grace token firmado, 3 días) permite trabajar sin
  internet; si vence sin conexión, la app pide validar la licencia.
- Reintentos con backoff 15s → 30s → 60s → 120s → 300s y flush automático
  cada 25 s cuando está en línea.

## Estructura

```
lib/
  main.dart                     # bootstrap: storage, sonidos, sync, runApp
  app.dart                      # MaterialApp + tema
  core/config.dart              # API_BASE_URL, timeouts, backoff
  core/theme.dart               # paleta y tema
  data/models.dart              # DTOs + ApiException
  data/session_store.dart       # secure storage: licencia, tokens, grace token
  data/local_db.dart            # SQLite: cola de escaneos, pods, manifest cache
  data/api_client.dart          # HTTP + reintento de token (401 -> refresh)
  data/repository.dart          # login, manifest, heartbeat
  data/sync_engine.dart         # cola offline, sync-batch, PoD, reintentos
  services/device_id.dart       # UUID de dispositivo (vinculación de licencia)
  services/location_service.dart# GPS + detección de ubicación simulada
  services/feedback.dart        # WAV sintetizado (pitidos) + vibración
  ui/                           # pantallas (splash, login, home, scan, ...)
```

## Anti-fraude

- `position.isMocked` (geolocator) → el escaneo se bloquea localmente y el
  servidor también lo rechaza (422 `MOCK_LOCATION_DETECTED`).
- Timestamps siempre en UTC ISO-8601.
- El servidor valida pertenencia al manifiesto, duplicados (`scan_uuid`) y
  coherencia de licencia/dispositivo en cada petición.
