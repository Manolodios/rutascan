# RutaScan — Contrato de API (v1)

Base URL por defecto en desarrollo: `http://localhost:8000`.
Documentación interactiva: `GET /docs` (OpenAPI) con todos los esquemas.

## Cabeceras

| Cabecera          | Uso                                                        |
| ----------------- | ---------------------------------------------------------- |
| `X-License-Key`   | Licencia de la empresa. Obligatoria en `/api/v1/mobile/*`; opcional en `/auth/login` y `/auth/refresh`. |
| `X-Device-UUID`   | UUID estable del dispositivo (se guarda en el dispositivo). |
| `X-Device-Platform` | `android` \| `ios` \| `other` (informativo, se registra). |
| `X-App-Version`   | Versión de la app móvil.                                   |
| `Authorization`   | `Bearer <access_token>` en endpoints autenticados.         |
| `X-Platform-Key`  | Clave de operador de plataforma para `/api/v1/platform/*`.  |

## Sobre de errores

Todos los errores comparten una forma estable:

```json
{ "detail": "Mensaje legible", "code": "ERROR_CODE" }
```

Errores de validación (422) añaden `errors: [...]` y `code: "VALIDATION_ERROR"`.
`PIN_LOCKOUT` añade `retry_after` (segundos).

Códigos relevantes:

| HTTP | Código                   | Significado                                       |
| ---- | ------------------------ | ------------------------------------------------- |
| 400  | `MISSING_LICENSE_HEADERS`| Faltan `X-License-Key` o `X-Device-UUID`.          |
| 401  | `INVALID_CREDENTIALS`    | Cédula/PIN incorrectos.                            |
| 401  | `INVALID_TOKEN` / `INVALID_REFRESH_TOKEN` / `TOKEN_REVOKED` | Token inválido, vencido o rotado. |
| 402  | `INVALID_LICENSE_KEY`    | Licencia inexistente.                              |
| 402  | `SUBSCRIPTION_EXPIRED` / `SUBSCRIPTION_SUSPENDED` | Suscripción vencida/suspendida. |
| 403  | `DEVICE_LIMIT_REACHED`   | El dispositivo supera `max_trucks` de la licencia. |
| 403  | `CROSS_TENANT`           | La licencia no corresponde al usuario.             |
| 404  | `ITEM_NOT_FOUND`         | QR no existe en el catálogo.                       |
| 404  | `SCAN_NOT_FOUND`         | No hay escaneo sincronizado para adjuntar evidencia. |
| 409  | `ITEM_NOT_IN_MANIFEST`   | El producto no está en la ruta de hoy.             |
| 409  | `ALREADY_DELIVERED`      | Línea ya entregada.                                |
| 422  | `MOCK_LOCATION_DETECTED` | GPS simulado: escaneo rechazado.                   |
| 422  | `REJECTION_REASON_REQUIRED` | Falta motivo en un rechazo.                     |
| 429  | `PIN_LOCKOUT`            | Demasiados intentos de PIN (ver `retry_after`).    |

---

## Autenticación

### `POST /auth/login`

```json
{
  "cedula": "1000000003",
  "pin": "3456",
  "device_uuid": "…",
  "platform": "android",
  "app_version": "1.0.0"
}
```

Respuesta 200 (`TokenPair`):

```json
{
  "access_token": "…", "refresh_token": "…", "token_type": "bearer",
  "expires_in": 1800,
  "user": { "id": "…", "user_cedula": "…", "full_name": "…", "role": "DRIVER", "is_active": true },
  "company": { "id": "…", "name": "…", "tax_id": "…", "license_key": "…" },
  "license": { "subscription_status": "ACTIVE", "days_remaining": 999, "max_trucks": 5, "active_devices": 1, … },
  "grace_token": "…", "grace_expires_at": "2026-10-19T14:21:28Z"
}
```

- Con `X-License-Key` válida, el login valida la suscripción (402) y registra el
  dispositivo (403 si excede `max_trucks`).
- Los administradores no consumen cupo de dispositivos.

### `POST /auth/refresh`

`{ "refresh_token": "…" }` → `TokenPair`. Rota el refresh token (el anterior
queda revocado). Incluya `X-License-Key` para recibir un nuevo `grace_token`.

