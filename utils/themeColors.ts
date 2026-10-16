// Colours for the few places Tailwind classes can't reach. Every token is a Tailwind colour name
// ('gray-800', 'emerald-400', 'white', 'atlas-dark' …) backed by a variable in theme.css.

/** A colour that follows the theme, for HTML inline styles: style={{ color: tc('white') }}. */
export const tc = (token: string, alpha?: number) =>
  alpha == null ? `rgb(var(--c-${token}))` : `rgb(var(--c-${token}) / ${alpha})`;

/** A theme-following shadow colour (soft slate in light, black in dark). */
export const shadowColor = (alpha: number) => `rgb(var(--shadow-rgb) / calc(${alpha} * var(--shadow-k)))`;
