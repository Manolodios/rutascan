# Plan: paginación del panel + onboarding de primeros pasos

Fecha: 2026-11-06
Alcance aprobado por el usuario ("hazlo"):

## 1. Backend
- [x] `dashboard_summary` agrega `setup` con conteos reales: camiones activos,
      productos activos, equipo (usuarios no ADMIN activos) y rutas históricas,
      más `complete`.
- [x] `GET /admin/security-events` acepta `offset` (ya acepta `limit`).
- [x] Pruebas: conteos de `setup` y paginación real por `offset`.

## 2. Panel
- [x] Productos: página de 50 con Anterior/Siguiente, búsqueda reinicia página,
      selección se conserva entre páginas.
- [x] Seguridad: página de 50 con Anterior/Siguiente, filtro reinicia página.
- [x] Onboarding: tarjeta "Primeros pasos" solo para ADMIN, con progreso 0-4,
      enlaces a Camiones/Productos/Usuarios/Rutas y opción de ocultarla
      (persistida por empresa en `localStorage`).

## 3. Verificación
- [x] `pytest` backend completo (44 passed).
- [x] `tsc` + build del panel, `oxlint` sin errores nuevos.
- [x] Prueba local end-to-end: empresa nueva (onboarding 0/4, ocultar) y
      catálogo con >50 productos (paginación real) + eventos >50 (offset).
- [x] `build:web`, commit, push, smoke test en producción (bundle
      `index-CD_rJKcz.js` live; health ok; `setup` y `offset` responden).
