import { newPublicCode, slugMatchesName } from './store-address.js';

describe('store address', () => {
  it('keeps the address while it still matches the name', () => {
    expect(slugMatchesName('boutique-maria', 'Boutique María')).toBe(true);
    expect(slugMatchesName('boutique-maria-x3k9', 'Boutique María')).toBe(true);
    expect(slugMatchesName('borrame', 'Borrame esta')).toBe(false);
    expect(slugMatchesName('boutique-maria-de-la-paz', 'Boutique María')).toBe(false);
  });

  it('creates permanent codes', () => {
    expect(newPublicCode()).toMatch(/^modaflow-[a-z0-9]{7}$/);
    expect(newPublicCode()).not.toBe(newPublicCode());
  });
});
