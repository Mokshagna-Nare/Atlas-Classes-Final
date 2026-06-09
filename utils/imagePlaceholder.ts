/**
 * Utility: Replace placeholder tokens like [[IMG_0]], [[IMG_1]] with inline img tags
 * @param text - Text containing placeholders like "The equation is [[IMG_0]] and slope is [[IMG_1]]"
 * @param inlineImages - Array of image URLs in order: ["url1", "url2", ...]
 * @returns HTML string with inline images
 */
export function replacePlaceholdersWithImages(
  text: string,
  inlineImages?: string[]
): string {
  if (!text || !inlineImages || inlineImages.length === 0) {
    return text;
  }

  let result = text;
  // Replace each placeholder with an inline img tag
  inlineImages.forEach((url, index) => {
    const placeholder = `[[IMG_${index}]]`;
    const imgTag = `<img src="${url}" class="inline-math" alt="formula" />`;
    result = result.replace(new RegExp(`\\[\\[IMG_${index}\\]\\]`, 'g'), imgTag);
  });

  return result;
}
