import React from "react";

type MathNode =
  | { type: "text"; value: string }
  | { type: "sup"; value: string }
  | { type: "sub"; value: string }
  | { type: "frac"; num: string; den: string };

export function tokenize(input: string): MathNode[] {
  const nodes: MathNode[] = [];
  let remaining = input;

  while (remaining.length > 0) {
    const fracIdx = remaining.indexOf("[FRAC]");
    const supIdx = remaining.indexOf("[SUP]");
    const subIdx = remaining.indexOf("[SUB]");

    const firstIdx = Math.min(
      fracIdx === -1 ? Infinity : fracIdx,
      supIdx === -1 ? Infinity : supIdx,
      subIdx === -1 ? Infinity : subIdx
    );

    if (firstIdx === Infinity) {
      nodes.push({ type: "text", value: remaining });
      break;
    }

    if (firstIdx > 0) {
      nodes.push({ type: "text", value: remaining.slice(0, firstIdx) });
      remaining = remaining.slice(firstIdx);
      continue;
    }

    if (remaining.startsWith("[FRAC]")) {
      const sepIdx = remaining.indexOf("[SEP]");
      const endIdx = remaining.indexOf("[/FRAC]");
      if (sepIdx !== -1 && endIdx !== -1 && sepIdx < endIdx) {
        const num = remaining.slice(6, sepIdx);
        const den = remaining.slice(sepIdx + 5, endIdx);
        nodes.push({ type: "frac", num, den });
        remaining = remaining.slice(endIdx + 7);
        continue;
      }
    }

    if (remaining.startsWith("[SUP]")) {
      const endIdx = remaining.indexOf("[/SUP]");
      if (endIdx !== -1) {
        nodes.push({ type: "sup", value: remaining.slice(5, endIdx) });
        remaining = remaining.slice(endIdx + 6);
        continue;
      }
    }

    if (remaining.startsWith("[SUB]")) {
      const endIdx = remaining.indexOf("[/SUB]");
      if (endIdx !== -1) {
        nodes.push({ type: "sub", value: remaining.slice(5, endIdx) });
        remaining = remaining.slice(endIdx + 6);
        continue;
      }
    }

    // Malformed marker — treat as plain text
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
        }}
      >
        {/* Numerator — extra paddingTop prevents tall chars like √ from being clipped */}
        <span
          style={{
            borderBottom: "1.5px solid currentColor",
            paddingTop: "6px",        // ← KEY FIX: gives √ room above the bar
            paddingBottom: "2px",
            paddingLeft: "3px",
            paddingRight: "3px",
            textAlign: "center",
            overflow: "visible",      // ← prevents clipping of ascenders
            display: "block",
          }}
        >
          {numNodes.map((n, i) => renderNode(n, i))}
        </span>
        {/* Denominator */}
        <span
          style={{
            paddingTop: "2px",
            paddingBottom: "2px",
            paddingLeft: "3px",
            paddingRight: "3px",
            textAlign: "center",
            display: "block",
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

export const MathText: React.FC<MathTextProps> = ({ text, className }) => {
  if (!text) return null;

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

export const hasMathMarkers = (text: string): boolean =>
  Boolean(text) &&
  (text.includes("[SUP]") ||
    text.includes("[SUB]") ||
    text.includes("[FRAC]"));

export const stripMathMarkers = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/\[FRAC\](.*?)\[SEP\](.*?)\[\/FRAC\]/gs, "($1/$2)")
    .replace(/\[SUP\](.*?)\[\/SUP\]/gs, "$1")
    .replace(/\[SUB\](.*?)\[\/SUB\]/gs, "$1");
};