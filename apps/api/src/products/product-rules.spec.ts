import { cleanText, displayName, normalizeKey, uniqueTags } from '../common/text.js';
import { findDuplicateVariant, formatProductSku, isPositiveMoney, stockStatus, variantSkuSuffix } from './product-rules.js';

describe('stockStatus', () => {
  it('is out of stock at 0', () => expect(stockStatus(0, 2)).toBe('out_of_stock'));
  it('is low between 1 and the threshold', () => {
    expect(stockStatus(1, 2)).toBe('low_stock');
    expect(stockStatus(2, 2)).toBe('low_stock');
    expect(stockStatus(3, 2)).toBe('in_stock');
  });
  it('threshold 0 disables the low-stock alert (one-off garments)', () => expect(stockStatus(1, 0)).toBe('in_stock'));
});

describe('variants', () => {
  it('detects duplicated size/color ignoring case, accents and spaces', () => {
    expect(findDuplicateVariant([{ size: 'M', color: 'Rojo' }, { size: ' m ', color: 'rojo' }])).toBe(1);
    expect(findDuplicateVariant([{ size: 'M', color: 'Rojo' }, { size: 'M', color: 'Negro' }])).toBe(-1);
    expect(findDuplicateVariant([{ size: null }, { size: '' }])).toBe(1);
  });

  it('builds readable SKU suffixes', () => {
    expect(variantSkuSuffix('M', 'Azul marino')).toBe('M-AZULMARI');
    expect(variantSkuSuffix('Única', null)).toBe('UNICA');
    expect(variantSkuSuffix(null, null)).toBe('');
  });

  it('formats product SKUs', () => expect(formatProductSku(42)).toBe('P00042'));
});

describe('money', () => {
  it('requires a positive sale price', () => {
    expect(isPositiveMoney('69.50')).toBe(true);
    expect(isPositiveMoney('0')).toBe(false);
    expect(isPositiveMoney('0.00')).toBe(false);
  });
});

describe('text normalization', () => {
  it('normalizes keys for duplicate detection', () => {
    expect(normalizeKey('  Blúsas   Lindas ')).toBe('blusas lindas');
    expect(cleanText('  manga   larga ')).toBe('manga larga');
    expect(displayName('ropa  interior')).toBe('Ropa interior');
  });

  it('deduplicates tags keeping the first spelling', () => {
    expect(uniqueTags(['Casual', 'casual', ' Manga  larga', 'mánga larga', ''])).toEqual(['casual', 'manga larga']);
  });
});
