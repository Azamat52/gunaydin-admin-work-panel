// @ts-nocheck
// Admin login/parol va sessiyalar PostgreSQL da saqlanadi (env yoki localStorage da emas).
import crypto from 'crypto';
import { pool } from './db.js';

function hash(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function verify(password: string, stored: string) {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(password, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function migrateAuth() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY, login TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY, admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL);
  `);
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM admins`);
  if (rows[0].n === 0) {
    // Prefer explicit deployment credentials. Legacy settings are kept as a migration fallback.
    const m = await pool.query(`SELECT value FROM app_meta WHERE key = 'shopSettings'`).catch(() => ({ rows: [] }));
    const old = m.rows[0]?.value ?? {};
    const isProduction = process.env.NODE_ENV === 'production';
    const envLogin = process.env.ADMIN_LOGIN?.trim() || '';
    const envPassword = process.env.ADMIN_PASSWORD || '';
    if (isProduction && (envLogin || envPassword) && (!envLogin || envPassword.length < 12)) {
      throw new Error('Production uchun ADMIN_LOGIN va kamida 12 belgili ADMIN_PASSWORD birgalikda belgilang.');
    }
    if (isProduction && !envLogin && !envPassword && (!old.adminLogin || !old.adminPassword)) {
      throw new Error('Admin hali yaratilmagan. Birinchi ishga tushirishdan oldin ADMIN_LOGIN va kamida 12 belgili ADMIN_PASSWORD environment variablelarini belgilang.');
    }
    const login = String(envLogin || old.adminLogin || (isProduction ? '' : 'admin')).trim();
    const password = String(envPassword || old.adminPassword || (isProduction ? '' : 'admin123'));
    if (!login || !password) {
      throw new Error('Admin hali yaratilmagan. ADMIN_LOGIN va ADMIN_PASSWORD belgilang.');
    }
    await pool.query(`INSERT INTO admins (login, password_hash) VALUES ($1,$2)`, [login, hash(password)]);
    console.log(`Admin yaratildi: login "${login}". Xavfsizlik uchun kuchli, noyob parol ishlating.`);
  }
  await pool.query(`DELETE FROM admin_sessions WHERE expires_at < now()`);
}

/** Returns a session token on success, otherwise null. */
export async function login(loginName: string, password: string) {
  const { rows } = await pool.query(`SELECT id, password_hash FROM admins WHERE login = $1`, [String(loginName ?? '').trim()]);
  if (!rows[0] || !verify(String(password ?? ''), rows[0].password_hash)) return null;
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(`INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES ($1,$2, now() + interval '30 days')`, [token, rows[0].id]);
  return token;
}

/** Returns admin id for a valid token, otherwise null. */
export async function checkToken(token: string | undefined) {
  if (!token) return null;
  const { rows } = await pool.query(`SELECT admin_id FROM admin_sessions WHERE token = $1 AND expires_at > now()`, [token]);
  return rows[0]?.admin_id ?? null;
}

export async function logout(token: string | undefined) {
  if (token) await pool.query(`DELETE FROM admin_sessions WHERE token = $1`, [token]);
}

export async function getAdminLogin(adminId: number) {
  const { rows } = await pool.query(`SELECT login FROM admins WHERE id = $1`, [adminId]);
  return rows[0]?.login ?? '';
}

/** Updates login, and password only when a new one is given. Other sessions are signed out on password change. */
export async function updateAdmin(adminId: number, newLogin: string, newPassword: string, keepToken: string) {
  await pool.query(`UPDATE admins SET login = $1, updated_at = now() WHERE id = $2`, [newLogin, adminId]);
  if (newPassword) {
    await pool.query(`UPDATE admins SET password_hash = $1 WHERE id = $2`, [hash(newPassword), adminId]);
    await pool.query(`DELETE FROM admin_sessions WHERE admin_id = $1 AND token <> $2`, [adminId, keepToken]);
  }
}

export async function checkPassword(adminId: number, password: string) {
  const { rows } = await pool.query(`SELECT password_hash FROM admins WHERE id = $1`, [adminId]);
  return !!rows[0] && verify(String(password ?? ''), rows[0].password_hash);
}

export function bearer(h: string | undefined) {
  return String(h ?? '').replace(/^Bearer\s+/i, '') || undefined;
}
