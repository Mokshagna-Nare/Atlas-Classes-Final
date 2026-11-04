"""
Layout and parsing improvements for the built-in OCR ("Extract existing
questions" without AI).

core/qpg_core.py is copied from the Streamlit app and must not be edited by
hand, so these are installed over it at start-up with install(core). They
make the OCR handle screenshots and phone photos of a single question as well
as printed papers:

- A text line that crosses the middle of the image is no longer dropped when
  the rest of the page looks like two columns (the question sentence of a
  screenshot with a side panel used to vanish this way).
- Option letters detected as separate little boxes ("A" next to "0.25 mol")
  are joined to their option text.
- Options laid out as a grid (A | B on one row, C | D on the next) are read
  row by row, and option letters the OCR missed (e.g. on a highlighted box)
  are filled in from the grid.
- A question with no number ("At STP, what is ...?" followed by A-D) is
  picked up, ignoring app chrome around it (QUESTION, CHEMISTRY, codes,
  breadcrumbs, timers, buttons).
- "0.5 mol" is no longer mistaken for question number 0 (or "2.5 kg" for
  option 2).
- When exactly one option sits on a clearly green highlight (how most apps
  mark the correct answer), it is proposed as the answer key. The lecturer
  still confirms every answer in the review step.

Every change keeps the old reading as a fallback: the new reading is used
only when it finds more complete questions.
"""

import io
import re
import threading

import numpy as np

_state = threading.local()

# A box holding just an option letter: "A", "(B)", "c)", "D.".
_LABEL_ONLY_RE = re.compile(r"^\s*[\(\[]?\s*([A-Da-d])\s*[\)\].:]?\s*$")
# A cell that starts with an option letter: "(A) x", "A) x", "a. x".
_CELL_LABEL_RE = re.compile(r"^\s*(?:[\(\[]\s*([A-Da-d])\s*[\)\]]|([A-Da-d])\s*[.)])\s*(.*)$")
# Line starting with a letter-labelled option, for the question reader.
_LETTER_OPTION_RE = re.compile(r"^\s*(?:\(\s*([A-Da-d])\s*\)|([A-Da-d])\s*[.)])\s*\S")

_CELL_GAP = "   "  # separates far-apart boxes on one line


def _height(item):
    return max(1.0, item[3] - item[1])


def _centre(item):
    return (item[1] + item[3]) / 2


def _letter_index(letter):
    return ord(letter.lower()) - ord("a") + 1


def _letter(index, upper):
    letter = chr(ord("a") + index - 1)
    return letter.upper() if upper else letter


# ---------------------------------------------------------------------------
# Geometry: OCR boxes -> lines
# ---------------------------------------------------------------------------
def _merge_option_labels(items, width):
    """Joins a lone option-letter box to the text box just to its right."""

    labels, others = [], []

    for item in items:
        (labels if _LABEL_ONLY_RE.match(item[4]) else others).append(item)

    if not labels:
        return list(items)

    taken = {}
    leftover = []

    for label in labels:
        letter = _LABEL_ONLY_RE.match(label[4]).group(1)
        size = _height(label)
        best = None

        for index, item in enumerate(others):
            if index in taken:
                continue

            gap = item[0] - label[2]

            if gap < -0.5 * size or gap > max(5 * size, 0.08 * width):
                continue

            if abs(_centre(item) - _centre(label)) > max(_height(item), size):
                continue

            if best is None or gap < best[0]:
                best = (gap, index)

        if best is None:
            leftover.append(label)
        else:
            taken[best[1]] = (label, letter)

    merged = []

    for index, item in enumerate(others):
        if index in taken:
            label, letter = taken[index]
            merged.append(
                (
                    min(label[0], item[0]),
                    min(label[1], item[1]),
                    max(label[2], item[2]),
                    max(label[3], item[3]),
                    f"({letter}) {item[4].strip()}",
                    min(label[5], item[5]),
                )
            )
        else:
            merged.append(item)

    return merged + leftover


