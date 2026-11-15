/** Trims and collapses inner whitespace: "  Manga   larga " -> "Manga larga". */
export function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Key used to detect duplicates regardless of case, accents and spacing:
 * " Blúsas  " and "blusas" -> "blusas".
 */
export function normalizeKey(value: string): string {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Display name with an upper-case first letter: "blusas" -> "Blusas". */
export function displayName(value: string): string {
  const cleaned = cleanText(value);
  return cleaned.charAt(0).toLocaleUpperCase('es') + cleaned.slice(1);
}

/** Unique, cleaned list of tags (case/accent-insensitive), keeping the first spelling. */
export function uniqueTags(values: string[], max = 20): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const cleaned = cleanText(raw).toLocaleLowerCase('es').slice(0, 40);
    const key = normalizeKey(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= max) break;
  }
  return out;
}
