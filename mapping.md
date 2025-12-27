
# CSS Selector Mapping & Migration Guide

Use this guide to map the new "Atlas Green" Dark Theme to your WordPress environment.

## Global Replacements
*   `body` -> `.bg-atlas-dark`, `.text-atlas-text-main`
*   `::selection` -> `background: #10B981; color: #000;`

## Color Tokens (Find & Replace)
*   **Primary Brand**: Replace any instance of Orange (`#FF6B00`, `#f97316`) with Green (`#10B981`).
*   **Background**: Replace White (`#FFFFFF`, `#F3F4F6`) with Dark (`#0B0F19`).
*   **Surface**: Replace Light Gray (`#F9FAFB`) with Dark Surface (`#111827`).

## Component Mappings

### 1. Buttons
| Old Class / Element | New Utility Class | Notes |
| :--- | :--- | :--- |
| `.bg-atlas-orange`, `.bg-orange-600` | `.btn .btn-primary` | Adds green bg, glow, and lift |
| Secondary Buttons / Borders | `.btn .btn-outline` | Transparent with green border |
| Text Links in Nav | `.btn .btn-ghost` | Subtle hover effect |

### 2. Cards & Containers
| Old Class / Element | New Utility Class | Notes |
| :--- | :--- | :--- |
| `.bg-white`, `.shadow-lg` | `.card` | Adds dark bg, border, and green glow hover |
| Course Tiles | `.card` | Inherits hover-lift automatically |
| Testimonial Containers | `.card` | |

### 3. Navigation
| Old Class / Element | New Utility Class | Notes |
| :--- | :--- | :--- |
| Header Links | `.nav-link` | Javascript handles `.nav--active` state |
| Mobile Menu | `.bg-surface` | Ensure backdrop-blur is enabled |

### 4. Typography & Decor
| Old Class / Element | New Utility Class | Notes |
| :--- | :--- | :--- |
| Section Headings | `.text-white` | |
| Subheadings / Meta text | `.text-muted` | |
| Badges / Tags | `.chip` | Green background tint with border |
| Section Containers | `.section-animate` | Triggers fade-up on scroll |

## Migration Steps
1.  **Backup**: Save current `style.css`.
2.  **Enqueue**: Add the provided `styles.css` and `interactions.ts` to your theme.
3.  **Replace**: Update HTML class attributes based on the table above.
4.  **Icons**: Ensure SVG icons use `currentColor` or explicitly set `text-green-500`.
