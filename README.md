# RutaScan

SaaS B2B de rastreo de carga con **licenciamiento anti-piratería** y operación
**offline-first**: dashboard web para administración, backend FastAPI y app
Flutter para conductores/bodega.

| Módulo | Tecnología | Carpeta |
| ------ | ---------- | ------- |
| API + licencias | Python 3.11+ · FastAPI · SQLAlchemy 2 · Pydantic v2 · PostgreSQL | `backend/` |
| Panel web | React 19 + Vite + Tailwind v4 + shadcn/ui | `dashboard/` |
| Programa Windows | Electron (ventana propia, arranca el backend) | `desktop/` |
| App móvil | Flutter (Android) — QR, GPS, cola offline, firma/foto | `mobile/` |
| Orquestación | Docker Compose (Postgres 16 + Redis 7 + API) | raíz |

> `web/` **no se versiona**: es el build del panel (`npm run build:web` dentro de
> `dashboard/`) que el backend sirve en la raíz `/`.

## Uso diario en Windows

El programa **RutaScan** se instala en el PC y abre en su propia ventana el panel
(<http://127.0.0.1:8000/>), arrancando el backend solo y apagándolo al cerrar la
ventana.

| Acceso directo | Qué hace |
| --- | --- |
| **RutaScan** (Escritorio / Inicio) | abre la app de escritorio (ventana propia) |
| `ABRIR RutaScan.bat` | igual que el acceso directo (sin instalación) |
| `PREPARAR CELULAR.bat` | abre el puerto 8000 en el firewall y muestra la IP del PC (una vez) |
| `CERRAR RutaScan.bat` | cierra backend y ventanas |

Los dos lanzadores compilan el panel la primera vez si `web\` todavía no existe:

```bash
cd dashboard && npm install && npm run build:web
```

Para volver a empaquetar e instalar la app de Windows, ver `desktop/README.md`.

## Arranque rápido (Docker)

```bash
cp .env.example .env      # edite SECRET_KEY y claves
docker compose up --build
```

- Panel web (React): http://localhost:8000/
- API (OpenAPI/Swagger): http://localhost:8000/docs
- Healthcheck: http://localhost:8000/health

El backend crea el esquema y siembra datos demo automáticamente al arrancar
(`SEED_DEMO_DATA=true`).

### Credenciales de demo

| Rol | Cédula | PIN | Uso |
| --- | ------ | --- | --- |
| ADMIN | `1020456789` | 1234 | Dashboard web |
| WAREHOUSE | `79458123` | 2345 | Dashboard / app |
| DRIVER | `52987641` | 3456 | App móvil |
| DRIVER | `1032459876` | 4567 | App móvil |
| DRIVER | `71745238` | 5678 | App móvil |

- Licencia: `RUTA-4F7Q-2MX9-BN38` · Camiones: `WKL-482`, `SJR-116`, `TSM-907`, `PBN-245`
- Productos demo: 12 referencias con código de barras `7702001000xxx`
- Clave de plataforma (operador SaaS): `PLATFORM_API_KEY` del `.env`

## Desarrollo local (sin Docker)

Backend (Python 3.11+; se probó también en 3.12–3.14):

```bash
python -m venv .venv
# Windows:  .venv\Scripts\activate      Linux/macOS:  source .venv/bin/activate
pip install -r backend/requirements.txt

cd backend
# apunte DATABASE_URL a un Postgres o use el compose solo para db/redis:
#   docker compose up -d db redis
uvicorn app.main:app --reload --port 8000
```

> Sin PostgreSQL, `database` en `/health` seguirá `down`; los tests y el smoke
> test no lo necesitan (usan SQLite en memoria).

Pruebas:

```bash
# desde backend/
python -m pytest -q                      # 15 pruebas unitarias/integración
PYTHONPATH=. python -m scripts.smoke_test  # E2E con TestClient (SQLite)
```

App móvil: ver `mobile/README.md`. En este PC ya quedó instalado el toolchain
completo (Flutter 3.47.7, JDK 17, Android SDK 36). Para el teléfono en la misma
WiFi:

```powershell
cd mobile
flutter build apk --release --dart-define=API_BASE_URL=http://<IP-del-PC>:8000
```

Ejecute antes `PREPARAR CELULAR.bat` (abre el puerto 8000 en el firewall y le
muestra la IP). El APK queda en
`mobile/build/app/outputs/flutter-apk/app-release.apk`.

> En la app, la dirección del servidor se puede cambiar sin recompilar:
> pantalla de inicio de sesión → `Servidor: …`, o **Ajustes → Cambiar
> dirección**.

## Qué incluye

### Licenciamiento y anti-piratería

- `/api/v1/mobile/*` guardado por `LicenseGuardMiddleware`:
  400 sin cabeceras · 402 licencia inválida/vencida/suspendida ·
  403 `DEVICE_LIMIT_REACHED` si un UUID nuevo excede `max_trucks`.
- Vinculación de dispositivo (cada instalación tiene su UUID) + TTL de
  dispositivo (`DEVICE_TTL_DAYS`).
- **Grace token** firmado de 3 días para operar sin conexión.
- Login cédula + PIN de 4 dígitos (bcrypt) con rate limit y bloqueo temporal.
- Multi-tenant estricto: toda consulta filtra por `company_id` del token.

### Anti-fraude en escaneos

- GPS simulado → bloqueo (422 `MOCK_LOCATION_DETECTED`) + evento de seguridad.
- Heurísticas: velocidad imposible, reloj adelantado, escaneo offline antiguo.
- `scan_uuid` como clave de idempotencia (reintentos jamás duplican).

### Offline-first

- Cola local SQLite en el móvil (`pending_scans`, `pod_pending`) y flush
  atómico con `POST /api/v1/mobile/deliveries/sync-batch` (SAVEPOINT por ítem,
  resultado por ítem).
- Manifiesto cacheado; la app funciona sin señal dentro del periodo de gracia.
- Evidencias de entrega (firma PNG / foto) subidas y adjuntadas
  automáticamente al recuperar la conexión.

### Dashboard (roles ADMIN / WAREHOUSE)

- Panel React único sobre la API: KPIs, mapa en vivo (Leaflet/OpenStreetMap),
  camiones en ruta, rutas (planificar, manifiesto, importar, despachar),
  productos (+ importación y hoja PDF de QR), camiones, usuarios, reportes
  Excel/PDF, licencia/dispositivos y eventos de seguridad.
- Usuarios y licencia solo se muestran al rol ADMIN; el menú se filtra por rol.

### Panel de plataforma (operador SaaS)

- Sección aparte (`#/plataforma`) protegida con `X-Platform-Key`
  (`PLATFORM_API_KEY`), no con el login de empresa.
- Totales de cuentas (operativas, por vencer, vencidas, suspendidas), días de
  licencia restantes por empresa, dispositivos/camiones/usuarios de cada una,
  y alta/renovación/suspensión de cuentas.

## Estructura del repo

```
backend/
  app/
    api/v1/        # auth, mobile/*, admin/*, platform
    services/      # scans, licensing, manifest, reports, qrpdf, imports…
    models/        # SQLAlchemy (companies, users, trucks, products,
                   # routes, route_details, delivery_logs, sync_batches,
                   # devices, security_events)
    middleware/    # LicenseGuardMiddleware
    core/          # config, JWT/bcrypt, cache, geo
    db/            # session + init_db (auto-create + seed demo)
  tests/           # pytest
  scripts/         # smoke_test.py (E2E)
web/               # (generado, no versionado) build del panel que sirve el backend
dashboard/         # panel web (React + Vite + shadcn/ui) + scripts/copy-to-web.mjs
desktop/           # app de escritorio (Electron) + empaquetado
mobile/            # app Flutter
docs/              # API.md (contrato) + ARCHITECTURE.md
docker-compose.yml
```

## Despliegue

1. `SECRET_KEY` fuerte (`openssl rand -hex 32`), `PLATFORM_API_KEY`, claves de
   Postgres y `ENVIRONMENT=production` en el entorno.
2. `DATABASE_URL` compatible con Supabase/Neon (agregue `?sslmode=require`).
3. `CORS_ORIGINS` restringido a su dominio del dashboard.
4. Compile el APK móvil con `--dart-define=API_BASE_URL=https://api.sudominio.com`.

Documentación: `docs/API.md` (endpoints y códigos de error) y
`docs/ARCHITECTURE.md` (diseño interno, modelo de datos, seguridad).
