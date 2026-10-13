import { resolveLocationText, resolveTelegramLocation } from './utils/geo.js';
// @ts-nocheck
// Ported from the Node.js bot (index.ts). Runs via Telegram webhook.
import { Lang, OrderStatus } from './types.js';
import { L, price } from './utils/i18n.js';
import * as store from './utils/store.js';
import * as kb from './utils/keyboards.js';
import * as promo from './utils/promo.js';
import type { MiniBot } from './minibot.js';

/** "25.08.1998", "25/08/1998", "1998-08-25" → "1998-08-25" (yoki null). */
function parseBirthday(t: string): string | null {
  t = t.trim();
  let d: number, m: number, y: number;
  let x = t.match(/^(\d{1,2})[.\/\- ](\d{1,2})[.\/\- ](\d{4})$/);
  if (x) { d = +x[1]; m = +x[2]; y = +x[3]; }
  else if ((x = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +x[1]; m = +x[2]; d = +x[3]; }
  else return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  if (y < 1900 || dt > new Date()) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Tug'ilgan kun yaqin bo'lsa va aksiya bo'lsa — tavsiya yuboradi. */
async function sendBirthdayOffer(bot: MiniBot, chatId: number, birthday?: string, notifyIfNone = false) {
  const list = promo.birthdayPromos();
  if (!list.length) return;
  if (promo.isBirthdayNow(birthday)) {
    let text = "🎉 *Tug'ilgan kuningiz muborak!*\nSiz uchun maxsus aksiyalar:\n\n";
    for (const p of list) text += `${p.emoji} *${p.title.uz}* — ${promo.promoRule(p, 'uz')}\n`;
    text += `\nChegirma savatchada avtomatik qo'llanadi (tug'ilgan kuningizdan ${promo.BIRTHDAY_WINDOW_DAYS} kun oldin va keyin).`;
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } else if (notifyIfNone) {
    await bot.sendMessage(chatId, `🎂 Tug'ilgan kuningizda sizni ${list.map((p) => `${p.emoji} ${p.title.uz}`).join(', ')} aksiyasi kutmoqda!`);
  }
}

export function registerHandlers(bot: MiniBot) {
// ═══════════════════════════════════════════════════════════════════
//  YORDAM SOZLAMALARI — filial egasi ma'lumotlarini shu yerga yozing
//  SUPPORT_USERNAME: Telegram username, @ belgisisiz (masalan: gunaydin_admin)
//  SUPPORT_PHONE: telefon raqami
// ═══════════════════════════════════════════════════════════════════
const SUPPORT_USERNAME = 'gunaydin_turkishfood';
const SUPPORT_PHONE = '+998 93 094 94 94';
function workHoursText() {
  const h = store.workHours;
  return h.enabled ? `${h.open} - ${h.close}` : '24/7';
}
// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════
const fmt = (n: number) => n.toLocaleString('ru-RU');
let lastQueryId = '';

async function sendMain(chatId: number, userId: number) {
  const s = store.getSession(userId);
  const l = L(s.lang);
  await bot.sendMessage(chatId, l.main_menu, {
    parse_mode: 'Markdown',
    reply_markup: kb.mainMenu(s.lang),
  });
}

const T = (_lang: any, uz: string, ..._rest: string[]) => uz;
const noImage = (lang: Lang, what: 'product' | 'promo') => what === 'product'
  ? T(lang, "🖼 _Bu mahsulotda rasm yo'q_", '🖼 _У этого товара нет фото_', '🖼 _This product has no photo_')
  : T(lang, "🖼 _Bu aksiyada rasm yo'q_", '🖼 _У этой акции нет фото_', '🖼 _This promotion has no photo_');

/** Shows text with a photo when there is one; otherwise text plus a "no photo" note. */
async function showMedia(chatId: number, msgId: number | undefined, isPhoto: boolean, image: string | undefined, text: string, markup: any, noImgNote: string) {
  const caption = text.length > 1000 ? text.slice(0, 1000) + '…' : text;
  if (image) {
    if (msgId && isPhoto) { await bot.editMessageCaption(caption, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: markup }); return; }
    try {
      await bot.sendPhoto(chatId, image, { caption, parse_mode: 'Markdown', reply_markup: markup });
      if (msgId) await bot.deleteMessage(chatId, msgId).catch(() => { });
      return;
    } catch (e) { console.error('sendPhoto failed:', e); }
  }
  const full = `${text}\n\n${noImgNote}`;
  if (msgId) await bot.editMessageText(full, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: markup });
  else await bot.sendMessage(chatId, full, { parse_mode: 'Markdown', reply_markup: markup });
}

/** Products of a promo with the quantity needed to actually get the deal. */
function promoLines(p: any) {
  return (p.items ?? [])
    .map((i: any) => ({ product: store.getProduct(i.productId), base: Math.max(1, Number(i.qty) || 1) }))
    .filter((x: any) => x.product && x.product.available)
    .map((x: any) => ({ product: x.product, qty: p.type === 'combo' ? x.base : promo.triggerQty(p, x.base) }));
}

/** Mijozga ko'rinadigan aksiyalar: tug'ilgan kun aksiyasi faqat tug'ilgan kuni (± oyna) bo'lganlarga. */
function userPromotions(birthday?: string) {
  const isBday = promo.isBirthdayNow(birthday);
  return store.visiblePromotions().filter((p: any) => p.type !== 'birthday' || isBday);
}

function promoListView(lang: Lang, birthday?: string) {
  const l = L(lang);
  const list = userPromotions(birthday);
  if (!list.length) return { text: T(lang, "🎁 Hozircha faol aksiyalar yo'q.", '🎁 Сейчас нет активных акций.', '🎁 No active promotions right now.'), markup: { inline_keyboard: [[{ text: l.btn_main_menu, callback_data: 'go:main' }]] } };
  let text = l.promos_title;
  for (const p of list) text += `${p.emoji} *${p.title[lang]}* — ${p.badge}\n✅ ${promo.promoRule(p, lang)}\n${promoPeriod(p, lang)}\n\n`;
  const rows: any[] = list.map(p => [{ text: `${p.emoji} ${p.title[lang]} ${p.badge}`, callback_data: `promo:${p.id}` }]);
  rows.push([{ text: l.btn_main_menu, callback_data: 'go:main' }]);
  return { text, markup: { inline_keyboard: rows } };
}

function promoPeriod(p: any, lang: Lang): string {
  if (!p.startsAt && !p.endsAt) return T(lang, '♾ Muddatsiz', '♾ Бессрочно', '♾ No end date');
  const f = (d?: string) => (d ? d.replace('T', ' ').slice(0, 16) : '…');
  return `📅 ${f(p.startsAt)} — ${f(p.endsAt)}`;
}

async function showCart(chatId: number, userId: number, msgId?: number) {
  const s = store.getSession(userId);
  const l = L(s.lang);
  if (s.cart.length === 0) {
    const opts: any = { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: l.btn_main_menu, callback_data: 'go:main' }]] } };
    if (msgId) await bot.editMessageText(l.cart_empty, { chat_id: chatId, message_id: msgId, ...opts });
    else await bot.sendMessage(chatId, l.cart_empty, opts);
    return;
  }
  const calc = promo.calcCart(s.cart, 'delivery', undefined, promo.isBirthdayNow(s.birthday));

  let text = l.cart_title;
  for (const item of s.cart) {
    const line = item.product.price * item.quantity;
    const d = calc.lineDiscount[item.product.id] ?? 0;
    text += `${item.product.emoji} *${item.product.name[s.lang]}* × ${item.quantity}\n`;
    text += d > 0
      ? `   ${fmt(line)} ➜ *${price(line - d, s.lang)}* 🎁\n\n`
      : `   ${fmt(item.product.price)} × ${item.quantity} = *${price(line, s.lang)}*\n\n`;
  }
  for (const g of calc.gifts) text += `${g.product.emoji} *${g.product.name[s.lang]}* × 1 — *${T(s.lang, 'BEPUL', 'БЕСПЛАТНО', 'FREE')}*\n\n`;
  text += `━━━━━━━━━━━━━━━━━\n`;
  text += `${l.cart_subtotal}: ${price(calc.subtotal, s.lang)}\n`;
  for (const a of calc.applied) text += `🎁 ${a.title[s.lang]} (${a.badge}): −${price(a.amount, s.lang)}\n`;
  text += `${l.cart_delivery}: ${l.cart_delivery_negotiable}\n`;
  text += `${l.cart_total}: ${price(calc.total, s.lang)}*`;

  const items = s.cart.map(i => ({ id: i.product.id, name: i.product.name[s.lang] }));
  const replyMarkup = kb.cartKeyboard(s.lang, items);

  if (msgId) await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: replyMarkup });
  else await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: replyMarkup });
}

