import { spawnSync } from 'node:child_process';

// Only reset when clearly pointed at a test DB to avoid data loss on dev/prod DBs.
const url = process.env.DATABASE_URL || '';
const isTestDb = /_test(\b|\?|$)/i.test(url) || /schema=app_test/i.test(url);

if (!url) {
  // eslint-disable-next-line no-console
  console.warn('[tests/setup/db] DATABASE_URL not set; skipping DB reset.');
} else if (!isTestDb) {
  // eslint-disable-next-line no-console
  console.warn('[tests/setup/db] DATABASE_URL does not look like a test DB; skipping reset. URL=', url);
} else if (!(globalThis as any).__DB_RESET_DONE__) {
  // eslint-disable-next-line no-console
  console.log('[tests/setup/db] Resetting test database via: prisma db push --force-reset');
  const res = spawnSync('npx', ['prisma', 'db', 'push', '--force-reset', '--skip-generate'], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    // eslint-disable-next-line no-console
    console.error('[tests/setup/db] prisma db push failed');
    process.exit(res.status ?? 1);
  }
  (globalThis as any).__DB_RESET_DONE__ = true;
}
