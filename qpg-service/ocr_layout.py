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


def _reading_rows(items, width):
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

        if len(left) >= 4 and len(right) >= 4:
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
    total = 0.0

    for question in questions:
        options = len(question.get("options") or [])
        words = len(str(question.get("question") or "").split())
        total += 1 + (3 if options >= 2 else 0) + min(words, 12) / 4

    return total


def _skew_degrees(engine, image):
    """Median slope of the long text boxes, from a detection-only pass."""

    # RapidOCR keeps per-call switches for later calls, so put them back.
    saved = {name: getattr(engine, name) for name in ("use_cls", "use_rec") if hasattr(engine, name)}

    try:
        output = engine(np.asarray(image.convert("RGB")), use_cls=False, use_rec=False)
    finally:
        for name, value in saved.items():
            setattr(engine, name, value)

    boxes = getattr(output, "boxes", None)
    angles = []

    for box in boxes if boxes is not None else []:
        (x0, y0), (x1, y1), (x2, y2) = box[0], box[1], box[2]
        length = float(np.hypot(x1 - x0, y1 - y0))
        thickness = float(np.hypot(x2 - x1, y2 - y1))

        if length > 3 * max(thickness, 1.0):
            angles.append(float(np.degrees(np.arctan2(y1 - y0, x1 - x0))))

    return float(np.median(angles)) if len(angles) >= 3 else 0.0


def _straighten(core, image_bytes):
    """
    (image bytes, colour array or None). A photo tilted by more than about
    a degree is rotated level first, so lines and option rows line up.
    """

    from PIL import Image

    prepared, _ = core.prepare_image_for_vision(image_bytes)
    image = Image.open(io.BytesIO(prepared))
    has_colour = image.mode not in ("L", "1", "LA")
    image = image.convert("RGB")
    engine = core.get_ocr_engine()

    if engine is not None:
        angle = _skew_degrees(engine, image)

        if 0.7 <= abs(angle) <= 20:
            array = np.asarray(image)
            border = np.concatenate([array[0], array[-1], array[:, 0], array[:, -1]])
            fill = tuple(int(v) for v in np.median(border, axis=0))
            image = image.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=fill)
            buffer = io.BytesIO()
            image.save(buffer, "PNG")
            image_bytes = buffer.getvalue()

    colour = None

    if has_colour:
        array = np.asarray(image)

        if array.size and np.abs(array[..., 1].astype(np.int16) - array[..., 0]).max() > 8:
            colour = array

    return image_bytes, colour


# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------
def install(core):
    # "0.5 mol" is not question 0, "2.5 kg" is not option 2.
    core._NUMBERED_LINE_RE = re.compile(r"^\s*\(?\s*(\d{1,3})\s*[.)](?!\d)\s*(.*)$")
    core._OPTION_LINE_RE = re.compile(
        r"^\s*(?:\(\s*([a-dA-D1-4])\s*\)|([a-dA-D])\s*[.)]|([1-4])\s*[.)](?!\d))\s*(.*)$"
    )

    original_parse = core.parse_questions_from_text
    original_lines = core._items_to_lines
    original_ocr = core.ocr_image_to_text

    def parse_questions_from_text(text):
        return original_parse(_add_unnumbered_questions(core, text))

    def items_to_lines(items, page_width):
        merged = _merge_option_labels(items, page_width)
        old = original_lines(merged, page_width)
        new = _rows_to_lines(_reading_rows(merged, page_width), page_width)

        old_read = parse_questions_from_text("\n".join(old))
        new_read = parse_questions_from_text("\n".join(new))
        old_score, new_score = _score(old_read), _score(new_read)
        keys = lambda read: sum(1 for question in read if question.get("key"))

        if new_score > old_score or old_score == 0 or (new_score == old_score and keys(new_read) > keys(old_read)):
            return new

        return old

    def ocr_image_to_text(image_bytes):
        # Straighten tilted photos, and keep the colour image so a highlighted
        # (correct) option can be seen.
        _state.colour = None

        try:
            image_bytes, colour = _straighten(core, image_bytes)
            _state.colour = colour
        except Exception:
            _state.colour = None

        try:
            return original_ocr(image_bytes)
        finally:
            _state.colour = None

    core.parse_questions_from_text = parse_questions_from_text
    core._items_to_lines = items_to_lines
    core.ocr_image_to_text = ocr_image_to_text
