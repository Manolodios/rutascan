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
| PIN robado | PIN con *hash* bcrypt, bloqueo por intentos y tokens de corta vida |
| App pirateada | Licencia por empresa, cupo de camiones y registro de dispositivos |
| GPS falso | Detección de ubicación simulada y velocidad imposible |
| Escaneos falsos | `scan_uuid` único (idempotencia) y verificación contra el manifiesto |
| Reloj manipulado | Desfase de marca de tiempo > 10 min ⇒ evento de seguridad |

## Buenas prácticas para quien despliega

- `SECRET_KEY` larga y única (`openssl rand -hex 32`); nunca la de ejemplo.
- Base de datos con un usuario limitado (no `postgres`) y TLS obligatorio.
- Secretos solo en variables de entorno; nunca en el repositorio.
- HTTPS de extremo a extremo (Render/Supabase ya lo dan).
- Copias de seguridad periódicas de la base de datos.