def _group_rows(items):
    rows = []

    for item in sorted(items, key=_centre):
        for row in rows:
            if abs(row["centre"] - _centre(item)) < 0.6 * min(_height(item), row["height"]):
                row["items"].append(item)
                break
        else:
            rows.append({"centre": _centre(item), "height": _height(item), "items": [item]})

    rows.sort(key=lambda row: row["centre"])
    return [sorted(row["items"], key=lambda item: item[0]) for row in rows]


def _reading_rows(items, width, columns=True):
    """
    Rows in reading order. The page is cut into bands at lines that cross
    the middle; a band is read column by column only when both halves of it
    hold several lines (a two-column paper), otherwise row by row.
    """

    middle, margin = width / 2, width * 0.02
    spanning = [item for item in items if item[0] <= middle - margin and item[2] >= middle + margin]
    rest = [item for item in items if item not in spanning]

    # Boxes on the same line as a spanning box belong to that line.
    span_rows = _group_rows(spanning)
    lone = []

    for item in rest:
        for row in span_rows:
            centre = sum(_centre(part) for part in row) / len(row)
            size = min(_height(part) for part in row)

            if abs(centre - _centre(item)) < 0.6 * min(size, _height(item)):
                row.append(item)
                break
        else:
            lone.append(item)

    span_rows = [sorted(row, key=lambda item: item[0]) for row in span_rows]
    span_rows.sort(key=lambda row: sum(_centre(part) for part in row) / len(row))
    cuts = [sum(_centre(part) for part in row) / len(row) for row in span_rows]

    def band_rows(band):
        left = [item for item in band if item[2] < middle + margin]
        right = [item for item in band if item[0] > middle - margin and item not in left]

        if columns and len(left) >= 4 and len(right) >= 4:
            return _group_rows(left) + _group_rows(right)

        return _group_rows(band)

    rows = []
    bounds = [-float("inf")] + cuts + [float("inf")]

    for position in range(len(bounds) - 1):
        band = [item for item in lone if bounds[position] <= _centre(item) < bounds[position + 1]]
        rows.extend(band_rows(band))

        if position < len(span_rows):
            rows.append(span_rows[position])

    return rows


def _cells(row, width):
    """Splits a row into cells at wide gaps; returns [(box, text)]."""

    gap_limit = max(2.5 * float(np.median([_height(item) for item in row])), 0.05 * width)
    cells = []

    for item in row:
        if cells and item[0] - cells[-1][0][2] <= gap_limit:
            box, text = cells[-1]
            cells[-1] = (
                (min(box[0], item[0]), min(box[1], item[1]), max(box[2], item[2]), max(box[3], item[3])),
                f"{text} {item[4].strip()}",
            )
        else:
            cells.append((tuple(item[:4]), item[4].strip()))

    return cells


def _green_score(colour, box):
    """How much greener than grey the area around a box is (0 = grey)."""

    x0, y0, x1, y1 = box
    pad = 0.6 * (y1 - y0)
    height, width = colour.shape[:2]
    region = colour[
        max(0, int(y0 - pad)) : min(height, int(y1 + pad)),
        max(0, int(x0 - pad)) : min(width, int(x1 + pad)),
    ]

    if region.size == 0:
        return 0.0

    pixels = region.reshape(-1, 3).astype(np.float32)
    # Median, so the text inside the box doesn't dilute its background.
    return float(np.median(pixels[:, 1] - np.maximum(pixels[:, 0], pixels[:, 2])))


def _highlighted_option(options):
    """The one option on a clearly green background, or None."""

    colour = getattr(_state, "colour", None)

    if colour is None or len(options) < 2:
        return None

    scores = sorted(((_green_score(colour, box), letter) for letter, box in options), reverse=True)
    best, runner_up = scores[0][0], scores[1][0]

    if best >= 15 and best - runner_up >= 12:
        return scores[0][1]

    return None


