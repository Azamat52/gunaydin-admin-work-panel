
export default {
  welcome: `🍔 *GunAydin*ga xush kelibsiz!\n\nMazali burgerlar, pitsa, shaurma va boshqalar!`,

  main_menu: `🏠 *Asosiy menyu*\n\nQuyidagilardan birini tanlang:`,
  btn_menu: `🍔 Menyu`,
  btn_cart: `🛒 Savat`,
  btn_orders: `📦 Buyurtmalarim`,
  btn_favorites: `❤️ Sevimlilar`,
  btn_promos: `🎁 Aksiyalar`,
  btn_delivery: `📍 Yetkazib berish`,
  btn_profile: `👤 Profil`,
  btn_support: `📞 Yordam`,
  btn_back: `⬅️ Orqaga`,
  btn_main_menu: `🏠 Asosiy menyu`,

  categories_title: `📂 *Kategoriyalar*\n\nQaysi bo'limni tanlaysiz?`,
  cat_hotdog: `🌭 Hotdog`,
  cat_pizza: `🍕 Pitsa`,
  cat_burgers: `🍔 Burger`,
  cat_doner: `🥙 Doner`,
  cat_desserts: `🍰 Shirinliklar`,
  cat_drinks: `🥤 Ichimliklar`,
  cat_tea: `🍵 Choy`,
  cat_lavash: `🌯 Lavash`,
  cat_haggee: `🥖 Haggee`,
  cat_sandwich: `🥪 Sandwich`,
  cat_fries: `🍟 Kartoshka FRI`,
  cat_shawarma: `🌯 Shaverma`,

  product_price: `💰 Narxi`,
  product_qty: `Miqdori`,
  btn_add_cart: `🛒 Savatga qo'shish`,
  btn_fav_add: `❤️ Sevimlilarga qo'shish`,
  btn_fav_remove: `💔 Sevimlilardan olib tashlash`,
  added_to_cart: (name: string, qty: number, total: string, count: number) =>
    `✅ *Savatga qo'shildi!*\n\n🍔 ${name} × ${qty}\n\n📦 Savatda: *${count} ta*\n💰 Jami: *${total}*`,
  btn_view_cart: `🛒 Savatni ko'rish`,
  btn_continue: `🍔 Xaridni davom ettirish`,
  fav_added: `❤️ Sevimlilarga qo'shildi!`,
  fav_removed: `💔 Sevimlilardan olib tashlandi!`,
  unavailable: `⛔ Bu mahsulot hozircha mavjud emas`,

  cart_empty: `🛒 *Savatingiz bo'sh!*\n\nMenyudan mahsulot qo'shing.`,
  cart_title: `🛒 *Savatingiz*\n\n`,
  cart_subtotal: `📋 Mahsulotlar`,
  cart_delivery: `🚚 Yetkazish`,
  cart_free: `Bepul`,
  cart_delivery_negotiable: `haydovchi bilan kelishiladi`,
  cart_total: `💰 *Jami`,
  btn_checkout: `✅ Buyurtma berish`,
  btn_clear_cart: `🗑 Savatni tozalash`,
  cart_cleared: `✅ Savat tozalandi!`,
  free_delivery_hint: `\n\n💡 _150 000 so'mdan yuqori buyurtmalarga yetkazish bepul!_`,

  choose_delivery_type: `🚀 *Buyurtmani qanday olasiz?*`,
  btn_delivery_type: `🛵 Yetkazib berish`,
  btn_pickup_type: `🏃 Olib ketish`,
  enter_address: `📍 *Manzilingizni kiriting:*\n\nMasalan: Toshkent, Chilonzor 5-kvartal, 12-uy\n\nYoki 📍 lokatsiya / Google Maps havolasini yuboring`,
  enter_phone: `📞 *Telefon raqamingizni kiriting:*\n\nMasalan: +998 90 123 45 67`,
  btn_share_contact: `📱 Raqamni yuborish`,
  enter_note: `📝 *Izoh qoldirasizmi?*\n\nMasalan: 3-qavat, qo'ng'iroq qiling`,
  btn_skip_note: `⏭ O'tkazib yuborish`,
  choose_payment: `💳 *To'lov turini tanlang:*`,
  btn_pay_card: `💳 Karta`,
  btn_pay_cash: `💵 Naqd pul`,
  card_payment_info: (card: string, owner: string) => `💳 <b>Karta orqali to'lov</b>\n\nQuyidagi kartaga o'tkazing:\n<b>${card}</b>${owner ? `\n👤 ${owner}` : ''}\n\nTo'lovdan so'ng chekni rasm yoki PDF ko'rinishida shu yerga yuboring. Buyurtmangiz chek yuborilgandan keyingina qabul qilinadi.`,
  receipt_required: `🧾 Iltimos, to'lov chekini *rasm yoki PDF* ko'rinishida yuboring. Chek kelmaguncha buyurtmangiz qabul qilinmaydi.`,

  order_confirmed: (id: string) =>
    `⏳ *Buyurtmangiz yuborildi!*

🆔 Buyurtma: *#${id}*
📊 Holat: ⏳ Tasdiq kutilmoqda

Admin buyurtmangizni ko'rib chiqmoqda. Tasdiqlangach sizga darhol xabar beramiz.`,
  pickup_confirmed: (id: string) =>
    `⏳ *Buyurtmangiz yuborildi!*

🆔 Buyurtma: *#${id}*
📍 Manzil: Toshkent, Amir Temur ko'chasi 15
📊 Holat: ⏳ Tasdiq kutilmoqda

Admin buyurtmangizni ko'rib chiqmoqda. Tasdiqlangach sizga darhol xabar beramiz.`,
  btn_track: `📍 Buyurtmani kuzatish`,

  status_preparing_msg: `👨‍🍳 *Buyurtmangiz tayyorlanmoqda!*\n\nOshpazimiz ishga kirishdi. Ko'p kuttirmaymiz! 🔥`,
  status_on_way_msg: `🛵 *Kuryer yo'lda!*\n\nBuyurtmangiz tez orada yetib boradi. Tayyor turing! 📦`,
  status_delivered_msg: `🟢 *Buyurtma yetkazildi!*\n\nXaridingiz uchun rahmat! 🎉\nYana kutib qolamiz! 😊`,
  status_ready_pickup_msg: (id: string) =>
    `🟠 *Buyurtmangiz tayyor!*\n\n🆔 Buyurtma: #${id}\n📍 Manzil: Toshkent, Amir Temur ko'chasi 15\n⏰ Ish vaqti: 10:00 - 23:00\n\nOlib ketishingiz mumkin! 🙏`,
  status_picked_up_msg: `✅ *Buyurtma olib ketildi!*\n\nXaridingiz uchun katta rahmat! 🎉\nYana keling! 😊`,
  status_cancelled_msg: `❌ *Buyurtmangiz bekor qilindi.*\n\nSavollar bo'lsa, yordam xizmatiga murojaat qiling.`,

  status_new: `⏳ Tasdiq kutilmoqda`,
  status_received_msg: (id: string) =>
    `✅ *Buyurtmangiz tasdiqlandi!*\n\n🆔 Buyurtma: *#${id}*\n⏱ Taxminiy vaqt: 30-45 daqiqa\n\nTez orada tayyorlashni boshlaymiz! 🔥`,
  status_cancelled_reason_msg: (id: string, reason: string) =>
    `❌ *Buyurtmangiz bekor qilindi.*\n\n🆔 Buyurtma: *#${id}*\n📝 Sabab: ${reason}\n\nSavollar bo'lsa, yordam xizmatiga murojaat qiling.`,
  cancel_reason_label: `📝 Sabab`,
  status_received: `🟡 Qabul qilindi`,
  status_preparing: `👨‍🍳 Tayyorlanmoqda`,
  status_on_way: `🛵 Yo'lda`,
  status_delivered: `🟢 Yetkazildi`,
  status_ready_pickup: `🟠 Olib ketishga tayyor`,
  status_picked_up: `✅ Olib ketildi`,
  status_cancelled: `❌ Bekor qilindi`,

  orders_title: `📦 *Buyurtmalarim*\n\n`,
  no_orders: `📦 *Hali buyurtmalar yo'q!*\n\nBirinchi buyurtmangizni bering!`,
  order_line: (id: string, status: string, total: string, date: string) =>
    `📦 *${id}* — ${status}\n💰 ${total} • 📅 ${date}`,

  favorites_title: `❤️ *Sevimlilar*\n\n`,
  no_favorites: `❤️ *Sevimlilar ro'yxati bo'sh!*\n\nMahsulot sahifasida ❤️ ni bosing.`,

  promos_title: `🎁 *Aksiyalar va maxsus takliflar*\n\n`,

  delivery_info: (hours: string) => `📍 *Yetkazib berish*\n\n⏱ Vaqt: 30-60 daqiqa\n💰 Narxi: haydovchi bilan kelishiladi\n📍 Hudud: Xonqa tumani\n🕐 Ish vaqti: ${hours}`,

  profile_title: (name: string, phone: string, orders: number) =>
    `👤 *Mening profilim*\n\n👤 Ism: *${name}*\n📞 Telefon: *${phone}*\n📦 Buyurtmalar: *${orders}*`,

  support_title: (phone: string, username: string, hours: string) => `📞 <b>Yordam markazi</b>\n\n📱 Telefon: ${phone}\n📩 Telegram: @${username}\n⏰ Ish vaqti: ${hours}`,
  btn_call: `📞 Qo'ng'iroq qilish`,
  btn_write: `✉️ Yozish`,

  btn_edit_price: `✏️ Narxni o'zgartirish`,
  btn_toggle: (available: boolean) => available ? `⛔ O'chirish` : `✅ Yoqish`,
  btn_delete: `🗑 O'chirish`,
  btn_cancel_order: `❌ Buyurtmani bekor qilish`,
  currency: `so'm`,
};
