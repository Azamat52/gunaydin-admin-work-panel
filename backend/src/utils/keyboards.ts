// @ts-nocheck

import { Lang, Order, OrderStatus, Product } from '../types.js';
import { L, price } from './i18n.js';
import * as store from './store.js';

type IKM = any;
type RKM = any;

export function mainMenu(lang: Lang): RKM {
  const l = L(lang);
  return { keyboard: [
    [{ text: l.btn_menu }, { text: l.btn_cart }],
    [{ text: l.btn_orders }, { text: l.btn_favorites }],
    [{ text: l.btn_promos }, { text: l.btn_delivery }],
    [{ text: l.btn_profile }, { text: l.btn_support }],
  ], resize_keyboard: true };
}



export function categories(lang: Lang): IKM {
  const l = L(lang);
  const rows = [];
  const cats = store.categories.filter((c) => c.active !== false);
  for (let i = 0; i < cats.length; i += 2) {
    rows.push(cats.slice(i, i + 2).map(({ id }) => {
      const n = store.getProductsByCategory(id).length;
      return { text: `${store.categoryLabel(id)}${n ? ` (${n})` : ''}`, callback_data: `cat:${id}` };
    }));
  }
  rows.push([{ text: l.btn_main_menu, callback_data: 'go:main' }]);
  return { inline_keyboard: rows };
}

export function productList(lang: Lang, cat: string): IKM {
  const products = store.getProductsByCategory(cat);
  const rows = products.map(p => [{
    text: `${p.emoji} ${p.name[lang]} — ${price(p.price, lang)}`,
    callback_data: `prod:${p.id}`,
  }]);
  rows.push([{ text: L(lang).btn_back, callback_data: 'go:categories' }]);
  return { inline_keyboard: rows };
}

export function productDetail(lang: Lang, product: Product, qty: number, isFav: boolean): IKM {
  const l = L(lang);
  return { inline_keyboard: [
    [
      { text: '➖', callback_data: `qty:minus:${product.id}` },
      { text: `${qty} ${'dona'}`, callback_data: 'noop' },
      { text: '➕', callback_data: `qty:plus:${product.id}` },
    ],
    [{ text: l.btn_add_cart, callback_data: `cart:add:${product.id}` }],
    [{ text: isFav ? l.btn_fav_remove : l.btn_fav_add, callback_data: `fav:toggle:${product.id}` }],
    [{ text: l.btn_back, callback_data: `go:back_cat` }],
  ]};
}

export function cartKeyboard(lang: Lang, items: { id: string; name: string }[]): IKM {
  const l = L(lang);
  const rows = items.map(i => ([
    { text: `➖`, callback_data: `cart:minus:${i.id}` },
    { text: `🗑 ${i.name}`, callback_data: `cart:remove:${i.id}` },
    { text: `➕`, callback_data: `cart:plus:${i.id}` },
  ]));
  rows.push([{ text: l.btn_checkout, callback_data: 'checkout:start' }]);
  rows.push([{ text: l.btn_clear_cart, callback_data: 'cart:clear' }, { text: l.btn_main_menu, callback_data: 'go:main' }]);
  return { inline_keyboard: rows };
}

export function deliveryType(lang: Lang): IKM {
  const l = L(lang);
  return { inline_keyboard: [
    [{ text: l.btn_delivery_type, callback_data: 'checkout:delivery' }],
    [{ text: l.btn_pickup_type, callback_data: 'checkout:pickup' }],
    [{ text: l.btn_back, callback_data: 'go:cart' }],
    [CANCEL_BTN],
  ]};
}

export function paymentKeyboard(lang: Lang): IKM {
  const l = L(lang);
  return { inline_keyboard: [
    [{ text: l.btn_pay_card, callback_data: 'pay:card' }],
    [{ text: l.btn_pay_cash, callback_data: 'pay:cash' }],
    [CANCEL_BTN],
  ]};
}

