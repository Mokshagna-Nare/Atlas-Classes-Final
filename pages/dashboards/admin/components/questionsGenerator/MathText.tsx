import React from 'react';

// Shows the generator's math markup the way the Word file does:
// x^{2} / x^2 as superscript, H_{2}O / H_2 as subscript.
const TOKEN = /\^\{([^{}]*)\}|_\{([^{}]*)\}|\^(-?[A-Za-z0-9+]+)|_([A-Za-z0-9]+)/g;

const MathText: React.FC<{ text?: string | null; className?: string }> = ({ text, className }) => {
  const value = String(text ?? '');
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;

  while ((match = TOKEN.exec(value)) !== null) {
    if (match.index > last) parts.push(value.slice(last, match.index));
    const sup = match[1] ?? match[3];
    const sub = match[2] ?? match[4];
    parts.push(sup !== undefined ? <sup key={match.index}>{sup}</sup> : <sub key={match.index}>{sub}</sub>);
    last = match.index + match[0].length;
  }

  if (last < value.length) parts.push(value.slice(last));
  return <span className={`whitespace-pre-wrap ${className || ''}`}>{parts}</span>;
};

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '(': '⁽', ')': '⁾', n: 'ⁿ',
};
const SUBSCRIPT: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '(': '₍', ')': '₎',
};
const mapChars = (chars: string, table: Record<string, string>) => Array.from(chars).map((c) => table[c] ?? c).join('');

// Plain-text version for places that can't hold markup (dropdown options).
export const plainMath = (text?: string | null) =>
  String(text ?? '').replace(TOKEN, (_m, supBraced, subBraced, sup, sub) =>
    supBraced !== undefined || sup !== undefined
      ? mapChars(supBraced ?? sup, SUPERSCRIPT)
      : mapChars(subBraced ?? sub, SUBSCRIPT),
  );

export default MathText;
