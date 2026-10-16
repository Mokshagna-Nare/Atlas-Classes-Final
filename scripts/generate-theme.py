"""
Generates the light/dark colour system:
  - theme.css: every Tailwind colour the app uses as a CSS variable (RGB triplet), with the
    dark values (Tailwind's defaults — the original look) and the designed light values.
  - the Tailwind `colors` config in index.html, pointing each class at its variable.
Re-run after changing a value:  python3 scripts/generate-theme.py
(tailwind-palette.json is Tailwind 3.4's default palette, MIT licensed.)
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
pal = json.load(open(ROOT / 'scripts' / 'tailwind-palette.json'))
SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

# Light neutrals: a soft sage-tinted paper with deep navy-charcoal ink, so the light theme keeps
# the dark theme's depth (layered surfaces, strong type) instead of reading as plain white.
LIGHT_NEUTRAL = {
    '950': '#f6f8f7',  # page
    '900': '#ffffff',  # cards / panels
    '800': '#eef4f1',  # raised surfaces, inputs, hover fills
    '700': '#d9e2dd',  # borders, dividers
    '600': '#626e80',  # muted metadata
    '500': '#5a6678',  # supporting text
    '400': '#465365',  # body text
    '300': '#34404f',  # strong body text
    '200': '#202c3d',  # secondary headings
    '100': '#101827',  # headings
    '50':  '#0b1220',  # ink
}
NEUTRALS = ['gray', 'slate', 'zinc', 'neutral', 'stone']
# Chromatic colours: bright shades used as text/accents on dark become deep shades on light,
# and the dark tinted backgrounds (800–950) become soft tints.
CHROMA_MAP = {'50': '950', '100': '900', '200': '800', '300': '700', '400': '700', '500': '700',
              '600': '800', '700': '800', '800': '200', '900': '100', '950': '50'}
CHROMATIC = ['emerald', 'green', 'red', 'rose', 'amber', 'yellow', 'blue', 'sky', 'purple', 'violet',
             'indigo', 'cyan', 'teal', 'lime', 'pink', 'fuchsia', 'orange']
# The brand green gets hand-tuned light values: text shades stay AA on every light surface,
# fills carry white labels, and the dark-theme tints become pale mint surfaces.
LIGHT_EMERALD = {
    '50': '#084a34', '100': '#0b5a3f', '200': '#0d6446', '300': '#127a56', '400': '#127a56',
    '500': '#15805a', '600': '#106b4d', '700': '#0d5c42', '800': '#c7e6d7', '900': '#ddf4e9',
    '950': '#eef9f3',
}

# Brand + named surfaces (index.html Tailwind config), dark value → light value.
ATLAS = {
    'atlas-primary':    ('#10b981', '#15805a'),
    'atlas-dark':       ('#0b0f19', '#ffffff'),
    'atlas-soft':       ('#111827', '#eef4f1'),
    'atlas-gray':       ('#1f2937', '#e5ece8'),
    'atlas-border':     ('#374151', '#d5dfda'),
    'atlas-text-main':  ('#f9fafb', '#101827'),
    'atlas-text-muted': ('#9ca3af', '#5a6678'),
    'atlas-black':      ('#05080f', '#f3f6f4'),
    'atlas-surface':    ('#0f1520', '#ffffff'),
    'atlas-raised':     ('#141b28', '#f9fbfa'),
}
BASE = {  # name: (dark, light)
    'white': ('#ffffff', '#101827'),   # "white" is the foreground colour → ink on light
    'black': ('#000000', '#b9c6bf'),   # recessed wells (inputs, panels) → soft sage on light
    'paper': ('#ffffff', '#ffffff'),   # always white (logo tiles, QR codes, diagrams)
    'on-accent': ('#ffffff', '#ffffff'),  # text/icons on solid colour fills (buttons, badges)
    'ink': ('#0b1220', '#0b1220'),        # always-dark text on always-white surfaces (paper)
    'scrim': ('#000000', '#475569'),      # modal backdrops: darkens in both themes
    # Public-site section backgrounds. Dark values equal what the dark theme already shows, so
    # they only change the light theme's rhythm: paper → cool sage → deeper sage.
    'canvas':       ('#0b0f19', '#f6f8f7'),
    'canvas-cool':  ('#0b0f19', '#eef4f1'),
    'canvas-sage':  ('#111827', '#e8f0ec'),
    # Brand accents for light-theme details (used with the light: variant).
    'brand-deep':   ('#059669', '#106b4d'),
    'brand-bright': ('#34d399', '#27c991'),
    'brand-pale':   ('#064e3b', '#ddf4e9'),
    'brand-line':   ('#065f46', '#c7e6d7'),
    'field-line':   ('#374151', '#7f8c86'),  # form-field outlines: 3:1 against white
}

def rgb(h):
    h = h.lstrip('#')
    return ' '.join(str(int(h[i:i + 2], 16)) for i in (0, 2, 4))

def lum(h):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (int(h.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)

def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

dark, light = {}, {}
for fam in NEUTRALS:
    for s in SHADES:
        dark[f'{fam}-{s}'] = pal[fam][s]
        light[f'{fam}-{s}'] = LIGHT_NEUTRAL[s]
for fam in CHROMATIC:
    src = pal['emerald'] if fam == 'orange' else pal[fam]  # orange is aliased to brand green
    for s in SHADES:
        dark[f'{fam}-{s}'] = (pal['emerald'][s] if fam == 'orange' and s in ('400', '500', '600') else pal[fam][s])
        light[f'{fam}-{s}'] = (src if fam == 'orange' and s in ('400', '500', '600') else pal[fam])[CHROMA_MAP[s]]
        if fam == 'emerald' or (fam == 'orange' and s in ('400', '500', '600')):
            light[f'{fam}-{s}'] = LIGHT_EMERALD[s]
for k, (d, l) in {**ATLAS, **BASE}.items():
    dark[k], light[k] = d, l

def block(values):
    return '\n'.join(f'  --c-{k}: {rgb(v)};' for k, v in values.items())

css = f"""/* GENERATED by scripts/generate-theme.py — edit that file, not this one.
 * Every Tailwind colour the app uses is a CSS variable, so one attribute on <html>
 * (data-theme="light" | "dark") re-themes the whole product. Dark = Tailwind defaults. */
