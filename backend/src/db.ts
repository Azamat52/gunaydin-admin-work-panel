// @ts-nocheck
// PostgreSQL connection. Set DATABASE_URL in .env (postgres://user:pass@host:5432/dbname).
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL .env faylida yozilmagan (masalan: postgres://user:parol@localhost:5432/gunaydin)');
  process.exit(1);
}
const ssl = process.env.DATABASE_SSL === 'true' || /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined;
export const pool = new pg.Pool({ connectionString: url, ssl });

/** Creates tables on first run. */
export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, category TEXT NOT NULL, price INTEGER NOT NULL,
      available BOOLEAN NOT NULL DEFAULT true, sort INTEGER NOT NULL DEFAULT 0, data JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS promotions (
      id TEXT PRIMARY KEY, active BOOLEAN NOT NULL DEFAULT true, sort INTEGER NOT NULL DEFAULT 0, data JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, user_id BIGINT NOT NULL, status TEXT, total INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), data JSONB NOT NULL);
    CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id);
    CREATE TABLE IF NOT EXISTS customers (
      user_id BIGINT PRIMARY KEY, first_name TEXT, lang TEXT, data JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
      sort INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
    CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value JSONB NOT NULL);
  `);
}