### `POST /auth/logout`

`{ "refresh_token": "…" }` → `{ "detail": "…", "code": "LOGGED_OUT" }`.

### `GET /auth/me`

Datos del usuario autenticado.

### `GET /auth/heartbeat`

Latido genérico (web): `{ server_time_utc, license, grace_token, grace_expires_at }`.

---

## Móvil (`/api/v1/mobile/*` — guardado por licencia)

Todas las peticiones requieren `X-License-Key` + `X-Device-UUID` + Bearer.
El middleware valida licencia y registra el dispositivo en cada llamada.

### `POST /api/v1/mobile/heartbeat`

Renueva el permiso offline:

```json
{ "server_time_utc": "…", "license": { … }, "grace_token": "…", "grace_expires_at": "…" }
```

### `GET /api/v1/mobile/routes/today`

Manifiesto del conductor para hoy:

```json
{
  "route": { "id": "…", "route_date": "2026-10-16", "status": "IN_PROGRESS",
             "truck": { "id": "…", "license_plate": "WKL-482", "model": "…" } },
  "counts": { "lines": 5, "assigned_units": 7, "delivered_units": 2,
              "rejected_lines": 0, "in_truck_lines": 3, "completion_pct": 28.6 },
  "items": [ { "route_detail_id": "…", "status": "IN_TRUCK",
               "assigned_quantity": 2, "delivered_quantity": 0,
               "return_required": false, "rejection_reason": null,
               "last_scan_at": null,
               "product": { "id": "…", "barcode_qr": "7702001000019",
                            "description": "…", "unit": "BOX", "weight": 2.5 } } ],
  "message": null
}
```

Sin ruta asignada: `route = null`, `items = []`, `message` explicativo.

### `POST /api/v1/mobile/deliveries/scan`

```json
{
  "scan_uuid": "uuid-v4-generado-en-el-dispositivo",
  "qr_code": "7702001000019",
  "action": "LOAD | DELIVER | REJECT",
  "latitude": 4.6533, "longitude": -74.0836, "gps_accuracy_m": 4.2,
  "is_mocked_location": false,
  "scan_timestamp_utc": "2026-10-16T14:20:00Z",
  "rejection_reason": "DAMAGED", "rejection_notes": "Caja rota",
  "pod_signature_url": null, "pod_photo_url": null
}
```

Respuesta 200:

```json
{ "accepted": true, "duplicate": false, "code": null,
  "message": "Escaneo registrado.", "product_description": "…",
  "detail_status": "DELIVERED", "route_completed": false, "flags": null }
```

Notas:

- `scan_uuid` es la clave de idempotencia: repetirlo devuelve
  `duplicate: true` sin duplicar datos.
- Los comentarios de rechazo son obligatorios para `REJECT`.
- Un rechazo marca `return_required` en la línea (reingreso a inventario).
- Escaneos viejos/sospechosos se marcan con `flags` (velocidad imposible,
  reloj adelantado, escaneo offline antiguo) y generan eventos de seguridad.

### `POST /api/v1/mobile/deliveries/sync-batch`

Flush de la cola offline — **una transacción atómica**, resultado por ítem
(cada ítem en su propio SAVEPOINT):

```json
{
  "items": [ { /* igual a scan */ } ],
  "batch_reference": "flutter-1697460000000"
}
```

Respuesta 200:

```json
{
  "batch_id": "…", "received": 3, "accepted": 2, "rejected": 1, "duplicates": 0,
  "results": [
    { "scan_uuid": "…", "qr_code": "…", "accepted": true, "duplicate": false,
      "code": null, "message": "…", "product_description": "…",
      "detail_status": "DELIVERED", "route_completed": false },
    { "scan_uuid": "…", "qr_code": "…", "accepted": false, "duplicate": false,
      "code": "ITEM_NOT_IN_MANIFEST", "message": "…" }
  ]
}
```

### `POST /api/v1/mobile/pod` (multipart)

- `kind`: `signature` | `photo`
- `file`: PNG/JPEG/WEBP (máx. `MAX_UPLOAD_MB`, defecto 10)