export function afterOrder(lang: Lang, orderId: string): IKM {
  const l = L(lang);
  return { inline_keyboard: [
    [{ text: l.btn_track, callback_data: `track:${orderId}` }],
    [{ text: l.btn_main_menu, callback_data: 'go:main' }],
  ]};
}

export function trackText(lang: Lang, order: Order): string {
  const isPickup = order.deliveryType === 'pickup';
  const steps: OrderStatus[] = isPickup
    ? ['new', 'received', 'preparing', 'ready_pickup', 'picked_up']
    : ['new', 'received', 'preparing', 'on_way', 'delivered'];
  const currentIdx = steps.indexOf(order.status);
  const typeIcon = isPickup ? '🏃' : '🛵';
  const typeLabel = isPickup ? ('O\'zi olib ketish') : ('Yetkazib berish');
  let txt = `📦 *Buyurtma #${order.id}*\n${typeIcon} ${typeLabel}\n\n`;
  if (order.status === 'cancelled') {
    txt += `❌ ${statusLabel(lang, 'cancelled')}\n`;
    if (order.cancelReason) txt += `${L(lang).cancel_reason_label}: ${order.cancelReason}\n`;
  }
  else for (let i = 0; i < steps.length; i++) {
    const icon = i < currentIdx ? '✅' : i === currentIdx ? '🔵' : '⬜';
    txt += `${icon} ${statusLabel(lang, steps[i])}\n`;
  }
  txt += `\n💰 ${price(order.total, lang)}`;
  if (order.address) txt += `\n📍 ${order.address}`;
  if (order.paymentMethod) txt += `\n💳 ${order.paymentMethod}`;
  if (order.note) txt += `\n📝 ${order.note}`;
  return txt;
}

export function trackKeyboard(lang: Lang, orderId: string): IKM {
  const l = L(lang);
  return { inline_keyboard: [
    [{ text: '🔄 Yangilash', callback_data: `track:${orderId}` }],
    [{ text: l.btn_main_menu, callback_data: 'go:main' }],
  ]};
}

export function ordersList(lang: Lang, orders: Order[]): IKM {
  const l = L(lang);
  const rows = orders.slice(0, 8).map(o => [{
    text: `📦 #${o.id} — ${statusLabel(lang, o.status)}`,
    callback_data: `track:${o.id}`,
  }]);
  rows.push([{ text: l.btn_main_menu, callback_data: 'go:main' }]);
  return { inline_keyboard: rows };
}

export function favoritesKeyboard(lang: Lang, productIds: string[]): IKM {
  const l = L(lang);
  const rows = productIds.map(id => {
    const p = store.getProduct(id);
    return p ? [{ text: `${p.emoji} ${p.name[lang]}`, callback_data: `prod:${p.id}` }] : [];
  }).filter(r => r.length > 0);
  rows.push([{ text: l.btn_main_menu, callback_data: 'go:main' }]);
  return { inline_keyboard: rows };
}

export const CANCEL_BTN = { text: '❌ Buyurtmani bekor qilish', callback_data: 'checkout:cancel' };
export function cancelOnly(): IKM { return { inline_keyboard: [[CANCEL_BTN]] }; }

export function shareContact(lang: Lang): RKM {
  return { keyboard: [[{ text: L(lang).btn_share_contact, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };
}

export function skipNote(lang: Lang): IKM {
  return { inline_keyboard: [[{ text: L(lang).btn_skip_note, callback_data: 'checkout:skip_note' }], [CANCEL_BTN]] };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function statusLabel(lang: Lang, status: OrderStatus): string {
  const l = L(lang);
  const map: Record<OrderStatus, string> = {
    new: l.status_new,
    received: l.status_received,
    preparing: l.status_preparing,
    on_way: l.status_on_way,
    delivered: l.status_delivered,
    ready_pickup: l.status_ready_pickup,
    picked_up: l.status_picked_up,
    cancelled: l.status_cancelled,
  };
  return map[status] || status;
}
