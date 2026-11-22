"""
Checks on extracted questions, so a reviewer only has to look where something
may be wrong (instead of re-reading every question against the page).

- fix_joined_words: OCR often runs two words together ("theprocess",
  "packagingin", "acidicpH"). A word that isn't in the dictionary is split
  only if every part is a common English word; dictionary words (including
  science terms like "lysosomes", "collenchyma") are never touched.
- question_checks: structure problems in one question (missing / merged /
  duplicate options, question text that swallowed its options, ...).
- page_checks: problems across a page with many questions: question numbers
  that are missing (merged into the previous question or unreadable) or out
  of order, and text on the page that ended up in no question.

Every function is best-effort: a failure means "no checks", never a failed page.
"""

import gzip
import math
import os
import re
import threading

_DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
_lock = threading.Lock()
_known = None  # dictionary words (never changed)
_common = None  # word -> log probability (parts a joined word may be split into)
_frequent = set()  # common web words (names, brands...): kept unless clearly two glued words

# Parts that are prefixes / suffixes rather than words: "bio molecules", "photo synthesis",
# "enzym es" would be wrong splits of real (if unlisted) words.
_NOT_FIRST = {
    "bio", "micro", "macro", "photo", "hydro", "electro", "thermo", "poly", "mono", "multi", "non",
    "pre", "sub", "inter", "intra", "anti", "semi", "re", "un", "de", "co", "di", "tri", "tetra",
    "penta", "hexa", "iso", "neo", "para", "meta", "ortho", "endo", "exo", "ecto", "proto", "pseudo",
    "auto", "chloro", "chromo", "cyto", "geo", "hemi", "hetero", "homo", "hyper", "hypo", "mega",
    "nano", "over", "under", "out", "up", "dis", "mis", "super", "trans", "ultra", "uni", "bi",
}
_NOT_LAST = {
    "ing", "ed", "es", "ly", "ness", "ment", "able", "ible", "tion", "sion", "al", "ic", "ous", "ive",
    "ise", "ize", "ism", "ist", "ity", "er", "or", "est", "ful", "less", "logy", "cyte", "some", "somes",
    "plast", "phyll", "sis", "lysis", "genic", "philic", "phobic", "ate", "ite", "ide", "ium",
}
_SHORT_OK = {"a", "i"}
_SHORT_PARTS = {"ph", "uv", "ir", "dc", "ac", "we", "he", "me", "my", "so", "no", "do", "go", "up", "if", "us", "am"}
# Small words that OCR most often glues to a neighbour ("inthe", "ofthe", "whichof").
_GLUE_WORDS = {
    "a", "an", "the", "of", "in", "on", "to", "is", "are", "was", "be", "by", "at", "as", "for",
    "and", "or", "from", "with", "its", "it", "that", "this", "which", "not",
}


def _load():
    global _known, _common

    with _lock:
        if _known is not None:
            return

        with gzip.open(os.path.join(_DATA, "english_words.txt.gz"), "rt") as handle:
            known = {line.strip() for line in handle if line.strip()}

        counts = {}

        with gzip.open(os.path.join(_DATA, "common_words.tsv.gz"), "rt") as handle:
            for line in handle:
                word, _, count = line.strip().partition("\t")

                if word and count.isdigit():
                    counts[word] = int(count)

        total = float(sum(counts.values())) or 1.0
        _common = {word: math.log(count / total) for word, count in counts.items()}
        _known = known
        _frequent.update(counts)


