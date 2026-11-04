"""
Uploaded images in any common format -> upright PNG/JPEG pages.

The Streamlit core opens images with PyMuPDF, which reads PNG and JPEG but
not iPhone photos (HEIC), WEBP, AVIF and others, and it ignores the EXIF
"rotate me" flag that phone cameras set, so many phone photos reached the
OCR sideways. Everything goes through here first:

- HEIC/HEIF (pillow-heif), WEBP, AVIF, BMP, TIFF, GIF, ICO, PPM... (Pillow)
- EXIF orientation applied, so the picture is upright
- transparency flattened onto a background that contrasts with the text
- multi-page TIFF / multi-frame images split into pages (split_pages)
"""

import io

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_FRAMES = 30

try:  # iPhone photos
    import pillow_heif

    pillow_heif.register_heif_opener()
except Exception:  # optional: everything else still works
    pillow_heif = None


def _open(data):
    from PIL import Image

    image = Image.open(io.BytesIO(data))
    image.load()
    return image


def _flatten(image):
    """RGB image; transparent areas get a background the text stands out on."""

    from PIL import Image
    import numpy as np

    if image.mode in ("RGBA", "LA", "PA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        array = np.asarray(rgba).astype(np.float32)
        alpha = array[..., 3:4] / 255.0
        visible = alpha[..., 0] > 0.5
        ink = float(array[..., :3][visible].mean()) if visible.any() else 0.0
        background = 0.0 if ink > 140 else 255.0  # white text -> dark background
        flat = array[..., :3] * alpha + background * (1.0 - alpha)
        return Image.fromarray(np.clip(flat, 0, 255).astype("uint8"), "RGB")

    if image.mode not in ("RGB", "L"):
        return image.convert("RGB")

    return image


def _encode(image):
    buffer = io.BytesIO()

    if image.mode == "RGB" and image.width * image.height > 2_500_000:
        image.save(buffer, "JPEG", quality=92)
        return buffer.getvalue(), "image/jpeg"

    image.save(buffer, "PNG")
    return buffer.getvalue(), "image/png"


def _upright(image):
    from PIL import ImageOps

    try:
        return ImageOps.exif_transpose(image)
    except Exception:
        return image


def normalize_image(data, mime="image/png"):
    """
    (bytes, mime) that PyMuPDF can read, upright. PNGs and upright JPEGs
    pass through untouched; anything unreadable is returned as it was.
    """

    if not data or data[:8] == PNG_SIGNATURE:
        return data, mime

    try:
        image = _open(data)
    except Exception:
        return data, mime

    if image.format == "JPEG":
        try:
            orientation = image.getexif().get(0x0112, 1)
        except Exception:
            orientation = 1

        if orientation in (None, 1) and image.mode in ("RGB", "L"):
            return data, "image/jpeg"

    return _encode(_flatten(_upright(image)))


def split_pages(data):
    """
    [(bytes, mime)] — one entry per page/frame of a multi-page TIFF (or
    similar). Single images give one entry. Raises ValueError when the
    file isn't an image at all.
    """

    try:
        image = _open(data)
    except Exception as error:
        raise ValueError(
            "This file isn't a supported image. Upload a PDF or an image "
            "(JPG, PNG, HEIC, WEBP, AVIF, BMP, TIFF, GIF)."
        ) from error

    frames = getattr(image, "n_frames", 1) or 1

    # Only TIFF holds real multi-page documents; GIF/WEBP frames are animation.
    if frames <= 1 or image.format != "TIFF":
        return [normalize_image(data, _mime(image))]

    pages = []

    for index in range(min(frames, MAX_FRAMES)):
        image.seek(index)
        pages.append(_encode(_flatten(_upright(image.copy()))))

    return pages


def _mime(image):
    return {"JPEG": "image/jpeg", "PNG": "image/png"}.get(image.format, "application/octet-stream")