def _is_short_answer(text):
    words = text.split()
    return 0 < len(words) <= 6 and not text.rstrip().endswith(("?", ":")) and not _CELL_LABEL_RE.match(text)


def _unlabelled_grids(all_cells, width):
    """
    Rows that start a 2x2 grid of short answers with no visible letters
    (the OCR missed them): exactly two such rows in a row, columns lined up,
    after a line of question text. Longer runs are tables, not options.
    """

    def two_short(cells):
        return len(cells) == 2 and all(_is_short_answer(text) for _, text in cells)

    starts = set()

    for position in range(1, len(all_cells) - 1):
        first, second = all_cells[position], all_cells[position + 1]

        if not (two_short(first) and two_short(second)):
            continue

        if two_short(all_cells[position - 1]) or (position + 2 < len(all_cells) and two_short(all_cells[position + 2])):
            continue

        if any(abs(a[0][0] - b[0][0]) > 0.06 * width for a, b in zip(first, second)):
            continue

        before = " ".join(text for cells in all_cells[:position] for _, text in cells)

        if len(before.split()) >= 4:
            starts.add(position)

    return starts



def _rows_to_lines(rows, width):
    """
    Text lines from rows. Grid option rows ("(A) x   y" / "(C) z   w") are
    written one option per line with missing letters filled in, and a green
    highlighted option becomes an "Ans:" line after the options.
    """

    lines = []
    run = []  # options of the current block: (letter, box)
    previous = None  # last option row: {"xs": [...], "next": n, "upper": bool}

    def close_run():
        nonlocal run, previous

        answer = _highlighted_option(run)

        if answer:
            lines.append(f"Ans: {answer}")

        run, previous = [], None

    all_cells = [_cells(row, width) for row in rows]
    grid_start = _unlabelled_grids(all_cells, width)

    for position, row in enumerate(rows):
        cells = all_cells[position]
        found = [_CELL_LABEL_RE.match(text) for _, text in cells]
        assigned = None

        if position in grid_start:
            assigned = ([1, 2], True)
        elif position - 1 in grid_start:
            assigned = ([3, 4], True)
        elif found[0] and len(cells) <= 4:
            first = found[0].group(1) or found[0].group(2)
            start = _letter_index(first)
            indexes = [start + i for i in range(len(cells))]
            explicit = [(_letter_index(m.group(1) or m.group(2)) if m else None) for m in found]

            if all(e is None or e == i for e, i in zip(explicit, indexes)) and indexes[-1] <= 4:
                assigned = (indexes, first.isupper())
        elif previous and not any(found) and len(cells) <= 4:
            xs = previous["xs"]
            aligned = all(min(abs(box[0] - x) for x in xs) <= 0.06 * width for box, _ in cells)
            indexes = [previous["next"] + i for i in range(len(cells))]

            if aligned and indexes[-1] <= 4:
                assigned = (indexes, previous["upper"])

        if assigned is None:
            if run:
                close_run()
            lines.append(_CELL_GAP.join(text for _, text in cells))
            continue

        indexes, upper = assigned

        if indexes[0] == 1 and run:
            close_run()

        for (box, text), index, match in zip(cells, indexes, found):
            body = match.group(3) if match else text
            letter = _letter(index, upper)
            lines.append(f"({letter}) {body.strip()}")
            run.append((letter, box))

        previous = {"xs": [box[0] for box, _ in cells], "next": indexes[-1] + 1, "upper": upper}

    if run:
        close_run()

    return lines


