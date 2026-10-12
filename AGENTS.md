# Architecture rules
- This downloadable package runs as a standalone Node/Express backend and Vite React admin frontend; keep it separate from the hosted TanStack app to preserve its deployment contract.
- Backend category metadata drives both customer and admin Telegram category keyboards, preventing divergent category lists.
- Combo sets are promotions referencing catalog products and quantities, not a parallel product category, so existing promotion editing and realtime persistence apply.
- Backend persistence is PostgreSQL via DATABASE_URL, keeping the in-memory store API so bot/API code stays unchanged.
- Frontend media helpers return only supplied image values, and empty media regions keep stable dimensions without fallback assets.

- Phone admin sections use retained tab panels and context-aware internal links without URL navigation; desktop/tablet retain router pages, preserving filters and scroll positions on phones.
- Orders and customers use complete card lists below the large breakpoint and tables on larger displays, keeping every field accessible without phone-wide tables.
- Payment receipts are stored as Telegram file IDs on the order and proxied through an authenticated admin API route, so no extra file storage or paid verification is needed.
- The work-hours status countdown uses the saved daily UTC+5 schedule and a client-side second timer, so unsaved edits never change the live status or require per-second API calls.
