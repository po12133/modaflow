import pg from 'pg';
import { type DbRole, roleUrl } from './support/db.js';

async function as(role: DbRole, sql: string) {
  const client = new pg.Client({ connectionString: roleUrl(role) });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

const denied = /permission denied/;

describe('database roles enforce the separation between systems (e2e)', () => {
  it('subscriber API role cannot reach the admin schema', async () => {
    await expect(as('modaflow_app', 'SELECT 1 FROM admin.staff LIMIT 1')).rejects.toThrow(denied);
    await expect(as('modaflow_app', 'SELECT 1 FROM admin.audit_logs LIMIT 1')).rejects.toThrow(denied);
    await expect(as('modaflow_app', 'SELECT 1 FROM admin.staff_sessions LIMIT 1')).rejects.toThrow(denied);
    await expect(as('modaflow_app', 'SELECT 1 FROM _prisma_migrations LIMIT 1')).rejects.toThrow(denied);
  });

  it('subscriber API role cannot activate plans or rewrite billing', async () => {
    await expect(as('modaflow_app', "UPDATE subscriptions SET status = 'ACTIVE' WHERE false")).rejects.toThrow(denied);
    await expect(as('modaflow_app', 'UPDATE subscriptions SET current_period_end = now() WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_app', 'UPDATE plan_change_requests SET amount_confirmed = 1 WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_app', 'UPDATE plan_change_requests SET reviewed_by_id = NULL WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_app', 'DELETE FROM plan_change_requests WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_app', 'DELETE FROM subscription_periods WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_app', 'UPDATE subscription_history SET reason = NULL WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_app', 'UPDATE plans SET price_cents = 0 WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_app', 'UPDATE platform_settings SET trial_days = 90 WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_app', 'SELECT id FROM subscriptions LIMIT 1 FOR UPDATE')).resolves.toBeDefined();
  });

  it('admin API role cannot read subscriber secrets nor delete business or financial records', async () => {
    await expect(as('modaflow_admin', 'SELECT password_hash FROM users LIMIT 1')).rejects.toThrow(denied);
    await expect(as('modaflow_admin', 'SELECT * FROM users LIMIT 1')).rejects.toThrow(denied);
    await expect(as('modaflow_admin', 'SELECT token_hash FROM sessions LIMIT 1')).rejects.toThrow(denied);
    await expect(as('modaflow_admin', 'SELECT 1 FROM password_reset_tokens LIMIT 1')).rejects.toThrow(denied);
    await expect(as('modaflow_admin', 'UPDATE users SET password_hash = NULL WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_admin', 'DELETE FROM tenants WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_admin', 'DELETE FROM plan_change_requests WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_admin', 'DELETE FROM subscription_periods WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_admin', 'UPDATE sales SET total = 0 WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_admin', 'UPDATE admin.audit_logs SET reason = NULL WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_admin', 'DELETE FROM admin.staff WHERE false')).rejects.toThrow(denied);
    await expect(as('modaflow_admin', 'SELECT id, email, status FROM users LIMIT 1')).resolves.toBeDefined();
  });
});
