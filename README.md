# GunAydin: React JS (frontend) + backend

## Qurilmalarga mos admin panel (v18)
- Telefonda pastki tablar: Boshqaruv, Buyurtmalar, Mahsulotlar, Statistika va Yana.
- Yana orqali Aksiyalar, Mijozlar va Sozlamalar ochiladi. Tab almashganda sahifa manzili o'zgarmaydi; ochilgan bo'limlarning qidiruv, filtr va aylantirish holati saqlanadi.
- Telefon va kichik planshetlarda buyurtmalar/mijozlar kartochkalarda; katta ekranlarda jadvallarda chiqadi.
- Aksiya tafsilotlari telefonda ustki oynada ochiladi. Shakllar, vaqt maydonlari, login va grafiklar kichik ekranlarga moslangan.
- 320, 390, 768 va 1280 piksel kenglikda namunaviy ma'lumotlar bilan tekshirildi; frontend production build muvaffaqiyatli.
- Backend, Telegram bot va tushum hisoblash qoidalari o'zgartirilmagan. Haqiqiy Telegram va PostgreSQL ulanishi bu tekshiruvda sinovdan o'tkazilmagan.

## 1. Backend (PostgreSQL bilan)
    cd backend
    npm install
    cp .env.example .env   # BOT_TOKEN, ADMIN_LOGIN, ADMIN_PASSWORD, DATABASE_URL ni yozing
    npm run dev            # http://localhost:4000

## 2. Frontend (sof React JS: Vite + React Router)
    cd frontend
    npm install
    cp .env.example .env   # VITE_API_URL=http://localhost:4000
    npm run dev            # http://localhost:8080

Kirish: backend .env dagi ADMIN_LOGIN / ADMIN_PASSWORD.
Frontend backendga REST (/api/...) va Socket.IO (jonli yangilanish) orqali ulanadi.
Tayyor build: npm run build -> frontend/dist


## 3. Galereyadan rasmlar
Mahsulot va aksiya oynasida “Galereyadan tanlash” orqali kompyuter yoki telefon rasmini tanlang,
so‘ng “Saqlash” ni bosing. JPG, PNG, WebP qabul qilinadi (20 MB gacha); HEIC ni JPG ga aylantiring.
Rasm brauzerda kichraytiriladi va JPEG sifatida mavjud API dagi `image` maydoniga yuboriladi.
Alohida upload endpoint yoki backend o‘zgarishi yo‘q. Rasm saqlanmaguncha faqat oldindan ko‘rishdir.
Saqlash xatosida oyna ochiq qoladi va qayta urinishingiz mumkin.

### Hostingdan keyin kim ko‘radi?
Muvaffaqiyatli saqlangan rasm backendning `data.json` faylida mahsulot/aksiya bilan saqlanadi.
Shu backend ma’lumotini oladigan sayt va boshqa admin qurilmalarda ham ko‘rinadi;
u faqat tanlagan telefon yoki kompyuterda qolmaydi. Mazkur ZIP admin paneldir:
`/api/data` admin kirishini talab qiladi, shuning uchun hosting qilishning o‘zi ommaviy katalog yaratmaydi.
Xaridorlar sayti ham ushbu `image` maydonini `<img src={image}>` bilan ko‘rsatishi kerak.

Frontenddagi `VITE_API_URL` ni ishlayotgan HTTPS backend manziliga, backenddagi mavjud
`FRONTEND_URL` sozlamasini esa frontend manziliga moslang. `localhost` internetdagi foydalanuvchilarga ishlamaydi.
Backend hostingida `data.json` yozilishi va qayta ishga tushirilganda saqlanib qolishi kerak
(doimiy disk/volume va zaxira nusxa). Vaqtinchalik diskli hosting faylni yo‘qotishi mumkin.
Rasm alohida HTTPS URL emas, data URI: Telegramga URL sifatida foto yuborish uchun mos emas.
Backend va Telegram bot kodi o‘zgartirilmagan.