# ---------------------------------------------------------------------------
# Question reader: unnumbered questions
# ---------------------------------------------------------------------------
_CHROME_WORDS = {
    "next", "previous", "prev", "submit", "skip", "back", "save", "save & next", "save and next",
    "clear", "clear response", "mark for review", "review", "bookmark", "report", "hint",
    "show answer", "check answer", "solution", "question", "questions", "metadata", "options",
}
_PROGRESS_RE = re.compile(r"^\s*(?:q(?:uestion)?\.?)\s*\d+\s*(?:of|/)\s*\d+\s*$", re.IGNORECASE)
_STATUS_RE = re.compile(r"^\s*(?:time(?:r| left)?|marks?|score|section|attempt(?:ed)?)\b", re.IGNORECASE)
_TIMER_RE = re.compile(r"^\s*\d{1,2}:\d{2}(?::\d{2})?\s*$")
_CODE_RE = re.compile(r"^(?=.*\d)(?=.*[A-Z])[A-Z0-9_\-/]{5,}$")


def _is_chrome(cell):
    text = re.sub(r"\s+", " ", cell).strip()
    words = text.split()

    if not text:
        return True

    if text.lower() in _CHROME_WORDS or _PROGRESS_RE.match(text) or _TIMER_RE.match(text):
        return True

    if _STATUS_RE.match(text) and len(words) <= 4:
        return True

    if "•" in text or text.count("·") >= 2:
        return True

    if len(words) <= 4 and re.search(r"\b(?:easy|medium|hard|difficult)\b", text, re.IGNORECASE) and re.search(r"[·\-|/]", text):
        return True  # tags like G10-Medium-Analytical

    if len(words) <= 3 and re.fullmatch(r"[A-Z][A-Z &/\-]*", text):
        return True  # section labels like QUESTION, CHEMISTRY

    if len(words) == 1 and _CODE_RE.match(text):
        return True  # question codes like 2026CHE02

    if " > " in text and "=" not in text and not text.rstrip().endswith(("?", ":")):
        return True  # breadcrumbs: Mole Concept > Gas Moles

    return False


def _question_text(lines):
    cells = [cell for line in lines for cell in re.split(r"\s{3,}", line)]
    kept = [cell.strip() for cell in cells if not _is_chrome(cell)]
    return re.sub(r"\s+", " ", " ".join(kept)).strip()


_NAV_BUTTONS = {
    "next", "previous", "prev", "submit", "skip", "back", "save & next", "save and next",
    "clear response", "mark for review", "mark for review & next", "finish", "end test",
}


def _drop_chrome_lines(text):
    """Removes quiz-app progress ("Question 3 of 20"), timers and nav buttons."""

    kept = []

    for line in str(text or "").splitlines():
        cells = [cell for cell in re.split(r"\s{3,}", line) if cell.strip()]
        useful = [
            cell
            for cell in cells
            if not (
                _PROGRESS_RE.match(cell)
                or _TIMER_RE.match(cell)
                or re.sub(r"\s+", " ", cell).strip().lower() in _NAV_BUTTONS
            )
        ]

        if cells and not useful:
            continue

        kept.append(_CELL_GAP.join(useful) if len(useful) != len(cells) else line)

    return "\n".join(kept)


def _add_unnumbered_questions(core, text):
    """
    When options (A)... appear before any question number, the page holds
    unnumbered questions (typical for a screenshot of one question). Each
    block of text before an (A) option then becomes "Qn: <question>".
    Pages that start with a numbered question are left untouched.
    """

    text = _drop_chrome_lines(text)
    lines = text.splitlines()

    def is_question_start(line):
        return bool(core._PREFIXED_QUESTION_RE.match(line) or core._NUMBERED_LINE_RE.match(line))

    def option_index(line):
        match = _LETTER_OPTION_RE.match(line)

        if match:
            return _letter_index(match.group(1) or match.group(2))

        inline = core._split_inline_options(line)

        if inline and inline[0][0].isalpha():
            return _letter_index(inline[0][0])

        return None

    for line in lines:
        clean = re.sub(r"\s+", " ", line).strip()

        if not clean or _PROGRESS_RE.match(clean):
            continue

        if option_index(clean) == 1:
            break

        if is_question_start(clean):
            return text
    else:
        return text  # no lettered options at all

    out, pending = [], []
    question_open = False
    count = 0

    for line in lines:
        clean = re.sub(r"\s+", " ", line).strip()

        if not clean:
            continue

        if _PROGRESS_RE.match(clean):
            continue

        index = option_index(clean)

        if index == 1 and not question_open:
            count += 1
            out.append(f"Q{count}: {_question_text(pending)}")
            out.append(line)
            pending = []
            continue

        if index is not None:
            question_open = False
            out.extend(pending)
            out.append(line)
            pending = []
            continue

        if (
            is_question_start(clean)
            or core._ANSWER_LINE_RE.match(clean)
            or core._SOLUTION_LINE_RE.match(clean)
        ):
            if is_question_start(clean):
                count += 1
                question_open = True

            out.extend(pending)
            out.append(line)
            pending = []
            continue

        if question_open:
            out.append(line)
        else:
            pending.append(line)

    out.extend(pending)
    return "\n".join(out)


