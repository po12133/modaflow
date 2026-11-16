import { randomInt } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import { storeSlugProblem } from '../storefront/storefront-rules.js';
import { slugify } from './store-fields.js';

const CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

function randomChars(length: number): string {
  return Array.from({ length }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

export function newPublicCode(): string {
  return `modaflow-${randomChars(7)}`;
}

export function slugMatchesName(slug: string, name: string): boolean {
  const base = slugify(name);
  return slug === base || (slug.startsWith(`${base}-`) && /^[a-z0-9]{4,8}$/.test(slug.slice(base.length + 1)));
}

type StoreReader = Pick<Prisma.TransactionClient, 'store'>;

export async function slugForName(db: StoreReader, name: string, current: { id: string; slug: string }): Promise<string> {
  return slugMatchesName(current.slug, name) ? current.slug : freeStoreSlug(db, name, current.id);
}

export async function freeStoreSlug(db: StoreReader, name: string, storeId?: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 52)}-${randomChars(4)}`;
    if (storeSlugProblem(candidate)) continue;
    const owner = await db.store.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!owner || owner.id === storeId) return candidate;
  }
  return `tienda-${randomChars(10)}`;
}

export function slugRace() {
  return new AppError(HttpStatus.CONFLICT, 'SLUG_TAKEN', 'Otra tienda acaba de tomar esa dirección. Intenta guardar de nuevo.');
}
