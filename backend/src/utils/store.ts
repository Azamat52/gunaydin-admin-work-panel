// @ts-nocheck
// Same API as the original in-memory store, persisted to data.json.
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { pool, migrate } from '../db.js';
import { calcCart } from './promo.js';
import { Session, Lang, Order, OrderStatus, Product, Promotion } from '../types.js';

let sessions = new Map<number, Session>();
let globalOrders = new Map<string, Order>();
let orderSeq = 1000;
/** Daily working hours (Tashkent time), repeated automatically every day. */
export let workHours = { enabled: false, open: '09:00', close: '23:00' };
/** Admin login/password and payment card, editable from the admin Settings page. */
export let shopSettings = {
  cardNumber: '8600 1104 7384 7170',
  cardOwner: '',
};
export let products: Product[] = [];
/** Categories live in the PostgreSQL `categories` table (no built-in demo list). */
export let categories: { id: string; name: string; emoji: string; description: string; sort: number; active: boolean }[] = [];
export async function loadCategories() {
  const r = await pool.query(`SELECT id, name, emoji, description, sort, active FROM categories ORDER BY sort, created_at`);
  categories = r.rows;
}
export function categoryLabel(id: string) {
  const c = categories.find((x) => x.id === id);
  return c ? `${c.emoji ? c.emoji + ' ' : ''}${c.name}` : id;
}
export async function saveCategory(x: any) {
  const name = String(x?.name ?? '').trim().slice(0, 40);
  if (!name) return null;
  const id = String(x?.id || '').trim() || `cat_${Date.now().toString(36)}`;
  const emoji = String(x?.emoji ?? '').trim().slice(0, 8), description = String(x?.description ?? '').trim().slice(0, 300);
  const sort = Number.isFinite(Number(x?.sort)) ? Number(x.sort) : categories.length;
  const active = x?.active !== false;
  await pool.query(`INSERT INTO categories (id, name, emoji, description, sort, active) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emoji = EXCLUDED.emoji, description = EXCLUDED.description, sort = EXCLUDED.sort, active = EXCLUDED.active`,
    [id, name, emoji, description, sort, active]);
  await loadCategories();
  return id;
}
/** Bulk reorder: ids in new order. */
export async function reorderCategories(ids: string[]) {
  for (let i = 0; i < ids.length; i++) await pool.query(`UPDATE categories SET sort = $1 WHERE id = $2`, [i, String(ids[i])]);
  await loadCategories();
}
/** Refuses to delete a category that still has products. */
export async function deleteCategory(id: string) {
  if (products.some((p) => p.category === id)) return false;
  await pool.query(`DELETE FROM categories WHERE id = $1`, [id]);
  await loadCategories();
  return true;
}
export let promotions: Promotion[] = [];

/** Fires 'order' (order, kind) whenever an order is created or its status changes. */
export const events = new EventEmitter();

const DATA_FILE = process.env.DATA_FILE || path.join(process.cwd(), 'data.json');

function applyState(d: any) {
  products = d.products ?? [];
  promotions = d.promotions ?? [];
  orderSeq = d.orderSeq ?? 1000;
  if (d.workHours) workHours = { ...workHours, ...d.workHours };
  if (d.shopSettings) { const { adminLogin, adminPassword, ...rest } = d.shopSettings; shopSettings = { ...shopSettings, ...rest }; }
  globalOrders = new Map((d.orders ?? []).map((o: any) => [o.id, { ...o, createdAt: new Date(o.createdAt) }]));
  sessions = new Map();
  for (const x of d.sessions ?? []) {
    sessions.set(Number(x.userId), { productQty: 1, cart: [], ...x, userId: Number(x.userId), favorites: new Set(x.favorites ?? []), orders: [] });
  }
  for (const o of allOrders().reverse()) sessions.get(o.userId)?.orders.unshift(o);
  trackMsgs.clear();
  for (const [k, v] of d.trackMsgs ?? []) trackMsgs.set(k, v);
}

