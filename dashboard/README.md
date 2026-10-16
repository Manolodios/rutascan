# RutaScan · Panel Nuevo (React)

Panel de control denso construido con **React 19 + Vite + Tailwind v4 + shadcn/ui**,
a partir del bloque [`@efferd/dashboard-2`](https://efferd.com) y **conectado a los
datos reales de RutaScan** (FastAPI).

El panel clásico (`../web`, HTML + JS puro) sigue intacto y funcionando.

## Cómo se abre

- **Producción (lo normal):** `..\ABRIR Panel Nuevo.bat` → abre
  <http://127.0.0.1:8000/app/>. El backend sirve este panel compilado desde
  `../web/app/`.
- **Desarrollo:** `npm run dev` → <http://localhost:5173> (proxy a la API en :8000).

Credenciales demo: cédula `1000000001`, PIN `1234`.

## Estructura

```
src/
  App.tsx                 enrutado por hash (#/, #/rutas, …) y login
  lib/
    api.ts                cliente HTTP (JWT + refresh automático en 401)
    auth.tsx              contexto de sesión (login / logout)
    links.ts              URLs según modo (dev vs desplegado)
    format.ts             fechas, porcentajes y etiquetas en español
    use-dashboard.ts      carga + refresco cada 30 s (summary, live-map, licencia)
  components/
    login-form.tsx        pantalla de ingreso (cédula + PIN)
    rs-dashboard.tsx      composición del panel
    rs-stats.tsx          KPIs (camiones en ruta, cumplimiento, ítems, alertas)
    rs-weekly-chart.tsx   gráfico de entregas/rechazos/cargas (recharts)
    rs-trucks-table.tsx   camiones en ruta hoy (live-map)
    rs-license-card.tsx   estado de la licencia
    rs-activity.tsx       actividad reciente (escaneos)
    app-shell.tsx         layout con barra lateral y cabecera (efferd app-shell-2)
```

## Endpoints que consume

| Endpoint | Uso |
| --- | --- |
| `POST /auth/login` | ingreso cédula + PIN |
| `POST /auth/refresh` | renovación silenciosa del token |
| `GET /api/v1/admin/dashboard/summary` | KPIs, semana y actividad reciente |
| `GET /api/v1/admin/dashboard/live-map` | camiones en ruta hoy |
| `GET /api/v1/admin/license` | estado de la licencia |

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | servidor de desarrollo (5173) |
| `npm run build` | compila a `dist/` |
| `npm run build:web` | compila con base `/app/` y copia a `../web/app/` |
| `npm run lint` | oxlint |

## Notas

- Se usa `legacy-peer-deps=true` (`.npmrc`) por un bug de resolución de pares de npm 10.
- Node local es 22.11.0; Vite 8 pide ≥22.12.0. Por eso el binario nativo de rolldown
  está fijado en `devDependencies` (`@rolldown/binding-win32-x64-msvc`). Actualizar
  Node a 22.12+ (idealmente 24 LTS) elimina el aviso y ese pin.
