import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { pgConnection } from './backup-format.js';

const run = promisify(execFile);
export const BACKUP_DB_ROLE = 'modaflow_backup';

export async function pgDumpVersion(): Promise<string> {
  const { stdout } = await run('pg_dump', ['--version']);
  return stdout.trim();
}

export async function pgDump(databaseUrl: string, password: string): Promise<Buffer> {
  const c = pgConnection(databaseUrl, BACKUP_DB_ROLE);
  const dir = await mkdtemp(join(tmpdir(), 'modaflow-backup-'));
  const file = join(dir, 'database.dump');
  try {
    await run('pg_dump', ['--format=custom', '--no-password', '-h', c.host, '-p', c.port, '-U', c.user, '-d', c.database, '-f', file], {
      env: { ...process.env, PGPASSWORD: password },
      maxBuffer: 16 * 1024 * 1024,
    });
    return await readFile(file);
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new Error(stderr ? stderr.split('\n').slice(-2).join(' ') : (error as Error).message);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
