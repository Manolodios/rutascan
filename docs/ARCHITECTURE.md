# RutaScan — Arquitectura

SaaS B2B multi-empresa de rastreo de carga: backend FastAPI + dashboard web +
app móvil Flutter, con licenciamiento anti-piratería y operación offline-first.

## Monorepo

```
backend/    API FastAPI (Python 3.11+) — SQLAlchemy + Pydantic v2
dashboard/  Panel web (React 19 + Vite + Tailwind + shadcn/ui)
web/        Build del panel (versionado) que sirve el backend y Render en la nube
desktop/    App de escritorio Windows (Electron)
mobile/     App Flutter (Android) para CONDUCTOR y BODEGA
docs/       API.md (contrato) + ARCHITECTURE.md + DESPLIEGUE-NUBE.md
docker-compose.yml
render.yaml # despliegue en la nube gratis (Render + Supabase)
```

## Backend

Capas (import de arriba hacia abajo, sin ciclos):

```
app/
  main.py            # app factory, handlers de error, estáticos (/uploads, /web)
  middleware/        # LicenseGuardMiddleware
  api/deps.py        # auth JWT, roles, MobileContext
  api/v1/            # routers: auth, mobile/*, admin/*, platform
  services/          # lógica de negocio (scans, licensing, manifest, reports…)
  models/            # SQLAlchemy 2.x
  schemas/           # Pydantic v2 (contratos HTTP)
  core/              # config, seguridad (JWT/bcrypt), cache, geo
  db/                # sesión + init_db (auto-create + seed)
```

### Flujo de una petición móvil

```
HTTP → LicenseGuardMiddleware (/api/v1/mobile/*)
        ├─ 400 sin X-License-Key/X-Device-UUID
        ├─ 402 licencia inválida/vencida/suspendida
        ├─ 403 DEVICE_LIMIT_REACHED (UUID nuevo > max_trucks)
        └─ OK → request.state.license_company_id
     → Bearer JWT (deps.get_current_user)
     → get_mobile_context (coherencia tenant usuario↔licencia, heartbeat de dispositivo)
     → router → service → commit
```

### Modelo de datos (PostgreSQL, auto-create en arranque)

| Tabla            | Claves y campos relevantes |
| ---------------- | -------------------------- |
| `companies`      | `license_key` (única), `subscription_status`, `expiration_date`, `max_trucks`. |
| `users`          | `company_id`, `user_cedula`, `pin_hash` (bcrypt), `role` (ADMIN/WAREHOUSE/DRIVER). |
| `trucks`         | `company_id`, `license_plate`, `assigned_driver_id`. |
| `products`       | `company_id`, `barcode_qr`, `description`, `unit`, `weight`. |
| `routes`         | `company_id`, `truck_id`, `route_date`, `status` (PENDING/IN_PROGRESS/COMPLETED). |
| `route_details`  | línea del manifiesto: `assigned_quantity`, `delivered_quantity`, `status`, `return_required`, `rejection_reason`. |
| `delivery_logs`  | un registro por escaneo físico: `scan_uuid` (único ⇒ idempotencia), `via_offline_batch`, `sync_batch_id`, GPS + `is_mocked_location`, `pod_signature_url`, `pod_photo_url`, flags. |
| `sync_batches`   | metadatos del flush offline (`received/accepted/rejected/duplicates`). |
| `devices`        | `device_uuid`, `user_id`, `platform`, `last_seen_at`; cupo de licencia. |
| `security_events`| tipo (MOCK_GPS, SPEED_ANOMALY, TIMESTAMP_SKEW, STALE_SCAN, PIN_LOCKOUT, DEVICE_LIMIT, CROSS_TENANT, MANIFEST_MISMATCH, …), coordenadas y detalle. |

Aislamiento multi-tenant: **toda** consulta filtra por `company_id` derivado
del token/licencia; nunca de parámetros del cliente.

### Máquina de estados del escaneo

- `LOAD` → la línea pasa a `IN_TRUCK` (confirmación de carga).
- `DELIVER` → `DELIVERED`; en líneas multi-unidad cada unidad requiere un
  escaneo (N escaneos para `assigned_quantity = N`).
- `REJECT` → `REJECTED` + `return_required = true` (reingreso a inventario);
  exige `rejection_reason` (DAMAGED, WRONG_ITEM, CLIENT_REJECTED, NO_ONE_HOME,
  ADDRESS_NOT_FOUND, OTHER).
- Primera operación sobre una ruta `PENDING` → `IN_PROGRESS`; cuando todas las
  líneas quedan terminales → `COMPLETED`.

### Sincronización offline (batch atómico)

