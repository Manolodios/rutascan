# RutaScan · Panel Nuevo (React)

Panel de control construido con **React 19 + Vite + Tailwind v4 + shadcn/ui**,
a partir del bloque [`@efferd/dashboard-2`](https://efferd.com) y **conectado a los
datos reales de RutaScan** (FastAPI).

El panel clásico (`../web`, HTML + JS puro) sigue intacto y funcionando como
respaldo.

## Cómo se abre

- **App de Windows (lo normal):** el acceso directo **RutaScan** ya abre este panel.
  El programa arranca el backend y carga <http://127.0.0.1:8000/app/>. Si el panel
  compilado no existe, cae automáticamente al panel clásico.
- **Navegador:** `..\ABRIR Panel Nuevo.bat` → compila si hace falta y abre
  <http://127.0.0.1:8000/app/> (lo sirve el backend desde `../web/app/`).
- **Desarrollo:** `npm run dev` → <http://localhost:5173> (proxy a la API en :8000).

Credenciales demo: cédula `1000000001`, PIN `1234` (ADMIN).
Bodega: `1000000002` / `2345`. Conductor: `1000000003` / `3456`.

## Secciones

Todas están implementadas y conectadas a la API real:

| Ruta | Sección | Qué permite |
| --- | --- | --- |
| `#/` | Panel | KPIs, semana, camiones en ruta, licencia y actividad |
| `#/rutas` | Rutas | crear ruta, manifiesto (agregar/quitar ítems, importar CSV), despachar |
| `#/productos` | Productos | catálogo, alta/edición, importar CSV/Excel, plantilla, etiquetas QR |
| `#/camiones` | Camiones | flota, conductor asignado, activar/desactivar |
| `#/usuarios` | Usuarios | alta/edición, roles, resetear PIN *(solo ADMIN)* |
| `#/reportes` | Reportes | exportar Excel/PDF por rango de fechas y ruta |
| `#/seguridad` | Seguridad | eventos antifraude con filtro y ubicación en mapa |
| `#/licencia` | Licencia | estado de suscripción y ranuras de dispositivos *(solo ADMIN)* |

Usuarios y Licencia solo aparecen para el rol ADMIN; el resto se oculta solo.

## Estructura

```
src/
  App.tsx                     enrutado por hash y protecciones por rol
  lib/
    api.ts                    cliente HTTP (JWT + refresh automático en 401) y descargas
    auth.tsx                  contexto de sesión (login / logout)
    links.ts                  URLs según modo (dev vs desplegado)
    format.ts                 fechas, porcentajes y etiquetas en español
    mutate.ts                 manejo de errores + toasts
    use-async.ts              carga de datos con recarga manual
    use-hash.ts               hash de la URL como estado
    use-dashboard.ts          carga + refresco cada 30 s (summary, live-map, licencia)
  components/
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
    views/                    una vista por sección
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
| `GET /api/v1/admin/dashboard/live-map` | camiones en ruta hoy |
| `GET/POST/DELETE /api/v1/admin/routes…` | rutas, manifiesto, importación y despacho |
| `GET/POST/PATCH /api/v1/admin/products…` | catálogo, importación, plantilla y etiquetas QR |
| `GET/POST/PATCH/DELETE /api/v1/admin/trucks…` | flota |
| `GET/POST/PATCH /api/v1/admin/users…` | usuarios y reset de PIN |
| `GET /api/v1/admin/reports/deliveries.xlsx` · `.pdf` | exportaciones |
| `GET /api/v1/admin/security-events` | auditoría antifraude |
| `GET/DELETE/POST /api/v1/admin/license…` | licencia y dispositivos |

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | servidor de desarrollo (5173) |
| `npm run build` | compila a `dist/` |
| `npm run build:web` | compila con base `/app/` y copia a `../web/app/` |
| `npm run lint` | oxlint |

## Notas

- Node **24 LTS** (probado con 24.20.0 + npm 11). No hacen falta parches:
  el binario nativo de rolldown se instala solo.
- `../web/app/` es el resultado de `npm run build:web` y está ignorado por git.
- Tras cambiar el panel, vuelva a ejecutar `npm run build:web` para actualizarlo
  en la app de Windows.
