// @ts-nocheck
// Real promotion engine: calculates discounts for a cart. Rules mirror frontend/src/lib/promo-types.js.
import { CartItem, Lang, Promotion } from '../types.js';
import * as store from './store.js';

const round = (n: number) => Math.max(0, Math.round(n / 100) * 100);
const num = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export const FREE_DELIVERY_FROM = 150_000;
export const DELIVERY_FEE = 0; // yetkazish narxi yo'q — mijoz haydovchi bilan kelishadi

/** Current HH:MM in Tashkent. */
function nowHHMM(): string {
  return new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false });
}
function inHours(p: Promotion): boolean {
  const from = p.hoursFrom || '00:00', to = p.hoursTo || '23:59', t = nowHHMM();
  return from <= to ? t >= from && t <= to : t >= from || t <= to; // supports overnight (22:00–02:00)
}
/** Product ids the promo applies to; empty list = all products. */
const targets = (p: Promotion) => new Set((p.items ?? []).map((i) => i.productId));
const applies = (p: Promotion, productId: string) => { const t = targets(p); return t.size === 0 || t.has(productId); };

export interface AppliedPromo { id: string; emoji: string; title: Promotion['title']; badge: string; amount: number; note?: string }
export interface CartCalc {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  applied: AppliedPromo[];
  gifts: CartItem[];
  /** Per product id: discount amount on that line. */
  lineDiscount: Record<string, number>;
}

/** Per-line discount of an item-level promotion on one cart line. */
function lineDiscountFor(p: Promotion, item: CartItem): number {
  const price = item.product.price, qty = item.quantity, v = num(p.value);
  switch (p.type || 'percent') {
    case 'percent': case 'birthday': return (price - round(price * (1 - Math.min(v, 100) / 100))) * qty;
    case 'happy': return inHours(p) ? (price - round(price * (1 - Math.min(v, 100) / 100))) * qty : 0;
    case 'fixed': return Math.min(price, v) * qty;
    case 'bogo': {
      const buy = Math.max(1, num(p.buyQty, 1)), get = Math.max(1, num(p.getQty, 1));
      return Math.floor(qty / (buy + get)) * get * price;
    }
    case 'second': return Math.floor(qty / 2) * round(price * (Math.min(v, 100) / 100));
    default: return 0;
  }
}
const ITEM_TYPES = ['percent', 'happy', 'fixed', 'bogo', 'second', 'birthday'];

/** Tug'ilgan kun aksiyasi amal qiladigan kunlar: tug'ilgan kundan oldin/keyin shuncha kun. */
export const BIRTHDAY_WINDOW_DAYS = 3;
/** Mijozning tug'ilgan kuni bugun (± BIRTHDAY_WINDOW_DAYS) bo'lsa true. */
export function isBirthdayNow(birthday?: string): boolean {
  const m = birthday?.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
  today.setHours(0, 0, 0, 0);
  for (const y of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
    const b = new Date(y, +m[1] - 1, +m[2]);
    if (Math.abs(b.getTime() - today.getTime()) <= BIRTHDAY_WINDOW_DAYS * 86400000) return true;
  }
  return false;
}
/** Hozir faol tug'ilgan kun aksiyalari. */
export const birthdayPromos = () => store.visiblePromotions().filter((p) => p.type === 'birthday');

