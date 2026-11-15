import { createHash, randomBytes } from 'node:crypto';

/** Cryptographically random, URL-safe token (256 bits by default). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 hex digest. Tokens are stored hashed so a DB leak cannot be replayed. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