:root,
[data-theme="dark"] {{
  color-scheme: dark;
{block(dark)}
  --shadow-rgb: 0 0 0;
  --shadow-k: 1;
}}

[data-theme="light"] {{
  color-scheme: light;
{block(light)}
  --shadow-rgb: 15 23 42;
  --shadow-k: 0.16;
}}
"""
(ROOT / 'theme.css').write_text(css)
print('wrote theme.css')

var = lambda k: f"'rgb(var(--c-{k}) / <alpha-value>)'"
lines = ['colors: {']
for k in list(BASE) + list(ATLAS):
    lines.append(f"  '{k}': {var(k)},")
lines.append("  'atlas-green': " + var('atlas-primary') + ",")
lines.append("  'atlas-orange': " + var('atlas-primary') + ",")
for fam in NEUTRALS + CHROMATIC:
    lines.append(f"  {fam}: {{ " + ', '.join(f"{s}: {var(f'{fam}-{s}')}" for s in SHADES) + " },")
lines.append('},')

# Point the Tailwind config in index.html at the variables (between the theme-colors markers).
html_path = ROOT / 'index.html'
html = html_path.read_text()
START, END = '/* theme-colors:start (generated) */\n', '            /* theme-colors:end */'
a, b = html.index(START) + len(START), html.index(END)
html_path.write_text(html[:a] + ''.join('            ' + l + '\n' for l in lines) + html[b:])
print('updated index.html colours')

# Contrast report for the light theme (WCAG AA: 4.5 normal text, 3 large text / UI).
L = light
checks = [
    ('heading ink on card', L['white'], L['gray-900']),
    ('heading ink on cool section', L['white'], L['canvas-cool']),
    ('secondary heading (gray-200) on page', L['gray-200'], L['canvas']),
    ('body (gray-400) on page', L['gray-400'], L['canvas']),
    ('body (gray-400) on sage', L['gray-400'], L['canvas-sage']),
    ('supporting (gray-500) on card', L['gray-500'], L['gray-900']),
    ('supporting (gray-500) on sage', L['gray-500'], L['canvas-sage']),
    ('metadata (gray-600) on card', L['gray-600'], L['gray-900']),
    ('metadata (gray-600) on cool section', L['gray-600'], L['canvas-cool']),
    ('placeholder (gray-500) on field', L['gray-500'], L['paper']),
    ('accent text (emerald-300/400) on sage', L['emerald-400'], L['canvas-sage']),
    ('brand text (atlas-primary) on page', L['atlas-primary'], L['canvas']),
    ('eyebrow (brand-deep) on brand-pale', L['brand-deep'], L['brand-pale']),
    ('white label on primary fill', '#ffffff', L['atlas-primary']),
    ('page-colour label on primary gradient', L['gray-950'], L['emerald-400']),
    ('white label on red-600 fill', '#ffffff', L['red-600']),
    ('amber-300 text on card', L['amber-300'], L['gray-900']),
    ('rose-300 text on card', L['rose-300'], L['gray-900']),
    ('blue-400 chip text on page', L['blue-400'], L['canvas']),
    ('purple-400 chip text on page', L['purple-400'], L['canvas']),
    ('form-field outline vs white (UI 3:1)', L['field-line'], L['paper']),
    ('icon (atlas-primary) on brand-pale (UI 3:1)', L['atlas-primary'], L['brand-pale']),
]
print('LIGHT THEME CONTRAST')
for name, fg, bg in checks:
    r = contrast(fg, bg)
    print(f'  {r:5.2f}  {"PASS" if r >= 4.5 else "large/UI" if r >= 3 else "LOW "}  {name}')
