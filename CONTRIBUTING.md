# Cómo contribuir a RutaScan

¡Gracias por el interés! RutaScan es un SaaS de rastreo de carga con enfoque
*offline-first* para empresas de distribución. Estas son las reglas de la casa.

## Antes de abrir un issue

- Busca en los issues existentes: puede estar ya reportado.
- Para **fallos de seguridad** no abras un issue público: mira [`SECURITY.md`](SECURITY.md).
- Indica qué parte (backend, panel, app móvil, app de escritorio), la versión y los
  pasos para reproducir el problema. Si puedes, adjunta el registro de errores.

## Preparar el entorno

Requisitos: **Python 3.12+**, **Node.js 20+**, y opcionalmente **Flutter 3.35+**
(solo para la app móvil) y **Docker** (base de datos + Redis).

```bash
# 1) Backend
cd backend
python -m venv .venv
.venv/Scripts/activate            # Windows
pip install -r requirements.txt
python -m scripts.init_db          # crea tablas y siembra la empresa demo
uvicorn app.main:app --reload      # http://127.0.0.1:8000/docs

# 2) Panel web
cd dashboard
npm install
npm run dev                        # http://localhost:5173

# 3) App de escritorio (Electron: abre el panel en su propia ventana)
cd desktop
npm install
npm start
```

Sin configurar nada, el backend usa **SQLite** y siembra una empresa de
demostración (`Comercializadora Andina S.A.S.`); las credenciales salen en la
consola al arrancar y también en el botón *"Ver credenciales de demostración"*
del login. Copia [`.env.example`](.env.example) a `.env` para usar PostgreSQL o
Redis.

## Pruebas

```bash
cd backend && pytest          # 15 pruebas, sin servicios externos (SQLite en memoria)
cd dashboard && npm run build # el panel tiene que compilar sin errores
```

Toda contribución debe: **pasar las pruebas**, **no romper el aislamiento
multi-tenant** (filtra siempre por `company_id`) y **no añadir secretos** al
repositorio.

## Estilo

- Python: 4 espacios, *type hints*, nombres en inglés y comentarios claros.
- TypeScript/React: sigue lo que ya hay en `dashboard/src` (funciones, no clases).
- Dart: `mobile/` usa el estilo estándar de `dart format`.
- Mensajes de commit en imperativo y cortos (`Añade reporte de rechazos`).

## Ramas y *pull requests*

1. Crea una rama desde `main`: `git checkout -b mi-cambio`.
2. Haz commits pequeños y con sentido.
3. Abre el *pull request* contando **qué** cambia y **por qué**, y cómo lo probaste.
4. Si toca la base de datos, explica la migración; si toca seguridad
   (licencias, PIN, GPS, anti-piratería), dilo explícitamente.

## Licencia de tus aportes

Al enviar un *pull request* aceptas que tu código se publique bajo la
**AGPL-3.0** ([`LICENSE`](LICENSE)), la misma licencia del proyecto.
