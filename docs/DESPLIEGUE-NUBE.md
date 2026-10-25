# RutaScan en la nube (gratis): Supabase + Render

Esta guía dejó RutaScan funcionando en un enlace fijo que **no depende de tu
PC**: ya está **completado y verificado**.

> ## ✅ <https://rutascan.onrender.com>
>
> | Prueba | Resultado |
> | --- | --- |
> | `/health` | `200` · `database: up` · `environment: production` |
> | Login ADMIN demo | `200` — Yasmín Bracho (ADMIN) |
> | Panel web | `200` (HTML + JS + CSS servidos desde la nube) |
> | APK del celular | `200` — 64,3 MB descargables |
> | Datos demo | 3 rutas del día · 4 camiones · 30 entregas asignadas (11 entregadas, 2 rechazos) · 36,7 % |
> | Licencia | `RUTA-4F7Q-2MX9-BN38` ACTIVA hasta 18/10/2027 |
> | Primer despliegue | 1 min 40 s |
>
> No hizo falta tarjeta: todo en plan gratuito (Render + Supabase).

---

## Parte 1 - Supabase (la base de datos) - YA ESTÁ LISTA

El proyecto `rutascan` existe en Supabase (ref `hkdustypbnkycrcctctg`) y el
asistente ya creó y verificó todo por usted con las migraciones:

| Migración | Qué hace |
| --- | --- |
| `rutascan_initial_schema` | Crea las 10 tablas (empresas, usuarios, camiones, rutas, escaneos…) |
| `rutascan_revoke_public_api_grants` | Cierra el acceso de la API pública de Supabase (`anon`/`authenticated`): solo entra la aplicación |
| `rutascan_add_fk_indexes` | Índices que recomendó el asesor de rendimiento |

El esquema exacto quedó guardado en `docs/supabase_schema.sql`. Los datos de
demostración se siembran solos al arrancar (en Render o en el PC).

**Conexión: ya está hecha y probada ✅.** La aplicación no usa el usuario total
de la base: se creó un usuario dedicado `rutascan_app` con permisos justos
(leer y escribir tablas, nada más). La cadena de conexión completa está en
`CLAVES.txt`, sección 6 — es la misma que se pega en Render.

Se probó desde el PC el 17/10/2026: conexión OK, esquema verificado, datos de
demostración sembrados en la nube (empresa, usuarios, camiones, rutas y 258
escaneos) y login de administrador funcionando con esa base.

> Para consultar o administrar la base directamente:
> <https://supabase.com/dashboard/project/hkdustypbnkycrcctctg>

## Parte 2 - Render (el servidor) - YA ESTÁ LISTA

El servicio `rutascan` quedó creado en la cuenta de Render con esta
configuración (la misma que describe `render.yaml`):

| Ajuste | Valor |
| --- | --- |
| Repositorio | `Manolodios/rutascan` (privado), rama `main` |
| Runtime · plan · región | `python` · `free` · Virginia (misma región que Supabase) |
| Build | `pip install -r backend/requirements.txt` |
| Arranque | `cd backend && python -m scripts.init_db && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Healthcheck | `/health` |
| Auto-despliegue | activado: cada `push` a `main` reconstruye el sitio solo |
| URL | <https://rutascan.onrender.com> (sitio) · <https://rutascan.onrender.com/app/> (panel) |
| Panel del servicio | <https://dashboard.render.com/web/srv-dba060qjnfac73droohg> |

Variables cargadas: `PYTHON_VERSION=3.12.7`, `ENVIRONMENT=production`,
`SECRET_KEY` (aleatoria), `SEED_DEMO_DATA=true`, `DEMO_AUTO_REFRESH=true`,
`WEB_DIR=../web`, `UPLOAD_DIR=../uploads`, más `PLATFORM_API_KEY` y
`DATABASE_URL` (los dos secretos viven en `CLAVES.txt`, secciones 6 y 7 — nunca
en el repositorio).

> 🔄 **La demo nunca se ve vacía.** Con `DEMO_AUTO_REFRESH=true`, cada arranque
> corre las fechas del tenant de demostración hasta **hoy** (rutas de hoy,
> escaneos "hace un momento", licencia vigente) sin tocar ids, cantidades ni los
> QR ya impresos. Solo actúa sobre la empresa demo (licencia
> `RUTA-4F7Q-2MX9-BN38`); los datos de un cliente real jamás se modifican.
> Para hacerlo a mano contra cualquier base:
> `cd backend && python -m scripts.refrescar_demo` (con `DATABASE_URL` en el
> entorno).

> ⚠️ Requisito que costó un paso extra: además de autorizar la aplicación de
> GitHub, Render exige una **credencial de Git** en
> *Account settings → Account Security → **Git Deployment Credentials** →
> Add credential → GitHub*, autorizando el repositorio. Sin ella la API responde
> `passed in repository URL is invalid or unfetchable`.

## Parte 3 - Comprobar (ya comprobado ✅)

1. Abra <https://rutascan.onrender.com>: aparece la página comercial.
2. Entre al panel con **Entrar al panel** (<https://rutascan.onrender.com/app/>) o
   con **Probar la demo**, y use las credenciales de demostración (ver
   `CLAVES.txt` o el botón "Ver credenciales de demostración" en el login).
3. Verifique Panel / Productos / Seguridad / Licencia y el menú **Plataforma**
   (`#/plataforma`) con la clave de plataforma.