Respuesta: `{ "url": "/uploads/<company>/signature/…png", "kind": "signature",
"size_bytes": 1234, "sha256": "…" }`.

### `POST /api/v1/mobile/deliveries/pod-attach`

Asocia evidencias a un escaneo ya sincronizado (clave: `scan_uuid`):

```json
{ "scan_uuid": "…", "pod_signature_url": "/uploads/…", "pod_photo_url": null }
```

Respuesta: `{ "detail": "Evidencia de entrega adjuntada.", "code": "POD_ATTACHED" }`.
Si el escaneo aún no está en el servidor → 404 `SCAN_NOT_FOUND` (la app inyecta
la URL en la cola local y viaja con el batch).

---

## Admin (`/api/v1/admin/*` — roles ADMIN / WAREHOUSE)

| Método y ruta | Descripción |
| --- | --- |
| `GET /dashboard/summary` | KPIs: entregas, rechazos, eventos, licencia. |
| `GET /dashboard/live-map` | Última posición por camión + eventos. |
| `GET /dashboard/activity` | Actividad reciente. |
| `GET /routes?route_date=…` | Rutas (filtro por fecha). |
| `POST /routes` | Crear ruta `{truck_id, route_date, driver_id?, notes?}`. |
| `GET /routes/{id}` | Ruta completa con líneas (`RouteFullOut`). |
| `POST /routes/{id}/details` | Asignar productos `{items: [{product_id, assigned_quantity}]}`. |
| `POST /routes/{id}/details/import` | Importar manifiesto CSV/Excel. |
| `POST /routes/{id}/dispatch` | Despachar ruta (PENDING → IN_PROGRESS). |
| `GET /products` · `POST /products` | Listar/crear productos. |
| `PATCH /products/{id}` | Actualizar producto. |
| `GET /products/template.csv` | Plantilla de importación. |
| `POST /products/import` | Importar productos (upsert). |
| `GET /products/qr-sheet.pdf` | Hoja PDF de etiquetas QR. |
| `GET /products/{id}/qr.png` | QR individual PNG. |
| `GET /trucks` · `POST /trucks` | Camiones. |
| `PATCH /trucks/{id}` | Actualizar camión. |
| `GET /users` · `GET /users/drivers` · `POST /users` | Usuarios. |
| `PATCH /users/{id}` | Actualizar usuario. |
| `POST /users/{id}/reset-pin` | `{pin}` nuevo PIN. |
| `GET /reports/deliveries.xlsx` / `.pdf` | Reportes (filtros por fecha). |
| `GET /license` | Snapshot de licencia + dispositivos. |
| `GET /license/devices` | Dispositivos registrados. |
| `POST /license/devices/{id}/block` | Bloquear dispositivo. |
| `GET /security-events` | Eventos anti-fraude. |

Todos exigen Bearer y aíslan por `company_id` del token (multi-tenant estricto).

---

## Plataforma (`/api/v1/platform/*` — `X-Platform-Key`)

| Método y ruta | Descripción |
| --- | --- |
| `POST /companies` | Alta de empresa + licencia + admin: `{name, tax_id, max_trucks, expiration_date, admin_cedula, admin_full_name, admin_pin}` → `{company_id, license_key, …}`. |
| `GET /companies` | Listado de empresas con métricas. |
| `PATCH /companies/{id}/license` | `{subscription_status?, expiration_date?, max_trucks?, is_active?}`. |

---

## Licencia y modo offline (resumen)

1. Cada llamada a `/api/v1/mobile/*` pasa por el guard de licencia:
   400 sin cabeceras · 402 licencia inválida/vencida/suspendida ·
   403 si un UUID nuevo excede `max_trucks` (los UUID ya registrados siempre pasan).
2. `/auth/login` y `/api/v1/mobile/heartbeat` emiten un **grace token** firmado
   válido 3 días. La app móvil lo cachea y permite escanear sin conexión
   mientras `now < grace_expires_at` y el último estado conocido sea `ACTIVE`.
3. Al volver la conexión, el móvil sincroniza primero los escaneos
   (`sync-batch`) y luego las evidencias (`pod` + `pod-attach`).
