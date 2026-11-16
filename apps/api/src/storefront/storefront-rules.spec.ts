import { formatBs, orderMessage, productSlug, storeSlugProblem, toSlug, whatsappUrl } from './storefront-rules.js';

describe('storefront rules', () => {
  it('validates public store slugs', () => {
    expect(storeSlugProblem('mioshop')).toBeNull();
    expect(storeSlugProblem('boutique-maria-2')).toBeNull();
    expect(storeSlugProblem('Mio Shop')).toBe('format');
    expect(storeSlugProblem('mio--shop')).toBe('format');
    expect(storeSlugProblem('-mio')).toBe('format');
    expect(storeSlugProblem('moda_bella')).toBe('format');
    expect(storeSlugProblem('ñandu')).toBe('format');
    expect(storeSlugProblem('ab')).toBe('length');
    expect(storeSlugProblem('dashboard')).toBe('reserved');
    expect(storeSlugProblem('tienda')).toBe('reserved');
    expect(storeSlugProblem('login')).toBe('reserved');
    expect(storeSlugProblem('ventas')).toBe('reserved');
  });

  it('builds product slugs from name and SKU', () => {
    expect(toSlug('Blusa Rosa Ñandú — talla M')).toBe('blusa-rosa-nandu-talla-m');
    expect(productSlug('Blusa roja de manga larga', 'P00012')).toBe('blusa-roja-de-manga-larga-p00012');
    expect(productSlug('¡¡¡', 'P1')).toBe('prenda-p1');
  });

  it('formats amounts in bolivianos', () => {
    expect(formatBs('85.00')).toBe('Bs 85');
    expect(formatBs('1205.50')).toBe('Bs 1.205,50');
  });

  it('prepares the WhatsApp order message', () => {
    const text = orderMessage(
      'MioShop',
      null,
      [
        { name: 'Blusa roja', size: 'M', color: null, quantity: 1, lineTotal: '85.00' },
        { name: 'Pantalón negro', size: '38', color: 'Negro', quantity: 2, lineTotal: '240.00' },
      ],
      '325.00',
      'ABC234',
    );
    expect(text).toBe(
      [
        'Hola, quiero consultar por estas prendas de MioShop:',
        '',
        '1. Blusa roja — Talla M — 1 unidad — Bs 85',
        '2. Pantalón negro — Talla 38 · Negro — 2 unidades — Bs 240',
        '',
        'Total referencial: Bs 325.',
        '',
        '¿Están disponibles?',
        '(Consulta ABC234)',
      ].join('\n'),
    );
    expect(orderMessage('X', 'Hola, me interesa:', [], '0.00', 'C').startsWith('Hola, me interesa:')).toBe(true);
  });

  it('creates wa.me links with the store number and encoded text', () => {
    expect(whatsappUrl('+59171234567', 'Hola ¿Están?')).toBe('https://wa.me/59171234567?text=Hola%20%C2%BFEst%C3%A1n%3F');
  });
});
