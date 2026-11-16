import pg from 'pg';

const ROLES = [
  ['modaflow_app', 'APP_DB_PASSWORD', true],
  ['modaflow_admin', 'ADMIN_DB_PASSWORD', true],
  ['modaflow_backup', 'BACKUP_DB_PASSWORD', false],
] as const;
const MIN_LENGTH = 16;

async function main() {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const production = process.env['NODE_ENV'] === 'production';
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    for (const [role, variable, required] of ROLES) {
      const password = process.env[variable];
      if (!password) {
        if (production && required) throw new Error(`${variable} is required in production`);
        console.warn(`${variable} is not set: ${role} keeps login disabled.`);
        continue;
      }
      if (password.length < MIN_LENGTH) throw new Error(`${variable} must have at least ${MIN_LENGTH} characters`);
      const { rows } = await client.query<{ sql: string }>('SELECT format($1, $2::text, $3::text) AS sql', [
        'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
        role,
        password,
      ]);
      await client.query(rows[0]!.sql);
      console.log(`Database role ${role} ready.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('[provision-db-roles] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
