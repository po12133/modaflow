import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    fileParallelism: false,
    env: { BACKUP_ENCRYPTION_KEY: '0e2e'.repeat(16), BACKUP_DB_PASSWORD: '' },
  },
});
