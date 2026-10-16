# RutaScan · Panel web (React)

Panel de control construido con **React 19 + Vite + Tailwind v4 + shadcn/ui**,
a partir del bloque [`@efferd/dashboard-2`](https://efferd.com) y **conectado a los
datos reales de RutaScan** (FastAPI). Es el **único panel** del proyecto: el backend
sirve su build en la raíz `/`.

## Cómo se abre

- **App de Windows (lo normal):** el acceso directo **RutaScan** abre el panel en su
  propia ventana. El programa arranca el backend y carga <http://127.0.0.1:8000/>.
- **Navegador:** `..\ABRIR RutaScan.bat` → compila si hace falta y abre
  <http://127.0.0.1:8000/> (lo sirve el backend desde `../web/`).
- **Desarrollo:** `npm run dev` → <http://localhost:5173> (proxy a la API en :8000).

Credenciales demo: cédula `1000000001`, PIN `1234` (ADMIN).
Bodega: `1000000002` / `2345`. Conductor: `1000000003` / `3456`.

## Secciones

Todas están implementadas y conectadas a la API real:

| Ruta | Sección | Qué permite |
| --- | --- | --- |
| `#/` | Panel | KPIs, semana, camiones en ruta, licencia y actividad |
| `#/mapa` | Mapa en vivo | última posición GPS por camión (Leaflet/OpenStreetMap), refresco cada 10 s |
| `#/rutas` | Rutas | crear ruta, manifiesto (agregar/quitar ítems, importar CSV), despachar |
| `#/productos` | Productos | catálogo, alta/edición, importar CSV/Excel, plantilla, etiquetas QR |
| `#/camiones` | Camiones | flota, conductor asignado, activar/desactivar |
| `#/usuarios` | Usuarios | alta/edición, roles, resetear PIN *(solo ADMIN)* |
| `#/reportes` | Reportes | exportar Excel/PDF por rango de fechas y ruta |
| `#/seguridad` | Seguridad | eventos antifraude con filtro y ubicación en mapa |
| `#/licencia` | Licencia | estado de suscripción y ranuras de dispositivos *(solo ADMIN)* |
| `#/plataforma` | Plataforma | **operador SaaS**: cuentas, estado y días de licencia restantes |

Usuarios y Licencia solo aparecen para el rol ADMIN; el resto se oculta solo.

`#/plataforma` es una pantalla aparte que **no** usa el login de empresa: pide la
clave `PLATFORM_API_KEY` del backend (`X-Platform-Key`) y permite ver todas las
cuentas con sus días de licencia, además de crear/renovar/suspender cuentas.

## Estructura

```
src/
  App.tsx                     enrutado por hash, panel de plataforma y protecciones por rol
  lib/
    api.ts                    cliente HTTP (JWT + refresh automático en 401) y descargas
    auth.tsx                  contexto de sesión (login / logout)
    platform.ts               cliente de plataforma (X-Platform-Key) y cálculo de días restantes
    format.ts                 fechas, porcentajes y etiquetas en español
    mutate.ts                 manejo de errores + toasts
    use-async.ts              carga de datos con recarga manual
    use-hash.ts               hash de la URL como estado
    use-dashboard.ts          carga + refresco cada 30 s (summary, live-map, licencia)
  components/
    logo.tsx                  marca RutaScan (camión + «RutaScan»)
    login-form.tsx            pantalla de ingreso (cédula + PIN)
    rs-dashboard.tsx          composición del panel
    rs-stats.tsx              KPIs (camiones en ruta, cumplimiento, ítems, alertas)
    rs-weekly-chart.tsx       gráfico de entregas/rechazos/cargas (recharts)
    rs-trucks-table.tsx       camiones en ruta hoy (live-map)
    rs-license-card.tsx       estado de la licencia
    rs-activity.tsx           actividad reciente (escaneos)
    page-header.tsx           cabecera de página y tarjeta de datos
    app-shell.tsx             layout con barra lateral y cabecera
    app-shared.tsx            menú lateral (con filtrado por rol)
    platform/
      platform-app.tsx        panel de plataforma (KPIs, tabla de cuentas, clave)
      company-dialogs.tsx     alta de cuenta y edición de licencia
    views/                    una vista por sección
      map-view.tsx            mapa en vivo (Leaflet)
      routes-view.tsx         rutas + manifiesto
      products-view.tsx       catálogo + etiquetas QR
      trucks-view.tsx         flota
      users-view.tsx          usuarios y PIN
      reports-view.tsx        exportaciones
      security-view.tsx       eventos antifraude
      license-view.tsx        licencia y dispositivos
      confirm-dialog.tsx      confirmaciones
      status-badge.tsx        insignias de estado
```

## Endpoints que consume

| Endpoint | Uso |
| --- | --- |
| `POST /auth/login` · `POST /auth/refresh` | ingreso cédula + PIN y renovación del token |
| `GET /api/v1/admin/dashboard/summary` | KPIs, semana y actividad reciente |
| `GET /api/v1/admin/dashboard/live-map` | camiones en ruta hoy y su última posición GPS |
| `GET/POST/DELETE /api/v1/admin/routes…` | rutas, manifiesto, importación y despacho |
| `GET/POST/PATCH /api/v1/admin/products…` | catálogo, importación, plantilla y etiquetas QR |
| `GET/POST/PATCH/DELETE /api/v1/admin/trucks…` | flota |
| `GET/POST/PATCH /api/v1/admin/users…` | usuarios y reset de PIN |
| `GET /api/v1/admin/reports/deliveries.xlsx` · `.pdf` | exportaciones |
| `GET /api/v1/admin/security-events` | auditoría antifraude |
| `GET/DELETE/POST /api/v1/admin/license…` | licencia y dispositivos |
| `GET/POST/PATCH /api/v1/platform/companies…` | panel de plataforma (cabecera `X-Platform-Key`) |

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | servidor de desarrollo (5173) |
| `npm run build` | compila a `dist/` (sin tocar `../web/`) |
| `npm run build:web` | compila y copia el resultado a `../web/` (lo que sirve el backend) |
| `npm run lint` | oxlint |

## Notas

- Node **24 LTS** (probado con 24.20.0 + npm 11). No hacen falta parches:
  el binario nativo de rolldown se instala solo.
- `../web/` es el resultado de `npm run build:web`, está **ignorado por git** y se
  reescribe completo en cada compilación: no edite archivos ahí.
- El panel usa rutas por hash (`#/rutas`), así que todo vive bajo `/` y no hace
  falta reescritura de rutas en el servidor.
- Tras cambiar el panel, vuelva a ejecutar `npm run build:web` para actualizarlo
  en la app de Windows.