def _split(word):
    """Best split of a lowercase word into common words, or None."""

    n = len(word)
    best = [(0.0, [])] + [None] * n

    for end in range(1, n + 1):
        for start in range(max(0, end - 20), end):
            if best[start] is None:
                continue

            part = word[start:end]
            score = _common.get(part)

            if score is None or (len(part) < 2 and part not in _SHORT_OK):
                continue

            candidate = (best[start][0] + score, best[start][1] + [part])

            if best[end] is None or candidate[0] > best[end][0]:
                best[end] = candidate

    if best[n] is None:
        return None

    parts = best[n][1]

    if not 2 <= len(parts) <= 3 or parts[0] in _NOT_FIRST or parts[-1] in _NOT_LAST:
        return None

    # Very short pieces only when they are real small words ("in", "of", "a") or common
    # science abbreviations ("pH", "UV") — "Avogadro" must not become "Avo ga dro".
    if any(len(part) <= 2 and part not in _GLUE_WORDS and part not in _SHORT_PARTS for part in parts):
        return None

    if len(parts) == 3 and any(len(part) < 3 and part not in _GLUE_WORDS for part in parts):
        return None

    return parts


_TOKEN_RE = re.compile(r"[A-Za-z]{5,}")


def fix_joined_words(text):
    """(text with run-together words split, [(old, new), ...])."""

    if not isinstance(text, str) or not text:
        return text, []

    try:
        _load()
    except Exception:
        return text, []

    changes = []

    def replace(match):
        token = match.group(0)
        lower = token.lower()

        # Real words stay as they are, and so do acronyms and formulas (NaOH, DNAse, KMnO):
        # more than one capital after the first letter.
        if lower in _known or sum(1 for ch in token[1:] if ch.isupper()) > 1:
            return token

        parts = _split(lower)

        if not parts:
            return token

        # A capitalised word is usually a name (Hasselbalch, Michaelis, Menten): split it only
        # when it starts with a small glued word ("Theprocess", "Inthe").
        if token[0].isupper() and parts[0] not in _GLUE_WORDS:
            return token

        # A frequent non-dictionary word ("Einstein", "Newton", "Bluetooth") is kept, unless it's
        # really a small word glued to another ("inthe", "ofthe", "isthe").
        if lower in _frequent and not (parts[0] in _GLUE_WORDS or parts[-1] in _GLUE_WORDS):
            return token

        pieces, position = [], 0

        for part in parts:
            pieces.append(token[position:position + len(part)])
            position += len(part)

        fixed = " ".join(pieces)
        changes.append((token, fixed))
        return fixed

    return _TOKEN_RE.sub(replace, text), changes


def fix_question(question):
    """Applies fix_joined_words to the question, options and explanation; returns the fixes."""

    fixes = []

    for key in ("question", "explanation"):
        value, changed = fix_joined_words(question.get(key))

        if changed:
            question[key] = value
            fixes.extend(changed)

    options = question.get("options")

    if isinstance(options, list):
        for index, option in enumerate(options):
            value, changed = fix_joined_words(option)

            if changed:
                options[index] = value
                fixes.extend(changed)

    return [f"{old} → {new}" for old, new in fixes]


# ---------------------------------------------------------------------------------------------
_LETTERS_RE = re.compile(r"[^a-z0-9]")
_OPTION_MARKERS_RE = re.compile(r"\(\s*([1-4a-dA-D])\s*\)\s*\w")
_NEXT_QUESTION_RE = re.compile(r"(?:^|\s)(?:Q\.?\s*)?\d{1,3}\s*[.)]\s+[A-Z][a-z]+\s+\w+")


def _norm(text):
    return _LETTERS_RE.sub("", str(text or "").lower())