async function showProduct(chatId: number, userId: number, productId: string, msgId?: number, isPhoto = false) {
  const s = store.getSession(userId);
  const l = L(s.lang);
  const product = store.getProduct(productId);
  if (!product) return;

  if (!product.available) {
    await bot.answerCallbackQuery(lastQueryId, { text: l.unavailable, show_alert: true });
    return;
  }

  s.selectedProductId = productId;
  const qty = s.productQty || 1;
  const isFav = s.favorites.has(productId);

  let text = `${product.emoji} *${product.name[s.lang]}*\n\n` +
    `📝 ${product.description[s.lang]}\n\n` +
    `${l.product_price}: *${price(product.price, s.lang)}*`;
  const deals = userPromotions(s.birthday).filter((p) => (p.items ?? []).some((i) => i.productId === productId));
  for (const p of deals) text += `\n🎁 ${p.title[s.lang]} — ${promo.promoRule(p, s.lang)}`;

  const markup = kb.productDetail(s.lang, product, qty, isFav);
  await showMedia(chatId, msgId, isPhoto, product.image, text, markup, noImage(s.lang, 'product'));
}

async function notifyCustomer(userId: number, text: string, orderId: string) {
  try {
    await bot.sendMessage(userId, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '📦 Kuzatish', callback_data: `track:${orderId}` }]] },
    });
  } catch (e) { console.error('Notify failed:', e); }
}

