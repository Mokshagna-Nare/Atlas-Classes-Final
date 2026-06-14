  import React from "react";

  import type { MCQ } from "../types";

  // =====================
  // Content helpers
  // =====================

  export const hasText = (v?: string | null) => !!String(v ?? "").trim();

  type McqLike = Pick<
    MCQ,
    | "question"
    | "imageUrl"
    | "inline_images"
    | "options"
    | "option_images"
    | "option_inline_images"
  > & { [k: string]: unknown };

  export const getQuestionImages = (row: McqLike): string[] => {
    const inline = Array.isArray(row.inline_images)
      ? (row.inline_images as unknown[]).filter((x): x is string => !!x && typeof x === "string")
      : [];

    if (inline.length > 0) return inline;
    return row.imageUrl ? [row.imageUrl as unknown as string].filter(Boolean) : [];
  };

  export const getOptionImages = (row: McqLike, idx: number): string[] => {
    const inlineImages = Array.isArray(row.option_inline_images)
      ? (row.option_inline_images as unknown[])
      : [];

    const inlineForIdx = Array.isArray(inlineImages[idx])
      ? (inlineImages[idx] as unknown[]).filter(
          (x): x is string => !!x && typeof x === "string"
        )
      : [];

    if (inlineForIdx.length > 0) return inlineForIdx;

    const optionImages = Array.isArray(row.option_images) ? row.option_images : [];
    const v = optionImages[idx];
    return v ? [v as unknown as string].filter(Boolean) : [];
  };

  export const hasQuestionContent = (row: McqLike) =>
    hasText(row.question as unknown as string) || getQuestionImages(row).length > 0;

  export const hasOptionContent = (row: McqLike, idx: number) =>
    hasText((row.options as unknown as string[] | undefined)?.[idx]) ||
    getOptionImages(row, idx).length > 0;

  export const validOptionCount = (row: McqLike) =>
    [0, 1, 2, 3].filter((i) => hasOptionContent(row, i)).length;

  // =====================
  // Rendering helpers
  // =====================

  const SAFE_MAX_WIDTH_PX = 520;
  const SAFE_MAX_HEIGHT_PX = 240;

  export function McqImageList({
    images,
    alt,
    className,
  }: {
    images: string[];
    alt: string;
    className?: string;
  }) {
    if (!images || images.length === 0) return null;

    return (
      <div className={className}>
        {images.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt={alt}
            loading="lazy"
            className="inline-block rounded border border-gray-700 bg-gray-900 p-1"
            style={{
              maxWidth: SAFE_MAX_WIDTH_PX,
              maxHeight: SAFE_MAX_HEIGHT_PX,
              width: "auto",
              height: "auto",
              objectFit: "contain",
              // Keep data-url images from inheriting odd background colors.
              backgroundColor: "transparent",
            }}
          />
        ))}
      </div>
    );
  }

