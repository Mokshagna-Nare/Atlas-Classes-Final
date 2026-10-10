import React from "react";

// Textbook-style maths for stored question text.
//
// Stored text carries markers written by the DOCX parser and the editors:
//   [FRAC]num[SEP]den[/FRAC]   stacked fraction
//   [SUP]x[/SUP], [SUB]x[/SUB] raised / lowered text
// and plain-text maths that is typeset on display:
//   √(…) or √2                 radical with a bar over the whole radicand
//   [SUP]3[/SUP]√(…)           nth root (the parser's output for OMML radicals with a degree)
//   ⋃ ⋂ ∑ ∏ followed by [SUB]/[SUP]   big operator with its limits above and below
//   [SUB]a[/SUB][SUP]b[/SUP]   limits stacked on the right (∫ₐᵇ, xᵢ²)
// Markers nest freely (a fraction inside a radical inside a fraction…).
// One parser feeds both outputs: React elements (MathText / RichMathText) and an HTML
// string (markersToHtml) for screens that render stored HTML.

type MathNode =
  | { type: "text"; value: string }
  | { type: "sup"; children: MathNode[] }
  | { type: "sub"; children: MathNode[] }
  | { type: "scripts"; sub: MathNode[]; sup: MathNode[] }
  | { type: "frac"; num: MathNode[]; den: MathNode[] }
  | { type: "sqrt"; children: MathNode[]; index?: MathNode[] }
  | { type: "op"; symbol: string; lower: MathNode[]; upper: MathNode[] };

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Index of the close tag matching an already-consumed open tag, honouring nesting. */
function findClose(s: string, from: number, open: string, close: string): number {
  let depth = 0;
  for (let i = from; i < s.length; i++) {
    if (s.startsWith(open, i)) depth++;
    else if (s.startsWith(close, i)) {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

/** Positions of the top-level [SEP] and the matching [/FRAC] for a fraction body starting at `from`. */
function findFracParts(s: string, from: number): { sep: number; end: number } | null {
  let depth = 0;
  let sep = -1;
  for (let i = from; i < s.length; i++) {
    if (s.startsWith("[FRAC]", i)) depth++;
    else if (s.startsWith("[/FRAC]", i)) {
      if (depth === 0) return sep === -1 ? null : { sep, end: i };
      depth--;
    } else if (depth === 0 && sep === -1 && s.startsWith("[SEP]", i)) sep = i;
  }
  return null;
}

function findMatchingParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")" && --depth === 0) return i;
  }
  return -1;
}

/** Radicand written without brackets: a number (√2, √13) or a single letter (√x). */
const BARE_RADICAND = /^(?:\d+(?:\.\d+)?|[A-Za-zα-ωΑ-Ω](?![A-Za-zα-ωΑ-Ω]))/;

const BIG_OPERATORS = new Set(["⋃", "⋂", "∑", "∏", "∪", "∩"]);
/** A binary ∪/∩ that carries limits is really the n-ary operator. */
const NARY_FORM: Record<string, string> = { "∪": "⋃", "∩": "⋂" };

const isEmpty = (nodes: MathNode[]) => nodes.every(n => n.type === "text" && !n.value.trim());

function parseRaw(s: string): MathNode[] {
  const nodes: MathNode[] = [];
  let buf = "";
  const flush = () => {
    if (buf) nodes.push({ type: "text", value: buf });
    buf = "";
  };

  let i = 0;
  while (i < s.length) {
    if (s.startsWith("[FRAC]", i)) {
      const parts = findFracParts(s, i + 6);
      if (parts) {
        flush();
        nodes.push({ type: "frac", num: parseRaw(s.slice(i + 6, parts.sep)), den: parseRaw(s.slice(parts.sep + 5, parts.end)) });
        i = parts.end + 7;
        continue;
      }
    }
    if (s.startsWith("[SUP]", i) || s.startsWith("[SUB]", i)) {
      const tag = s.slice(i + 1, i + 4); // SUP | SUB
      const end = findClose(s, i + 5, `[${tag}]`, `[/${tag}]`);
      if (end !== -1) {
        flush();
        nodes.push({ type: tag === "SUP" ? "sup" : "sub", children: parseRaw(s.slice(i + 5, end)) });
        i = end + 6;
        continue;
      }
    }
    if (s[i] === "√") {
      if (s[i + 1] === "(") {
        const close = findMatchingParen(s, i + 1);
        if (close !== -1) {
          flush();
          nodes.push({ type: "sqrt", children: parseRaw(s.slice(i + 2, close)) });
          i = close + 1;
          continue;
        }
      } else {
        const bare = BARE_RADICAND.exec(s.slice(i + 1));
        if (bare) {
          flush();
          nodes.push({ type: "sqrt", children: [{ type: "text", value: bare[0] }] });
          i += 1 + bare[0].length;
          continue;
        }
      }
    }
    buf += s[i];
    i++;
  }
  flush();
  return combine(nodes);
}