// ═══════════════════════════════════════════════════════════════════
//  /start
// ═══════════════════════════════════════════════════════════════════
bot.onText(/\/start/, async (msg) => {
  const userId = msg.from!.id;
  const firstName = msg.from?.first_name || 'User';
  const s = store.getSession(userId, firstName);
  await bot.sendMessage(msg.chat.id, L('uz').welcome, {
    parse_mode: 'Markdown',
    reply_markup: kb.mainMenu('uz'),
  });
  // Tug'ilgan kun hali kiritilmagan bo'lsa — so'raymiz
  if (!s.birthday) {
    s.askingBirthday = true;
    store.saveState();
    await bot.sendMessage(msg.chat.id, "🎂 Tug'ilgan kuningizni kiriting (masalan: *25.08.1998*).\nTug'ilgan kuningizda maxsus aksiyalardan foydalanasiz!", { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: "⏭ O'tkazib yuborish", callback_data: 'bday:skip' }]] } });
  } else {
    await sendBirthdayOffer(bot, msg.chat.id, s.birthday);
  }
  if (s.checkoutStep) {
    await bot.sendMessage(msg.chat.id, "⚠️ Sizda tugallanmagan buyurtma bor. Davom etishingiz yoki bekor qilishingiz mumkin.", { reply_markup: kb.cancelOnly() });
  }
});

