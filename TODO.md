- [ ] Implement fix in `docx-parser-service/main.py` to preserve `$$...$$` delimiters and math punctuation/symbols during `extract_content()` reconstruction (stop collapsing spaces globally).
- [ ] After OMML rewrite, add validation that returned strings contain matching `$$...$$`; if not, trigger `[[MATH_FALLBACK]]` so placeholder conversion occurs.
- [ ] For MathType OLE: on MTEF->LaTeX failure, map to `[[IMG_n]]` using native WMF/EMF fallback images extracted from `word/media` and passed through `image_map`.
- [ ] Run backend locally (or unit check) and verify JSON now contains `$$...$$` for successful extraction.