/** Second pass: groups neighbouring nodes into the structures they form together. */
function combine(nodes: MathNode[]): MathNode[] {
  const out: MathNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const next = nodes[i + 1];

    // [SUB]a[/SUB][SUP]b[/SUP] (either order) → limits stacked on the right.
    if ((node.type === "sub" && next?.type === "sup") || (node.type === "sup" && next?.type === "sub")) {
      const sub = node.type === "sub" ? node.children : (next as { children: MathNode[] }).children;
      const sup = node.type === "sup" ? node.children : (next as { children: MathNode[] }).children;
      i++;
      if (isEmpty(sub) && isEmpty(sup)) continue;
      out.push(isEmpty(sub) ? { type: "sup", children: sup } : isEmpty(sup) ? { type: "sub", children: sub } : { type: "scripts", sub, sup });
      continue;
    }

    // [SUP]3[/SUP]√(x) with nothing it could be the power of → cube root of x.
    if (node.type === "sup" && next?.type === "sqrt" && !next.index) {
      const prev = out[out.length - 1];
      const standalone = !prev || (prev.type === "text" && !/[\w)\]π]$/.test(prev.value));
      if (standalone && !isEmpty(node.children)) {
        out.push({ ...next, index: node.children });
        i++;
        continue;
      }
    }

    out.push(node);
  }

  // Big operator immediately followed by its limits: ⋃[SUB]n∈ℤ[/SUB].
  for (let i = 0; i < out.length - 1; i++) {
    const node = out[i];
    const limits = out[i + 1];
    if (node.type !== "text" || !(limits.type === "sub" || limits.type === "sup" || limits.type === "scripts")) continue;
    const symbol = node.value.slice(-1);
    if (!BIG_OPERATORS.has(symbol)) continue;
    const lower = limits.type === "sub" ? limits.children : limits.type === "scripts" ? limits.sub : [];
    const upper = limits.type === "sup" ? limits.children : limits.type === "scripts" ? limits.sup : [];
    const before = node.value.slice(0, -1);
    const op: MathNode = { type: "op", symbol: NARY_FORM[symbol] ?? symbol, lower, upper };
    out.splice(i, 2, ...(before ? [{ type: "text", value: before } as MathNode, op] : [op]));
  }
  return out;
}

const hasTypesetMath = (text: string) => /\[(?:FRAC|SUP|SUB)\]|√/.test(text);

// ---------------------------------------------------------------------------
// Layout (shared by the React and HTML outputs)
// ---------------------------------------------------------------------------

type Style = Record<string, string | number>;

/** Rule thickness for fraction bars and radical bars: thin like print, never under 1px. */
const RULE = "max(1px, 0.075em)";

const STYLES = {
  sup: { fontSize: "0.72em", lineHeight: 0, position: "relative", verticalAlign: "baseline", top: "-0.5em" },
  sub: { fontSize: "0.72em", lineHeight: 0, position: "relative", verticalAlign: "baseline", bottom: "-0.3em" },
  scripts: { display: "inline-flex", flexDirection: "column", fontSize: "0.72em", lineHeight: 1, verticalAlign: "0.6em", textAlign: "left", margin: "0 0.04em" },
  frac: { display: "inline-flex", flexDirection: "column", alignItems: "stretch", verticalAlign: "middle", textAlign: "center", fontSize: "0.9em", lineHeight: 1.25, margin: "0 0.18em" },
  num: { display: "block", padding: "0.12em 0.22em 0.05em", borderBottom: `${RULE} solid currentColor` },
  den: { display: "block", padding: "0.08em 0.22em 0" },
  sqrt: { display: "inline-block", position: "relative", padding: "0.14em 0.1em 0 0.64em", margin: "0 0.06em", lineHeight: 1.2, whiteSpace: "nowrap" },
  sqrtIndexed: { marginLeft: "0.32em" },
  sqrtSign: { position: "absolute", left: 0, top: 0, width: "0.64em", height: "100%", overflow: "visible" },
  sqrtBar: { position: "absolute", left: "0.62em", right: 0, top: 0, height: RULE, background: "currentColor" },
  sqrtIndex: { position: "absolute", left: "-0.3em", bottom: "48%", fontSize: "0.58em", lineHeight: 1 },
  op: { display: "inline-flex", flexDirection: "column", alignItems: "center", verticalAlign: "middle", lineHeight: 1, margin: "0 0.16em" },
  opSymbol: { fontSize: "1.45em", lineHeight: 1 },
  opLimit: { fontSize: "0.62em", lineHeight: 1.15, whiteSpace: "nowrap" },
} satisfies Record<string, Style>;

