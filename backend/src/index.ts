// GunAydin backend: Telegram bot (long polling) + REST API + Socket.IO for the admin panel.
import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { pool } from './db.js';

import { MiniBot } from './minibot.js';
import { registerHandlers } from './bot.js';
import * as store from './utils/store.js';
import * as auth from './auth.js';
import * as realtime from './realtime.js';
import * as kb from './utils/keyboards.js';
import { L } from './utils/i18n.js';
import type { OrderStatus } from './types.js';
import { RESTART_STAMP } from './restart-flag.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = Number(process.env.PORT || 4000);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
// Allowed panel origins: FRONTEND_URL (comma-separated, or "*") plus any localhost port.
const ALLOWED = FRONTEND_URL.split(',').map((x) => x.trim().replace(/\/$/, '')).filter(Boolean);
if (process.env.NODE_ENV === 'production') {
  const missing = ['BOT_TOKEN', 'DATABASE_URL', 'FRONTEND_URL']
    .filter((key) => !process.env[key]?.trim());
  const productionOrigins = FRONTEND_URL.split(',').map((x) => x.trim()).filter(Boolean);
  const invalidOrigins = productionOrigins.some((origin) => {
    if (origin === '*') return true;
    try {
      const parsed = new URL(origin);
      return parsed.protocol !== 'https:' || parsed.origin !== origin.replace(/\/$/, '');
    } catch {
      return true;
    }
  });
  if (missing.length || invalidOrigins) {
    console.error(`Production sozlamalari noto'g'ri. Yetishmayotgan qiymatlar: ${missing.join(', ') || 'FRONTEND_URL faqat aniq HTTPS origin bo‘lishi kerak (masalan https://panel.example.com)'}`);
    process.exit(1);
  }
}
function originOk(origin: string | undefined) {
  // Requests without Origin (e.g. health checks/server tools) are not browser CORS requests.
  if (!origin) return true;
  if (ALLOWED.includes('*') || ALLOWED.includes(origin)) return true;
  return process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
const corsOrigin = (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => cb(null, originOk(origin));
const corsOptions: cors.CorsOptions = {
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN .env faylida yozilmagan');
  process.exit(1);
}

await store.loadState();
await auth.migrateAuth();
console.log('PostgreSQL ga ulandi ✅');
if (store.expirePromotions()) store.saveState();

// ── Socket.IO ────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions, pingInterval: 10_000, pingTimeout: 5_000 });

io.use((socket, next) => {
  const { token } = (socket.handshake.auth ?? {}) as Record<string, string>;
  auth.checkToken(token).then((id) => (id ? next() : next(new Error('Unauthorized')))).catch(() => next(new Error('Unauthorized')));
});
io.on('connection', (socket) => {
  socket.emit('state', snapshot());
});

// Live users: Telegram accounts that interacted with the bot in the last 2 minutes.
const lastSeen = new Map<number, number>();
const LIVE_MS = 2 * 60_000;
function liveCount() {
  const now = Date.now();
  for (const [id, t] of lastSeen) if (now - t > LIVE_MS) lastSeen.delete(id);
  return lastSeen.size;
}
setInterval(() => io.emit('live', liveCount()), 10_000);
store.events.on('dbError', (msg: string) => io.emit('dbError', msg));

function snapshot() {
  const products = store.products;
  const promotions = store.promotions;
  const customers = store.allSessions().map((s) => ({
    userId: s.userId, name: s.firstName, lang: s.lang, phone: s.phone,
    joinedAt: (s as any).joinedAt ?? new Date().toISOString(),
  }));
  const orders = store.allOrders().map(serializeOrder);
  return { liveUsers: liveCount(), categories: store.categories, products, promotions, customers, orders, workHours: store.workHours, openNow: store.isOpenNow() };
}

function serializeOrder(o: any) {
  return {
    ...o,
    createdAt: new Date(o.createdAt).toISOString(),
    items: o.items.map((i: any) => ({
      productId: i.product.id, name: i.product.name.uz, emoji: i.product.emoji,
      price: i.product.price, quantity: i.quantity,
    })),
  };
}

/** Save to data.json and push the fresh state to every open panel. */
function commit() {
  store.saveState();
  io.emit('state', snapshot());
}

// ── Telegram bot (long polling) ─────────────────────────────────────────────
const bot = new MiniBot(BOT_TOKEN);
registerHandlers(bot);

// ── Live order sync ─────────────────────────────────────────────────────────
// Any order change (panel OR Telegram) is pushed instantly to every open panel
// and the customer's Telegram tracking card is redrawn.
store.events.on('order', (order: any, kind: 'created' | 'status') => {
  io.emit(kind === 'created' ? 'order:new' : 'order:updated', serializeOrder(order));
  commit();
  if (kind !== 'status') return;
  for (const m of store.trackMsgsFor(order.id)) {
    const lang = store.getSession(m.chatId).lang;
    bot.editMessageText(kb.trackText(lang, order), {
      chat_id: m.chatId, message_id: m.msgId, parse_mode: 'Markdown',
      reply_markup: kb.trackKeyboard(lang, order.id),
    }).catch(() => {});
  }
});

/** Outside working hours: customers get a "we're closed" message instead of the menu. */
async function closedReply(u: any) {
  if (store.isOpenNow()) return false;
  const from = u.message?.from ?? u.callback_query?.from;
  const chatId = u.message?.chat?.id ?? u.callback_query?.message?.chat?.id;
  if (!from || !chatId) return false;
  const lang = store.getSession(from.id).lang;
  const { open, close } = store.workHours;
  const text = `🕒 Kechirasiz, hozir ish vaqtimiz tugagan.\n\nBiz har kuni ${open} dan ${close} gacha faolmiz. Ish vaqtida kutib qolamiz!`;
  console.log(`🕒 Ish vaqti tashqarida so‘rov bloklandi: user ${from.id}`);
  if (u.callback_query) await bot.api('answerCallbackQuery', { callback_query_id: u.callback_query.id, text: text.split('\n')[0], show_alert: false }).catch(() => {});
  await bot.sendMessage(chatId, text).catch((e) => console.error('Yopiq xabari yuborilmadi:', e));
  return true;
}

// ── Restart (works with `npm run dev`: tsx watch reloads when restart-flag.ts changes) ──
const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const NOTIFY_FILE = path.join(SRC_DIR, '..', '.restart-notify.json');
let restarting = false;
const RESTART_TEXT = '⏳ Kechirasiz, bot qayta ishga tushirilmoqda. Iltimos, bir oz kutib turing...';

async function afterRestart() {
  let ids: number[] = [];

  // Render instances may restart with a fresh ephemeral filesystem. Keep the
  // production notification list in PostgreSQL so it survives the restart.
  if (process.env.NODE_ENV === 'production') {
    try {
      const result = await pool.query('SELECT value FROM app_meta WHERE key = $1', ['restartNotify']);
      ids = Array.isArray(result.rows[0]?.value) ? result.rows[0].value : [];
      await pool.query('DELETE FROM app_meta WHERE key = $1', ['restartNotify']);
    } catch (e) {
      console.error('Restart xabarlari PostgreSQL dan olinmadi:', e);
    }
  }

  // Keep the local development flow compatible with the file watcher.
  if (ids.length === 0 && fs.existsSync(NOTIFY_FILE)) {
    try { ids = JSON.parse(fs.readFileSync(NOTIFY_FILE, 'utf8')); } catch {}
    try { fs.unlinkSync(NOTIFY_FILE); } catch {}
  }
  if (ids.length === 0) return;

  console.log(`✅ Restart tugadi (${RESTART_STAMP}), ${ids.length} mijozga xabar yuborilmoqda`);
  for (const id of ids) {
    const lang = store.getSession(id).lang;
    await bot.sendMessage(id, '✅ Bot qayta ishga tushdi! Davom etishingiz mumkin.', { reply_markup: kb.mainMenu(lang) }).catch((e) => console.error(`Restart xabari ${id} ga yuborilmadi:`, e));
  }
}

async function poll() {
  await afterRestart();
  let offset = 0;
  await bot.api('deleteWebhook', {}).catch(() => {});
  console.log('🤖 Bot ishga tushdi');
  for (;;) {
    try {
      const updates = await bot.api('getUpdates', {
        offset, timeout: 30, allowed_updates: ['message', 'callback_query'],
      });
      for (const u of updates) {
        offset = u.update_id + 1;
        const fid = u.message?.from?.id ?? u.callback_query?.from?.id;
        if (restarting) {
          const cid = u.message?.chat?.id ?? u.callback_query?.message?.chat?.id;
          if (u.callback_query) await bot.api('answerCallbackQuery', { callback_query_id: u.callback_query.id, text: '⏳ Bot qayta ishga tushirilmoqda...' }).catch(() => {});
          if (cid) {
            await bot.sendMessage(cid, RESTART_TEXT, { reply_markup: { remove_keyboard: true } }).catch(() => {});
            notifyIds.add(cid);
          }
          continue;
        }
        if (fid) lastSeen.set(fid, Date.now());
        if (await closedReply(u)) continue;
        await bot.processUpdate(u);
        commit();
      }
    } catch (e) {
      console.error('Polling xatosi:', e);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// ── REST API ────────────────────────────────────────────────────────────────
// Keep CORS before JSON parsing, authentication middleware, and every API route.
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

// Render health checks can verify the HTTP process without exposing private data.
app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

app.post('/api/login', async (req, res) => {
  const { login, password } = req.body ?? {};
  const token = await auth.login(login, password).catch(() => null);
  res.json(token ? { ok: true, token } : { ok: false });
});

// Every route below requires a valid session token (Authorization: Bearer <token>).
app.use('/api', async (req, res, next) => {
  const token = auth.bearer(req.header('authorization'));
  const adminId = await auth.checkToken(token).catch(() => null);
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });
  res.locals.adminId = adminId; res.locals.token = token;
  next();
});

app.post('/api/logout', async (_req, res) => {
  await auth.logout(res.locals.token).catch(() => {});
  res.json({ ok: true });
});

app.get('/api/data', (_req, res) => res.json(snapshot()));

// Restart: save data, then exit — the process manager (pm2/systemd/hosting) starts the bot again.
const notifyIds = new Set<number>();
app.post('/api/restart', async (_req, res) => {
  if (restarting) return res.json({ ok: true });
  restarting = true;
  commit();
  res.json({ ok: true });
  console.log('🔄 Admin paneldan restart so‘raldi');
  // Warn recently active customers and hide their menu buttons until the bot is back.
  const now = Date.now();
  for (const [id, t] of lastSeen) if (now - t < 30 * 60_000) notifyIds.add(id);
  for (const id of notifyIds) {
    await bot.sendMessage(id, RESTART_TEXT, { reply_markup: { remove_keyboard: true } }).catch(() => {});
  }
  setTimeout(async () => {
    if (process.env.NODE_ENV === 'production') {
      // Persist notification recipients in PostgreSQL because Render's local
      // filesystem is not a reliable place to keep state across instance restarts.
      try {
        await pool.query(
          'INSERT INTO app_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
          ['restartNotify', JSON.stringify([...notifyIds])],
        );
      } catch (e) {
        console.error('Restart mijozlari PostgreSQL ga saqlanmadi:', e);
      }
      console.log('🔄 Production restart: exiting so Render can restart the service');
      process.exit(1);
      return;
    }
    fs.writeFileSync(NOTIFY_FILE, JSON.stringify([...notifyIds]));
    // `npm run dev` uses `tsx watch`, so touching the source flag reloads it.
    // But `npm start` runs compiled dist/index.js and has no watcher; changing
    // restart-flag.ts there leaves `restarting` true forever. In that case,
    // complete a safe in-process restart cycle instead of getting stuck.
    if (process.env.npm_lifecycle_event === 'start') {
      console.log('🔄 Local npm start: bot restart cycle is being completed without a process manager');
      restarting = false;
      for (const id of notifyIds) {
        const lang = store.getSession(id).lang;
        await bot.sendMessage(id, '✅ Bot qayta ishga tushdi! Davom etishingiz mumkin.', {
          reply_markup: kb.mainMenu(lang),
        }).catch(() => {});
      }
      notifyIds.clear();
      console.log('✅ Local restart tugadi');
      return;
    }

    // Local development: touching this file makes `tsx watch` reload the bot.
    fs.writeFileSync(path.join(SRC_DIR, 'restart-flag.ts'), `// Admin paneldan restart uchun. Qo'lda o'zgartirmang.\nexport const RESTART_STAMP = '${new Date().toISOString()}';\n`);
  }, 3000);
});

app.get('/api/settings/shop', async (_req, res) => res.json({ ...store.shopSettings, adminLogin: await auth.getAdminLogin(res.locals.adminId), adminPassword: '' }));
app.put('/api/settings/admin', async (req, res) => {
  const login = String(req.body?.adminLogin ?? '').trim(), pass = String(req.body?.adminPassword ?? ''), cur = String(req.body?.currentPassword ?? '');
  if (login.length < 3 || (pass && pass.length < 4)) return res.status(400).json({ error: 'Login (3+), yangi parol (4+) bo‘lsin' });
  if (!(await auth.checkPassword(res.locals.adminId, cur))) return res.status(400).json({ error: 'Joriy parol noto‘g‘ri' });
  try { await auth.updateAdmin(res.locals.adminId, login, pass, res.locals.token); }
  catch { return res.status(400).json({ error: 'Bu login band' }); }
  res.json({ ok: true, adminLogin: login });
});
app.put('/api/settings/shop', async (req, res) => {
  if (!store.setShopSettings(req.body)) return res.status(400).json({ error: '16 xonali karta raqamini kiriting' });
  commit();
  res.json({ ok: true, settings: { ...store.shopSettings } });
});

app.put('/api/settings/work-hours', (req, res) => {
  if (!store.setWorkHours(req.body)) return res.status(400).json({ error: 'Vaqt HH:MM formatida bo‘lishi kerak' });
  commit();
  res.json({ ok: true, workHours: store.workHours });
});

app.post('/api/categories/reorder', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 500) : [];
  await store.reorderCategories(ids);
  commit();
  res.json({ ok: true });
});
app.put('/api/categories/:id', async (req, res) => {
  const id = await store.saveCategory({ ...req.body, id: req.params.id === 'new' ? '' : req.params.id });
  if (!id) return res.status(400).json({ error: 'Kategoriya nomini kiriting' });
  commit();
  res.json({ ok: true, id });
});
app.delete('/api/categories/:id', async (req, res) => {
  if (!(await store.deleteCategory(req.params.id))) return res.status(400).json({ error: 'Avval bu kategoriyadagi mahsulotlarni o‘chiring yoki boshqa kategoriyaga o‘tkazing' });
  commit();
  res.json({ ok: true });
});

app.put('/api/products/:id', (req, res) => {
  const p = { ...req.body, id: req.params.id, popular: !!req.body.popular };
  const i = store.products.findIndex((x) => x.id === p.id);
  const before = i >= 0 ? { ...store.products[i] } : undefined;
  if (i >= 0) store.products[i] = p;
  else store.addProduct(p);
  realtime.productSaved(bot, before, p);
  commit();
  res.json({ ok: true });
});

app.delete('/api/products/:id', (req, res) => {
  store.deleteProduct(req.params.id);
  realtime.productDeleted();
  commit();
  res.json({ ok: true });
});

app.put('/api/promotions/:id', (req, res) => {
  const p = { ...req.body, id: req.params.id };
  if (p.startsAt && p.endsAt && (store.promoEndMs(p) ?? 0) <= (store.promoStartMs(p) ?? 0))
    return res.status(400).json({ error: 'endsAt must be after startsAt' });
  if (store.isExpired(p)) p.active = false;
  p.extraProducts = (Array.isArray(p.extraProducts) ? p.extraProducts : []).map((e: any) => {
    const name = String(e?.name?.uz ?? '').trim();
    return { id: String(e.id), category: String(e.category ?? ''), emoji: String(e.emoji || '🎁'), image: e.image || undefined, price: Math.max(0, Math.round(Number(e.price) || 0)), available: true, popular: false,
      name: { uz: name, ru: String(e?.name?.ru || name), en: String(e?.name?.en || name) }, description: { uz: '', ru: '', en: '' } };
  }).filter((e: any) => e.id && e.name.uz);
  // Promotion-only products disappear as soon as the promotion is turned off.
  if (!p.active) store.dropExtraProducts(p);
  const wasVisible = realtime.isPromotionVisible(p.id);
  const list = [...store.promotions];
  const i = list.findIndex((x) => x.id === p.id);
  if (i >= 0) list[i] = p;
  else list.push(p);
  store.setPromotions(list);
  realtime.promotionSaved(bot, wasVisible, p);
  realtime.syncCarts();
  commit();
  res.json({ ok: true });
});

app.delete('/api/promotions/:id', (req, res) => {
  store.setPromotions(store.promotions.filter((x) => x.id !== req.params.id));
  realtime.syncCarts();
  commit();
  res.json({ ok: true });
});

// Payment receipt (image or PDF) exactly as the customer sent it.
app.get('/api/orders/:id/receipt', async (req, res) => {
  const order = store.getOrder(req.params.id);
  const r = order?.receipt;
  if (!r) return res.status(404).json({ error: 'Receipt not found' });
  try {
    const buf = await bot.downloadFile(r.fileId);
    res.setHeader('Content-Type', r.mime);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buf);
  } catch (e) {
    console.error('receipt download failed:', e);
    res.status(502).json({ error: 'Receipt unavailable' });
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  const id = req.params.id;
  const status = req.body?.status as OrderStatus;
  const reason = String(req.body?.reason ?? '').trim().slice(0, 500);
  const order = store.getOrder(id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (store.isFinal(order))
    return res.status(409).json({ error: 'Order is finalized' });
  if (!store.canMoveTo(order, status))
    return res.status(409).json({ error: 'Status can only move forward' });
  if (status === 'cancelled' && !reason)
    return res.status(400).json({ error: 'Cancel reason is required' });
  if (status === 'cancelled') store.cancelOrder(id, reason);
  else store.updateStatus(id, status); // -> live sync to panels + Telegram messages
  const cl = L(store.getSession(order.userId).lang);
  const map: Partial<Record<OrderStatus, string>> = {
    received: cl.status_received_msg(id),
    preparing: cl.status_preparing_msg,
    on_way: cl.status_on_way_msg,
    delivered: cl.status_delivered_msg,
    ready_pickup: cl.status_ready_pickup_msg(id),
    picked_up: cl.status_picked_up_msg,
    cancelled: cl.status_cancelled_reason_msg(id, reason),
  };
  const text = map[status];
  if (text) {
    await bot.sendMessage(order.userId, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '📦 Kuzatish', callback_data: `track:${id}` }]] },
    }).catch((e) => console.error('Xabar yuborilmadi:', e));
  }
  res.json({ ok: true });
});

// Every minute: turn off promotions whose end date has passed.
setInterval(() => { if (store.expirePromotions()) { realtime.syncCarts(); commit(); } }, 60_000);

server.listen(PORT, () => {
  console.log(`🚀 Backend: http://localhost:${PORT}`);
  void poll();
});