Comprobaciones realizadas el 17/10/2026 **desde fuera de la red del PC**:

| Endpoint | Resultado |
| --- | --- |
| `GET /health` | `200` · `{"status":"ok","database":"up","environment":"production"}` |
| `POST /auth/login` (ADMIN) | `200` — token válido (Yasmín Bracho) |
| `GET /` (panel) | `200` — HTML + `assets/*.js` + `*.css` |
| `HEAD /uploads/RutaScan-Celular.apk` | `200` — 23,3 MB (arm64) |
| `GET /api/v1/admin/dashboard/summary` | `200` — 3 rutas del día, 4 camiones, 30 entregas asignadas (11 entregadas, 2 rechazos), 36,7 % |
| `GET /api/v1/admin/license` | `200` — `RUTA-4F7Q-2MX9-BN38`, ACTIVA hasta 18/10/2027 |

## Parte 4 - El celular

El APK se descarga directo de la nube. Hay dos versiones, según el teléfono
(se compilan con `--split-per-abi`: mucho más livianas que el APK universal de
64 MB, que tarda más en descargar e instalar):

| Teléfono | Enlace | Tamaño |
| --- | --- | --- |
| Normal (arm64, casi todos) | <https://rutascan.onrender.com/uploads/RutaScan-Celular.apk> | 23 MB |
| Antiguo / 32 bits | <https://rutascan.onrender.com/uploads/RutaScan-Celular-32bits.apk> | 19 MB |

Compilación (desde `mobile/`, dejando la nube como servidor por defecto):

```powershell
flutter build apk --release --split-per-abi `
  --dart-define=API_BASE_URL=https://rutascan.onrender.com
```

Luego se copian con el nombre público que usa el panel:

```powershell
Copy-Item build/app/outputs/flutter-apk/app-arm64-v8a-release.apk   ..\uploads\RutaScan-Celular.apk -Force
Copy-Item build/app/outputs/flutter-apk/app-armeabi-v7a-release.apk ..\uploads\RutaScan-Celular-32bits.apk -Force
```

> La app exige **Android 7 (API 24) o superior**. Si el teléfono es más antiguo,
> el instalador no puede completar la instalación.

En la app instalada:

1. En la pantalla de inicio de sesión toque **Servidor**.
2. Escriba `https://rutascan.onrender.com` y guarde (o **Ajustes → Cambiar
   dirección**).
3. Inicie sesión con un usuario DRIVER (`20148379` / `3456`).

> Los APK viajan al servidor **dentro del repositorio** (`uploads/` en la raíz
> del proyecto). En Render la variable `UPLOAD_DIR=../uploads` apunta a esa
> carpeta (el proceso corre desde `backend/`). Como `uploads/` está excluida en
> `.gitignore`, una versión nueva se publica con
> `git add -f uploads/RutaScan-Celular.apk uploads/RutaScan-Celular-32bits.apk`
> + commit + push.

---

## Cosas que debe saber del plan gratuito

