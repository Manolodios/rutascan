# Firma del APK (Android)

El APK de RutaScan se firma con una **llave de publicación propia**, no con la
llave de depuración de Android. Google Play rechaza los builds firmados en
debug y, peor aún, cualquiera con la debug keystore (que es pública) podría
firmar un APK que el teléfono acepte como actualización legítima.

## Dónde viven los archivos (fuera de git)

| Archivo | Contenido |
| --- | --- |
| `mobile/android/keystore/rutascan-release.jks` | Llave privada (RSA 2048, 10.000 días) |
| `mobile/android/key.properties` | Alias y contraseñas que lee Gradle |

Ambos están en `.gitignore`. **Respáldelos** en un gestor de contraseñas y en un
disco externo: si se pierde la llave no se pueden publicar actualizaciones (Play
exige la misma firma para siempre).

## Crear la llave (solo la primera vez)

```powershell
cd mobile\android
keytool -genkeypair -v -keystore keystore\rutascan-release.jks -alias rutascan `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=RutaScan, OU=Mobile, O=RutaScan, L=Cabimas, ST=Zulia, C=VE"
```

`key.properties` (en `mobile/android/`):

```properties
storePassword=<contraseña>
keyPassword=<contraseña>
keyAlias=rutascan
storeFile=../keystore/rutascan-release.jks
```

## Compilar

```powershell
cd mobile
# APK universal (~65 MB)
flutter build apk --release --dart-define=API_BASE_URL=https://rutascan.onrender.com

# APK por arquitectura (los que se publican en /uploads)
flutter build apk --release --split-per-abi `
  --dart-define=API_BASE_URL=https://rutascan.onrender.com

# Para Google Play
flutter build appbundle --release --dart-define=API_BASE_URL=https://rutascan.onrender.com
```

Salidas en `mobile/build/app/outputs/flutter-apk/`:

| Archivo | Uso |
| --- | --- |
| `app-arm64-v8a-release.apk` | Celulares modernos → `uploads/RutaScan-Celular.apk` |
| `app-armeabi-v7a-release.apk` | 32 bits → `uploads/RutaScan-Celular-32bits.apk` |

## Verificar la firma antes de publicar

```powershell
C:\Android\Sdk\build-tools\36.0.0\apksigner.bat verify --print-certs <apk>
```

Debe mostrar `CN=RutaScan`. Si dice `CN=Android Debug`, **no publique** ese APK.

## Publicar en GitHub Releases

Los APK firmados también se publican como assets del release `v1.0.0` en
<https://github.com/Manolodios/rutascan/releases/tag/v1.0.0>. Para actualizarlos:

1. Compile y verifique la firma (arriba).
2. Entre al release en GitHub → **Edit** → borre los assets viejos.
3. Suba `uploads/RutaScan-Celular.apk` y `uploads/RutaScan-Celular-32bits.apk`.
4. Actualice las notas si cambiaron las credenciales de demostración.

> Si un teléfono tiene instalado un APK de depuración anterior, hay que
> **desinstalarlo** antes de instalar el firmado: Android no permite actualizar
> entre firmas distintas.

## Sin `key.properties`

El build release queda **sin firmar** a propósito (Gradle avisa). No se cae a la
llave de debug en ningún caso.