// ═══════════════════════════════════════════════════════════════════
//  TEXT MESSAGES
// ═══════════════════════════════════════════════════════════════════
 bot.on('message', async (msg) => {
   const chatId = msg.chat.id;
   const userId = msg.from!.id;
   const s = store.getSession(userId, msg.from?.first_name);
   const l = L(s.lang);

   // ── Card payment: order is created ONLY after the receipt photo arrives ──
   if (s.checkoutStep === 'receipt') {
     // Receipt is only collected (photo, image file or PDF) — never verified.
     // Accepting or cancelling the order is entirely up to the admin.
     let receipt: NonNullable<typeof s.pendingOrder>['receipt'];
     if (msg.photo?.length) {
       receipt = { fileId: msg.photo[msg.photo.length - 1].file_id, kind: 'image', mime: 'image/jpeg' };
     } else if (msg.document) {
       const mime = String(msg.document.mime_type || '');
       const name = String(msg.document.file_name || '');
       if (mime === 'application/pdf' || /\.pdf$/i.test(name)) receipt = { fileId: msg.document.file_id, kind: 'pdf', mime: 'application/pdf', fileName: name || undefined };
       else if (mime.startsWith('image/')) receipt = { fileId: msg.document.file_id, kind: 'image', mime, fileName: name || undefined };
     }
     if (!receipt) {
       await bot.sendMessage(chatId, l.receipt_required, { parse_mode: 'Markdown', reply_markup: kb.cancelOnly() });
       return;
     }
     s.pendingOrder!.receipt = receipt;
     const order = store.createOrder(userId, s.pendingOrder!);
     s.checkoutStep = undefined;
     s.pendingOrder = undefined;
     const confirmMsg = order.deliveryType === 'pickup' ? l.pickup_confirmed(order.id) : l.order_confirmed(order.id);
     await bot.sendMessage(chatId, confirmMsg, { parse_mode: 'Markdown', reply_markup: kb.afterOrder(s.lang, order.id) });
     await sendMain(chatId, userId);
     return;
   }

   // ── Tug'ilgan kunni qabul qilish ──
   if (s.askingBirthday && msg.text && !msg.text.startsWith('/') && !s.checkoutStep) {
     const bday = parseBirthday(msg.text);
     if (!bday) {
       await bot.sendMessage(chatId, "❗️ Sana noto'g'ri. *KK.OO.YYYY* ko'rinishida yozing, masalan: *25.08.1998*", { parse_mode: 'Markdown' });
       return;
     }
     s.birthday = bday;
     s.askingBirthday = false;
     store.saveState();
     const [y, mo, d] = bday.split('-');
     await bot.sendMessage(chatId, `✅ Tug'ilgan kuningiz saqlandi: *${d}.${mo}.${y}*`, { parse_mode: 'Markdown' });
     await sendBirthdayOffer(bot, chatId, bday, true);
     return;
   }

   // ── Address: Telegram location pin, map link or plain text ──
   if (s.checkoutStep === 'address' && (msg.location || msg.venue || msg.text)) {
     if (msg.text?.startsWith('/')) return;
     // Joy tanlangan bo'lsa (venue) o'sha joy, aks holda mijoz turgan aniq GPS nuqta
     const loc = msg.venue?.location || msg.location;
     const raw = (msg.text || '').trim();
     const geo = loc ? await resolveTelegramLocation(loc.latitude, loc.longitude) : await resolveLocationText(raw);
     if (geo && msg.venue?.title) geo.name = `${msg.venue.title}, ${msg.venue.address || geo.name}`;
     s.pendingOrder!.location = geo || undefined;
     s.pendingOrder!.address = geo ? (raw && !/https?:\/\//.test(raw) ? `${raw} (${geo.name})` : geo.name) : raw;
     s.checkoutStep = 'phone';
     if (geo) {
       // Mijozga aniq nuqtani xaritada qaytarib ko'rsatamiz
       try { await bot.sendLocation(chatId, geo.lat, geo.lng); } catch { /* ignore */ }
       await bot.sendMessage(chatId, geo.source === 'text' ? `📍 Eng yaqin topilgan joy: ${geo.name}` : `📍 ${geo.name}`, { reply_markup: { remove_keyboard: true } });
     } else {
       await bot.sendMessage(chatId, "⚠️ Manzil xaritadan topilmadi, yozganingiz saqlandi. Aniqroq bo'lishi uchun 📍 tugma orqali lokatsiya yuboring.", { reply_markup: { remove_keyboard: true } });
     }
     await bot.sendMessage(chatId, l.enter_phone, { parse_mode: 'Markdown', reply_markup: kb.shareContact(s.lang) });
     return;
   }

   if (!msg.text || msg.text.startsWith('/')) return;
   const text = msg.text.trim();

  // ── Checkout flow: awaiting text input ─────────────────────────
  if (s.checkoutStep === 'phone') {
    s.pendingOrder!.phone = text;
    s.phone = text;
    s.checkoutStep = 'note';
    // Remove the "share contact" keyboard so it doesn't stay on screen
    await bot.sendMessage(chatId, '✅ ' + text, { reply_markup: { remove_keyboard: true } });
    await bot.sendMessage(chatId, l.enter_note, { parse_mode: 'Markdown', reply_markup: kb.skipNote(s.lang) });
    return;
  }
  if (s.checkoutStep === 'note') {
    s.pendingOrder!.note = text;
    s.checkoutStep = 'payment';
    await bot.sendMessage(chatId, l.choose_payment, { parse_mode: 'Markdown', reply_markup: kb.paymentKeyboard(s.lang) });
    return;
  }

  // ── Main menu buttons (language-aware) ──────────────────────────
  if (text === l.btn_menu) {
    if (!store.categories.some((c) => c.active !== false)) { await bot.sendMessage(chatId, T(s.lang, "😔 Hozircha menyuda kategoriyalar yo'q", '😔 Пока в меню нет категорий', '😔 No categories in the menu yet')); return; }
    await bot.sendMessage(chatId, l.categories_title, { parse_mode: 'Markdown', reply_markup: kb.categories(s.lang) });
    return;
  }
  if (text === l.btn_cart) { await showCart(chatId, userId); return; }
  if (text === l.btn_orders) {
    if (s.orders.length === 0) {
      await bot.sendMessage(chatId, l.no_orders, { parse_mode: 'Markdown', reply_markup: kb.mainMenu(s.lang) });
      return;
    }
    let txt = l.orders_title;
    for (const o of s.orders.slice(0, 8)) {
      txt += l.order_line(`#${o.id}`, kb.statusLabel(s.lang, o.status), price(o.total, s.lang), o.createdAt.toLocaleDateString('ru-RU')) + '\n\n';
    }
    await bot.sendMessage(chatId, txt, { parse_mode: 'Markdown', reply_markup: kb.ordersList(s.lang, s.orders) });
    return;
  }
  if (text === l.btn_favorites) {
    if (s.favorites.size === 0) {
      await bot.sendMessage(chatId, l.no_favorites, { parse_mode: 'Markdown', reply_markup: kb.mainMenu(s.lang) });
      return;
    }
    const ids = Array.from(s.favorites);
    let txt = l.favorites_title;
    for (const id of ids) {
      const p = store.getProduct(id);
      if (p) txt += `${p.emoji} *${p.name[s.lang]}* — ${price(p.price, s.lang)}\n`;
    }
    await bot.sendMessage(chatId, txt, { parse_mode: 'Markdown', reply_markup: kb.favoritesKeyboard(s.lang, ids) });
    return;
  }
  if (text === l.btn_promos) {
    const v = promoListView(s.lang, s.birthday);
    await bot.sendMessage(chatId, v.text, { parse_mode: 'Markdown', reply_markup: v.markup });
    return;
  }
  if (text === l.btn_delivery) {
    await bot.sendMessage(chatId, l.delivery_info(workHoursText()), { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: l.btn_main_menu, callback_data: 'go:main' }]] } });
    return;
  }
  if (text === l.btn_profile) {
    const phone = s.phone || 'Kiritilmagan';
    await bot.sendMessage(chatId, l.profile_title(s.firstName, phone, s.orders.length), {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: l.btn_main_menu, callback_data: 'go:main' }]] },
    });
    return;
  }
  if (text === l.btn_support) {
    await bot.sendMessage(chatId, l.support_title(SUPPORT_PHONE, SUPPORT_USERNAME, workHoursText()), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: l.btn_write, url: `https://t.me/${SUPPORT_USERNAME}` }],
          [{ text: l.btn_main_menu, callback_data: 'go:main' }],
        ]
      },
    });
    return;
  }
});

