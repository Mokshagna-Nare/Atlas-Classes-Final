// Shared interaction styles for the public site (home page and Careers), built on the design
// tokens in index.html (shadow-card, shadow-glow, ease-premium, atlas-surface…).
// Every interactive style carries hover, keyboard focus-visible, pressed and disabled states.

/** Visible keyboard focus ring; mouse clicks don't show it. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-dark';

const buttonBase =
  'inline-flex items-center justify-center gap-2 font-bold select-none transition-[transform,box-shadow,background-color,border-color,color,filter] duration-300 ease-premium active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50';

/** Solid emerald call to action. Dark text on emerald keeps the label legible (WCAG AA). */
export const buttonPrimary = `${buttonBase} rounded-full bg-gradient-to-b from-emerald-400 to-emerald-500 text-gray-950 shadow-glow hover:-translate-y-0.5 hover:brightness-110 hover:shadow-glow-lg ${focusRing}`;

/** Quiet outlined action that sits beside a primary button. */
export const buttonSecondary = `${buttonBase} rounded-full border border-white/15 bg-white/[0.04] text-gray-100 backdrop-blur-sm hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.08] ${focusRing}`;

/** Base card surface (no hover). */
export const cardStatic = 'rounded-2xl border border-white/[0.07] bg-gradient-to-b from-atlas-raised/90 to-atlas-surface/80 shadow-card';

/**
 * Card with the premium hover: cursor spotlight wash, glowing edge, lift and deeper shadow
 * (see .spotlight in styles.css). Keeps the default cursor, so content cards don't read as links.
 * Put data-spotlight-group on the grid so neighbouring cards' edges catch the light too.
 */
export const cardHover = `${cardStatic} spotlight`;

/** Card that is itself a link or button: the same hover plus a keyboard focus ring. */
export const cardInteractive = `${cardHover} ${focusRing}`;

/** Text input / select / textarea on the public site. */
export const fieldInput =
  'w-full rounded-xl border border-white/10 bg-atlas-dark/80 px-4 py-3.5 text-white placeholder-gray-500 outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-white/20 focus-visible:border-emerald-400/70 focus-visible:bg-atlas-dark focus-visible:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]';
