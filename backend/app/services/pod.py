"""Normalize and shrink proof-of-delivery images before storing them.

Signatures are kept as PNG (transparency matters); photos are re-encoded as
JPEG. This keeps the database small and strips EXIF metadata (including GPS)
from the original file.
"""

from __future__ import annotations

import io

from PIL import Image, ImageOps

MAX_STORED_BYTES = 3 * 1024 * 1024


class InvalidPodImage(ValueError):
    """The uploaded bytes are not a supported image."""


def prepare_pod(data: bytes, kind: str) -> tuple[bytes, str]:
    """Return ``(bytes, content_type)`` ready to be stored."""
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            image = ImageOps.exif_transpose(image)

            if kind == "signature":
                if image.mode not in ("RGBA", "LA"):
                    image = image.convert("RGBA")
                image.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
                buffer = io.BytesIO()
                image.save(buffer, format="PNG", optimize=True)
                stored, content_type = buffer.getvalue(), "image/png"
            else:
                if getattr(image, "is_animated", False):
                    image.seek(0)
                image = image.convert("RGB")
                image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
                buffer = io.BytesIO()
                image.save(
                    buffer,
                    format="JPEG",
                    quality=82,
                    optimize=True,
                    progressive=True,
                )
                stored, content_type = buffer.getvalue(), "image/jpeg"
    except Exception as exc:  # Pillow raises several unrelated exception types
        raise InvalidPodImage("Archivo de imagen no válido.") from exc

    if len(stored) > MAX_STORED_BYTES:
        raise InvalidPodImage("La imagen sigue siendo demasiado grande tras comprimirla.")
    return stored, content_type