## 4. Real-time: admin panel → Telegram bot
Admin panelda saqlangan o'zgarish botga darhol yetadi:
- Yangi mahsulot (yoki yana sotuvga qo'yilgan mahsulot) — barcha bot foydalanuvchilariga rasm va "Ko'rish" tugmasi bilan xabar yuboriladi.
- Yangi faol aksiya — darhol xabar yuboriladi.
- Narx/nom o'zgarsa yoki mahsulot o'chirilsa — foydalanuvchilar savatchasi avtomatik yangilanadi.
- Admin panel Socket.IO orqali jonli yangilanadi (botdagi buyurtmalar ham darhol ko'rinadi).
Xabar yuborishni o'chirish: backend .env da `BROADCAST_UPDATES=false`.

## Jonli yangilanish (Socket.IO)
- Buyurtma, holat, mahsulot, aksiya va mijozlardagi har qanday o'zgarish barcha ochiq admin panellarga darhol yetadi (`state`, `order:new`, `order:updated` hodisalari).
- Holat panelda yoki Telegramda o'zgarsa, Telegramdagi barcha admin buyurtma xabarlari va mijozning "Kuzatish" kartasi o'zi yangilanadi.
- Holat faqat oldinga o'zgaradi; oldingi bosqich tugmalari yo'qoladi.
- Panel yuqorisida "Jonli" / "Oflayn" belgisi ulanish holatini ko'rsatadi.
- `FRONTEND_URL` bir nechta manzilni vergul bilan qabul qiladi (yoki `*`). localhost har qanday portda ruxsat etilgan.

## Menyu va Combo (v12)
- Menyu: Hotdog, Pitsa, Burger, Doner, Shirinliklar, Ichimliklar, Choy, Lavash, Haggee, Sandwich, Kartoshka FRI, Shaverma.
- Haqiqiy menyu (46 ta mahsulot, narxlari bilan) kiritildi. Lavash kategoriyasi olib tashlandi.
- Combo alohida menyu kategoriyasi emas: Aksiyalar → Yangi aksiya → Combo / Oilaviy set. Mahsulotlar, miqdor va set narxini tanlang.
- 3 ta namunaviy Combo mavjud: burger seti, oilaviy set va hotdog seti.
- Mahsulot va aksiya rasm joylari bo‘sh; faqat yuklangan rasm ko‘rsatiladi. Standart rasmlar avtomatik qo‘yilmaydi.
- Ushbu ZIP ichidagi backend/data.json yangilangan namunaviy menyuni saqlaydi. Ishlayotgan serverdagi eski data.json faylini ko‘r-ko‘rona almashtirmang: avval zaxira oling, aks holda mavjud buyurtmalar va mijozlar yo‘qolishi mumkin. Yangi katalogni admin paneldan kiritish yoki alohida ko‘chirish kerak.


## PostgreSQL (v13)
- Barcha ma'lumotlar (mahsulotlar, aksiyalar, buyurtmalar, mijozlar) endi PostgreSQL da saqlanadi, data.json emas.
- backend/.env ga `DATABASE_URL=postgres://user:parol@host:5432/baza` yozing. Bulutli baza SSL so'rasa `DATABASE_SSL=true`.
- Jadvallar birinchi ishga tushishda o'zi yaratiladi: products, promotions, orders, customers, app_meta.
- Baza bo'sh bo'lsa: eski data.json bor bo'lsa o'sha bazaga ko'chiriladi, yo'q bo'lsa yangi menyu yoziladi.
- Frontendda hech narsa sozlash shart emas — u avvalgidek backend API orqali ishlaydi.


## Production deployment (Render + Vercel)

### Render (backend + Telegram bot)
Create a **Web Service** from the `backend` directory:
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Runtime: Node.js; set `NODE_ENV=production`.

Set these environment variables in Render (do not commit real values):
- `BOT_TOKEN`: a newly generated Telegram bot token
- `DATABASE_URL`: your Neon/PostgreSQL connection string
- `DATABASE_SSL=true`
- `ADMIN_LOGIN`: a unique admin login
- `ADMIN_PASSWORD`: a long, unique password
- `FRONTEND_URL=https://YOUR-VERCEL-DOMAIN.vercel.app` (exact origin, no trailing slash; comma-separated if using multiple trusted frontend origins)
- `BROADCAST_UPDATES=true` (optional)

Use a PostgreSQL database with backups. The app stores orders/customers in PostgreSQL; don't rely on an ephemeral Render filesystem for business data. Only one active backend instance should run this long-polling Telegram bot unless polling is moved to a dedicated single worker.

### Frontend hosting (MCWeb yoki Vercel)
Frontend loyihasining Root Directory/ishchi papkasi `frontend` bo‘lishi kerak. Agar MCWeb Root Directory tanlashga ruxsat bermasa, `frontend/` ichidagi fayllarni alohida GitHub repositoryga joylab, o‘sha repositoryni deploy qiling. Build Command: `npm run build`; Output Directory: `dist`.
Frontend hosting Environment Variables bo‘limiga qo‘shing:
- `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com` (backend origin only; no `/api` suffix and no trailing slash)

Render backend Environment Variables: `FRONTEND_URL=https://YOUR-FRONTEND-DOMAIN` (aniq frontend origin; `VITE_API_URL` dagi backend manzili emas). Ikkalasi bir-birining o‘rnini bosmaydi.

Redeploy after changing environment variables. Confirm the Render URL responds and then test login, loading orders, changing order status, and live updates. CORS permits only the origin(s) listed in `FRONTEND_URL` plus localhost during development.

### Secrets and first deploy
Never upload `.env` files or real tokens/passwords to GitHub. The `.env.example` files contain placeholders only. If a real Telegram token or PostgreSQL password was shared in any ZIP or committed to a public repository, revoke/regenerate it immediately (BotFather for Telegram; Neon dashboard for the database), then update the hosting environment variables and redeploy. If a real Telegram token or database password has ever been committed or shared in an archive, rotate it before production. Do not overwrite an existing production database with sample data; take a backup first.
# gunaydin-admin-work-panel