- **Render duerme el servicio** tras 15 minutos sin visitas, y el primer
  acceso después de eso tarda ~30-60 segundos (se ve "Application loading";
  medido el 25-10-2026: 42 s). Para que eso no pase hay **keep-alive**, en
  dos capas que se cubren entre sí:
  - **GitHub** (ya activo, no hay que hacer nada): el trabajo
    `.github/workflows/keep-alive.yml` toca `/health` y la portada cada 13
    minutos desde los servidores de GitHub. Funciona aunque su PC esté
    apagada. Se puede ejecutar a mano desde GitHub → pestaña **Actions** →
    *Keep-alive* → **Run workflow**.
  - **Su PC** (respaldo): doble clic en `MANTENER DESPIERTO.bat` instala una
    tarea de Windows que toca la página cada 13 minutos mientras su sesión
    esté abierta. Se quita con `MANTENER DESPIERTO.bat -Quitar`, y las visitas
    quedan en `%LOCALAPPDATA%\RutaScan\tools\mantener-despierto.log`.
  - Límites, para que no le sorprendan: los trabajos programados de GitHub
    pueden atrasarse hasta ~15-20 min en horas de mucha carga (para eso está
    el respaldo del PC), y GitHub los desactiva si el repositorio pasa 60
    días sin actividad (cualquier `git push` los reactiva).
- **Supabase pausa** proyectos gratuitos tras ~7 días sin uso. Si pasa, entre a
  supabase.com y pulse **Restore**; no se pierden datos.
- **La base está blindada**: las tablas no son accesibles por la API pública de
  Supabase (se revocaron los permisos de `anon`/`authenticated`); solo entra la
  aplicación con su cadena de conexión, que vive únicamente en Render (variable
  segura) y en `CLAVES.txt` en su PC. Los asesores de seguridad de Supabase no
  reportan hallazgos.
- Las **fotos de evidencia** que sube el celular quedan en el disco temporal de
  Render: se pierden si Render reinicia el servicio (el APK sí queda, porque
  viene del repositorio). Los datos (empresa, usuarios, escaneos) viven en
  Supabase y no se pierden.
- **Sin Redis**: `cache_backend` queda en `memory` (suficiente para la demo). El
  rate-limit del login funciona igual.
- No hay claves en el repositorio: `SECRET_KEY` la genera Render y los dos
  secretos se cargan como variables de entorno.

## Actualizar la nube

- **Cualquier cambio** (backend, panel ya compilado en `web/`, APK):
  `git push` a `main` → Render reconstruye solo (**~2 minutos**, medido).
- **Panel web**: en el PC, `cd dashboard && npm run build:web` (copia el build a
  `web/`), luego `git add web && git commit -m "panel" && git push`.
- **A mano desde el panel**: <https://dashboard.render.com/web/srv-dba060qjnfac73droohg>
  → **Manual Deploy → Deploy latest commit** (o **Clear build cache & deploy**
  si algo quedara raro).
- **Ver los registros** (para diagnosticar): mismo panel del servicio →
  pestaña **Logs**.

## Referencia rápida

| Dato | Valor |
| --- | --- |
| URL pública | <https://rutascan.onrender.com> |
| APK del celular | <https://rutascan.onrender.com/uploads/RutaScan-Celular.apk> |
| Base de datos | Supabase `hkdustypbnkycrcctctg` (usuario dedicado `rutascan_app`) |
| Esquema | `docs/supabase_schema.sql` (migraciones `rutascan_*`) |
| Servicio Render | `rutascan` · `srv-dba060qjnfac73droohg` · python · free · Virginia |
| Panel del servicio | <https://dashboard.render.com/web/srv-dba060qjnfac73droohg> |
| Env obligatorias | `DATABASE_URL` y `PLATFORM_API_KEY` (ver `CLAVES.txt`, secciones 6-7) |
| Env automáticas | `SECRET_KEY` (generada), `SEED_DEMO_DATA=true`, `DEMO_AUTO_REFRESH=true`, `WEB_DIR=../web`, `UPLOAD_DIR=../uploads` |
| Python | 3.12.7 (`PYTHON_VERSION`) |
| Arranque | `cd backend && python -m scripts.init_db && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Healthcheck | `/health` |
| Keep-alive (que no duerma) | GitHub cada 13 min, ya activo; respaldo del PC: `MANTENER DESPIERTO.bat` |
