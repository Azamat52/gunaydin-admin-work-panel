// Real-time bridge: admin panel changes -> Telegram bot users instantly.
// Telegram has no sockets for bots, so "real-time" means we push messages
// (new product / new promotion) and refresh users' carts the moment the admin saves.
import type { MiniBot } from './minibot.js';
import type { Lang, Product, Promotion } from './types.js';
import * as store from './utils/store.js';
import { price } from './utils/i18n.js';

const BROADCAST = (process.env.BROADCAST_UPDATES ?? 'true') !== 'false';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const T = {
  newProduct: { uz: '🆕 Yangi mahsulot!', ru: '🆕 Новинка в меню!', en: '🆕 New on the menu!' },
  backProduct: { uz: '✅ Yana sotuvda!', ru: '✅ Снова в продаже!', en: '✅ Back in stock!' },
  newPromo: { uz: '🎁 Yangi aksiya!', ru: '🎁 Новая акция!', en: '🎁 New promotion!' },
  open: { uz: '👀 Ko‘rish', ru: '👀 Смотреть', en: '👀 View' },
} satisfies Record<string, Record<Lang, string>>;

/** Keep carts consistent with the current catalog (price/name changes, deletions). */
export function syncCarts() {
  for (const s of store.allSessions()) {
    s.cart = s.cart
      .map((c) => ({ ...c, product: store.getProduct(c.product.id)! }))
      .filter((c) => c.product && c.product.available);
  }
}

// Sequential queue so broadcasts never overlap and respect Telegram limits (~30 msg/s).
let queue: Promise<void> = Promise.resolve();
function enqueue(job: () => Promise<void>) {
  queue = queue.then(job).catch((e) => console.error('Broadcast xatosi:', e));
}

async function sendTo(bot: MiniBot, chatId: number, caption: string, image: string | undefined, button: { text: string; callback_data: string }) {
  const reply_markup = { inline_keyboard: [[button]] };
  try {
    if (image) await bot.sendPhoto(chatId, image, { caption, parse_mode: 'Markdown', reply_markup });
    else await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup });
  } catch (e) {
    const msg = String(e);
    // Photo failed (bad image) -> fall back to text. Blocked users are skipped silently.
    if (image && !msg.includes('blocked') && !msg.includes('deactivated')) {
      await bot.sendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup }).catch(() => {});
    }
  }
}

function broadcast(bot: MiniBot, build: (lang: Lang) => { caption: string; image?: string; button: { text: string; callback_data: string } }) {
  if (!BROADCAST) return;
  const users = store.allSessions().map((s) => ({ id: s.userId, lang: s.lang }));
  enqueue(async () => {
    for (const u of users) {
      const m = build(u.lang);
      await sendTo(bot, u.id, m.caption, m.image, m.button);
      await sleep(40);
    }
  });
}

/** Call after a product was saved from the admin panel. */
export function productSaved(bot: MiniBot, before: Product | undefined, after: Product) {
  syncCarts();
  const isNew = !before && after.available;
  const back = !!before && !before.available && after.available;
  if (!isNew && !back) return;
  broadcast(bot, (lang) => ({
    caption: `${isNew ? T.newProduct[lang] : T.backProduct[lang]}\n\n${after.emoji} *${after.name[lang]}*\n📝 ${after.description[lang]}\n💰 *${price(after.price, lang)}*`,
    image: after.image,
    button: { text: T.open[lang], callback_data: `prod:${after.id}` },
  }));
}

export function productDeleted() { syncCarts(); }

const visible = (id: string) => store.visiblePromotions().some((p) => p.id === id);

/** Call with visibility BEFORE the save, after the store was updated. */
export function promotionSaved(bot: MiniBot, wasVisible: boolean, p: Promotion) {
  if (wasVisible || !visible(p.id)) return;
  broadcast(bot, (lang) => ({
    caption: `${T.newPromo[lang]}\n\n${p.emoji} *${p.title[lang]}* ${p.badge}\n📝 ${p.description[lang]}`,
    image: p.image,
    button: { text: T.open[lang], callback_data: `promo:${p.id}` },
  }));
}

export { visible as isPromotionVisible };
