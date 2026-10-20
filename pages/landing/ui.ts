// Shared interaction styles for the public site (home page and Careers), built on the design
// tokens in index.html (shadow-card, shadow-glow, ease-premium, atlas-surface…).
// Every interactive style carries hover, keyboard focus-visible, pressed and disabled states.
// The light: classes are the light theme's own treatment — clean white surfaces, hairline
// borders, soft wide shadows, one saturated emerald for actions; the dark theme ignores them.

/** Light-theme elevation: a hairline contact shadow plus one soft, wide ambient shadow. */
const lightCardShadow =
  'light:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-12px_rgba(16,24,40,0.10)]';

/** Visible keyboard focus ring; mouse clicks don't show it. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-atlas-dark light:focus-visible:ring-offset-canvas';

const buttonBase =
  'inline-flex items-center justify-center gap-2 font-bold select-none transition-[transform,box-shadow,background-color,border-color,color,filter] duration-300 ease-premium active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50';

/** Solid emerald call to action. Dark text on emerald keeps the label legible (WCAG AA). */
export const buttonPrimary = `${buttonBase} rounded-full bg-gradient-to-b from-emerald-400 to-emerald-500 text-gray-950 shadow-glow hover:-translate-y-0.5 hover:brightness-110 hover:shadow-glow-lg light:from-atlas-primary light:to-atlas-primary light:text-on-accent light:shadow-[0_1px_2px_rgba(16,24,40,0.08),0_8px_20px_-8px_rgba(21,128,90,0.55)] light:hover:from-brand-deep light:hover:to-brand-deep light:hover:brightness-100 light:hover:shadow-[0_1px_2px_rgba(16,24,40,0.08),0_14px_28px_-10px_rgba(21,128,90,0.6)] ${focusRing}`;

/** Quiet action that sits beside a primary button: a light grey pill. */
export const buttonSecondary = `${buttonBase} rounded-full border border-white/15 bg-white/[0.04] text-gray-100 backdrop-blur-sm hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.08] light:border-gray-700 light:bg-paper light:text-gray-100 light:shadow-[0_1px_2px_rgba(16,24,40,0.05)] light:hover:border-gray-700 light:hover:bg-gray-800 ${focusRing}`;

/** Base card surface (no hover). */
export const cardStatic = `rounded-2xl border border-white/[0.07] bg-gradient-to-b from-atlas-raised/90 to-atlas-surface/80 shadow-card light:rounded-[1.25rem] light:border-gray-700 light:from-paper light:to-paper ${lightCardShadow}`;

/**
 * Card with the premium hover: cursor spotlight wash, glowing edge, lift and deeper shadow
 * (see .spotlight in styles.css). Keeps the default cursor, so content cards don't read as links.
 * Put data-spotlight-group on the grid so neighbouring cards' edges catch the light too.
 */
export const cardHover = `${cardStatic} spotlight light:hover:border-brand-line light:hover:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-18px_rgba(16,24,40,0.16)]`;

/** Card that is itself a link or button: the same hover plus a keyboard focus ring. */
export const cardInteractive = `${cardHover} ${focusRing}`;

/** Text input / select / textarea on the public site. */
export const fieldInput =
  'w-full rounded-xl border border-white/10 bg-atlas-dark/80 px-4 py-3.5 text-white placeholder-gray-500 outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-white/20 focus-visible:border-emerald-400/70 focus-visible:bg-atlas-dark focus-visible:shadow-[0_0_0_4px_rgba(16,185,129,0.12)] light:border-field-line/70 light:bg-paper light:hover:border-field-line light:focus-visible:border-atlas-primary light:focus-visible:shadow-[0_0_0_4px_rgba(21,128,90,0.14)]';

/** Small uppercase label above a section title ("Programs", "Contact", "We are hiring"). */
export const eyebrowChip =
  'inline-flex items-center gap-2 rounded-full border border-atlas-primary/25 bg-atlas-primary/[0.08] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-atlas-primary light:border-brand-line light:bg-brand-pale light:text-brand-deep brand:border-white/25 brand:bg-white/10 brand:text-white';
/** The pulsing dot inside an eyebrow chip. */
export const eyebrowDot = 'h-1.5 w-1.5 rounded-full bg-atlas-primary shadow-[0_0_8px_rgba(16,185,129,0.9)] light:shadow-none brand:bg-white brand:shadow-none';

/** Icon tile on a card: a soft mint tile with a deep emerald icon in the light theme. */
export const iconWell =
  'border border-atlas-primary/20 bg-atlas-primary/10 text-atlas-primary light:border-transparent light:bg-brand-pale light:text-brand-deep';

/**
 * Light-theme accent families, drawn from the hero's pastel palette, so each card or section can
 * carry its own colour identity: `card` (tinted wash + border), `tile` (solid icon tile, white
 * icon), `text` (accent text, AA on white), `bar` (small rules and check marks).
 * Important (!) so they override the shared card / tile light styles they sit on.
 */
export const lightAccent = {
  emerald: {
    card: 'light:!bg-[linear-gradient(180deg,#e7f7ef_0%,#ffffff_48%)] light:!border-[#cdeedc] light:hover:!border-[#9fdcbd]',
    tile: 'light:!border-transparent light:!bg-[linear-gradient(135deg,#14a374,#0b6b4b)] light:!text-white light:!shadow-[0_10px_20px_-8px_rgba(15,122,85,0.55)]',
    text: 'light:!text-[#0b5e42]',
    bar: 'light:!bg-[#0f7a55] light:!text-[#0f7a55]',
  },
  sky: {
    card: 'light:!bg-[linear-gradient(180deg,#e6f2fc_0%,#ffffff_48%)] light:!border-[#cfe3f6] light:hover:!border-[#a6cdf0]',
    tile: 'light:!border-transparent light:!bg-[linear-gradient(135deg,#1f8fd6,#0b5c94)] light:!text-white light:!shadow-[0_10px_20px_-8px_rgba(11,106,168,0.5)]',
    text: 'light:!text-[#0a5a8f]',
    bar: 'light:!bg-[#0b6aa8] light:!text-[#0b6aa8]',
  },
  violet: {
    card: 'light:!bg-[linear-gradient(180deg,#efebfd_0%,#ffffff_48%)] light:!border-[#e0d9f8] light:hover:!border-[#c7b9f2]',
    tile: 'light:!border-transparent light:!bg-[linear-gradient(135deg,#7357e6,#4a31a8)] light:!text-white light:!shadow-[0_10px_20px_-8px_rgba(91,63,196,0.5)]',
    text: 'light:!text-[#4a31a8]',
    bar: 'light:!bg-[#5b3fc4] light:!text-[#5b3fc4]',
  },
  amber: {
    card: 'light:!bg-[linear-gradient(180deg,#fef3e2_0%,#ffffff_48%)] light:!border-[#f6dcb6] light:hover:!border-[#efc07a]',
    tile: 'light:!border-transparent light:!bg-[linear-gradient(135deg,#d97706,#92400e)] light:!text-white light:!shadow-[0_10px_20px_-8px_rgba(180,83,9,0.5)]',
    text: 'light:!text-[#92400e]',
    bar: 'light:!bg-[#b45309] light:!text-[#b45309]',
  },
} as const;
export type LightAccent = (typeof lightAccent)[keyof typeof lightAccent];
