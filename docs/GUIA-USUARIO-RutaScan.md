# RutaScan — Guía de uso (panel web + app del conductor)

**Distribuidora Costa Oriental, C.A.** · Cabimas, Zulia · Venezuela  
Soporte y ventas: WhatsApp +58 412 164 0277 · `wa.me/584121640277`

---

## 1. Antes de empezar

RutaScan tiene tres usuarios distintos. Nadie se registra solo; las cuentas las crea el dueño/administrador y se entregan con cédula y PIN de 4 dígitos.

| Rol | Qué hace | Entra desde |
|-----|----------|-------------|
| **Dueño / Administrador** | Da de alta camiones, conductores, rutas y clientes. Ve reportes, seguridad y licencia. | Panel web (`#/plataforma` o panel normal) |
| **Bodega** | Al despachar, escanea la carga que sube a cada camión. | Panel web |
| **Conductor** | En la calle, escanea cada entrega o rechazo con el celular. También puede consultar su día desde el panel web. | App del celular (APK) y panel web |

**Credenciales de demostración (solo para probar):**

| Usuario | Cédula | PIN | Qué ve |
|---------|--------|-----|--------|
| Administrador | `13598742` | `1234` | Todo el negocio |
| Bodega | `15874230` | `2345` | Carga y despacho |
| Conductor Jhonny Pirela | `20148379` | `3456` | Su ruta de hoy y lo que le falta |
| Conductor Ender Fuenmayor | `18376452` | `4567` | Su ruta de hoy |
| Conductor Alcides Urdaneta | `14209876` | `5678` | Su ruta de hoy |

La licencia de demo es `RUTA-4F7Q-2MX9-BN38` (12 camiones, activa).

---

## 2. Dueño / Administrador — panel web

Entrá en `https://rutascan.onrender.com/` (o tu `ABRIR RutaScan.bat` local) y iniciá sesión con tu cédula y PIN.

### 2.1 Pantalla de licencia
Si la licencia está vencida o suspendida, el panel te bloquea con un aviso y el WhatsApp de soporte. Mientras esté activa, tenés acceso total.

### 2.2 Panel (resumen del día)
Te muestra:
- Camiones en ruta hoy y cuántos llevan avanzados.
- Rutas de hoy: cuántas están completadas.
- Cumplimiento de entregas (porcentaje).
- Alertas de seguridad de las últimas 24 h (GPS simulado, reloj adelantado, escaneo fuera del manifiesto, duplicados).

### 2.3 Mapa en vivo
Muestra la última posición de cada camión con GPS. Verde = señal reciente; rojo = posible ubicación falsa. Se actualiza solo cada 10 segundos.

### 2.4 Rutas y manifiesto
Acá creás la ruta del día:
1. Elegís el camión.
2. El sistema toma automáticamente al conductor asignado a ese camión.
3. Cargás los productos con sus cantidades (el manifiesto).
4. Anotás una nota para el conductor si querés (ej. “Ruta Cabimas · salida 7:00 a. m.”).

Cuando la bodega escanea la carga, ese manifiesto queda “amarrado” al camión y al conductor.

### 2.5 Camiones
Listado de camiones de la empresa: placa, modelo, si está activo y qué conductor tiene asignado hoy. Desde acá podés cambiarle el conductor a un camión.

### 2.6 Usuarios
Altas de administrador, bodega y conductores. Cada uno lleva cédula, nombre completo, PIN y rol.

### 2.7 Reportes
Descargá Excel con tres hojas: entregas, rechazos y cargas, con fecha, hora, GPS y señales de fraude. Útil para cuadrar cuentas al final del día.

### 2.8 Seguridad
Bitácora de eventos sospechosos: GPS simulado, velocidad imposible, reloj del celular adelantado, escaneos repetidos, productos fuera del manifiesto.

---

## 3. Bodega — despacho y carga

Tu trabajo es escanear la carga **antes de que salga el camión**, así si falta una caja se sabe antes, no al otro día.

Desde el panel web, sección **Rutas** → abrís el manifiesto de la ruta en curso:

1. Verás la lista de productos que deben ir en ese camión.
2. Con el celular o un lector de QR, escaneá cada producto al subirlo al camión.
3. El sistema marca cada línea como “Cargado” / “En camión”.
4. Si sobra algo o falta algo, se ve al instante en el manifiesto.

Una vez todo cargado, el camión puede salir y el conductor empieza su jornada.

---

## 4. Conductor — en la calle

### 4.1 App del celular (lo principal)

