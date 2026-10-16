// Shared interaction styles for the public site (home page and Careers), built on the design
// tokens in index.html (shadow-card, shadow-glow, ease-premium, atlas-surface…).
// Every interactive style carries hover, keyboard focus-visible, pressed and disabled states.
// The light: classes are the light theme's own treatment (soft slate shadows, fine borders,
// deep-emerald fills); the dark theme ignores them.

/** Light-theme elevation: a hairline contact shadow plus a soft, wide ambient one. */
const lightCardShadow =
  'light:shadow-[0_1px_2px_rgba(16,24,39,0.05),0_14px_34px_-18px_rgba(16,24,39,0.16)]';

/** Visible keyboard focus ring; mouse clicks don't show it. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-dark light:focus-visible:ring-offset-canvas';

const buttonBase =
  'inline-flex items-center justify-center gap-2 font-bold select-none transition-[transform,box-shadow,background-color,border-color,color,filter] duration-300 ease-premium active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50';

/** Solid emerald call to action. Dark text on emerald keeps the label legible (WCAG AA). */
export const buttonPrimary = `${buttonBase} rounded-full bg-gradient-to-b from-emerald-400 to-emerald-500 text-gray-950 shadow-glow hover:-translate-y-0.5 hover:brightness-110 hover:shadow-glow-lg light:from-atlas-primary light:to-brand-deep light:text-on-accent light:shadow-[0_10px_24px_-10px_rgba(16,107,77,0.6),inset_0_1px_0_rgba(255,255,255,0.18)] light:hover:brightness-[0.92] light:hover:shadow-[0_16px_30px_-12px_rgba(16,107,77,0.65),inset_0_1px_0_rgba(255,255,255,0.18)] ${focusRing}`;

/** Quiet outlined action that sits beside a primary button. */
export const buttonSecondary = `${buttonBase} rounded-full border border-white/15 bg-white/[0.04] text-gray-100 backdrop-blur-sm hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.08] light:border-gray-700 light:bg-paper light:shadow-[0_1px_2px_rgba(16,24,39,0.05),0_6px_16px_-10px_rgba(16,24,39,0.18)] light:hover:border-atlas-primary/45 light:hover:bg-brand-pale/40 light:hover:text-brand-deep ${focusRing}`;

/** Base card surface (no hover). */
export const cardStatic = `rounded-2xl border border-white/[0.07] bg-gradient-to-b from-atlas-raised/90 to-atlas-surface/80 shadow-card light:border-gray-700/80 light:from-paper light:to-atlas-raised ${lightCardShadow}`;

/**
 * Card with the premium hover: cursor spotlight wash, glowing edge, lift and deeper shadow
 * (see .spotlight in styles.css). Keeps the default cursor, so content cards don't read as links.
 * Put data-spotlight-group on the grid so neighbouring cards' edges catch the light too.
 */
export const cardHover = `${cardStatic} spotlight light:hover:border-brand-line light:hover:shadow-[0_2px_4px_rgba(16,24,39,0.04),0_28px_56px_-26px_rgba(16,24,39,0.22),0_18px_40px_-26px_rgba(21,128,90,0.32)]`;

/** Card that is itself a link or button: the same hover plus a keyboard focus ring. */
export const cardInteractive = `${cardHover} ${focusRing}`;

/** Text input / select / textarea on the public site. */
export const fieldInput =
  'w-full rounded-xl border border-white/10 bg-atlas-dark/80 px-4 py-3.5 text-white placeholder-gray-500 outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-white/20 focus-visible:border-emerald-400/70 focus-visible:bg-atlas-dark focus-visible:shadow-[0_0_0_4px_rgba(16,185,129,0.12)] light:border-field-line light:bg-paper light:hover:border-gray-400 light:focus-visible:border-atlas-primary light:focus-visible:shadow-[0_0_0_4px_rgba(21,128,90,0.16)]';

/** Small uppercase label above a section title ("Programs", "Contact", "We are hiring"). */
export const eyebrowChip =
  'inline-flex items-center gap-2 rounded-full border border-atlas-primary/25 bg-atlas-primary/[0.08] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-atlas-primary light:border-brand-line light:bg-brand-pale light:text-brand-deep';
/** The pulsing dot inside an eyebrow chip. */
export const eyebrowDot = 'h-1.5 w-1.5 rounded-full bg-atlas-primary shadow-[0_0_8px_rgba(16,185,129,0.9)] light:shadow-[0_0_0_3px_rgba(39,201,145,0.22)]';

/** Icon tile on a card: tinted well that lights up when the card is hovered. */
export const iconWell =
  'border border-atlas-primary/20 bg-atlas-primary/10 text-atlas-primary light:border-brand-line light:bg-brand-pale light:text-brand-deep';
