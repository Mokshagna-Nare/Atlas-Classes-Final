"""
Figures for "Extract existing questions" with the built-in reader (no AI).

The page image is read by OCR, which gives every piece of text with its
box. A figure is what is left when the text is taken away: a sizeable block
of drawing (lines, outlines, shading) that isn't text. Its part labels
("A", "B", "C", "D" with leader lines) are kept inside the figure and taken
out of the question text. Each figure is cropped from the page and attached
to the question printed above it (in the same column).

Everything here is best-effort: any failure means "no figure", never a
failed page.
"""

import io
import re

import numpy as np

# Text that can be a figure's part label: "A", "B", "-C", "(D)", "1", "P".
_LABEL_RE = re.compile(r"^\W*[A-Za-z0-9]{1,2}\W*$")
_NUMBER_PREFIX_RE = re.compile(r"^\s*(?:Q\.?\s*)?\(?\d{1,3}\s*[.)]\s*")


def _is_label(text):
    return bool(_LABEL_RE.match(text or ""))


def _norm(text):
    return re.sub(r"[^a-z0-9]", "", (text or "").lower())


def _components(grid):
    """Connected groups of True cells (8-neighbour) -> list of (r0, c0, r1, c1, cells)."""

    rows, cols = grid.shape
    seen = np.zeros_like(grid, dtype=bool)
    found = []

    for start_r, start_c in zip(*np.nonzero(grid)):
        if seen[start_r, start_c]:
            continue

        stack = [(start_r, start_c)]
        seen[start_r, start_c] = True
        r0 = r1 = start_r
        c0 = c1 = start_c
        cells = 0

        while stack:
            r, c = stack.pop()
            cells += 1
            r0, r1, c0, c1 = min(r0, r), max(r1, r), min(c0, c), max(c1, c)

            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    nr, nc = r + dr, c + dc

                    if 0 <= nr < rows and 0 <= nc < cols and grid[nr, nc] and not seen[nr, nc]:
                        seen[nr, nc] = True
                        stack.append((nr, nc))

        found.append((r0, c0, r1 + 1, c1 + 1, cells))

    return found


def _dilate(grid, steps):
    out = grid.copy()

    for _ in range(steps):
        grown = out.copy()
        grown[1:, :] |= out[:-1, :]
        grown[:-1, :] |= out[1:, :]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out = grown

    return out