// ═══════════════════════════════════════════════════════════════════
//  CONTACT (phone sharing)
// ═══════════════════════════════════════════════════════════════════
bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  const s = store.getSession(userId);
  const l = L(s.lang);
  if (s.checkoutStep === 'phone' && msg.contact) {
    s.pendingOrder!.phone = msg.contact.phone_number;
    s.phone = msg.contact.phone_number;
    s.checkoutStep = 'note';
    await bot.sendMessage(chatId, '✅ ' + msg.contact.phone_number, { reply_markup: { remove_keyboard: true } });
    await bot.sendMessage(chatId, l.enter_note, { parse_mode: 'Markdown', reply_markup: kb.skipNote(s.lang) });
  }
});

// ═══════════════════════════════════════════════════════════════════
//  CALLBACK QUERIES
// ═══════════════════════════════════════════════════════════════════
bot.on('callback_query', async (query) => {
  const chatId = query.message!.chat.id;
  const msgId = query.message!.message_id;
  const userId = query.from.id;
  const data = query.data || '';
  const isPhoto = !!query.message?.photo;
  lastQueryId = query.id;
  const s = store.getSession(userId, query.from.first_name);
  const l = L(s.lang);

  // Answer each callback exactly once (a second answer is ignored by Telegram, so alerts were lost).
  let answered = false;
  const realAnswer = bot.answerCallbackQuery.bind(bot);
  bot.answerCallbackQuery = ((id: string, opts: any = {}) => {
    if (id !== query.id) return realAnswer(id, opts);
    if (answered) return Promise.resolve();
    answered = true;
    return realAnswer(id, opts);
  }) as any;
  try {
    await handleCallback();
  } finally {
    bot.answerCallbackQuery = realAnswer as any;
    if (!answered) await realAnswer(query.id).catch(() => { });
  }

  async function handleCallback() {
  const [ns, ...rest] = data.split(':');

  // ── Tug'ilgan kunni o'tkazib yuborish ──
  if (ns === 'bday' && rest[0] === 'skip') {
    s.askingBirthday = false;
    store.saveState();
    await bot.deleteMessage(chatId, msgId).catch(() => { });
    return;
  }


  // ── Navigation ────────────────────────────────────────────────────
  if (ns === 'go') {
    const dest = rest[0];
    if (dest === 'main') { await bot.deleteMessage(chatId, msgId).catch(() => { }); await sendMain(chatId, userId); return; }
    if (dest === 'categories') { await bot.editMessageText(l.categories_title, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.categories(s.lang) }); return; }
    if (dest === 'cart') { await showCart(chatId, userId, msgId); return; }
    if (dest === 'promos') { const v = promoListView(s.lang, s.birthday); await bot.editMessageText(v.text, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: v.markup }); return; }
    if (dest === 'back_cat') {
      const cat = s.selectedCategory || store.categories[0]?.id || '';
      await bot.editMessageText(`${store.categoryLabel(cat)}\n\n`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.productList(s.lang, cat) });
      return;
    }
    return;
  }

  // ── Category ──────────────────────────────────────────────────────
  if (ns === 'cat') {
    const cat = rest[0];
    s.selectedCategory = cat;
    const catLabel = store.categoryLabel(cat);
    const catObj = store.categories.find((c) => c.id === cat);
    if (!catObj || catObj.active === false || store.getProductsByCategory(cat).length === 0) {
      await bot.answerCallbackQuery(lastQueryId, { text: T(s.lang, "😔 Bu kategoriyada hozircha mahsulotlar yo'q", '😔 В этой категории пока нет товаров', '😔 No products in this category yet'), show_alert: true }).catch(() => { });
      return;
    }
    await bot.editMessageText(`${catLabel}${catObj.description ? `\n_${catObj.description}_` : ''}\n\n`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.productList(s.lang, cat) });
    return;
  }

  // ── Product ───────────────────────────────────────────────────────
  if (ns === 'prod') {
    s.productQty = 1;
    await showProduct(chatId, userId, rest[0], msgId, isPhoto);
    return;
  }

  // ── Quantity ──────────────────────────────────────────────────────
  if (ns === 'qty') {
    const dir = rest[0]; const pid = rest[1];
    if (dir === 'plus') s.productQty = Math.min((s.productQty || 1) + 1, 20);
    if (dir === 'minus') s.productQty = Math.max((s.productQty || 1) - 1, 1);
    await showProduct(chatId, userId, pid, msgId, isPhoto);
    return;
  }

  // ── Cart actions ──────────────────────────────────────────────────
  if (ns === 'cart') {
    const action = rest[0]; const pid = rest[1];
    if (action === 'add') {
      const product = store.getProduct(pid);
      if (!product) return;
      const qty = s.productQty || 1;
      store.cartAdd(userId, product, qty);
      s.productQty = 1;
      const total = price(store.cartTotal(userId), s.lang);
      const count = store.cartCount(userId);
      await bot.answerCallbackQuery(query.id, { text: `✅ Savatga qo\'shildi! (${count} ta)`, show_alert: true });
      await bot.sendMessage(chatId, l.added_to_cart(product.name[s.lang], qty, total, count), {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: l.btn_view_cart, callback_data: 'go:cart' }, { text: l.btn_continue, callback_data: `go:back_cat` }]] },
      });
      return;
    }
    if (action === 'plus') {
      const item = s.cart.find(c => c.product.id === pid);
      if (item) store.cartUpdate(userId, pid, item.quantity + 1);
      await showCart(chatId, userId, msgId);
      return;
    }
    if (action === 'minus') {
      const item = s.cart.find(c => c.product.id === pid);
      if (item) store.cartUpdate(userId, pid, item.quantity - 1);
      await showCart(chatId, userId, msgId);
      return;
    }
    if (action === 'remove') { store.cartUpdate(userId, pid, 0); await showCart(chatId, userId, msgId); return; } 
    if (action === 'clear') { store.cartClear(userId); await bot.editMessageText(l.cart_cleared, { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [[{ text: l.btn_main_menu, callback_data: 'go:main' }]] } }); return; }
    return;
  }

  // ── Favorites ─────────────────────────────────────────────────────
  if (ns === 'fav') {
    const pid = rest[1];
    const added = store.toggleFavorite(userId, pid);
    await bot.answerCallbackQuery(query.id, { text: added ? l.fav_added : l.fav_removed, show_alert: false });
    await showProduct(chatId, userId, pid, msgId, isPhoto);
    return;
  }

  // ── Checkout ──────────────────────────────────────────────────────
  if (ns === 'checkout') {
    const step = rest[0];
    if (step === 'start') {
      if (s.cart.length === 0) { await bot.answerCallbackQuery(query.id, { text: l.cart_empty, show_alert: true }); return; }
      s.pendingOrder = {};
      s.checkoutStep = 'delivery_type';
      await bot.editMessageText(l.choose_delivery_type, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.deliveryType(s.lang) });
      return;
    }
    if (step === 'delivery' || step === 'pickup') {
      s.pendingOrder!.deliveryType = step === 'delivery' ? 'delivery' : 'pickup';
      if (step === 'pickup') {
        s.checkoutStep = 'phone';
        await bot.sendMessage(chatId, '📍 *Bizning filialimiz:*\nhttps://maps.app.goo.gl/UfhQ2J3AqJzS7Hs8A', { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: "🗺 Xaritada ochish", url: 'https://maps.app.goo.gl/UfhQ2J3AqJzS7Hs8A' }]] } });
        await bot.editMessageText(l.enter_phone, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.cancelOnly() });
        await bot.sendMessage(chatId, '📱 Telefon raqamingizni yuborish uchun quyidagi tugmani bosing.', { reply_markup: kb.shareContact(s.lang) });
      } else {
        s.checkoutStep = 'address';
        await bot.editMessageText(l.enter_address, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.cancelOnly() });
        await bot.sendMessage(chatId, '📍 Manzilingizni yuborish uchun quyidagi tugmani bosing yoki manzilni yozing.', { reply_markup: { keyboard: [[{ text: '📍 Lokatsiyani yuborish', request_location: true }]], resize_keyboard: true, one_time_keyboard: true } });
      }
      return;
    }
    if (step === 'cancel') {
      if (!s.checkoutStep) { await bot.answerCallbackQuery(query.id, { text: "Faol buyurtma yo'q" }).catch(() => {}); return; }
      // Record the abandoned order in the admin panel as cancelled by the customer.
      if (s.cart.length > 0) store.createOrder(userId, { ...(s.pendingOrder || {}), status: 'cancelled', cancelReason: 'Mijoz bekor qilgan' });
      s.checkoutStep = undefined;
      s.pendingOrder = undefined;
      await bot.editMessageText('❌ Buyurtma bekor qilindi.', { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] } }).catch(() => {});
      await bot.sendMessage(chatId, '👌', { reply_markup: { remove_keyboard: true } }).catch(() => {});
      await sendMain(chatId, userId);
      return;
    }
    if (step === 'skip_note') {
      s.checkoutStep = 'payment';
      await bot.sendMessage(chatId, l.choose_payment, { parse_mode: 'Markdown', reply_markup: kb.paymentKeyboard(s.lang) });
      return;
    }
    return;
  }

  // ── Payment ───────────────────────────────────────────────────────
  if (ns === 'pay') {
    const method = rest[0];
    const payLabels: Record<string, Record<Lang, string>> = {
      card: { uz: '💳 Karta', ru: '💳 Картой', en: '💳 Card' },
      cash: { uz: '💵 Naqd pul', ru: '💵 Наличные', en: '💵 Cash' },
    };
    if (!payLabels[method]) {
      await bot.answerCallbackQuery(query.id).catch(() => {});
      return;
    }
    s.pendingOrder!.paymentMethod = payLabels[method][s.lang];

    // Card: wait for the receipt photo BEFORE creating the order,
    // so nothing reaches the admin panel until the customer sends it.
    if (method === 'card') {
      s.checkoutStep = 'receipt';
      const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      await bot.editMessageText(l.card_payment_info(store.shopSettings.cardNumber, esc(store.shopSettings.cardOwner)), { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: kb.cancelOnly() });
      return;
    }

    const order = store.createOrder(userId, s.pendingOrder!);
    s.checkoutStep = undefined;
    s.pendingOrder = undefined;

    // Confirm to customer
    const confirmMsg = order.deliveryType === 'pickup' ? l.pickup_confirmed(order.id) : l.order_confirmed(order.id);
    await bot.editMessageText(confirmMsg, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.afterOrder(s.lang, order.id) });
    // Bring the customer back to the main menu (restores the main keyboard)
    await sendMain(chatId, userId);

    return;
  }

  // ── Track order ───────────────────────────────────────────────────
  if (ns === 'track') {
    const orderId = rest[0];
    const order = store.getOrder(orderId);
    if (!order) return;
    store.rememberTrackMsg(orderId, chatId, msgId);
    const txt = kb.trackText(s.lang, order);

    await bot.editMessageText(txt, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', reply_markup: kb.trackKeyboard(s.lang, orderId) });
    return;
  }

  // ── Promotions ────────────────────────────────────────────────────
  if (ns === 'promo') {
    const p = userPromotions(s.birthday).find(x => x.id === rest[0]);
    if (!p) { await bot.answerCallbackQuery(query.id, { text: T(s.lang, 'Aksiya tugagan', 'Акция завершена', 'Promotion ended'), show_alert: true }); return; }
    const items = promoLines(p);
    let txt = `${p.emoji} *${p.title[s.lang]}* — ${p.badge}\n\n${p.description[s.lang] || ''}\n\n✅ ${promo.promoRule(p, s.lang)}\n${promoPeriod(p, s.lang)}`;
    if (items.length) {
      const calc = promo.calcCart(items.map((x) => ({ product: x.product, quantity: x.qty })), 'pickup', [p], true);
      txt += `\n\n🛒 *${T(s.lang, 'Aksiyadagi mahsulotlar', 'Товары акции', 'Products in this deal')}:*\n`;
      for (const x of items) txt += `• ${x.product.emoji} ${x.product.name[s.lang]} × ${x.qty} — ${price(x.product.price * x.qty, s.lang)}\n`;
      if (calc.discount > 0) txt += `\n💰 ${fmt(calc.subtotal)} ➜ *${price(calc.subtotal - calc.discount, s.lang)}*`;
    }
    const rows: any[] = [];
    if (items.length) rows.push([{ text: T(s.lang, '🛒 Aksiyani savatga qo\'shish', '🛒 Добавить акцию в корзину', '🛒 Add deal to cart'), callback_data: `promoadd:${p.id}` }]);
    for (const x of items.slice(0, 6)) rows.push([{ text: `ℹ️ ${x.product.emoji} ${x.product.name[s.lang]}`, callback_data: `prod:${x.product.id}` }]);
    rows.push([{ text: T(s.lang, '⬅️ Aksiyalar', '⬅️ Акции', '⬅️ Promotions'), callback_data: 'go:promos' }]);
    rows.push([{ text: l.btn_menu, callback_data: 'go:categories' }]);
    rows.push([{ text: l.btn_main_menu, callback_data: 'go:main' }]);
    await showMedia(chatId, msgId, isPhoto, p.image, txt, { inline_keyboard: rows }, noImage(s.lang, 'promo'));
    return;
  }

  // Step 1: card with photo + exact contents + price, before anything goes to the cart.
  if (ns === 'promoadd') {
    const p = userPromotions(s.birthday).find(x => x.id === rest[0]);
    if (!p) { await bot.answerCallbackQuery(query.id, { text: T(s.lang, 'Aksiya tugagan', 'Акция завершена', 'Promotion ended'), show_alert: true }); return; }
    const lines = promoLines(p);
    if (!lines.length) { await bot.answerCallbackQuery(query.id, { text: T(s.lang, "Aksiyadagi mahsulotlar hozir mavjud emas", 'Товары акции сейчас недоступны', 'Deal products are unavailable'), show_alert: true }); return; }
    const calc = promo.calcCart(lines.map((x) => ({ product: x.product, quantity: x.qty })), 'pickup', [p], true);
    let txt = `${p.emoji} *${p.title[s.lang]}* — ${p.badge}\n\n✅ ${promo.promoRule(p, s.lang)}\n\n🛒 *${T(s.lang, "Savatga qo'shiladi", 'Будет добавлено', 'Will be added')}:*\n`;
    for (const x of lines) txt += `• ${x.product.emoji} ${x.product.name[s.lang]} × ${x.qty} — ${price(x.product.price * x.qty, s.lang)}\n`;
    txt += calc.discount > 0
      ? `\n💰 ${fmt(calc.subtotal)} ➜ *${price(calc.subtotal - calc.discount, s.lang)}*`
      : `\n💰 *${price(calc.subtotal, s.lang)}*`;
    txt += `\n\n${T(s.lang, "Tasdiqlaysizmi?", 'Подтверждаете?', 'Confirm?')}`;
    const rows = [
      [{ text: T(s.lang, "✅ Ha, savatga qo'shish", '✅ Да, добавить', '✅ Yes, add to cart'), callback_data: `promook:${p.id}` }],
      [{ text: l.btn_back, callback_data: `promo:${p.id}` }],
    ];
    await showMedia(chatId, msgId, isPhoto, p.image, txt, { inline_keyboard: rows }, noImage(s.lang, 'promo'));
    return;
  }

  // Step 2: confirmed — set each line to the quantity the deal needs (no double-stacking on repeat taps).
  if (ns === 'promook') {
    const p = userPromotions(s.birthday).find(x => x.id === rest[0]);
    if (!p) { await bot.answerCallbackQuery(query.id, { text: T(s.lang, 'Aksiya tugagan', 'Акция завершена', 'Promotion ended'), show_alert: true }); return; }
    for (const x of promoLines(p)) {
      const inCart = s.cart.find((c) => c.product.id === x.product.id);
      if (inCart) store.cartUpdate(userId, x.product.id, Math.max(inCart.quantity, x.qty));
      else store.cartAdd(userId, x.product, x.qty);
    }
    await bot.answerCallbackQuery(query.id, { text: T(s.lang, "✅ Aksiya savatga qo'shildi", '✅ Акция добавлена', '✅ Deal added'), show_alert: false });
    await bot.deleteMessage(chatId, msgId).catch(() => { });
    await showCart(chatId, userId);
    return;
  }

  if (data === 'noop') return;
  }
});

}
