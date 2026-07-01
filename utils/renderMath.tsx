import React from "react";

/**
 * Renders math marker strings as proper HTML elements.
 *
 * Markers from the parser:
 *   [SUP]x[/SUP]                     → <sup> styled for readability
 *   [SUB]x[/SUB]                     → <sub> styled for readability
 *   [FRAC]num[SEP]den[/FRAC]         → stacked fraction with horizontal bar
 *
 * Nested markers inside FRAC num/den are supported recursively.
 */

type MathNode =
  | { type: "text"; value: string }
  | { type: "sup"; value: string }
  | { type: "sub"; value: string }
  | { type: "frac"; num: string; den: string };

export function tokenize(input: string): MathNode[] {
  const nodes: MathNode[] = [];
  let remaining = input;

  while (remaining.length > 0) {
    // [FRAC]...[SEP]...[/FRAC] — must check before SUP/SUB
    const fracIdx = remaining.indexOf("[FRAC]");
    const supIdx = remaining.indexOf("[SUP]");
    const subIdx = remaining.indexOf("[SUB]");

    // Find which marker comes first
    const firstIdx = Math.min(
      fracIdx === -1 ? Infinity : fracIdx,
      supIdx === -1 ? Infinity : supIdx,
      subIdx === -1 ? Infinity : subIdx
    );

    if (firstIdx === Infinity) {
      // No more markers — rest is plain text
      nodes.push({ type: "text", value: remaining });
      break;
    }

    // Push any plain text before the first marker
    if (firstIdx > 0) {
      nodes.push({ type: "text", value: remaining.slice(0, firstIdx) });
      remaining = remaining.slice(firstIdx);
      continue;
    }

    // Now remaining starts with a marker
    if (remaining.startsWith("[FRAC]")) {
      const sepIdx = remaining.indexOf("[SEP]");
      const endIdx = remaining.indexOf("[/FRAC]");
      if (sepIdx !== -1 && endIdx !== -1 && sepIdx < endIdx) {
        const num = remaining.slice(6, sepIdx); // after [FRAC]
        const den = remaining.slice(sepIdx + 5, endIdx); // after [SEP]
        nodes.push({ type: "frac", num, den });
        remaining = remaining.slice(endIdx + 7); // after [/FRAC]
        continue;
      }
    }

    if (remaining.startsWith("[SUP]")) {
      const endIdx = remaining.indexOf("[/SUP]");
      if (endIdx !== -1) {
        const value = remaining.slice(5, endIdx); // after [SUP]
        nodes.push({ type: "sup", value });
        remaining = remaining.slice(endIdx + 6); // after [/SUP]
        continue;
      }
    }

    if (remaining.startsWith("[SUB]")) {
      const endIdx = remaining.indexOf("[/SUB]");
      if (endIdx !== -1) {
        const value = remaining.slice(5, endIdx); // after [SUB]
        nodes.push({ type: "sub", value });
        remaining = remaining.slice(endIdx + 6); // after [/SUB]
        continue;
      }
    }

    // Malformed marker — treat the bracket as plain text and move on
    nodes.push({ type: "text", value: remaining[0] });
    remaining = remaining.slice(1);
  }

  return nodes;
}

export function renderNode(node: MathNode, key: number): React.ReactNode {
  if (node.type === "text") {
    return <span key={key}>{node.value}</span>;
  }

  if (node.type === "sup") {
    // Recursively render — sup content may itself contain markers
    const inner = tokenize(node.value);
    return (
      <sup
        key={key}
        style={{
          fontSize: "0.72em",
          lineHeight: 0,
          position: "relative",
          verticalAlign: "baseline",
          top: "-0.5em",
          fontWeight: "inherit",
          letterSpacing: "inherit",
        }}
      >
        {inner.map((n, i) => renderNode(n, i))}
      </sup>
    );
  }

  if (node.type === "sub") {
    const inner = tokenize(node.value);
    return (
      <sub
        key={key}
        style={{
          fontSize: "0.72em",
          lineHeight: 0,
          position: "relative",
          verticalAlign: "baseline",
          bottom: "-0.3em",
          fontWeight: "inherit",
          letterSpacing: "inherit",
        }}
      >
        {inner.map((n, i) => renderNode(n, i))}
      </sub>
    );
  }

  if (node.type === "frac") {
    const numNodes = tokenize(node.num);
    const denNodes = tokenize(node.den);
    return (
      <span
        key={key}
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          verticalAlign: "middle",
          margin: "0 3px",
          fontSize: "0.9em",
          lineHeight: 1.3,
          gap: 0,
        }}
      >
        <span
          style={{
            borderBottom: "1.5px solid currentColor",
            paddingBottom: "2px",
            paddingLeft: "3px",
            paddingRight: "3px",
            textAlign: "center",
          }}
        >
          {numNodes.map((n, i) => renderNode(n, i))}
        </span>
        <span
          style={{
            paddingTop: "2px",
            paddingLeft: "3px",
            paddingRight: "3px",
            textAlign: "center",
          }}
        >
          {denNodes.map((n, i) => renderNode(n, i))}
        </span>
      </span>
    );
  }

  return null;
}

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Renders a string with math markers as properly formatted React elements.
 *
 * Usage:
 *   <MathText text={q.question} className="text-gray-200 font-medium" />
 *   <MathText text={option} />
 */
export const MathText: React.FC<MathTextProps> = ({ text, className }) => {
  if (!text) return null;

  // Fast path: no markers at all
  if (
    !text.includes("[SUP]") &&
    !text.includes("[SUB]") &&
    !text.includes("[FRAC]")
  ) {
    return <span className={className}>{text}</span>;
  }

  const nodes = tokenize(text);
  return (
    <span className={className} style={{ lineHeight: 1.8 }}>
      {nodes.map((node, i) => renderNode(node, i))}
    </span>
  );
};

/** Returns true if the string contains any math markers */
export const hasMathMarkers = (text: string): boolean =>
  Boolean(text) &&
  (text.includes("[SUP]") ||
    text.includes("[SUB]") ||
    text.includes("[FRAC]"));

/**
 * Strips all math markers and returns plain readable text.
 * Used for search, duplicate checks, select dropdowns etc.
 */
export const stripMathMarkers = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/\[FRAC\](.*?)\[SEP\](.*?)\[\/FRAC\]/gs, "($1/$2)")
    .replace(/\[SUP\](.*?)\[\/SUP\]/gs, "$1")
    .replace(/\[SUB\](.*?)\[\/SUB\]/gs, "$1");
};