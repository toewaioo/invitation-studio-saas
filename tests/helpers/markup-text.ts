const entities: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&nbsp;': '\u00a0',
};

/** Converts SSR markup to the text a reader sees, without changing whitespace. */
export function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#x27|#39|nbsp);/g, (entity) => entities[entity] ?? entity);
}

/** Returns the exact visible text of each rendered parent paragraph. */
export function renderedParentTexts(markup: string): string[] {
  return [...markup.matchAll(/<p class="traditional-parents">([\s\S]*?)<\/p>/g)].map(
    (match) => visibleText(match[1]),
  );
}