def question_checks(question):
    """Plain-language reasons this question should be checked against the page ([] = looks fine)."""

    checks = []
    text = str(question.get("question") or "")
    options = [str(option or "") for option in (question.get("options") or [])]
    filled = [option for option in options if option.strip()]
    mcq = bool(filled) and question.get("question_type") != "Numerical"

    if len(_norm(text)) < 12:
        checks.append("The question text is very short — check it was read in full.")

    if mcq:
        if len(filled) != 4:
            checks.append(
                f"{len(filled)} option(s) found instead of 4 — check none are missing, merged or split."
            )

        # An empty option between filled ones (a trailing gap is already covered above).
        last_filled = max((i for i, option in enumerate(options[:4]) if option.strip()), default=-1)
        gaps = [str(i + 1) for i, option in enumerate(options[:4]) if not option.strip() and i < last_filled]

        if gaps:
            checks.append(f"Option {', '.join(gaps)} is empty.")

        seen = {}

        for index, option in enumerate(options[:4]):
            key = _norm(option)

            if key and key in seen:
                checks.append(f"Options {seen[key] + 1} and {index + 1} are identical.")
            elif key:
                seen[key] = index

        for index, option in enumerate(options[:4]):
            if _NEXT_QUESTION_RE.search(option):
                checks.append(f"Option {index + 1} may contain the start of another question.")

        lengths = sorted(len(option) for option in filled)

        if lengths:
            median = lengths[len(lengths) // 2]

            for index, option in enumerate(options[:4]):
                if len(option) > 160 and len(option) > 3 * max(median, 20):
                    checks.append(f"Option {index + 1} is much longer than the others — extra text may have been merged into it.")

    markers = [marker.lower() for marker in _OPTION_MARKERS_RE.findall(text)]

    if any(markers[i:i + 2] in (["1", "2"], ["a", "b"]) for i in range(len(markers))):
        checks.append("The question text seems to contain its options — check they were separated.")

    return checks


_OPTION_LABEL_RE = re.compile(r"^\s*(?:\(\s*[a-dA-D1-4]\s*\)|[a-dA-D]\s*[.)])\s*")
_NUMBER_LINE_RE = re.compile(r"^\s*(?:Q(?:uestion)?\.?\s*)?\(?\s*(\d{1,3})\s*[.):]\s*(.*)$", re.IGNORECASE)


def _question_numbers(questions, text_read):
    """The printed number of each question (or None), found from the page text."""

    lines = [line for line in str(text_read or "").splitlines() if line.strip()]
    starts = []

    for line in lines:
        match = _NUMBER_LINE_RE.match(line)

        if match:
            starts.append((int(match.group(1)), _norm(match.group(2))[:16]))

    numbers = []
    used = set()

    for question in questions:
        wanted = _norm(question.get("question"))[:16]
        found = None

        if len(wanted) >= 6:
            for index, (number, start) in enumerate(starts):
                if index not in used and len(start) >= 6 and (wanted.startswith(start[:12]) or start.startswith(wanted[:12])):
                    found = index
                    break

        if found is None:
            numbers.append(None)
        else:
            used.add(found)
            numbers.append(starts[found][0])

    return numbers


def page_checks(questions, text_read):
    """Problems across the whole page: missing / out-of-order numbers, text in no question."""

    checks = []

    if not text_read or not questions:
        return checks

    numbers = _question_numbers(questions, text_read)
    known = [(position, number) for position, number in enumerate(numbers) if number is not None]

    for (_, previous), (_, current) in zip(known, known[1:]):
        if current > previous + 1 and current - previous <= 20:
            missing = list(range(previous + 1, current))
            names = ", ".join(str(n) for n in missing[:6]) + ("…" if len(missing) > 6 else "")
            checks.append(
                f"Question {names} not found between {previous} and {current} — it may be merged into "
                f"question {previous}, or unreadable on the page."
            )
        elif current <= previous:
            checks.append(f"Question numbers go from {previous} back to {current} — check the order and for duplicates.")

    # Text on the page that isn't in any question, option or explanation.
    placed = "".join(
        _norm(question.get("question")) + "".join(_norm(option) for option in (question.get("options") or []))
        + _norm(question.get("explanation"))
        for question in questions
    )
    leftovers = []

    for line in str(text_read).splitlines():
        stripped = _NUMBER_LINE_RE.sub(lambda m: m.group(2), line).strip()
        stripped = _OPTION_LABEL_RE.sub("", stripped)
        letters = _norm(stripped)

        if len(letters) >= 15 and letters not in placed:
            leftovers.append(re.sub(r"\s+", " ", stripped)[:90])

    if leftovers:
        shown = "; ".join(f"“{line}”" for line in leftovers[:4]) + (f" (+{len(leftovers) - 4} more)" if len(leftovers) > 4 else "")
        checks.append(f"Text on the page that isn't in any question (a heading, or a missed line?): {shown}")

    return checks
