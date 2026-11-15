import { normalizeWhatsapp, slugify } from './store-fields.js';

describe('normalizeWhatsapp', () => {
  it.each([
    ['71234567', '+59171234567'],
    ['7123 4567', '+59171234567'],
    ['612-34-567', '+59161234567'],
    ['59171234567', '+59171234567'],
    ['+591 71234567', '+59171234567'],
    ['+54 9 11 2345 6789', '+5491123456789'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeWhatsapp(input)).toBe(expected);
  });

  it.each(['1234', '81234567', 'abc', '+0123456789', '', '+59171234567890123'])('rejects %s', (input) => {
    expect(normalizeWhatsapp(input)).toBeNull();
  });
});

describe('slugify', () => {
  it('removes accents and symbols', () => {
    expect(slugify('Mio Shop — Moda Ñandú!')).toBe('mio-shop-moda-nandu');
  });

  it('falls back when nothing usable remains', () => {
    expect(slugify('¡¡¡')).toBe('tienda');
  });
});
