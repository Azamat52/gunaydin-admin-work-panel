// Promotion mechanics: how a promotion changes prices of its products.
export const PROMO_TYPES = {
  percent: { label: "Foizli chegirma", hint: "Tanlangan mahsulotlar narxidan % chegirma", emoji: "🏷️" },
  fixed: { label: "Summali chegirma", hint: "Har bir mahsulot narxidan belgilangan summa ayiriladi", emoji: "💸" },
  bogo: { label: "N + M (1+1, 2+1)", hint: "N ta olsangiz, M tasi bepul", emoji: "🎁" },
  second: { label: "Ikkinchisiga chegirma", hint: "Ikkinchi mahsulotga % chegirma (masalan 50%)", emoji: "✌️" },
  combo: { label: "Combo / Oilaviy set", hint: "Bir nechta mahsulot bitta maxsus narxda", emoji: "👨‍👩‍👧‍👦" },
  happy: { label: "Happy hour", hint: "Belgilangan soatlarda % chegirma", emoji: "⏰" },
  gift: { label: "Sovg'a mahsulot", hint: "Minimal summadan buyurtmaga bepul mahsulot", emoji: "🎀" },
  birthday: { label: "Tug'ilgan kun", hint: "Tug'ilgan kun egasiga % chegirma", emoji: "🎂" },
};

export const promoTypeOf = (p) => (PROMO_TYPES[p.type] ? p.type : "percent");

const round = (n) => Math.max(0, Math.round(n / 100) * 100);

/** Price of one unit of a product inside the promotion (for per-item types). */
export function promoUnitPrice(promo, product) {
  const v = Number(promo.value) || 0;
  switch (promoTypeOf(promo)) {
    case "percent":
    case "happy":
    case "birthday":
      return round(product.price * (1 - Math.min(v, 100) / 100));
    case "fixed":
      return round(product.price - v);
    default:
      return product.price;
  }
}

/** Menu products plus this promotion's temporary (not-in-menu) products. */
export const withExtras = (promo, products) => [...products, ...(promo?.extraProducts ?? [])];

/** Items of the promotion with quantities: [{ product, qty }]. */
export function promoItems(promo, products) {
  return (promo.items ?? [])
    .map((it) => ({ product: withExtras(promo, products).find((p) => p.id === it.productId), qty: Math.max(1, Number(it.qty) || 1) }))
    .filter((x) => x.product);
}

/** Summary of old vs new price for display. */
export function promoSummary(promo, products) {
  const items = promoItems(promo, products);
  const type = promoTypeOf(promo);
  const v = Number(promo.value) || 0;
  const full = items.reduce((s, x) => s + x.product.price * x.qty, 0);
  let final = full;
  if (type === "combo") final = Number(promo.setPrice) || full;
  else if (type === "bogo") {
    const buy = Math.max(1, Number(promo.buyQty) || 1);
    const get = Math.max(1, Number(promo.getQty) || 1);
    // Per product: in each group of buy+get, the cheapest `get` units are free.
    final = items.reduce((s, x) => {
      const group = buy + get;
      const freeUnits = Math.floor(x.qty / group) * get;
      return s + x.product.price * (x.qty - freeUnits);
    }, 0);
  } else if (type === "second") {
    final = items.reduce((s, x) => {
      const pairs = Math.floor(x.qty / 2);
      return s + x.product.price * x.qty - round(x.product.price * (Math.min(v, 100) / 100)) * pairs;
    }, 0);
  } else if (type === "gift" || type === "delivery") final = full;
  else final = items.reduce((s, x) => s + promoUnitPrice(promo, x.product) * x.qty, 0);
  return { items, full, final, saved: Math.max(0, full - final) };
}

/** Short auto-badge text for the promotion. */
export function autoBadge(promo) {
  const v = Number(promo.value) || 0;
  switch (promoTypeOf(promo)) {
    case "percent": case "happy": case "birthday": return `-${v}%`;
    case "fixed": return `-${v.toLocaleString("ru-RU")}`;
    case "bogo": return `${promo.buyQty || 1}+${promo.getQty || 1}`;
    case "second": return `2-chi -${v}%`;
    case "combo": return "SET";
    case "gift": return "SOVG'A";
    case "delivery": return "0 so'm 🚚";
    default: return "";
  }
}

/** One line describing the rule (Uzbek). */
export function promoRule(promo, products = []) {
  const v = Number(promo.value) || 0;
  const sum = (n) => `${(Number(n) || 0).toLocaleString("ru-RU")} so'm`;
  switch (promoTypeOf(promo)) {
    case "percent": return `Mahsulotlarga ${v}% chegirma`;
    case "fixed": return `Har bir mahsulotdan ${sum(v)} chegirma`;
    case "bogo": return `${promo.buyQty || 1} ta olsangiz — ${promo.getQty || 1} tasi bepul`;
    case "second": return `Ikkinchi mahsulotga ${v}% chegirma`;
    case "combo": return `Set narxi: ${sum(promo.setPrice)}`;
    case "happy": return `${promo.hoursFrom || "00:00"}–${promo.hoursTo || "23:59"} oralig'ida ${v}% chegirma`;
    case "gift": {
      const g = withExtras(promo, products).find((p) => p.id === promo.giftProductId);
      return `${sum(promo.minOrder)} dan buyurtmaga ${g ? g.name.uz : "sovg'a"} bepul`;
    }
    case "delivery": return `${sum(promo.minOrder)} dan buyurtmaga yetkazish bepul`;
    case "birthday": return `Tug'ilgan kun egasiga ${v}% chegirma`;
    default: return "";
  }
}

import { promoEndMs } from "@/lib/bot-types";

/** Remaining time until end: null if no end, 0 or less if finished. */
export function msLeft(promo, now = Date.now()) {
  const e = promoEndMs(promo);
  return e === null ? null : e - now;
}

/** "2 kun 3 soat 15 min" style text. */
export function fmtLeft(ms) {
  if (ms <= 0) return "Tugadi";
  const total = Math.floor(ms / 60000);
  const d = Math.floor(total / 1440), h = Math.floor((total % 1440) / 60), m = total % 60;
  if (d > 0) return `${d} kun ${h} soat ${m} min`;
  if (h > 0) return `${h} soat ${m} min`;
  return m > 0 ? `${m} min` : "1 minutdan kam";
}
