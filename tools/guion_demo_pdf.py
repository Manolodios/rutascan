# -*- coding: utf-8 -*-
"""Genera el guion de demostración de RutaScan en PDF.

Salida: docs/GUION-DEMO-RutaScan.pdf

Uso:
    .venv\\Scripts\\python.exe tools\\guion_demo_pdf.py

Se usa Helvetica (WinAnsiEncoding): no incluir emojis, flechas ni simbolos
fuera de Latin-1 (acentos, comillas « », guiones largos y bullets si funcionan).
"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SALIDA = ROOT / "docs" / "GUION-DEMO-RutaScan.pdf"

# --- Paleta ---------------------------------------------------------------
NAVY = colors.HexColor("#0f172a")
BLUE = colors.HexColor("#1d4ed8")
LIGHT = colors.HexColor("#eff6ff")
GREY = colors.HexColor("#475569")
SOFT = colors.HexColor("#f8fafc")
BORDER = colors.HexColor("#cbd5e1")

ANCHO = 17.4 * cm

# --- Estilos --------------------------------------------------------------
SS = {
    "marca": ParagraphStyle(
        "marca", fontName="Helvetica-Bold", fontSize=9, textColor=BLUE,
        leading=12, spaceAfter=2,
    ),
    "titulo": ParagraphStyle(
        "titulo", fontName="Helvetica-Bold", fontSize=22, textColor=NAVY,
        leading=25, spaceAfter=3,
    ),
    "sub": ParagraphStyle(
        "sub", fontName="Helvetica", fontSize=10.5, textColor=GREY,
        leading=14, spaceAfter=8,
    ),
    "intro": ParagraphStyle(
        "intro", fontName="Helvetica", fontSize=10, textColor=NAVY,
        leading=14, alignment=TA_JUSTIFY, spaceAfter=4,
    ),
    "h2": ParagraphStyle(
        "h2", fontName="Helvetica-Bold", fontSize=13, textColor=NAVY,
        leading=16, spaceBefore=6, spaceAfter=5,
    ),
    "step": ParagraphStyle(
        "step", fontName="Helvetica-Bold", fontSize=11, textColor=BLUE,
        leading=14, spaceBefore=8, spaceAfter=3,
    ),
    "cuerpo": ParagraphStyle(
        "cuerpo", fontName="Helvetica", fontSize=9.6, textColor=NAVY,
        leading=13, alignment=TA_JUSTIFY, spaceAfter=3,
    ),
    "viñeta": ParagraphStyle(
        "vineta", fontName="Helvetica", fontSize=9.6, textColor=NAVY,
        leading=13, leftIndent=10, bulletIndent=1, spaceAfter=2,
    ),
    "di": ParagraphStyle(
        "di", fontName="Helvetica-Oblique", fontSize=9.8, textColor=NAVY,
        leading=13.5, alignment=TA_JUSTIFY,
    ),
    "celda": ParagraphStyle(
        "celda", fontName="Helvetica", fontSize=9, textColor=NAVY, leading=12,
    ),
    "celdaB": ParagraphStyle(
        "celdaB", fontName="Helvetica-Bold", fontSize=9, textColor=NAVY, leading=12,
    ),
    "celdaH": ParagraphStyle(
        "celdaH", fontName="Helvetica-Bold", fontSize=9, textColor=colors.white,
        leading=12,
    ),
    "nota": ParagraphStyle(
        "nota", fontName="Helvetica", fontSize=8.6, textColor=GREY,
        leading=11.5, spaceBefore=3,
    ),
    "precio": ParagraphStyle(
        "precio", fontName="Helvetica-Bold", fontSize=26, textColor=BLUE, leading=30,
    ),
}


def p(texto, estilo="cuerpo"):
    return Paragraph(texto, SS[estilo])


def vineta(texto):
    return Paragraph(texto, SS["viñeta"], bulletText="\u2022")


def h2(texto):
    return KeepTogether([
        Spacer(1, 4),
        HRFlowable(width="100%", thickness=1.6, color=BLUE, spaceAfter=4),
        Paragraph(texto, SS["h2"]),
    ])


def di(texto):
    """Cita textual: lo que hay que decir, en una caja azul."""
    t = Table([[Paragraph(texto, SS["di"])]], colWidths=[ANCHO])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("LINEBEFORE", (0, 0), (0, -1), 2.4, BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def tabla(filas, anchos, fila_encabezado=True):
    t = Table(filas, colWidths=anchos, repeatRows=1 if fila_encabezado else 0)
    estilo = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if fila_encabezado:
        estilo += [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SOFT]),
        ]
    t.setStyle(TableStyle(estilo))
    return t


# --- Contenido ------------------------------------------------------------
HISTORIA = []

HISTORIA.append(p("RUTASCAN", "marca"))
HISTORIA.append(p("Guion de demostración", "titulo"))
HISTORIA.append(p(
    "Reunión de 5 minutos &middot; el orden de las pantallas, las palabras exactas "
    "y las respuestas a las preguntas difíciles.",
    "sub",
))
HISTORIA.append(p(
    "<b>Objetivo de la reunión:</b> que la empresa vea que RutaScan responde dos "
    "preguntas &mdash; <i>¿dónde está mi carga?</i> y <i>¿qué prueba tengo de cada "
    "entrega?</i> &mdash; y que acepte probarlo gratis con sus propios camiones. "
    "<b>Regla de oro:</b> habla de pérdidas, evidencia y control; nunca de tecnología.",
    "intro",
))

# 1. Antes de la reunión
HISTORIA.append(h2("1. Antes de la reunión (cinco minutos antes)"))
filas = [[
    p("#", "celdaH"), p("Qué hacer", "celdaH"), p("Por qué", "celdaH"),
]]
checklist = [
    ("1", "Abre <b>rutascan.onrender.com</b> y déjalo cargando.",
     "El plan gratuito duerme el sitio: el primer acceso tarda 30-60 segundos."),
    ("2", "Entra con el usuario de demostración y déjalo en el <b>Panel</b>.",
     "Empezar ya adentro ahorra un minuto y se ve profesional."),
    ("3", "Zoom del navegador al 110-125 % (tecla Ctrl junto al signo +).",
     "Que las letras se lean desde el otro lado del escritorio."),
    ("4", "Prueba una descarga antes: <b>Reportes &gt; Descargar Excel</b>.",
     "Evita el silencio incómodo si el navegador pregunta dónde guardar."),
    ("5", "Ten a mano el archivo <b>CLAVES.txt</b> y este guion.",
     "Por si abres el panel de plataforma o te preguntan algo raro."),
    ("6", "Si vas a mostrar el celular: cárgalo, con la app abierta y sesión iniciada.",
     "Nada peor que &laquo;espéreme, se está actualizando&raquo;."),
    ("7", "Cierra WhatsApp y las notificaciones (modo no molestar).",
     "Una notificación personal rompe la venta."),
]
for num, que, por in checklist:
    filas.append([p(num, "celdaB"), p(que, "celda"), p(por, "celda")])
HISTORIA.append(tabla(filas, [0.9 * cm, 8.4 * cm, 8.1 * cm]))

# 2. Guion minuto a minuto
HISTORIA.append(h2("2. El guion, minuto a minuto"))

PASOS = [
    ("0:00 - 0:40 &middot; El problema (todavía sin mostrar el computador)", [
        di("&laquo;Don/Doña [nombre], ¿usted sabe hoy a qué hora salió el camión, cuántas "
           "entregas lleva y si alguna se la rechazaron? ... Exacto: se sabe al final del "
           "día, cuando el conductor llama o entrega los papeles. Y cuando hay un reclamo, "
           "¿quién prueba qué pasó?&raquo;"),
        di("&laquo;RutaScan responde esas dos cosas: <b>dónde está la carga ahora</b> y "
           "<b>qué prueba tengo de cada entrega</b>. Se lo muestro en cinco minutos.&raquo;"),
    ]),
    ("0:40 - 1:20 &middot; Entrar (mostrar que es real, no un dibujo)", [
        vineta("<b>Haz:</b> abre el login, pulsa <b>Ver credenciales de demostración</b> y entra."),
        di("&laquo;Esto ya está funcionando en internet, no es un dibujo. Esta es una empresa de "
           "ejemplo de <b>Cabimas</b> &mdash; Distribuidora Costa Oriental &mdash; para no mostrarle "
           "datos de otro cliente: usted tendría su empresa, sus camiones y su nombre.&raquo;"),
    ]),
    ("1:20 - 2:20 &middot; Panel: el parte del día en un solo lugar", [
        vineta("<b>Haz:</b> señala las cuatro tarjetas y la tabla <b>Camiones en ruta hoy</b>."),
        di("&laquo;Este es el día de hoy: <b>3 rutas</b>, 4 camiones, 30 unidades asignadas, "
           "11 entregadas, 2 rechazos y <b>36.7 %</b> de cumplimiento. Fíjese: el P84LS6V está "
           "<b>en ruta</b> con 33 %, el B23MC7V ya <b>completó</b> su jornada y el G56RD9V "
           "todavía no sale.&raquo;"),
        di("&laquo;Y mire las <b>alertas</b> de 24 horas: tres cosas raras detectadas solitas. "
           "Ahí está la plata que hoy se pierde sin que usted se entere.&raquo;"),
    ]),
    ("2:20 - 3:00 &middot; Mapa en vivo (el primer «ah»)", [
        vineta("<b>Haz:</b> clic en <b>Mapa en vivo</b>."),
        di("&laquo;Esto se actualiza solo cada 10 segundos: la <b>última posición de cada "
           "camión</b> con la hora de la señal. Verde: señal reciente. Rojo: alguien intentó "
           "usar una <b>ubicación falsa</b>.&raquo;"),
        di("&laquo;Y ahí están los cuatro camiones repartidos por <b>Cabimas</b> y la Costa "
           "Oriental.&raquo;"),
    ]),
    ("3:00 - 3:50 &middot; Rutas y bodega: quién carga, quién entrega", [
        vineta("<b>Haz:</b> clic en <b>Rutas</b> y abre el <b>Manifiesto</b> de la ruta en curso."),
        di("&laquo;Aquí está el manifiesto: qué productos van en ese camión. La bodega los "
           "escanea al <b>Despachar</b> y esa carga queda amarrada a ese camión y a ese "
           "conductor. Si falta una caja, se sabe <b>antes</b> de que el camión salga, no al "
           "otro día.&raquo;"),
        di("&laquo;El conductor escanea cada entrega con el celular: producto, hora, ubicación "
           "y foto o firma del cliente.&raquo;"),
    ]),
    ("3:50 - 4:30 &middot; Reportes (el segundo «ah»)", [
        vineta("<b>Haz:</b> clic en <b>Reportes</b>, pulsa <b>Descargar Excel (.xlsx)</b> y sigue "
               "hablando mientras descarga."),
        di("&laquo;¿Quién entregó, a qué hora, dónde y con qué evidencia? Está en el Excel: "
           "tres hojas, con GPS y señales de fraude. <b>Mientras le explico, ya se está "
           "descargando</b>; esto es lo que hoy alguien digita en Excel todo el día.&raquo;"),
    ]),
    ("4:30 - 5:10 &middot; Seguridad y licencia (el miedo del dueño)", [
        vineta("<b>Haz:</b> clic en <b>Seguridad</b>."),
        di("&laquo;El sistema desconfía por usted: si el teléfono usa <b>ubicación simulada</b>, "
           "si le <b>mueven la hora</b>, si escanean un producto que <b>no está en el "
           "manifiesto</b> o si <b>repiten</b> un escaneo para robárselo. Todo queda registrado "
           "con fecha, usuario y lugar.&raquo;"),
        di("&laquo;Y aquí está la <b>licencia</b> y los <b>dispositivos</b>: si mañana alguien "
           "se lleva una tablet o intenta usar la app sin pagar, se bloquea sola. Usted decide "
           "quién entra.&raquo;"),
    ]),
    ("5:10 - 5:40 &middot; El celular del conductor (si lo tienes a mano)", [
        vineta("<b>Haz:</b> muestra la app: cédula, PIN y escanear."),
        di("&laquo;Esto es lo que ve el conductor: tres toques. Funciona <b>sin señal</b>: escanea "
           "igual y se sincroniza cuando vuelva la red. No hay que capacitarlo: cédula, PIN y "
           "apuntar la cámara.&raquo;"),
    ]),
    ("5:40 - 6:00 &middot; Cierre (el pedido)", [
        di("&laquo;Le resumo: usted sabe dónde está la carga, tiene prueba de cada entrega, "
           "cierra las cuentas solo y detecta el robo. Se lo dejo <b>probando 30 días</b> con "
           "sus propios camiones, sin pagar nada y sin contrato. ¿Le parece si el lunes le "
           "creo la cuenta con dos camiones?&raquo;"),
        p("<b>Detente y deja que responda.</b> El objetivo de esta reunión es la prueba, "
          "no el contrato.", "cuerpo"),
    ]),
]

for titulo, bloque in PASOS:
    contenido = [Paragraph(titulo, SS["step"])]
    for i, item in enumerate(bloque):
        if i:
            contenido.append(Spacer(1, 3))
        contenido.append(item)
    HISTORIA.append(KeepTogether(contenido))

# 3. Las tres ideas
HISTORIA.append(h2("3. Las tres ideas que deben recordar (repítelas al cerrar)"))
for texto in [
    "<b>Dónde está la carga</b> &mdash; mapa en vivo, actualizado cada 10 segundos.",
    "<b>Prueba de cada entrega</b> &mdash; escaneo con hora, ubicación y foto o firma.",
    "<b>El sistema desconfía por usted</b> &mdash; alertas de fraude y control de licencia.",
]:
    HISTORIA.append(vineta(texto))

# 4. Preguntas difíciles
HISTORIA.append(h2("4. Preguntas difíciles y qué responder"))
preguntas = [
    ("¿Cuánto vale?",
     "15 dólares por camión al mes, todo incluido; desde 10 camiones baja a 12. Los primeros 30 días "
     "son gratis y no hay contrato."),
    ("¿Qué planes tienen? ¿Cuál es el básico?",
     "No hay planes ni versiones recortadas: un solo precio con todo incluido. Lo único que cambia es "
     "cuántos camiones tiene usted."),
    ("¿Funciona sin internet?",
     "Sí, es lo primero que resolvimos: el conductor escanea sin señal y se sincroniza cuando vuelve "
     "la red. Puede trabajar hasta 3 días desconectado."),
    ("¿Y si me roban el celular o lo usan sin pagar?",
     "Cada instalación es un dispositivo registrado y hay cupo por empresa; desde el panel se bloquea "
     "o se libera."),
    ("¿Dónde quedan mis datos? ¿Es seguro?",
     "En servidores en la nube con conexión cifrada, base de datos administrada, claves protegidas y "
     "cada empresa aislada: nadie ve los datos de otra. Fotos y firmas incluidas."),
    ("¿Se integra con mi sistema o mi ERP?",
     "Tiene API documentada y exportación a Excel y PDF; la integración con su software se hace sobre "
     "esa API."),
    ("¿Mis conductores lo van a saber usar?",
     "Cédula, PIN de 4 dígitos y apuntar la cámara. Si saben usar WhatsApp, saben usar esto."),
    ("¿Y si dejo de pagar?",
     "No hay contrato de permanencia: si no sigue, le entregamos su histórico en Excel y listo."),
    ("¿Quién más lo usa?",
     "Estamos entrando con empresas como la suya; por eso la prueba no tiene costo. (Nunca inventes "
     "clientes.)"),
    ("¿Quién lo programó? ¿Qué pasa si te desapareces?",
     "El código está versionado y se puede auditar o dejar en garantía; el sistema opera solo, no "
     "depende de que yo esté presente."),
    ("¿Esto reemplaza mi facturación?",
     "No: RutaScan controla la operación y la evidencia de entrega; la facturación sigue en su sistema."),
]
filas = [[p("Pregunta", "celdaH"), p("Respuesta corta y honesta", "celdaH")]]
for preg, resp in preguntas:
    filas.append([p("<i>" + preg + "</i>", "celda"), p(resp, "celda")])
HISTORIA.append(tabla(filas, [5.2 * cm, 12.2 * cm]))

# 5. Precio unico
HISTORIA.append(h2("5. Precio: uno solo, todo incluido"))
HISTORIA.append(p("Una sola mensualidad, todo el sistema, sin planes ni letra pequeña. Es lo más fácil "
                  "de decir, lo más fácil de recordar y lo que menos preguntas genera: lo único que "
                  "cambia es <b>cuántos camiones</b> tiene el cliente.", "cuerpo"))
tarjeta = Table(
    [[
        Paragraph("$15", SS["precio"]),
        Paragraph("por camión al mes<br/>sin contrato &middot; <b>30 días de prueba gratis</b>"
                  "<br/>desde 10 camiones: <b>$12</b> por camión", SS["celda"]),
    ]],
    colWidths=[3.4 * cm, 14.0 * cm],
)
tarjeta.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
    ("LINEBEFORE", (0, 0), (0, -1), 2.4, BLUE),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
]))
HISTORIA.append(tarjeta)
HISTORIA.append(Spacer(1, 4))
HISTORIA.append(vineta("Es <b>por camión, no por usuario</b>: entran todos los que necesiten (bodega, "
                       "administración, conductores). Es un argumento de venta."))
HISTORIA.append(vineta("<b>Todo incluido:</b> panel, app del conductor, reportes, alertas de fraude, "
                       "licencia, soporte por WhatsApp y actualizaciones. No hay versión básica."))
HISTORIA.append(vineta("Cobra <b>mensual por adelantado</b>: la prueba gratis convierte más que un descuento."))
HISTORIA.append(vineta("<b>No ofrezcas descuento tú primero.</b> Si te lo piden: <i>&laquo;si paga el año "
                       "completo, le regalo dos meses&raquo;</i>."))
HISTORIA.append(vineta("No cobres instalación: la <b>puesta en marcha la hago yo</b> (cuesta tiempo, no plata)."))
HISTORIA.append(vineta("<b>Cómo cobrar (Venezuela):</b> Zelle, efectivo en dólares o Binance (USDT); si el "
                       "cliente solo paga en bolívares, Pago Móvil al cambio del día."))
HISTORIA.append(vineta("<b>Factura:</b> si el cliente es una empresa formal te va a pedir factura fiscal; "
                       "tenlo resuelto antes de cerrar."))

# 6. Chuleta
chuleta = [
    ("Panel", "https://rutascan.onrender.com"),
    ("Empresa demo", "Distribuidora Costa Oriental, C.A. &middot; Cabimas, Zulia"),
    ("Pantallas directas", "#/mapa &middot; #/rutas &middot; #/reportes &middot; #/seguridad"),
    ("Panel de plataforma", "#/plataforma (la clave está en CLAVES.txt)"),
    ("Administrador", "13598742 / 1234"),
    ("Bodega", "15874230 / 2345"),
    ("Conductores", "20148379 / 3456 &middot; 18376452 / 4567 &middot; 14209876 / 5678"),
    ("App del celular", ".../uploads/RutaScan-Celular.apk (23 MB, Android 7 o superior)"),
    ("App para teléfonos antiguos", ".../uploads/RutaScan-Celular-32bits.apk (19 MB)"),
    ("Licencia demo", "RUTA-4F7Q-2MX9-BN38 (vigente por un año)"),
]
filas = [[p("Dato", "celdaH"), p("Valor", "celdaH")]]
for dato, valor in chuleta:
    filas.append([p("<b>" + dato + "</b>", "celda"), p(valor, "celda")])
HISTORIA.append(Spacer(1, 4))
HISTORIA.append(HRFlowable(width="100%", thickness=1.6, color=BLUE, spaceAfter=4))
HISTORIA.append(Paragraph("6. Chuleta (ten esto a la vista)", SS["h2"]))
HISTORIA.append(tabla(filas, [5.2 * cm, 12.2 * cm]))

HISTORIA.append(Spacer(1, 8))
HISTORIA.append(p("Y lo que <b>no</b> hay que hacer: no improvises (si no sabes algo, &laquo;se lo "
                  "confirmo por escrito hoy mismo&raquo;), no abras Ajustes ni CLAVES.txt delante del "
                  "cliente, no prometas funciones ni fechas que no existen y no des la demo sin haber "
                  "abierto el sitio un minuto antes.", "nota"))


# --- Plantilla ------------------------------------------------------------
def pie(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(1.8 * cm, 1.25 * cm, A4[0] - 1.8 * cm, 1.25 * cm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GREY)
    canvas.drawString(1.8 * cm, 0.9 * cm, "RutaScan  ·  Guion de demostración")
    canvas.drawRightString(A4[0] - 1.8 * cm, 0.9 * cm, "Página %d" % doc.page)
    canvas.restoreState()


def main():
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(SALIDA),
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.6 * cm,
        title="RutaScan - Guion de demostración",
        author="RutaScan",
        subject="Guion de demo comercial",
    )
    marco = Frame(doc.leftMargin, doc.bottomMargin, ANCHO, A4[1] - 3.1 * cm, id="cuerpo")
    doc.addPageTemplates([PageTemplate(id="principal", frames=[marco], onPage=pie)])
    doc.build(HISTORIA)
    print("PDF generado:", SALIDA)


if __name__ == "__main__":
    main()