def find(image, items, page_width=None):
    """
    image: the page as a PIL image; items: OCR boxes (x0, y0, x1, y1, text,
    score) in a page that is page_width wide (default: the image's width).

    Returns (figures, kept_items, scaled_items):
    - figures: [{"box": (x0, y0, x1, y1) in image pixels}, ...]
    - kept_items: items with the figures' part labels removed (same
      coordinates as given), for reading the text;
    - scaled_items: all items in image pixels (for placing questions).
    """

    width, height = image.size
    scale = width / float(page_width or width)
    boxes = []

    for item in items:
        x0, y0, x1, y1 = (float(v) * scale for v in item[:4])
        boxes.append((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1), str(item[4] or "")))

    grey = np.asarray(image.convert("L"), dtype=np.uint8)
    paper = float(np.percentile(grey, 90))
    # Dark strokes only: light watermarks and paper texture don't count.
    ink = grey < min(paper - 60.0, 170.0)

    for x0, y0, x1, y1, _ in boxes:
        ink[max(0, int(y0) - 2):int(y1) + 3, max(0, int(x0) - 2):int(x1) + 3] = False

    cell = max(4, int(round(min(width, height) / 160.0)))
    rows, cols = height // cell, width // cell

    if rows < 4 or cols < 4:
        return [], list(items), boxes

    grid = ink[: rows * cell, : cols * cell].reshape(rows, cell, cols, cell).sum(axis=(1, 3)) >= max(2, cell // 2)
    groups = _components(_dilate(grid, 2))
    long_text = [b for b in boxes if not _is_label(b[4])]
    labels = [b for b in boxes if _is_label(b[4])]
    figures = []

    for r0, c0, r1, c1, _cells in groups:
        x0, y0, x1, y1 = c0 * cell, r0 * cell, c1 * cell, r1 * cell
        w, h = x1 - x0, y1 - y0

        if w < max(40, 0.08 * width) or h < max(40, 0.04 * height):
            continue  # specks, underlines, rules

        if max(w / h, h / w) > 8:
            continue  # a long line or a page border

        if w * h > 0.75 * width * height:
            continue  # the whole page (photo background): not a figure

        strokes = int(grid[r0:r1, c0:c1].sum())

        if strokes < 0.04 * (r1 - r0) * (c1 - c0):
            continue  # an empty frame / scattered marks

        # A table (grid lines around text) is text, not a figure.
        texty = sum(
            max(0.0, min(x1, b[2]) - max(x0, b[0])) * max(0.0, min(y1, b[3]) - max(y0, b[1]))
            for b in long_text
        )

        if texty > 0.15 * w * h:
            continue

        figures.append([float(x0), float(y0), float(x1), float(y1)])

    # Part labels next to the drawing (at the end of its leader lines).
    used_labels = set()

    for figure in figures:
        x0, y0, x1, y1 = figure
        reach = 0.08 * width

        for index, (lx0, ly0, lx1, ly1, _) in enumerate(labels):
            cy = (ly0 + ly1) / 2
            beside = lx1 >= x0 - reach and lx0 <= x1 + reach
            level = y0 - 0.25 * (ly1 - ly0) <= cy <= y1 + 0.25 * (ly1 - ly0)

            if beside and level:
                used_labels.add(index)
                figure[0], figure[1] = min(figure[0], lx0), min(figure[1], ly0)
                figure[2], figure[3] = max(figure[2], lx1), max(figure[3], ly1)

    label_boxes = [labels[i] for i in used_labels]
    kept = []

    for item, box in zip(items, boxes):
        inside = any(box is label for label in label_boxes) or any(
            box[0] >= f[0] - 2 and box[2] <= f[2] + 2 and box[1] >= f[1] - 2 and box[3] <= f[3] + 2 for f in figures
        )

        if not inside:
            kept.append(item)

    return [{"box": tuple(f)} for f in figures], kept, boxes


def _question_starts(questions, boxes):
    """Where each question starts on the page: (x0, y0) or None."""

    starts = []
    used = set()
    ordered = sorted(range(len(boxes)), key=lambda i: (round(boxes[i][1] / 8), boxes[i][0]))

    for question in questions:
        wanted = _norm(question.get("question"))[:24]
        found = None

        if len(wanted) >= 6:
            for index in ordered:
                if index in used:
                    continue

                text = _norm(_NUMBER_PREFIX_RE.sub("", boxes[index][4]))[:24]

                if len(text) >= 6 and (wanted.startswith(text[:14]) or text.startswith(wanted[:14])):
                    found = index
                    break

        if found is not None:
            used.add(found)
            starts.append((boxes[found][0], boxes[found][1]))
        else:
            starts.append(None)

    return starts


def _crop(image, box):
    from PIL import Image

    width, height = image.size
    pad = max(6, int(0.01 * width))
    x0, y0 = max(0, int(box[0]) - pad), max(0, int(box[1]) - pad)
    x1, y1 = min(width, int(box[2]) + pad), min(height, int(box[3]) + pad)
    crop = image.convert("RGB").crop((x0, y0, x1, y1))

    if max(crop.size) > 1400:
        crop.thumbnail((1400, 1400), Image.LANCZOS)

    buffer = io.BytesIO()
    crop.save(buffer, "PNG", optimize=True)
    data = buffer.getvalue()

    # Printed at about the size it had on the page (text width ~ 6.5 in).
    width_pt = min(360.0, max(120.0, (x1 - x0) / float(width) * 468.0))
    height_pt = width_pt * (y1 - y0) / float(max(1, x1 - x0))

    if height_pt > 360.0:
        width_pt, height_pt = width_pt * 360.0 / height_pt, 360.0

    return {
        "image": data,
        "mime": "image/png",
        "width_pt": round(width_pt, 1),
        "height_pt": round(height_pt, 1),
        "size_kb": round(len(data) / 1024.0, 1),
    }


def attach(questions, image, figures, boxes):
    """Give each figure to the question above it (same column)."""

    if not figures or not questions:
        return 0

    width, height = image.size
    starts = _question_starts(questions, boxes)
    chosen = {}

    for figure in figures:
        x0, y0, x1, y1 = figure["box"]
        centre = (x0 + x1) / 2
        best = None

        for index, start in enumerate(starts):
            if start is None:
                continue

            sx, sy = start
            same_column = sx <= centre and sx >= x0 - 0.5 * width

            if same_column and sy <= y0 + 0.02 * height and (best is None or sy > starts[best][1]):
                best = index

        if best is None and len(questions) == 1:
            best = 0

        if best is not None:
            chosen.setdefault(best, []).append(figure["box"])

    for index, found in chosen.items():
        box = (
            min(b[0] for b in found),
            min(b[1] for b in found),
            max(b[2] for b in found),
            max(b[3] for b in found),
        )
        questions[index]["figure"] = _crop(image, box)

    return len(chosen)
