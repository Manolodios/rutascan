# RutaScan en la nube (gratis): Supabase + Render

Esta guía deja RutaScan funcionando en un enlace fijo
(`https://rutascan-algo.onrender.com`) que **no depende de tu PC**: se puede
mostrar a una empresa desde cualquier computador o celular, siempre encendido.

Todo el código ya está preparado (commit con `render.yaml` y el panel compilado
en `./web`). Solo faltan dos registros gratuitos: **Supabase** (base de datos en
la nube) y **Render** (servidor donde corre la aplicación).

> Tiempo total: ~10 minutos, casi todo esperando. No hace falta tarjeta.

---

## Parte 1 - Supabase (la base de datos)

1. Entre a <https://supabase.com> y pulse **Start your project**.
2. Elija **Continue with GitHub** (es la forma más rápida; autorice con su
   cuenta de GitHub).
3. Pulse **New project** y complete:
   - **Name**: `rutascan`
   - **Database Password**: cree una contraseña y **guárdela** (o péguela en
     `CLAVES.txt`).
   - **Region**: la más cercana (por ejemplo `East US` o `São Paulo`).
4. Espere 1-2 minutos a que el proyecto quede listo (*Project is ready*).
5. En la parte superior pulse el botón **Connect**.
6. En la ventana que se abre busque la sección **Session pooler** (no la de
   "*Direct connection*" ni "*Transaction pooler*").
7. Copie el texto que empieza con `postgresql://postgres.xxxx:...:5432/postgres`
   y **péguelo en el chat** (y opcionalmente en `CLAVES.txt`).

Con esa dirección el backend crea las tablas y siembra los datos de
demostración automáticamente al arrancar. (Este paso permite además probar la
conexión desde el PC antes de tocar Render.)

## Parte 2 - Render (el servidor)

1. Entre a <https://render.com> y pulse **Get Started** -> **GitHub**.
   Autorice a Render el acceso al repositorio **`rutascan`** (puede darle
   acceso solo a ese repositorio).
2. En el panel de Render: **New +** -> **Blueprint**.
3. Seleccione el repositorio **`Manolodios/rutascan`** y pulse **Connect**.
4. Render lee `render.yaml` y muestra el servicio `rutascan` con dos campos:
   - **DATABASE_URL** → pegue la dirección de Supabase del paso 1.
   - **PLATFORM_API_KEY** → pegue `RS-PLAT-...` (está en `CLAVES.txt`).
5. Pulse **Apply** y espere 3-5 minutos (la primera vez instala dependencias).

Cuando termine, arriba verá la dirección del servicio, del estilo
`https://rutascan-abcd.onrender.com`. **Ese es el enlace fijo de RutaScan.**

## Parte 3 - Comprobar

1. Abra el enlace: debe aparecer el panel de login.
2. Entre con las credenciales de demostración (ver `CLAVES.txt` o el botón
   "Ver credenciales de demostración" en el login).
3. Verifique Panel / Productos / Seguridad / Licencia y el menú **Plataforma**
   (`#/plataforma`) con la clave de plataforma.

## Parte 4 - El celular

En la app del celular (la que ya está instalada o el APK del Escritorio):

1. En la pantalla de inicio de sesión toque **Servidor**.
2. Pegue el enlace de Render (`https://rutascan-abcd.onrender.com`).
3. Inicie sesión con un usuario DRIVER.

El APK también se puede descargar desde el túnel local
(`PUBLICAR RutaScan en Internet.bat` → `https://…/uploads/RutaScan-Celular.apk`).

---

## Cosas que debe saber del plan gratuito

- **Render duerme el servicio** tras 15 minutos sin visitas. El primer acceso
  después de eso tarda ~30-60 segundos (se ve "Application loading"); los
  siguientes son instantáneos. Abra el enlace un par de minutos antes de una
  demostración.
- **Supabase pausa** proyectos gratuitos tras ~7 días sin uso. Si pasa, entre a
  supabase.com y pulse **Restore**; no se pierden datos.
- Las **fotos de evidencia** que sube el celular quedan en el disco temporal de
  Render: se pierden si Render reinicia el servicio. Los datos (empresa,
  usuarios, escaneos) viven en Supabase y no se pierden.
- `render.yaml` genera `SECRET_KEY` de forma aleatoria y guarda los dos valores
  que usted pegue; no hay claves en el repositorio.

## Actualizar la nube

- **Backend**: `git push` a `main` → Render reconstruye solo.
- **Panel web**: en el PC, `cd dashboard && npm run build:web`, luego
  `git add web && git commit -m "panel" && git push` (el panel vive versionado
  en `./web` justamente para no depender de Node.js en la nube).
- **Borrar y volver a crear**: si algo quedara mal, `git push --force` no es
  necesario: en Render basta **Manual Deploy → Clear build cache & deploy**.

## Referencia rápida

| Dato | Valor |
| --- | --- |
| Servicio | `rutascan` (runtime python, plan free) |
| Env obligatorias | `DATABASE_URL`, `PLATFORM_API_KEY` |
| Env automáticas | `SECRET_KEY` (generada), `SEED_DEMO_DATA=true`, `WEB_DIR=../web` |
| Python | 3.12.7 (`PYTHON_VERSION`) |
| Arranque | `cd backend && python -m scripts.init_db && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Healthcheck | `/health` |