export function calcCart(cart: CartItem[], deliveryType: 'delivery' | 'pickup' = 'delivery', promos = store.visiblePromotions(), isBirthday = false): CartCalc {
  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const lineDiscount: Record<string, number> = {};
  const lineBy: Record<string, Promotion> = {};
  const applied = new Map<string, AppliedPromo>();
  const add = (p: Promotion, amount: number, note?: string) => {
    if (amount <= 0) return;
    const a = applied.get(p.id) ?? { id: p.id, emoji: p.emoji, title: p.title, badge: p.badge, amount: 0, note };
    a.amount += amount; applied.set(p.id, a);
  };
  const okMin = (p: Promotion, base: number) => base >= num(p.minOrder);

  // 1) Item promos: each line gets the single best promotion (no double discounts).
  for (const item of cart) {
    let best = 0, bestP: Promotion | undefined;
    for (const p of promos) {
      if (p.type === 'birthday' && !isBirthday) continue;
      if (!ITEM_TYPES.includes(p.type || 'percent') || !applies(p, item.product.id) || !okMin(p, subtotal)) continue;
      const d = Math.min(lineDiscountFor(p, item), item.product.price * item.quantity);
      if (d > best) { best = d; bestP = p; }
    }
    if (bestP) { lineDiscount[item.product.id] = best; lineBy[item.product.id] = bestP; add(bestP, best); }
  }

  // 2) Combo sets on lines that have no item discount: every full set costs setPrice.
  for (const p of promos.filter((x) => x.type === 'combo' && (x.items ?? []).length)) {
    const need = p.items.map((i) => ({ id: i.productId, qty: Math.max(1, num(i.qty, 1)) }));
    const lines = need.map((n) => cart.find((c) => c.product.id === n.id && !lineBy[n.id]));
    if (lines.some((l) => !l)) continue;
    const sets = Math.min(...need.map((n, i) => Math.floor(lines[i].quantity / n.qty)));
    if (sets < 1) continue;
    const full = need.reduce((s, n, i) => s + lines[i].product.price * n.qty, 0);
    const saved = (full - num(p.setPrice, full)) * sets;
    if (saved <= 0) continue;
    // spread the saving over the set lines so the cart can show it per product
    let left = saved;
    need.forEach((n, i) => {
      const part = i === need.length - 1 ? left : Math.round((saved * lines[i].product.price * n.qty) / full);
      left -= part;
      lineDiscount[n.id] = (lineDiscount[n.id] ?? 0) + part; lineBy[n.id] = p;
    });
    add(p, saved, `× ${sets}`);
  }

  const discount = Math.min(subtotal, Object.values(lineDiscount).reduce((s, d) => s + d, 0));
  const afterDiscount = subtotal - discount;

  // 3) Gift products
  const gifts: CartItem[] = [];
  for (const p of promos.filter((x) => x.type === 'gift' && x.giftProductId)) {
    const g = store.getProduct(p.giftProductId);
    if (g && afterDiscount >= num(p.minOrder)) {
      gifts.push({ product: { ...g, price: 0, name: { uz: `🎀 ${g.name.uz}`, ru: `🎀 ${g.name.ru}`, en: `🎀 ${g.name.en}` } }, quantity: 1 });
      add(p, g.price, 'gift');
    }
  }

  // 4) Delivery
  let deliveryFee = deliveryType === 'pickup' ? 0 : afterDiscount >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;
  if (deliveryFee > 0) {
    const fd = promos.find((x) => x.type === 'delivery' && afterDiscount >= num(x.minOrder));
    if (fd) { add(fd, deliveryFee, 'delivery'); deliveryFee = 0; }
  }

  return { subtotal, discount, deliveryFee, total: afterDiscount + deliveryFee, applied: Array.from(applied.values()), gifts, lineDiscount };
}

/** Human description of a promotion's rule. */
export function promoRule(p: Promotion, lang: Lang): string {
  const v = num(p.value);
  const sum = (n: any) => `${num(n).toLocaleString('ru-RU')} so'm`;
  const T = (uz: string, ..._r: string[]) => uz;
  switch (p.type || 'percent') {
    case 'percent': return T(`${v}% chegirma`, `Скидка ${v}%`, `${v}% off`);
    case 'fixed': return T(`Har biridan ${sum(v)} chegirma`, `Скидка ${sum(v)} на каждый`, `${sum(v)} off each`);
    case 'bogo': return T(`${p.buyQty || 1} ta olsangiz — ${p.getQty || 1} tasi bepul`, `Купи ${p.buyQty || 1} — ${p.getQty || 1} в подарок`, `Buy ${p.buyQty || 1}, get ${p.getQty || 1} free`);
    case 'second': return T(`Ikkinchisiga ${v}% chegirma`, `Второй со скидкой ${v}%`, `${v}% off the second one`);
    case 'combo': return T(`Set narxi: ${sum(p.setPrice)}`, `Цена сета: ${sum(p.setPrice)}`, `Set price: ${sum(p.setPrice)}`);
    case 'happy': return T(`${p.hoursFrom || '00:00'}–${p.hoursTo || '23:59'} da ${v}% chegirma`, `${p.hoursFrom || '00:00'}–${p.hoursTo || '23:59'} скидка ${v}%`, `${v}% off ${p.hoursFrom || '00:00'}–${p.hoursTo || '23:59'}`);
    case 'gift': { const g = store.getProduct(p.giftProductId); return T(`${sum(p.minOrder)} dan buyurtmaga ${g?.name.uz ?? "sovg'a"} bepul`, `От ${sum(p.minOrder)} — ${g?.name.ru ?? 'подарок'} бесплатно`, `${g?.name.en ?? 'Gift'} free from ${sum(p.minOrder)}`); }
    case 'delivery': return T(`${sum(p.minOrder)} dan yetkazish bepul`, `Бесплатная доставка от ${sum(p.minOrder)}`, `Free delivery from ${sum(p.minOrder)}`);
    case 'birthday': return T(`Tug'ilgan kun egasiga ${v}% chegirma`, `Именинникам ${v}%`, `${v}% birthday discount`);
    default: return '';
  }
}

/** Units needed to trigger the promo for one product (so "add to cart" gives the deal right away). */
export function triggerQty(p: Promotion, baseQty: number): number {
  if (p.type === 'bogo') return Math.max(baseQty, Math.max(1, num(p.buyQty, 1)) + Math.max(1, num(p.getQty, 1)));
  if (p.type === 'second') return Math.max(baseQty, 2);
  return baseQty;
}
