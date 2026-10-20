# Política de seguridad

RutaScan maneja datos de entregas, ubicaciones GPS y credenciales de operarios,
así que la seguridad es parte del producto, no un extra.

## Reportar una vulnerabilidad

**No abras un issue público.** Escribe un correo a la dirección que aparece en el
perfil del propietario del repositorio (o usa *Security → Report a vulnerability*
en GitHub) con:

- Descripción del fallo y su impacto.
- Pasos para reproducirlo (o una prueba de concepto).
- Versión / commit afectado.

Respondemos en un plazo de 72 horas y te avisamos cuando esté corregido. Si
quieres, te damos crédito público en la nota de la versión.

## Alcance

Nos interesa especialmente:

- Saltarse el **control de licencias** o el bloqueo por caducidad (`LicenseGuardMiddleware`).
- Acceder a datos de **otra empresa** (fallos de aislamiento multi-tenant).
- Falsificar escaneos, GPS o firmas de entrega (el módulo anti-fraude).
- Ejecutar código en el servidor, filtrar secretos o escalar privilegios.

Fuera de alcance: ataques de denegación de servicio, ingeniería social,
vulnerabilidades de dependencias ya publicadas y problemas de la instancia de
demostración pública (datos de ejemplo, sin valor real).

## Cómo protege RutaScan

| Riesgo | Mitigación |
| --- | --- |
| Datos de otra empresa | `company_id` en todas las tablas + filtro en cada consulta |
| PIN robado | PIN con *hash* bcrypt, bloqueo por cédula **y por IP** y tokens de corta vida (access 8 h, refresh rotado) |
| App pirateada | Licencia por empresa, cupo de camiones y registro de dispositivos |
| Panel sin pagar | Licencia vencida o suspendida ⇒ 402 en todo `/api/v1/admin` y `/api/v1/driver` (solo queda visible la pantalla de licencia) |
| Conductor que no debe ver el negocio | `/api/v1/driver` es de solo lectura y filtra por el propio conductor; todo `/api/v1/admin` exige rol ADMIN/WAREHOUSE |
| Fuerza bruta en la plataforma | Clave `X-Platform-Key` comparada con `secrets.compare_digest` (tiempo constante) |
| GPS falso | Detección de ubicación simulada y velocidad imposible |
| Escaneos falsos | `scan_uuid` único (idempotencia) y verificación contra el manifiesto |
| Reloj manipulado | Desfase de marca de tiempo > 10 min ⇒ evento de seguridad |
| Fórmulas maliciosas en Excel | Celdas de texto que empiezan por `= + - @` se exportan como texto |
| Archivos subidos | Solo imágenes (PNG/JPEG/WEBP), tamaño máximo y nombre aleatorio del servidor |
| Inyección SQL | ORM de SQLAlchemy; ninguna consulta arma SQL con texto del usuario |
| XSS | React escapa por defecto; los popups del mapa se escapan a mano |
| Mala configuración | Cabeceras `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y HSTS; Swagger apagado en producción |

## Limitaciones conocidas

Son decisiones conscientes para esta etapa, no fallos ocultos:

1. **Las fotos y firmas de entrega (PoD) se sirven desde `/uploads` sin
   autenticación.** El nombre incluye un hash del contenido más 12 caracteres
   aleatorios (≈ 96 bits), así que la URL no se adivina, pero quien tenga el
   enlace puede abrirla. Mitigación futura: URLs firmadas con caducidad.
2. **La empresa de demostración es pública y escribible.** Cualquiera con las
   credenciales de la demo puede alterar esos datos. Se reparan en un minuto con
   `backend/scripts/reseed_demo.py` (no afecta a clientes reales).
3. **El token de sesión vive en `localStorage`.** Es el patrón habitual en una
   SPA; un XSS lo podría leer. No hay CSP estricta porque el mapa (Leaflet) y los
   estilos en línea la romperían.
4. **CORS abierto (`*`).** La autenticación va en cabecera `Authorization`, no en
   cookies, así que no hay riesgo de CSRF; se puede cerrar al dominio propio.
5. **Sin límite global por IP en `/api/v1/platform`.** La clave es larga y
   aleatoria; el coste de adivinarla es prohibitivo.

## Qué se revisó (auditoría interna)

Autenticación y sesión, aislamiento multi-tenant en cada endpoint, subida de
archivos, generación de PDF/Excel/QR, claves y secretos en el repositorio y en el
paquete web, cabeceras HTTP, dependencias y el modo de producción. Los hallazgos
corregidos están en el historial de commits (`security:`); los aceptados, arriba.

## Buenas prácticas para quien despliega

- `SECRET_KEY` larga y única (`openssl rand -hex 32`); nunca la de ejemplo.
- Base de datos con un usuario limitado (no `postgres`) y TLS obligatorio.
- Secretos solo en variables de entorno; nunca en el repositorio.
- HTTPS de extremo a extremo (Render/Supabase ya lo dan).
- Copias de seguridad periódicas de la base de datos.
