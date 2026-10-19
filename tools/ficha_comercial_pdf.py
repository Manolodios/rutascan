# -*- coding: utf-8 -*-
"""Genera la ficha comercial de una pagina de RutaScan (para WhatsApp / correo).

Salida: docs/FICHA-COMERCIAL-RutaScan.pdf

Uso:
    .venv\\Scripts\\python.exe tools\\ficha_comercial_pdf.py

Se usa Helvetica (WinAnsiEncoding): no incluir emojis, flechas ni simbolos
fuera de Latin-1 (acentos, comillas « », guiones largos y bullets si funcionan).
"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SALIDA = ROOT / "docs" / "FICHA-COMERCIAL-RutaScan.pdf"

# --- Paleta ---------------------------------------------------------------
NAVY = colors.HexColor("#0f172a")
BLUE = colors.HexColor("#1d4ed8")
LIGHT = colors.HexColor("#eff6ff")
GREY = colors.HexColor("#475569")
BORDER = colors.HexColor("#cbd5e1")

ANCHO = 17.0 * cm

# --- Contacto -------------------------------------------------------------
WHATSAPP_VISTA = "+58 412 164 0277"
WHATSAPP_URL = "https://wa.me/584121640277"

# --- Estilos --------------------------------------------------------------
SS = {
    "marca": ParagraphStyle(
        "marca", fontName="Helvetica-Bold", fontSize=26, textColor=BLUE, leading=28,
    ),
    "lema": ParagraphStyle(
        "lema", fontName="Helvetica", fontSize=9.4, textColor=GREY, leading=12,
    ),
    "reclamo": ParagraphStyle(
        "reclamo", fontName="Helvetica-Bold", fontSize=15.5, textColor=NAVY, leading=19,
        spaceBefore=2, spaceAfter=2,
    ),
    "intro": ParagraphStyle(
        "intro", fontName="Helvetica", fontSize=9.8, textColor=GREY, leading=13.4,
        alignment=TA_JUSTIFY, spaceAfter=2,
    ),
    "h2": ParagraphStyle(
        "h2", fontName="Helvetica-Bold", fontSize=11.6, textColor=NAVY, leading=14,
        spaceBefore=9, spaceAfter=4,
    ),
    "vineta": ParagraphStyle(
        "vineta", fontName="Helvetica", fontSize=9.7, textColor=NAVY, leading=13,
        leftIndent=11, bulletIndent=1, spaceAfter=3,
    ),
    "cuerpo": ParagraphStyle(
        "cuerpo", fontName="Helvetica", fontSize=9.7, textColor=NAVY, leading=13,
        alignment=TA_JUSTIFY, spaceAfter=2,
    ),
    "celda": ParagraphStyle(
        "celda", fontName="Helvetica", fontSize=9.6, textColor=NAVY, leading=12.8,
    ),
    "precio": ParagraphStyle(
        "precio", fontName="Helvetica-Bold", fontSize=27, textColor=BLUE, leading=31,
    ),
    "cta": ParagraphStyle(
        "cta", fontName="Helvetica-Bold", fontSize=11.5, textColor=NAVY, leading=15,
        alignment=TA_CENTER,
    ),
    "cta2": ParagraphStyle(
        "cta2", fontName="Helvetica", fontSize=9.8, textColor=NAVY, leading=13.4,
        alignment=TA_CENTER,
    ),
    "pie": ParagraphStyle(
        "pie", fontName="Helvetica", fontSize=8, textColor=GREY, leading=10.5,
        alignment=TA_CENTER,
    ),
}


def p(texto: str, estilo: str) -> Paragraph:
    return Paragraph(texto, SS[estilo])


def vineta(texto: str) -> Paragraph:
    return Paragraph(texto, SS["vineta"], bulletText="\u2022")


HISTORIA: list = []

# --- Cabecera -------------------------------------------------------------
HISTORIA.append(
    Table(
        [[
            p("RutaScan", "marca"),
            p("Control de carga y evidencia<br/>de entrega para flotas", "lema"),
        ]],
        colWidths=[9.6 * cm, 7.4 * cm],
        style=TableStyle([
            ("VALIGN", (0, 0), (0, 0), "BOTTOM"),
            ("VALIGN", (1, 0), (1, 0), "BOTTOM"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]),
    )
)
HISTORIA.append(HRFlowable(width="100%", thickness=2, color=BLUE, spaceBefore=2, spaceAfter=7))

HISTORIA.append(p("Sepa <b>dónde está cada camión</b> y tenga la <b>prueba de cada entrega</b>.", "reclamo"))
HISTORIA.append(
    p("Para distribuidoras y transportistas con flota propia. Lo usa el conductor desde su "
      "celular y usted lo ve en vivo desde el computador o el teléfono.", "intro")
)

# --- Que resuelve ---------------------------------------------------------
HISTORIA.append(p("Lo que resuelve", "h2"))
for titulo, detalle in [
    ("Dónde está la carga:",
     " mapa en vivo con la última posición de cada camión, actualizado cada 10 segundos."),
    ("Prueba de cada entrega:",
     " quién recibió, a qué hora, con foto o firma y ubicación por cada producto escaneado."),
    ("Robo hormiga y fraude:",
     " el sistema avisa solo si alguien usa una ubicación falsa, mueve la hora del teléfono, "
     "escanea algo que no está en el manifiesto o repite un escaneo."),
    ("Sin señal, sin problema:",
     " el conductor escanea igual sin internet y todo se sincroniza cuando vuelve a tener red "
     "(hasta 3 días sin conexión)."),
    ("Reportes para gerencia:",
     " cumplimiento por ruta, camión, conductor y fecha, exportable a Excel y PDF."),
]:
    HISTORIA.append(vineta("<b>" + titulo + "</b>" + detalle))

# --- Como funciona --------------------------------------------------------
HISTORIA.append(p("Cómo funciona (tres pasos)", "h2"))
pasos = [
    ("1. Despacho.", " En la bodega se carga el manifiesto y se escanea cada bulto: queda "
                     "registrado qué salió y en qué camión."),
    ("2. En ruta.", " El conductor escanea cada entrega. Si el cliente firma o hay devolución, "
                    "también queda la foto y el motivo."),
    ("3. Usted ve.", " Panel en vivo, alertas de lo raro y reportes. El cliente recibe el "
                     "comprobante de su entrega."),
]
for titulo, detalle in pasos:
    HISTORIA.append(p("<b>" + titulo + "</b>" + detalle, "cuerpo"))

# --- Precio ---------------------------------------------------------------
HISTORIA.append(Spacer(1, 9))
tarjeta = Table(
    [[
        p("$15", "precio"),
        p("<b>por camión al mes</b> &middot; mínimo $30 al mes<br/>"
          "<b>Todo incluido</b>: panel, app del conductor, reportes, alertas, licencia y soporte"
          "<br/><b>30 días de prueba gratis</b> &middot; sin contrato &middot; desde 10 camiones: "
          "<b>$12</b> por camión", "celda"),
    ]],
    colWidths=[3.0 * cm, 14.0 * cm],
)
tarjeta.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
    ("LINEBEFORE", (0, 0), (0, -1), 2.4, BLUE),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
HISTORIA.append(tarjeta)

# --- Llamada a la accion --------------------------------------------------
HISTORIA.append(Spacer(1, 10))
cta = Table(
    [
        [p("Pida una demostración de <b>15 minutos</b> con sus propios datos", "cta")],
        [p("Escriba por WhatsApp al "
           '<link href="' + WHATSAPP_URL + '"><b>' + WHATSAPP_VISTA + "</b></link>"
           "  &middot;  Panel: rutascan.onrender.com<br/>"
           "Se la muestro en vivo: usted mira, pregunta y decide. Sin compromiso.", "cta2")],
    ],
    colWidths=[ANCHO],
)
cta.setStyle(TableStyle([
    ("BOX", (0, 0), (-1, -1), 1.1, BORDER),
    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
    ("TOPPADDING", (0, 0), (0, 0), 8),
    ("BOTTOMPADDING", (0, 0), (0, 0), 3),
    ("BOTTOMPADDING", (0, 1), (0, 1), 8),
    ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
]))
HISTORIA.append(cta)

HISTORIA.append(Spacer(1, 8))
HISTORIA.append(HRFlowable(width="100%", thickness=0.8, color=BORDER, spaceAfter=4))
HISTORIA.append(
    p("RutaScan &middot; Registro de carga, evidencia de entrega y control de flota &middot; "
      "hecho en Venezuela &middot; soporte por WhatsApp y actualizaciones incluidas", "pie")
)


def main() -> int:
    doc = SimpleDocTemplate(
        str(SALIDA),
        pagesize=A4,
        leftMargin=2.0 * cm,
        rightMargin=2.0 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.3 * cm,
        title="RutaScan - Ficha comercial",
        author="RutaScan",
        subject="Control de carga y evidencia de entrega para flotas",
    )
    doc.build(HISTORIA)
    print(f"Ficha generada: {SALIDA}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
