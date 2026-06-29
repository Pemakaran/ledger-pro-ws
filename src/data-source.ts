import { join } from 'path';
import { DataSource } from 'typeorm';

/**
 * Standalone TypeORM DataSource for the migration CLI and the prod release step.
 * Mirrors the runtime config in `common/database/database.module.ts` but reads
 * `process.env` directly (the CLI runs outside Nest) and never synchronizes — in
 * prod the schema is owned by migrations (dev keeps `DB_SYNC=true`). Env is
 * supplied by the container / prod secrets already on `process.env`.
 *
 * Globs use `{ts,js}` so the same file works under ts-node (dev, `src/`) and
 * compiled (prod, `dist/`).
 */
const isTrue = (value: unknown): boolean => value === true || value === 'true';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'chat',
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: isTrue(process.env.DB_LOGGING),
  ssl: isTrue(process.env.DB_SSL) ? { rejectUnauthorized: false } : false,
});
