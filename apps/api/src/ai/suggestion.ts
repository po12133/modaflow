import { cleanText, normalizeKey, uniqueTags } from '../common/text.js';
import type { GarmentSuggestion } from './garment-recognizer.js';

/** Suggestion returned to the web app (camelCase, bounded, category matched to the store). */
export interface SuggestionView {
  isGarment: boolean;
  name: string;
  description: string;
  garmentType: string;
  category: { id: string; name: string } | null;
  /** Category proposed by the AI that the store does not have yet (user may create it). */
  suggestedCategory: string | null;
  color: string;
  secondaryColors: string[];
  size: string | null;
  style: string;
  features: string[];
  tags: string[];
  message: string;
}

const clip = (value: string | null | undefined, max: number) => cleanText(value ?? '').slice(0, max);

/**
 * Sanitizes the model output before it reaches the form: trims and bounds
 * every field, deduplicates tags/colors and maps the category to an existing
 * store category. Values stay editable in the UI.
 */
export function toSuggestionView(
  s: GarmentSuggestion,
  categories: { id: string; name: string }[],
): SuggestionView {
  const categoryKey = normalizeKey(s.category ?? '');
  const match = categoryKey ? categories.find((c) => normalizeKey(c.name) === categoryKey) : undefined;
  const size = clip(s.size, 20);
  const mainColor = clip(s.mainColor, 40);
  const secondaryColors = uniqueTags(s.secondaryColors ?? [], 5)
    .map((c) => clip(c, 40))
    .filter((c) => normalizeKey(c) !== normalizeKey(mainColor));

  return {
    isGarment: Boolean(s.isGarment),
    name: clip(s.name, 120),
    description: clip(s.description, 500),
    garmentType: clip(s.garmentType, 60),
    category: match ? { id: match.id, name: match.name } : null,
    suggestedCategory: !match && categoryKey ? clip(s.category, 60) : null,
    color: mainColor,
    secondaryColors: secondaryColors.map((c) => c.charAt(0).toLocaleUpperCase('es') + c.slice(1)),
    size: size || null,
    style: clip(s.style, 60),
    features: uniqueTags(s.features ?? [], 10).map((f) => clip(f, 60)),
    tags: uniqueTags(s.tags ?? [], 12),
    message: clip(s.message, 300),
  };
}