/** Loads everything from PostgreSQL. First run: imports old data.json if present, otherwise starts empty. */
export async function loadState() {
  await migrate();
  await loadCategories();
  const meta = await pool.query(`SELECT key, value FROM app_meta`);
  if (!meta.rows.some((r) => r.key === 'orderSeq')) {
    if (fs.existsSync(DATA_FILE)) {
      console.log('data.json topildi — PostgreSQL ga ko\'chirilmoqda...');
      applyState(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
    }
    await writeAll();
    return;
  }
  const m = Object.fromEntries(meta.rows.map((r) => [r.key, r.value]));
  const [pr, pm, or, cu] = await Promise.all([
    pool.query(`SELECT data FROM products ORDER BY sort`),
    pool.query(`SELECT data FROM promotions ORDER BY sort`),
    pool.query(`SELECT data FROM orders ORDER BY created_at`),
    pool.query(`SELECT data FROM customers`),
  ]);
  applyState({
    orderSeq: m.orderSeq, workHours: m.workHours, shopSettings: m.shopSettings, trackMsgs: m.trackMsgs,
    products: pr.rows.map((r) => r.data), promotions: pm.rows.map((r) => r.data),
    orders: or.rows.map((r) => r.data), sessions: cu.rows.map((r) => r.data),
  });
}

async function writeAll() {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('DELETE FROM products');
    for (const [i, p] of products.entries())
      await c.query(`INSERT INTO products (id, category, price, available, sort, data) VALUES ($1,$2,$3,$4,$5,$6)`,
        [p.id, p.category, Math.round(Number(p.price) || 0), p.available !== false, i, p]);
    await c.query('DELETE FROM promotions');
    for (const [i, p] of promotions.entries())
      await c.query(`INSERT INTO promotions (id, active, sort, data) VALUES ($1,$2,$3,$4)`, [p.id, !!p.active, i, p]);
    const ords = Array.from(globalOrders.values());
    await c.query(`DELETE FROM orders WHERE NOT (id = ANY($1::text[]))`, [ords.map((o) => o.id)]);
    for (const o of ords)
      await c.query(`INSERT INTO orders (id, user_id, status, total, created_at, data) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, total = EXCLUDED.total, data = EXCLUDED.data`,
        [o.id, o.userId, o.status ?? null, Math.round(Number(o.total) || 0), new Date(o.createdAt), JSON.stringify(o)]);
    for (const s of sessions.values()) {
      const d = { ...s, orders: undefined, favorites: Array.from(s.favorites ?? []) };
      await c.query(`INSERT INTO customers (user_id, first_name, lang, data) VALUES ($1,$2,$3,$4)
        ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, lang = EXCLUDED.lang, data = EXCLUDED.data`,
        [s.userId, s.firstName ?? null, s.lang ?? null, JSON.stringify(d)]);
    }
    const meta = { orderSeq, workHours, shopSettings, trackMsgs: Array.from(trackMsgs.entries()) };
    for (const [k, v] of Object.entries(meta))
      await c.query(`INSERT INTO app_meta (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [k, JSON.stringify(v)]);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// Saves are queued so writes never overlap; many quick changes collapse into one write.
let saving: Promise<void> = Promise.resolve();
let pending = false;
/** Writes the whole state to PostgreSQL (in the background). */
export function saveState() {
  if (pending) return saving;
  pending = true;
  saving = saving.then(async () => {
    pending = false;
    try { await writeAll(); } catch (e: any) {
      console.error('PostgreSQL ga saqlashda xato:', e);
      const full = ['53100', '53200', '54000'].includes(e?.code) || /ENOSPC|no space|disk full|quota/i.test(String(e?.message));
      events.emit('dbError', full ? 'Databaseda joy qolmadi! Maʼlumotlar saqlanmayapti.' : 'Databasega saqlashda xato: ' + (e?.message ?? e));
    }
  });
  return saving;
}

export function setPromotions(list: Promotion[]) { promotions = list; }

const TZ = '+05:00'; // Tashkent
/** Dates are "YYYY-MM-DD" (whole day) or "YYYY-MM-DDTHH:mm" (Tashkent time). */
export function promoStartMs(p: { startsAt?: string }) {
  if (!p.startsAt) return null;
  return Date.parse(p.startsAt.length <= 10 ? `${p.startsAt}T00:00:00${TZ}` : `${p.startsAt.slice(0, 16)}:00${TZ}`);
}
export function promoEndMs(p: { endsAt?: string }) {
  if (!p.endsAt) return null;
  return Date.parse(p.endsAt.length <= 10 ? `${p.endsAt}T23:59:59${TZ}` : `${p.endsAt.slice(0, 16)}:00${TZ}`);
}
/** Expired once its end moment has passed. */
export function isExpired(p: Promotion) { const e = promoEndMs(p); return e !== null && e <= Date.now(); }
/** Promotions the bot shows: active, started and not expired. */
export function visiblePromotions(): Promotion[] {
  const now = Date.now();
  return promotions.filter((p) => { const s = promoStartMs(p); return p.active && !isExpired(p) && (s === null || s <= now); });
}
/** Turns off expired promotions. Returns true if anything changed. */
export function expirePromotions(): boolean {
  let changed = false;
  for (const p of promotions) if (p.active && isExpired(p)) { p.active = false; dropExtraProducts(p); changed = true; }
  return changed;
}

// ── Sessions ─────────────────────────────────────────────────────────────────
export function getSession(userId: number, firstName = 'User'): Session {
  if (!sessions.has(userId)) {
    sessions.set(userId, { userId, lang: 'uz', firstName, cart: [], favorites: new Set(), orders: [], productQty: 1, joinedAt: new Date().toISOString() } as any);
  }
  const s = sessions.get(userId)!;
  if (firstName && firstName !== 'User') s.firstName = firstName;
  return s;
}
export function allSessions(): Session[] { return Array.from(sessions.values()); }

// ── Cart ─────────────────────────────────────────────────────────────────────
export function cartAdd(userId: number, product: Product, qty: number) {
  const s = getSession(userId);
  const existing = s.cart.find((c) => c.product.id === product.id);
  if (existing) existing.quantity += qty;
  else s.cart.push({ product, quantity: qty });
}
export function cartUpdate(userId: number, productId: string, qty: number) {
  const s = getSession(userId);
  if (qty <= 0) s.cart = s.cart.filter((c) => c.product.id !== productId);
  else { const item = s.cart.find((c) => c.product.id === productId); if (item) item.quantity = qty; }
}
export function cartClear(userId: number) { getSession(userId).cart = []; }
export function cartTotal(userId: number): number {
  return getSession(userId).cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
}
export function cartCount(userId: number): number {
  return getSession(userId).cart.reduce((s, i) => s + i.quantity, 0);
}

// ── Favorites ────────────────────────────────────────────────────────────────
export function toggleFavorite(userId: number, productId: string): boolean {
  const s = getSession(userId);
  if (s.favorites.has(productId)) { s.favorites.delete(productId); return false; }
  s.favorites.add(productId); return true;
}

// ── Orders ───────────────────────────────────────────────────────────────────
export function createOrder(userId: number, partial: Partial<Order>): Order {
  const s = getSession(userId);
  const calc = calcCart(s.cart, partial.deliveryType || 'delivery');
  const order: Order = {
    id: String(++orderSeq), userId, userName: s.firstName, items: [...s.cart, ...calc.gifts], subtotal: calc.subtotal,
    deliveryFee: calc.deliveryFee, discount: calc.discount,
    promotions: calc.applied.map((a) => ({ id: a.id, title: a.title.uz, badge: a.badge, amount: a.amount })),
    total: calc.total, status: partial.status || 'new', cancelReason: partial.cancelReason, deliveryType: partial.deliveryType || 'delivery',
    address: partial.address, location: partial.location, phone: partial.phone, paymentMethod: partial.paymentMethod, note: partial.note,
    receipt: partial.receipt,
    createdAt: new Date(),
  };
  globalOrders.set(order.id, order);
  s.orders.unshift(order);
  cartClear(userId);
  events.emit('order', order, 'created');
  return order;
}
export function getOrder(id: string): Order | undefined { return globalOrders.get(id); }
export function updateStatus(id: string, status: OrderStatus) {
  const o = globalOrders.get(id);
  if (o && o.status !== status) { o.status = status; events.emit('order', o, 'status'); }
}
export function cancelOrder(id: string, reason?: string) {
  const o = globalOrders.get(id);
  if (o && reason) o.cancelReason = reason;
  updateStatus(id, 'cancelled');
}
export function allOrders(): Order[] {
  return Array.from(globalOrders.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
export function allOrdersCount(): number { return globalOrders.size; }
export function totalRevenue(): number { return Array.from(globalOrders.values()).filter((o) => o.status === 'delivered' || o.status === 'picked_up').reduce((s, o) => s + o.total, 0); }

// ── Products ─────────────────────────────────────────────────────────────────
export function addProduct(p: Product) { products.push(p); }
export function updateProductPrice(id: string, newPrice: number) { const p = products.find((x) => x.id === id); if (p) p.price = newPrice; }
export function toggleProductAvailable(id: string): boolean {
  const p = products.find((x) => x.id === id);
  if (p) p.available = !p.available;
  return p?.available ?? false;
}
export function deleteProduct(id: string) { const i = products.findIndex((x) => x.id === id); if (i >= 0) products.splice(i, 1); }
/** Menu products first; promotion-only products resolve only while their promotion is visible. */
export function getProduct(id: string): Product | undefined {
  const p = products.find((x) => x.id === id);
  if (p) return p;
  for (const pr of visiblePromotions()) { const x = (pr.extraProducts ?? []).find((e) => e.id === id); if (x) return x; }
  return undefined;
}
/** Removes promotion-only products (and references to them) from a promotion. */
export function dropExtraProducts(p: Promotion) {
  const ids = new Set((p.extraProducts ?? []).map((e) => e.id));
  if (!ids.size) return;
  p.extraProducts = [];
  p.items = (p.items ?? []).filter((i) => !ids.has(i.productId));
  if (p.giftProductId && ids.has(p.giftProductId)) p.giftProductId = '';
}
export function getProductsByCategory(cat: string): Product[] {
  if (cat === 'special') return products.filter((p) => p.popular && p.available);
  return products.filter((p) => p.category === cat && p.available);
}

// ── Finalized orders & tracking messages ──────────────────────────────
export const FINAL_STATUSES: OrderStatus[] = ['cancelled', 'delivered', 'picked_up'];
export function isFinal(o?: { status: OrderStatus }): boolean { return !!o && FINAL_STATUSES.includes(o.status); }
// Status only moves forward: previous steps disappear once a later one is set.
const DELIVERY_FLOW: OrderStatus[] = ['new', 'received', 'preparing', 'on_way', 'delivered'];
const PICKUP_FLOW: OrderStatus[] = ['new', 'received', 'preparing', 'ready_pickup', 'picked_up'];
export function flowFor(o: { deliveryType?: string }): OrderStatus[] { return o.deliveryType === 'pickup' ? PICKUP_FLOW : DELIVERY_FLOW; }
export function nextStatuses(o: { status: OrderStatus; deliveryType?: string }): OrderStatus[] {
  if (isFinal(o)) return [];
  const flow = flowFor(o);
  if (o.status === 'new') return ['received'];
  return flow.slice(flow.indexOf(o.status) + 1);
}
export function canMoveTo(o: { status: OrderStatus; deliveryType?: string }, next: OrderStatus): boolean {
  if (isFinal(o)) return false;
  if (next === 'cancelled') return true;
  return nextStatuses(o).includes(next);
}
// orderId -> customer "track order" messages (refreshed live on every status change)
var trackMsgs = new Map<string, { chatId: number; msgId: number }[]>();
export function rememberTrackMsg(orderId: string, chatId: number, msgId: number) {
  const list = trackMsgs.get(orderId) ?? [];
  if (!list.some((m) => m.chatId === chatId && m.msgId === msgId)) list.push({ chatId, msgId });
  trackMsgs.set(orderId, list.slice(-3));
}
export function trackMsgsFor(orderId: string) { return trackMsgs.get(orderId) ?? []; }

export function setShopSettings(x: any) {
  const card = String(x?.cardNumber ?? '').replace(/\D/g, '');
  if (card.length !== 16) return false;
  shopSettings = { cardNumber: card.replace(/(\d{4})(?=\d)/g, '$1 '), cardOwner: String(x?.cardOwner ?? '').trim().slice(0, 60) };
  return true;
}
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
export function setWorkHours(h: any) {
  if (!HM.test(h?.open) || !HM.test(h?.close)) return false;
  workHours = { enabled: !!h.enabled, open: h.open, close: h.close };
  return true;
}
/** True when the shop is open now (Tashkent, UTC+5). Supports overnight hours like 18:00-03:00. */
export function isOpenNow(now = new Date()) {
  if (!workHours.enabled) return true;
  const t = new Date(now.getTime() + 5 * 3600_000);
  const m = t.getUTCHours() * 60 + t.getUTCMinutes();
  const toM = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
  const o = toM(workHours.open), c = toM(workHours.close);
  if (o === c) return true;
  return o < c ? m >= o && m < c : m >= o || m < c;
}
