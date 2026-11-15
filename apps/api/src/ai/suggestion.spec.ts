import type { GarmentSuggestion } from './garment-recognizer.js';
import { toSuggestionView } from './suggestion.js';

const base: GarmentSuggestion = {
  isGarment: true,
  name: '  Blusa roja  de manga larga ',
  description: 'Blusa roja.',
  garmentType: 'Blusa',
  category: 'BLÚSAS',
  mainColor: 'Rojo',
  secondaryColors: ['rojo', 'blanco', 'Blanco'],
  size: '',
  style: 'Casual',
  features: ['manga larga'],
  tags: ['Blusa', 'blusa', 'rojo'],
  message: '',
};

const categories = [
  { id: 'c1', name: 'Blusas' },
  { id: 'c2', name: 'Vestidos' },
];

describe('toSuggestionView', () => {
  it('cleans fields, deduplicates and maps the category to the store', () => {
    const view = toSuggestionView(base, categories);
    expect(view).toMatchObject({
      name: 'Blusa roja de manga larga',
      category: { id: 'c1', name: 'Blusas' },
      suggestedCategory: null,
      secondaryColors: ['Blanco'],
      size: null,
      tags: ['blusa', 'rojo'],
    });
  });

  it('keeps an unknown category as a suggestion instead of inventing an id', () => {
    const view = toSuggestionView({ ...base, category: 'Kimonos' }, categories);
    expect(view.category).toBeNull();
    expect(view.suggestedCategory).toBe('Kimonos');
  });

  it('keeps a size only when the model read one, and bounds long text', () => {
    const view = toSuggestionView({ ...base, size: 'M', name: 'x'.repeat(500) }, categories);
    expect(view.size).toBe('M');
    expect(view.name).toHaveLength(120);
  });
});