def _score(questions):
    """Complete questions (text + options) count; fragments barely do."""

    total = 0.0

    for question in questions:
        options = len(question.get("options") or [])
        words = len(str(question.get("question") or "").split())

        if options >= 2 and words:
            total += 4 + min(options, 4) / 2 + min(words, 12) / 4
        else:
            total += 0.25

    return total


def _text_geometry(engine, image):
    """
    (tilt in degrees, share of sideways boxes) from a detection-only pass:
    the median slope of long text boxes, and how many boxes stand upright
    (text running vertically = the picture is turned 90 degrees).
    """

    # RapidOCR keeps per-call switches for later calls, so put them back.
    saved = {name: getattr(engine, name) for name in ("use_cls", "use_rec") if hasattr(engine, name)}

    try:
        output = engine(np.asarray(image.convert("RGB")), use_cls=False, use_rec=False)
    finally:
        for name, value in saved.items():
            setattr(engine, name, value)

    boxes = getattr(output, "boxes", None)
    angles, upright, flat = [], 0, 0

    for box in boxes if boxes is not None else []:
        (x0, y0), (x1, y1), (x2, y2) = box[0], box[1], box[2]
        length = float(np.hypot(x1 - x0, y1 - y0))
        thickness = float(np.hypot(x2 - x1, y2 - y1))

        if length > 3 * max(thickness, 1.0):
            angles.append(float(np.degrees(np.arctan2(y1 - y0, x1 - x0))))

        if length > 2 * thickness:
            if abs(x1 - x0) >= abs(y1 - y0):
                flat += 1
            else:
                upright += 1
        elif thickness > 2 * length:
            if abs(y2 - y1) >= abs(x2 - x1):
                upright += 1
            else:
                flat += 1

    tilt = float(np.median(angles)) if len(angles) >= 3 else 0.0
    sideways = upright / (upright + flat) if upright + flat >= 3 else 0.0
    return tilt, sideways


def _png(image):
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


def _rotate(image, angle):
    from PIL import Image

    if angle in (90, 180, 270):
        return image.transpose({90: Image.ROTATE_90, 180: Image.ROTATE_180, 270: Image.ROTATE_270}[angle])

    array = np.asarray(image)
    border = np.concatenate([array[0], array[-1], array[:, 0], array[:, -1]])
    fill = tuple(int(v) for v in np.median(border, axis=0))
    return image.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=fill)


def _colour_of(image, has_colour):
    if not has_colour:
        return None

    array = np.asarray(image)

    if array.size and np.abs(array[..., 1].astype(np.int16) - array[..., 0]).max() > 8:
        return array

    return None


def _prepare(core, image_bytes):
    """
    (upright RGB image, has colour, share of sideways text). A photo tilted
    by more than about a degree is rotated level, so lines and option rows
    line up.
    """

    from PIL import Image

    prepared, _ = core.prepare_image_for_vision(image_bytes)
    image = Image.open(io.BytesIO(prepared))
    has_colour = image.mode not in ("L", "1", "LA")
    image = image.convert("RGB")
    engine = core.get_ocr_engine()
    sideways = 0.0

    if engine is not None:
        tilt, sideways = _text_geometry(engine, image)

        if sideways < 0.5 and 0.7 <= abs(tilt) <= 20:
            image = _rotate(image, tilt)

    return image, has_colour, sideways


