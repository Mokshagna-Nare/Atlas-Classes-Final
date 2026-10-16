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

# Light neutrals: a clean, cool SaaS grey ramp — near-white page, pure white cards, hairline
# borders and deep navy ink (the look of well-made light products: calm, crisp, airy).
LIGHT_NEUTRAL = {
    '950': '#f7f8fa',  # page
    '900': '#ffffff',  # cards / panels
    '800': '#f2f4f7',  # raised surfaces, inputs, secondary buttons, hover fills
    '700': '#e6e9ef',  # hairline borders, dividers
    '600': '#667085',  # muted metadata
    '500': '#555f73',  # supporting text
    '400': '#475467',  # body text
    '300': '#344054',  # strong body text
    '200': '#1d2939',  # secondary headings
    '100': '#101828',  # headings
    '50':  '#0c111d',  # ink
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
    '50': '#084a34', '100': '#0b5a3f', '200': '#0d6446', '300': '#0f714e', '400': '#0f714e',
    '500': '#15805a', '600': '#106b4d', '700': '#0d5c42', '800': '#c7e6d7', '900': '#ddf4e9',
    '950': '#eef9f3',
}

# Brand + named surfaces (index.html Tailwind config), dark value → light value.
ATLAS = {
    'atlas-primary':    ('#10b981', '#15805a'),
    'atlas-dark':       ('#0b0f19', '#ffffff'),
    'atlas-soft':       ('#111827', '#fbfcfd'),
    'atlas-gray':       ('#1f2937', '#eef1f5'),
    'atlas-border':     ('#374151', '#e4e7ec'),
    'atlas-text-main':  ('#f9fafb', '#101828'),
    'atlas-text-muted': ('#9ca3af', '#555f73'),
    'atlas-black':      ('#05080f', '#f5f7fa'),
    'atlas-surface':    ('#0f1520', '#ffffff'),
    'atlas-raised':     ('#141b28', '#fbfcfd'),
}
BASE = {  # name: (dark, light)
    'white': ('#ffffff', '#101828'),   # "white" is the foreground colour → ink on light
    'black': ('#000000', '#c8cfda'),   # recessed wells (inputs, panels) → soft grey on light
    'paper': ('#ffffff', '#ffffff'),   # always white (logo tiles, QR codes, diagrams)
    'on-accent': ('#ffffff', '#ffffff'),  # text/icons on solid colour fills (buttons, badges)
    'ink': ('#0b1220', '#0b1220'),        # always-dark text on always-white surfaces (paper)
    'scrim': ('#000000', '#1d2939'),      # modal backdrops: darkens in both themes
    # Public-site section backgrounds. Dark values equal what the dark theme already shows, so
    # they only change the light theme's rhythm: paper → cool sage → deeper sage.
    'canvas':       ('#0b0f19', '#ffffff'),
    'canvas-cool':  ('#0b0f19', '#f7f8fa'),
    'canvas-sage':  ('#111827', '#f3f8f5'),
    # Brand accents for light-theme details (used with the light: variant).
    'brand-deep':   ('#059669', '#106b4d'),
    'brand-bright': ('#34d399', '#27c991'),
    'brand-vivid':  ('#34d399', '#109670'),  # end stop of large accent-word gradients (3:1 on paper)
    'brand-pale':   ('#064e3b', '#e8f7f0'),
    'brand-line':   ('#065f46', '#cdebdd'),
    'field-line':   ('#374151', '#8792a2'),  # form-field outlines: 3:1 against white
    # Saturated emerald for the light theme's one bold promo card (a brand island).
    'brand-card':     ('#0b0f19', '#0b7a55'),
    'brand-card-deep':('#05080f', '#064e3a'),
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

# Brand islands: an element marked data-theme="brand" becomes a saturated emerald card in the
# light theme (white text, mint accents, white buttons). In the dark theme it simply inherits dark.
BRAND_NEUTRAL = {
    '950': '#064e3a', '900': '#0d6b4b', '800': '#13805a', '700': '#2a9a73', '600': '#bfe6d4',
    '500': '#d7f3e6', '400': '#e8f8f0', '300': '#f2fbf7', '200': '#f7fdfa', '100': '#ffffff',
    '50': '#ffffff',
}
brand = dict(dark)
for fam in NEUTRALS:
    for sh in SHADES:
        brand[f'{fam}-{sh}'] = BRAND_NEUTRAL[sh]
brand.update({
    'white': '#ffffff', 'atlas-text-main': '#ffffff', 'atlas-text-muted': '#d7f3e6',
    'atlas-primary': '#d1fae5', 'emerald-300': '#d1fae5', 'emerald-400': '#ffffff', 'emerald-500': '#effcf6',
    'atlas-dark': '#0b7a55', 'atlas-black': '#064e3a', 'atlas-soft': '#0d6b4b', 'atlas-surface': '#0d6b4b',
    'atlas-raised': '#13805a', 'canvas': '#0b7a55', 'canvas-cool': '#0b7a55', 'canvas-sage': '#0b7a55',
    'brand-card': light['brand-card'], 'brand-card-deep': light['brand-card-deep'],
})

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
  --shadow-rgb: 16 24 40;
  --shadow-k: 0.14;
}}

[data-theme="light"] [data-theme="brand"] {{
  color-scheme: dark;
{block(brand)}
  --shadow-rgb: 4 47 34;
  --shadow-k: 0.6;
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
    ('white on navy active pill', '#ffffff', L['gray-100']),
    ('large accent word end (brand-vivid) on page', L['brand-vivid'], L['canvas']),
    ('BRAND card: white heading', '#ffffff', L['brand-card']),
    ('BRAND card: body (gray-400)', brand['gray-400'], L['brand-card']),
    ('BRAND card: small text (gray-500)', brand['gray-500'], L['brand-card']),
    ('BRAND card: button label on white', brand['gray-950'], '#ffffff'),
]
print('LIGHT THEME CONTRAST')
for name, fg, bg in checks:
    r = contrast(fg, bg)
    print(f'  {r:5.2f}  {"PASS" if r >= 4.5 else "large/UI" if r >= 3 else "LOW "}  {name}')
