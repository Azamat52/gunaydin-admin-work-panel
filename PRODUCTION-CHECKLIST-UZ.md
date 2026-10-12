# Production tekshiruv ro‘yxati — GünAydın Admin

## Render backend Environment Variables

- `NODE_ENV=production`
- `BOT_TOKEN` — BotFather’dan olingan amaldagi bot tokeni
- `DATABASE_URL` — Neon/PostgreSQL ulanish satri
- `DATABASE_SSL=true`
- `ADMIN_LOGIN` — yangi admin bazasi yaratilayotganda ishlatiladigan login
- `ADMIN_PASSWORD` — kamida 12 belgili, noyob parol (faqat birinchi admin yaratilayotganda)
- `FRONTEND_URL=https://SIZNING-FRONTEND-DOMENINGIZ` — frontendning aniq HTTPS origin’i, `/api` qo‘shilmaydi
- `BROADCAST_UPDATES=true` (ixtiyoriy)

## Frontend hosting Environment Variables

- `VITE_API_URL=https://gunaydin-admin-work-panel.onrender.com` — backend origin’i; `/api` qo‘shmang va oxiriga `/` qo‘ymang. Agar Render URL o‘zgargan bo‘lsa, haqiqiy URL’ni ishlating.

Frontend domeni o‘zgarsa, Render’dagi `FRONTEND_URL` ni ham o‘sha domenga moslang. Frontend va backend environment variable’larini yangilagandan keyin ikkala servisni ham qayta deploy qiling.

## Deploydan keyin sinov

1. `https://SIZNING-RENDER-DOMENINGIZ/health` ochilganda `{"ok":true}` javobi kelishi kerak.
2. Admin panel login qilishi kerak.
3. Buyurtmalar va mahsulotlar yuklanishini tekshiring.
4. Buyurtma holatini o‘zgartirib, Telegram xabari va jonli panel yangilanishini tekshiring.
5. Logout qilib, eski sessiya tokeni bilan API so‘rovi 401 qaytarishini tekshiring.
6. Render va Neon’da loglar, backup va billingni tekshiring.

## Juda muhim — maxfiy ma’lumotlar

Bu loyihaning yuborilgan arxivida `.env.example` ichida haqiqiyga o‘xshash Telegram bot tokeni va PostgreSQL paroli bor edi. Ushbu yangilangan ZIP’da ular olib tashlandi. Ammo ZIP yuborilishidan oldin bu ma’lumotlar oshkor bo‘lgan bo‘lishi mumkin: **BotFather’da tokenni revoke/regenerate qiling va Neon’da DB parolini almashtiring**. So‘ng Render Environment Variables ichida yangi qiymatlarni saqlab, backendni redeploy qiling. Faqat ZIP’dagi qiymatni almashtirish yetarli emas.

## Cheklov

Ushbu arxivdagi kod statik ko‘rib chiqildi. Paketlarni o‘rnatish muhiti vaqt tugashi sababli `npm ci` yakunlanmadi, shuning uchun bu tekshiruvda production build va haqiqiy Render/Neon/Telegram ulanishlari to‘liq ishga tushirib tasdiqlanmadi. Deploydan oldin `backend` va `frontend` papkalarida `npm ci` hamda `npm run build` bajarilsin.