/** The √ hook, stretched to the radicand's height; its top-right corner meets the bar. */
const SIGN_PATH = "M0.4 11.6 L2.6 10.4 L5.4 19.6 L10 0.2";
const SIGN_STROKE = { strokeWidth: RULE } as Style;

// ---------------------------------------------------------------------------
// React output
// ---------------------------------------------------------------------------

const renderAll = (nodes: MathNode[]) => nodes.map((n, i) => renderNode(n, i));

function renderNode(node: MathNode, key: number): React.ReactNode {
  switch (node.type) {
    case "text":
      return <React.Fragment key={key}>{node.value}</React.Fragment>;
    case "sup":
      return <sup key={key} style={STYLES.sup as React.CSSProperties}>{renderAll(node.children)}</sup>;
    case "sub":
      return <sub key={key} style={STYLES.sub as React.CSSProperties}>{renderAll(node.children)}</sub>;
    case "scripts":
      return (
        <span key={key} style={STYLES.scripts as React.CSSProperties}>
          <span>{renderAll(node.sup)}</span>
          <span>{renderAll(node.sub)}</span>
        </span>
      );
    case "frac":
      return (
        <span key={key} style={STYLES.frac as React.CSSProperties}>
          <span style={STYLES.num as React.CSSProperties}>{renderAll(node.num)}</span>
          <span style={STYLES.den as React.CSSProperties}>{renderAll(node.den)}</span>
        </span>
      );
    case "sqrt":
      return (
        <span key={key} style={{ ...STYLES.sqrt, ...(node.index ? STYLES.sqrtIndexed : {}) } as React.CSSProperties}>
          {node.index && <span style={STYLES.sqrtIndex as React.CSSProperties}>{renderAll(node.index)}</span>}
          <svg style={STYLES.sqrtSign as React.CSSProperties} viewBox="0 0 10 20" preserveAspectRatio="none" aria-hidden="true">
            <path d={SIGN_PATH} fill="none" stroke="currentColor" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={SIGN_STROKE as React.CSSProperties} />
          </svg>
          <span style={STYLES.sqrtBar as React.CSSProperties} aria-hidden="true" />
          <span className="sr-only">√</span>
          {renderAll(node.children)}
        </span>
      );
    case "op":
      return (
        <span key={key} style={STYLES.op as React.CSSProperties}>
          {!isEmpty(node.upper) && <span style={STYLES.opLimit as React.CSSProperties}>{renderAll(node.upper)}</span>}
          <span style={STYLES.opSymbol as React.CSSProperties}>{node.symbol}</span>
          {!isEmpty(node.lower) && <span style={STYLES.opLimit as React.CSSProperties}>{renderAll(node.lower)}</span>}
        </span>
      );
  }
}

interface MathTextProps {
  text: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ text, className }) => {
  if (!text) return null;
  if (!hasTypesetMath(text)) return <span className={className}>{text}</span>;
  return (
    <span className={className} style={{ lineHeight: 1.8 }}>
      {renderAll(parseRaw(text))}
    </span>
  );
};

// ---------------------------------------------------------------------------
// HTML output (for content stored as HTML, e.g. tables and inline images)
// ---------------------------------------------------------------------------