1. Descargá la app desde el enlace que te dio el dueño (o desde el panel: sección “Mi ruta” → “App del celular”).
2. Abrí la app e iniciá sesión con tu **cédula** y **PIN de 4 dígitos**.
3. Verás tu ruta de hoy con los productos que tenés que entregar.
4. En cada parada:
   - Escaneá el QR del producto.
   - Elegí **Entregado** o **Rechazado** (si rechazó, elegí el motivo: dañado, producto equivocado, nadie en el destino, dirección no encontrada, otro).
   - El sistema registra hora, ubicación y queda como prueba.

**Funciona sin señal:** podés escanear igual sin internet y se sincroniza solo cuando vuelva la red. Podés trabajar hasta 3 días desconectado.

### 4.2 Panel web del conductor (consulta)

Si no tenés el celular a mano, o querés revisar tu día desde una computadora, entrá al panel con tu cédula y PIN. Verás solo lo tuyo:

#### Mi jornada
- Saludos con tu nombre y la fecha (hora de Venezuela).
- Tu ruta de hoy: camión, placa, modelo, estado (En ruta / Completada / Pendiente).
- Avance: porcentaje de cumplimiento, cuántas unidades entregadas, cuántas van en el camión, cuántos rechazos.
- Nota de la central (si el dueño dejó alguna).
- **Te faltan X unidades (Y productos)** — resumen rápido de lo que todavía no entregaste hoy.
- **Rutas por empezar** — si ya te programaron la ruta de mañana, la ves acá.
- Mapa con tu recorrido de hoy (los puntos donde escaneaste).
- Últimos escaneos del día (qué, cuándo y si fue offline o con GPS simulado).
- Botón para bajar la app del celular.

#### Mi ruta
- Manifiesto completo de tu ruta: producto, código QR, cuánto te asignaron, cuánto entregaste y estado de cada línea (Entregado / En camión / Rechazado).
- Por entregar: lista rápida con solo lo que te queda por completar.

#### Mi historial
- Tus rutas de los últimos 7, 14 o 30 días.
- Por cada ruta: fecha, camión, estado, unidades asignadas, entregadas y porcentaje de cumplimiento.
- Podés abrir cualquier ruta pasada y ver el detalle producto por producto.

**Importante:** desde el panel web **no se hacen entregas**. Las entregas y rechazos se confirman siempre con la app del celular. El panel es solo para consultar.

---

## 5. Flujo típico de un día de reparto

1. **Mañana (dueño o bodega):** se arma la ruta en el panel, se asigna camión y conductor, se carga el manifiesto.
2. **Bodega:** escanea cada producto al subirlo al camión. Queda constancia de qué carga sale y con quién.
3. **Conductor:** sale con el celular. En cada cliente escanea el QR, marca Entregado o Rechazado (con motivo), y listo.
4. **Durante el día (dueño):** desde el mapa en vivo ve dónde está cada camión y cómo va el avance.
5. **Final del día (dueño/bodega):** descarga el reporte de Excel, cierra cuentas y revisa alertas de seguridad.
6. **Mañana siguiente:** el conductor ve en “Mi jornada” o “Rutas por empezar” la ruta que ya le programaron.

---

## 6. Preguntas frecuentes

**¿El conductor tiene que saber usar computadora?**  
No. Solo necesita cédula, PIN y apuntar la cámara del celular al QR. Si sabe usar WhatsApp, sabe usar la app.

**¿Y si se cae internet en la calle?**  
La app sigue funcionando. Escanea igual y se sincroniza sola cuando vuelva la señal.

**¿El conductor puede borrar o cambiar entregas?**  
No. Cada escaneo queda registrado con fecha, hora y ubicación. Es la prueba de entrega.

**¿Qué pasa si me roban el celular?**  
Cada instalación es un dispositivo registrado. Desde el panel de seguridad se puede bloquear ese dispositivo para que no entre más.

**¿Cómo consigo una cuenta para mi empresa?**  
Escríbenos por WhatsApp: +58 412 164 0277 (`wa.me/584121640277`). Te creamos la cuenta con tu clave de licencia y tus camiones. Prueba 30 días sin contrato.

---

## 7. Soporte

- **WhatsApp (ventas y soporte):** +58 412 164 0277  
- **Enlace directo:** `wa.me/584121640277`  
- **App del celular:** descargala desde el panel web o desde el link que te envíe tu asesor.

RutaScan — Sabés dónde está la carga, tenés prueba de cada entrega y el sistema desconfía por vos.
