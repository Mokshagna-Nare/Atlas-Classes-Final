import { MCQ } from '../types';

/**
 * Gets the correct option index for an MCQ.
 * Checks answer_index first, then falls back to parsing answer as:
 * - A/B/C/D format (converts to 0-3)
 * - Numeric string (0-based)
 * - Exact text match against options
 */
export function getCorrectOptionIndex(mcq: MCQ): number | null {
  // First priority: use answer_index if it exists
  if (mcq.answer_index !== undefined && mcq.answer_index !== null) {
    return mcq.answer_index;
  }

  if (!mcq.answer) {
    return null;
  }

  // Parse answer as A/B/C/D format
  const upperAnswer = mcq.answer.trim().toUpperCase();
  if (/^[A-D]$/.test(upperAnswer)) {
    return upperAnswer.charCodeAt(0) - 'A'.charCodeAt(0); // A=0, B=1, C=2, D=3
  }

  // Parse as numeric string (0-based index)
  const numericAnswer = parseInt(mcq.answer.trim(), 10);
  if (!isNaN(numericAnswer) && numericAnswer >= 0 && numericAnswer < mcq.options.length) {
    return numericAnswer;
  }

  // Find exact text match in options
  const matchIndex = mcq.options.findIndex(
    (option) => option.toLowerCase() === mcq.answer.toLowerCase()
  );

  return matchIndex !== -1 ? matchIndex : null;
}

/**
 * Checks if the given option index is the correct answer for the MCQ.
 */
export function isCorrectOption(mcq: MCQ, index: number): boolean {
  const correctIndex = getCorrectOptionIndex(mcq);
  return correctIndex !== null && correctIndex === index;
}

/**
 * Gets the correct answer text for an MCQ.
 * Uses getCorrectOptionIndex to find the correct option and returns its text.
 * Falls back to the raw answer field if index lookup fails.
 */
export function getCorrectAnswerText(mcq: MCQ): string | null {
  const correctIndex = getCorrectOptionIndex(mcq);
  
  // If we found a valid index, return the option text at that position
  if (correctIndex !== null && mcq.options && mcq.options[correctIndex]) {
    return mcq.options[correctIndex];
  }
  
  // Fall back to raw answer field if it exists
  if (mcq.answer) {
    return mcq.answer;
  }
  
  return null;
}