const UNITLESS = new Set(["lineHeight", "opacity", "zIndex"]);
const css = (...styles: Style[]) =>
  Object.entries(Object.assign({}, ...styles) as Style)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}:${typeof v === "number" && v !== 0 && !UNITLESS.has(k) ? `${v}px` : v}`)
    .join(";");

const htmlAll = (nodes: MathNode[]): string => nodes.map(htmlNode).join("");

function htmlNode(node: MathNode): string {
  switch (node.type) {
    case "text":
      return node.value; // already HTML
    case "sup":
      return `<sup style="${css(STYLES.sup)}">${htmlAll(node.children)}</sup>`;
    case "sub":
      return `<sub style="${css(STYLES.sub)}">${htmlAll(node.children)}</sub>`;
    case "scripts":
      return `<span style="${css(STYLES.scripts)}"><span>${htmlAll(node.sup)}</span><span>${htmlAll(node.sub)}</span></span>`;
    case "frac":
      return `<span style="${css(STYLES.frac)}"><span style="${css(STYLES.num)}">${htmlAll(node.num)}</span><span style="${css(STYLES.den)}">${htmlAll(node.den)}</span></span>`;
    case "sqrt":
      return (
        `<span style="${css(STYLES.sqrt, node.index ? STYLES.sqrtIndexed : {})}">` +
        (node.index ? `<span style="${css(STYLES.sqrtIndex)}">${htmlAll(node.index)}</span>` : "") +
        `<svg style="${css(STYLES.sqrtSign)}" viewBox="0 0 10 20" preserveAspectRatio="none" aria-hidden="true"><path d="${SIGN_PATH}" fill="none" stroke="currentColor" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="${css(SIGN_STROKE)}"/></svg>` +
        `<span style="${css(STYLES.sqrtBar)}" aria-hidden="true"></span><span class="sr-only">√</span>${htmlAll(node.children)}</span>`
      );
    case "op":
      return (
        `<span style="${css(STYLES.op)}">` +
        (isEmpty(node.upper) ? "" : `<span style="${css(STYLES.opLimit)}">${htmlAll(node.upper)}</span>`) +
        `<span style="${css(STYLES.opSymbol)}">${node.symbol}</span>` +
        (isEmpty(node.lower) ? "" : `<span style="${css(STYLES.opLimit)}">${htmlAll(node.lower)}</span>`) +
        `</span>`
      );
  }
}

/** Same layout as MathText, as an HTML string for content stored as HTML. */
export const markersToHtml = (html: string): string => (html && hasTypesetMath(html) ? htmlAll(parseRaw(html)) : html);

// ---------------------------------------------------------------------------
// Plain text (PDF / Word export, short labels)
// ---------------------------------------------------------------------------

const SUPERSCRIPT: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "n": "ⁿ", "i": "ⁱ", "(": "⁽", ")": "⁾" };
const SUBSCRIPT: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "−": "₋", "(": "₍", ")": "₎" };

const toScript = (text: string, map: Record<string, string>, marker: string) =>
  text && [...text].every(c => c in map) ? [...text].map(c => map[c]).join("") : text ? `${marker}${group(text)}` : "";

/** Brackets a linearised piece only when it has more than one term: 2π, (2n+1)π and √(2) stay as they are. */
const group = (text: string) => (/^(?:[\w.π²³]|√?\([^()]*\))+$/u.test(text) ? text : `(${text})`);

const plainAll = (nodes: MathNode[]): string => nodes.map(plainNode).join("");

function plainNode(node: MathNode): string {
  switch (node.type) {
    case "text":
      return node.value;
    case "sup":
      return toScript(plainAll(node.children), SUPERSCRIPT, "^");
    case "sub":
      return toScript(plainAll(node.children), SUBSCRIPT, "_");
    case "scripts":
      return toScript(plainAll(node.sub), SUBSCRIPT, "_") + toScript(plainAll(node.sup), SUPERSCRIPT, "^");
    case "frac":
      return `${group(plainAll(node.num))}/${group(plainAll(node.den))}`;
    case "sqrt": {
      const index = node.index ? toScript(plainAll(node.index), SUPERSCRIPT, "^") : "";
      return `${index}√(${plainAll(node.children)})`;
    }
    case "op":
      return node.symbol + toScript(plainAll(node.lower), SUBSCRIPT, "_") + toScript(plainAll(node.upper), SUPERSCRIPT, "^");
  }
}

export const hasMathMarkers = (text: string): boolean => Boolean(text) && /\[(?:FRAC|SUP|SUB)\]/.test(text);

/** Linear text for places that can't typeset (PDF/Word export, dropdown labels): ½ → (1/2), x[SUP]2[/SUP] → x². */
export const stripMathMarkers = (text: string): string => (text ? plainAll(parseRaw(text)) : "");

// ---------------------------------------------------------------------------
// Entry point for stored question/option text
// ---------------------------------------------------------------------------

const looksLikeHtml = (text: string) => /<\/?[a-z][\s\S]*?>/i.test(text);

/**
 * Renders stored question/option text in textbook format: stacked fractions, radicals with a
 * bar over the radicand, raised/lowered text and big operators with limits.
 * Content saved as HTML (e.g. tables) keeps its markup; plain text is never parsed as HTML.
 */
export const RichMathText: React.FC<MathTextProps & { as?: "span" | "div" }> = ({ text, className, as = "span" }) => {
  if (!text) return null;
  if (looksLikeHtml(text)) {
    const Tag = as;
    return <Tag className={className} style={{ lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: markersToHtml(text) }} />;
  }
  if (as === "div") {
    return (
      <div className={className}>
        <MathText text={text} />
      </div>
    );
  }
  return <MathText text={text} className={className} />;
};
