import React from "react";

/**
 * Renders math marker strings as proper HTML.
 *
 * Markers produced by the parser:
 *   [SUP]x[/SUP]         → <sup> with readable font size
 *   [SUB]x[/SUB]         → <sub> with readable font size
 *   [FRAC]num[SEP]den[/FRAC] → stacked fraction with horizontal bar
 *
 * All other text is rendered as plain text spans.
 */

type MathNode =
  | { type: "text"; value: string }
  | { type: "sup"; value: string }
  | { type: "sub"; value: string }
  | { type: "frac"; num: string; den: string };

function tokenize(input: string): MathNode[] {
  const nodes: MathNode[] = [];
  let remaining = input;

  while (remaining.length > 0) {
    // Check for [FRAC]...[SEP]...[/FRAC]
    const fracMatch = remaining.match(/^\[FRAC\]([\s\S]*?)\[SEP\]([\s\S]*?)\[\/FRAC\]/);
    if (fracMatch) {
      nodes.push({ type: "frac", num: fracMatch[1], den: fracMatch[2] });
      remaining = remaining.slice(fracMatch[0].length);
      continue;
    }

    // Check for [SUP]...[/SUP]
    const supMatch = remaining.match(/^\[SUP\]([\s\S]*?)\[\/SUP\]/);
    if (supMatch) {
      nodes.push({ type: "sup", value: supMatch[1] });
      remaining = remaining.slice(supMatch[0].length);
      continue;
    }

    // Check for [SUB]...[/SUB]
    const subMatch = remaining.match(/^\[SUB\]([\s\S]*?)\[\/SUB\]/);
    if (subMatch) {
      nodes.push({ type: "sub", value: subMatch[1] });
      remaining = remaining.slice(subMatch[0].length);
      continue;
    }

    // Plain text up to next marker
    const nextMarker = remaining.search(/\[(?:SUP|SUB|FRAC)/);
    if (nextMarker === -1) {
      nodes.push({ type: "text", value: remaining });
      break;
    } else {
      nodes.push({ type: "text", value: remaining.slice(0, nextMarker) });
      remaining = remaining.slice(nextMarker);
    }
  }

  return nodes;
}

function renderNode(node: MathNode, key: number): React.ReactNode {
  if (node.type === "text") {
    return <span key={key}>{node.value}</span>;
  }

  if (node.type === "sup") {
    return (
      <sup
        key={key}
        style={{
          fontSize: "0.75em",
          lineHeight: 0,
          verticalAlign: "super",
          fontWeight: "inherit",
        }}
      >
        {node.value}
      </sup>
    );
  }

  if (node.type === "sub") {
    return (
      <sub
        key={key}
        style={{
          fontSize: "0.75em",
          lineHeight: 0,
          verticalAlign: "sub",
          fontWeight: "inherit",
        }}
      >
        {node.value}
      </sub>
    );
  }

  if (node.type === "frac") {
    // Recursively render num and den in case they have nested markers
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
          margin: "0 2px",
          fontSize: "0.92em",
          lineHeight: 1.2,
        }}
      >
        <span style={{ borderBottom: "1px solid currentColor", paddingBottom: "1px", paddingLeft: "2px", paddingRight: "2px" }}>
          {numNodes.map((n, i) => renderNode(n, i))}
        </span>
        <span style={{ paddingTop: "1px", paddingLeft: "2px", paddingRight: "2px" }}>
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
 * Renders a string containing math markers as properly formatted React elements.
 * Use this anywhere you display question text or option text.
 *
 * Usage:
 *   <MathText text={q.question} className="text-gray-200 font-medium" />
 */
export const MathText: React.FC<MathTextProps> = ({ text, className }) => {
  if (!text) return null;

  // Fast path: no markers present
  if (!text.includes("[SUP]") && !text.includes("[SUB]") && !text.includes("[FRAC]")) {
    return <span className={className}>{text}</span>;
  }

  const nodes = tokenize(text);
  return (
    <span className={className} style={{ lineHeight: 1.7 }}>
      {nodes.map((node, i) => renderNode(node, i))}
    </span>
  );
};

/** Returns true if the string contains any math markers */
export const hasMathMarkers = (text: string): boolean =>
  text.includes("[SUP]") || text.includes("[SUB]") || text.includes("[FRAC]");

/** Strips all markers and returns plain text (for search/duplicate checks) */
export const stripMathMarkers = (text: string): string =>
  text
    .replace(/\[FRAC\](.*?)\[SEP\](.*?)\[\/FRAC\]/gs, "($1/$2)")
    .replace(/\[SUP\](.*?)\[\/SUP\]/gs, "$1")
    .replace(/\[SUB\](.*?)\[\/SUB\]/gs, "$1");