def _even_lighting(image):
    """
    Greyscale copy with shadows and uneven lighting removed and contrast
    stretched: each pixel is divided by the local paper brightness.
    """

    from PIL import Image, ImageFilter, ImageOps

    grey = image.convert("L")

    if np.asarray(grey).mean() < 128:
        grey = ImageOps.invert(grey)

    small = grey.resize((max(1, grey.width // 4), max(1, grey.height // 4)))
    size = max(3, (min(small.size) // 20) | 1)
    paper = small.filter(ImageFilter.MaxFilter(min(size, 15))).filter(ImageFilter.GaussianBlur(size))
    paper = np.asarray(paper.resize(grey.size)).astype(np.float32)
    flat = np.asarray(grey).astype(np.float32) / np.maximum(paper, 1.0) * 255.0
    flat = Image.fromarray(np.clip(flat, 0, 255).astype("uint8"), "L")
    return ImageOps.autocontrast(flat, cutoff=1).convert("RGB")


# ---------------------------------------------------------------------------
# Text clean-up before the question reader: more labelling styles
# ---------------------------------------------------------------------------
_CIRCLED = {chr(0x24B6 + i): "ABCD"[i] for i in range(4)}
_CIRCLED.update({chr(0x24D0 + i): "abcd"[i] for i in range(4)})
_LABEL_STYLES = [
    re.compile(r"^\s*\[\s*([A-Da-d])\s*\]\s*(.+)$"),  # [A] x
    re.compile(r"^\s*([A-Da-d])\s*\]\s*(.+)$"),  # A] x
    re.compile(r"^\s*([A-Da-d])\s*[:\-–—]\s*(.+)$"),  # A: x / A - x
    re.compile(r"^\s*([A-Da-d])\s+(\S.*)$"),  # A x (only in a full A, B, C run)
    re.compile(r"^\s*(?:option|opt\.?)\s*([A-Da-d1-4])\s*[:.)\-]?\s*(.+)$", re.IGNORECASE),  # Option A: x
]
_INLINE_MARKER_RE = re.compile(r"(?:^|(?<=\s))(?:\(\s*([A-Da-d])\s*\)|\[\s*([A-Da-d])\s*\]|([A-Da-d])\s*[.):\]])\s*(?=\S)")
_ANSWER_PHRASE_RE = re.compile(
    r"^\s*(?:the\s+)?(?:(?:correct|right)\s+(?:answer|option|choice)|answer|ans\.?)\s*(?:is|=)\s*[:\-]?\s*"
    r"(?:option\s*)?\(?\s*([A-Da-d1-4])\s*\)?(?=\W|$)",
    re.IGNORECASE,
)
_TICK_RE = re.compile(r"\s*[✓✔☑✅]\s*$")
_KEY_LINE_RE = re.compile(r"^\s*(answer\s*key|key\s*answers?|answers)\s*[:\-]\s*(.+)$", re.IGNORECASE)
_PROBLEM_RE = re.compile(r"^\s*(?:problem|prob\.|exercise|ex\.)\s*(\d{1,3})\s*[:.)\-]?\s*(.*)$", re.IGNORECASE)


def _label_runs(lines):
    """Lines (by index) that belong to an A, B, C(, D) run in one label style -> '(X) body'."""

    converted = {}

    for style in _LABEL_STYLES:
        hits = []

        for index, line in enumerate(lines):
            if index in converted:
                continue

            match = style.match(line)

            if match and not match.group(1).isdigit():
                hits.append((index, match.group(1), match.group(2)))
            elif match:
                hits.append((index, "abcd"[int(match.group(1)) - 1], match.group(2)))

        position = 0

        while position < len(hits):
            index, letter, _ = hits[position]

            if _letter_index(letter) != 1:
                position += 1
                continue

            run = [hits[position]]

            for later in hits[position + 1:]:
                if later[0] - run[-1][0] > 3 or _letter_index(later[1]) != len(run) + 1:
                    break
                run.append(later)
                if len(run) == 4:
                    break

            if len(run) >= 3 and (style is not _LABEL_STYLES[3] or len(run) == 4):
                upper = run[0][1].isupper() or run[0][1].isdigit()

                for line_index, item_letter, body in run:
                    converted[line_index] = f"({_letter(_letter_index(item_letter), upper)}) {body.strip()}"

                position += len(run)
            else:
                position += 1

    return converted


def _split_inline(line):
    """'What is x? A. 1 B. 2 C. 3 D. 4' -> ['What is x?', '(A) 1', '(B) 2', ...] or None."""

    markers = list(_INLINE_MARKER_RE.finditer(line))

    for start in range(len(markers)):
        letters = [(m.group(1) or m.group(2) or m.group(3)) for m in markers[start:]]

        if _letter_index(letters[0]) != 1:
            continue

        run = 1

        while run < len(letters) and _letter_index(letters[run]) == run + 1 and run < 4:
            run += 1

        if run < 3:
            continue

        chosen = markers[start : start + run]
        head = line[: chosen[0].start()].strip()
        parts = [head] if head else []

        for position, marker in enumerate(chosen):
            end = chosen[position + 1].start() if position + 1 < len(chosen) else len(line)
            body = line[marker.end() : end].strip()

            if not body:
                return None

            letter = marker.group(1) or marker.group(2) or marker.group(3)
            parts.append(f"({letter}) {body}")

        return parts

    return None


def _normalise_text(text):
    lines = []

    for line in str(text or "").splitlines():
        for circled, letter in _CIRCLED.items():
            line = re.sub(rf"^\s*{circled}\s*", f"({letter}) ", line)

        problem = _PROBLEM_RE.match(line)

        if problem:
            line = f"Q{problem.group(1)}: {problem.group(2)}"

        answer = _ANSWER_PHRASE_RE.match(line)

        if answer:
            line = f"Ans: {answer.group(1)}"

        key_line = _KEY_LINE_RE.match(line)

        # "Answer Key: 1. (c) 2. (b)" on one line -> header + pairs
        if key_line and len(re.findall(r"\d{1,3}\s*[.):\-]?\s*\(?\s*[A-Da-d1-4]\s*\)?(?=\s|,|;|$)", key_line.group(2))) >= 2:
            lines.extend(["Answer Key", key_line.group(2)])
            continue

        lines.append(line)

    converted = _label_runs(lines)
    lines = [converted.get(index, line) for index, line in enumerate(lines)]
    out = []

    for line in lines:
        parts = None if re.match(r"^\s*\(\s*[A-Da-d]\s*\)", line) and len(_INLINE_MARKER_RE.findall(line)) < 3 else _split_inline(line)
        parts = parts or [line]

        for part in parts:
            tick = _TICK_RE.search(part)
            label = re.match(r"^\s*\(\s*([A-Da-d])\s*\)", part)

            if tick and label:
                out.append(part[: tick.start()])
                out.append(f"Ans: {label.group(1)}")
            else:
                out.append(part)

    return "\n".join(out)


def has_complete_question(questions):
    return any(len(question.get("options") or []) >= 2 and question.get("question") for question in questions)


def score(questions):
    return _score(questions)


def page_orientations(core, image_bytes):
    """
    Upright candidates for a whole page, most likely first, for readers that
    cut the page into strips: a sideways page is turned both ways, an
    upright one is also tried upside down.
    """

    from PIL import Image

    prepared, _ = core.prepare_image_for_vision(image_bytes)
    image = Image.open(io.BytesIO(prepared)).convert("RGB")
    engine = core.get_ocr_engine()
    sideways = _text_geometry(engine, image)[1] if engine is not None else 0.0

    if sideways >= 0.5:
        return [_png(_rotate(image, 270)), _png(_rotate(image, 90))]

    return [prepared, _png(_rotate(image, 180))]


class single_pass:
    """
    Within this block, OCR reads each image once (no retries turned around
    or re-lit). Used for the strips of a tall page, which are only parts of
    a page and can't be judged on their own.
    """

    def __enter__(self):
        _state.single_pass = True

    def __exit__(self, *exc):
        _state.single_pass = False


# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------
def install(core):
    import image_input

    # "0.5 mol" is not question 0, "2.5 kg" is not option 2.
    core._NUMBERED_LINE_RE = re.compile(r"^\s*\(?\s*(\d{1,3})\s*[.)](?!\d)\s*(.*)$")
    core._OPTION_LINE_RE = re.compile(
        r"^\s*(?:\(\s*([a-dA-D1-4])\s*\)|([a-dA-D])\s*[.)]|([1-4])\s*[.)](?!\d))\s*(.*)$"
    )

    original_parse = core.parse_questions_from_text
    original_lines = core._items_to_lines
    original_ocr = core.ocr_image_to_text
    original_prepare = core.prepare_image_for_vision

    def prepare_image_for_vision(data, mime="image/png"):
        # HEIC/WEBP/AVIF/BMP/TIFF/GIF..., upright per the camera's EXIF flag.
        data, mime = image_input.normalize_image(data, mime)
        return original_prepare(data, mime)

    def parse_questions_from_text(text):
        return original_parse(_add_unnumbered_questions(core, _normalise_text(text)))

    def items_to_lines(items, page_width):
        merged = _merge_option_labels(items, page_width)
        keys = lambda read: sum(1 for question in read if question.get("key"))

        # The original reading first: a new one must find more to replace it.
        candidates = [
            original_lines(merged, page_width),
            _rows_to_lines(_reading_rows(merged, page_width), page_width),
            _rows_to_lines(_reading_rows(merged, page_width, columns=False), page_width),  # option grids
        ]
        best, best_rank = None, None

        for lines in candidates:
            read_back = parse_questions_from_text("\n".join(lines))
            rank = (round(_score(read_back), 3), keys(read_back))

            if best is None or rank > best_rank:
                best, best_rank = lines, rank

        return best

    def read(image, has_colour):
        _state.colour = _colour_of(image, has_colour)

        try:
            text, error = original_ocr(_png(image))
        finally:
            _state.colour = None

        read_back = parse_questions_from_text(text) if not error else []
        return text, error, _score(read_back) + min(len(text.split()), 60) / 60, read_back

    def complete(questions):
        return any(len(question.get("options") or []) >= 2 and question.get("question") for question in questions)

    def ocr_image_to_text(image_bytes):
        """
        Upright, level image first. If that finds no complete question, try
        again with the lighting evened out, and turned around when the text
        looks sideways or upside down; keep the best reading.
        """

        try:
            image, has_colour, sideways = _prepare(core, image_bytes)
        except Exception:
            return original_ocr(image_bytes)

        text, error, score, questions = read(image, has_colour)

        if error or complete(questions) or getattr(_state, "single_pass", False):
            return text, error

        best = (score, text)
        attempts = []

        if sideways >= 0.5:
            attempts += [(_rotate(image, 270), has_colour), (_rotate(image, 90), has_colour)]
        else:
            attempts.append((_rotate(image, 180), has_colour))
            attempts.append((_even_lighting(image), False))

        for candidate, colour in attempts:
            try:
                other_text, other_error, other_score, other_questions = read(candidate, colour)
            except Exception:
                continue

            if not other_error and other_score > best[0]:
                best = (other_score, other_text)

            if not other_error and complete(other_questions):
                break

        return best[1], None

    core.prepare_image_for_vision = prepare_image_for_vision
    core.parse_questions_from_text = parse_questions_from_text
    core._items_to_lines = items_to_lines
    core.ocr_image_to_text = ocr_image_to_text
