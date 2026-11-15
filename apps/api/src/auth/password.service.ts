import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { generateToken } from '../common/crypto.js';

// Argon2id with OWASP-recommended minimum parameters (19 MiB, t=2, p=1).
// `algorithm: 2` is Algorithm.Argon2id (a const enum, not importable with isolatedModules).
const ARGON2ID_OPTIONS = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  /** Hash used to spend equivalent time when the user does not exist (anti user-enumeration). */
  private readonly dummyHash = hash(generateToken(), ARGON2ID_OPTIONS);

  hash(password: string): Promise<string> {
    return hash(password, ARGON2ID_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /** Runs a verification against a throwaway hash so timing does not reveal unknown emails. */
  async verifyDummy(password: string): Promise<void> {
    await this.verify(await this.dummyHash, password);
  }
}