`sync-batch` ejecuta **una transacción**; cada ítem usa un SAVEPOINT:

1. `scan_uuid` ya visto ⇒ resultado `duplicate` (idempotente).
2. Regla de negocio violada ⇒ se revierte solo ese ítem y se devuelve
   `accepted: false` + `code` (los demás continúan).
3. Los errores de seguridad (GPS falso, velocidad imposible, etc.) se persisten
   en `security_events` incluso cuando el ítem se rechaza.

### Anti-fraude

| Vector | Mitigación |
| ------ | ---------- |
| GPS simulado | `is_mocked_location` → 422 `MOCK_LOCATION_DETECTED` + evento `MOCK_GPS`. |
| Viaje imposible | `haversine_m` + `implied_speed_kmh` entre escaneos → flag `SPEED_ANOMALY`. |
| Reloj del dispositivo | `scan_timestamp_utc` > horario servidor + tolerancia → `TIMESTAMP_SKEW`. |
| Escaneos offline viejos | antigüedad > umbral → `STALE_SCAN`. |
| Fuerza bruta de PIN | rate limit por cédula (memoria/Redis) → 429 `PIN_LOCKOUT` + evento. |
| Piratería de licencia | guard por cabeceras, vinculación de dispositivo, cupo `max_trucks`, grace token firmado. |
| Fuga entre tenants | contexto móvil valida usuario↔licencia (evento `CROSS_TENANT`). |

### Licenciamiento

- `licensing.assert_subscription_valid` → 402 si vencida/suspendida.
- `licensing.register_device` → alta/renovación de dispositivo con cupo;
  el middleware aplica el cupo también a dispositivos nuevos.
- `create_grace_token` → JWT tipo `grace` con `lic`, `exp` a 3 días: permiso
  offline firmado que la app cachea.
- `/api/v1/platform/*` (header `X-Platform-Key`) permite a la operación crear
  empresas/licencias y suspender, renovar o ampliar cupos.

## Dashboard web

SPA de React (Vite) + Tailwind + shadcn/ui, enrutada por hash. El backend sirve su
build desde `web/` en `/` (lo genera `npm run build:web` dentro de `dashboard/`),
y el panel llama a `/api/v1/admin/*` con Bearer JWT.
Módulos: panel, mapa en vivo, rutas (planificar/asignar/importar/despachar),
productos (+QR PDF), camiones, usuarios, reportes (Excel/PDF), licencia,
seguridad y panel de plataforma (`#/plataforma`, header `X-Platform-Key`).

## App móvil (Flutter)

- **Offline-first real**: SQLite local con `pending_scans`, `pod_pending` y
  `manifest_cache`; `SyncEngine` (ChangeNotifier) con listener de
  conectividad, backoff 15→300 s y flush automático cada 25 s.
- **Idempotencia**: `scan_uuid` (UUID v4) generado en el dispositivo; el
  server jamás duplica un escaneo reenviado.
- **Permiso offline**: grace token cacheado en `flutter_secure_storage`; sin
  conexión la app exige `now < grace_expires_at` + último estado `ACTIVE`.
- **Evidencias (PoD)**: firma (PNG) y foto; con red se suben y adjuntan al
  instante (`pod` + `pod-attach`), sin red se encolan y el flush las
  sincroniza en orden (primero escaneos, después evidencias).
- **UX de campo**: 2 botones gigantes (CARGAR CAMIÓN / ENTREGAR CLIENTE),
  feedback éxito = destello verde + vibración corta + pitido agudo; error =
  destello rojo + vibración larga + zumbido grave (WAV sintetizado, sin
  assets binarios).

## Despliegue

`docker-compose.yml` orquesta:

| Servicio | Notas |
| -------- | ----- |
| `db`     | PostgreSQL 16 con volumen persistente + healthcheck. |
| `redis`  | Cache/rate-limit compartido (opcional pero recomendado). |
| `api`    | Backend en `:8000`; espera `db`/`redis`; monta `./web` y `./uploads`. |

El backend crea las tablas y siembra datos demo al arrancar (idempotente).
Para Supabase/Neon basta apuntar `DATABASE_URL` a Postgres administrado.

## Pruebas

- `backend/tests`: 15 pruebas (auth/seguridad, heurísticas geo, máquina de
  estados, batch atómico, multi-unidad, rechazos).
- `backend/scripts/smoke_test.py`: E2E con TestClient sobre SQLite que cubre
  guard de licencia, login, grace token, escaneo en vivo, idempotencia,
  mock-GPS, batch offline, PoD (upload + attach + 404), dashboard, reportes,
  PDF QR, licencia, rotación de refresh y estáticos web.
