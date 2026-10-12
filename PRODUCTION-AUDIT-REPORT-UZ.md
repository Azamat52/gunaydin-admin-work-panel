# Production tekshiruv hisoboti — GünAydın Admin

## Tekshiruv natijalari
- Frontend va backend `package.json` hamda lockfile'lari ko'rildi; lockfile format v3 va paket nomlari mos.
- REST API uchun CORS middleware marshrutlardan oldin qo'yilgan.
- Production rejimida `FRONTEND_URL` aniq HTTPS origin bo'lishi va `*` bo'lmasligi tekshiriladi.
- Socket.IO ham shu CORS siyosatidan foydalanadi va ulanishda admin tokenini tekshiradi.
- `.env.example` fayllarida haqiqiy token/parol o'rniga placeholder ishlatilgan.
- Frontend va backend uchun Node.js `>=22.12.0` talabi manifest va lockfile'ga aniq yozildi. Bu Vite 7 bilan mos zamonaviy Node runtime ishlatilishini ta'minlashga yordam beradi.

## Deploydan oldin bajarish kerak
1. `backend` papkasida `npm ci` va `npm run build`.
2. `frontend` papkasida `npm ci` va `npm run build`.
3. Backend hostingida `NODE_ENV=production`, `BOT_TOKEN`, `DATABASE_URL`, `DATABASE_SSL=true`, `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `FRONTEND_URL` ni kiriting. Birinchi admin yaratilishida parol kamida 12 belgili bo'lsin.
4. Frontend hostingida `VITE_API_URL` ni backendning to'liq originiga qo'ying (masalan `https://your-service.onrender.com`; `/api` va oxirgi `/` qo'shmang).
5. `/health`, login, buyurtma holatini o'zgartirish, Socket.IO jonli yangilanishi va logoutni real hostingda sinang.
6. Bot tokeni yoki DB paroli ilgari ZIP/repozitoriyda haqiqiy ko'rinishda bo'lgan bo'lsa, ularni albatta yangilang.

## Muhim cheklov
Ushbu muhitda npm paketlari offline keshda yo'q edi (`npm ci --offline` ENOTCACHED bilan to'xtadi). Shu sababli haqiqiy `npm run build`, TypeScript kompilyatsiyasi va hosting/Telegram/PostgreSQL integratsion sinovlari bajarilmadi. Demak, bu arxiv statik tekshiruvdan o'tkazildi, ammo faqat shu tekshiruv asosida loyihani 100% production-ready deb kafolatlab bo'lmaydi.
