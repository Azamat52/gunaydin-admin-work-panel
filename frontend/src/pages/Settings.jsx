import { Spinner, LoadingOverlay } from "@/components/admin/loader";
import { useEffect, useState } from "react";
import { Bell, Clock, CreditCard, KeyRound, Save, Monitor, Moon, RotateCcw, RefreshCw, SlidersHorizontal, Sun, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/store/settings-store";
import { playOrderSound } from "@/lib/notify";
import { getWorkHours, saveWorkHours, getShopSettings, saveShopSettings, saveAdminCreds, restartBot } from "@/lib/admin.functions";
import { workHoursStatus } from "@/lib/work-hours";

const THEMES = [{ value: "light", label: "Yorug‘", icon: Sun }, { value: "dark", label: "Qorong‘i", icon: Moon }, { value: "system", label: "Qurilmaga mos", icon: Monitor }];

function SettingRow({ title, children, htmlFor }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:gap-4 border-b border-border py-5 last:border-0">
    <label htmlFor={htmlFor} className="min-w-0 text-sm font-medium">{title}</label>
    {children}
  </div>;
}

function WorkHours() {
  const [h, setH] = useState({ enabled: false, open: "09:00", close: "23:00" });
  const [openNow, setOpenNow] = useState(null);
  const [savedHours, setSavedHours] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const refresh = () => getWorkHours().then((d) => { if (d?.workHours) { setH(d.workHours); setSavedHours(d.workHours); } if (d) setOpenNow(d.openNow); }).catch(() => toast.error("Ish vaqtini yuklab bo‘lmadi"));
  useEffect(() => {
    refresh();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const t = setInterval(() => { getWorkHours().then((d) => { if (d?.workHours) setSavedHours(d.workHours); if (d) setOpenNow(d.openNow); }).catch(() => {}); }, 30000);
    return () => { clearInterval(tick); clearInterval(t); };
  }, []);
  const countdown = workHoursStatus(savedHours, now);
  const currentOpen = countdown?.open ?? openNow;
  const save = async () => {
    if (!h.open || !h.close) return toast.error("Ochilish va yopilish vaqtini kiriting");
    setSaving(true);
    try {
      await saveWorkHours(h);
      setSavedHours({ ...h });
      setNow(Date.now());
      const d = await getWorkHours().catch(() => null);
      if (d) { setOpenNow(d.openNow); if (d.workHours) setSavedHours(d.workHours); }
      toast.success("Ish vaqti saqlandi — har kuni avtomatik ishlaydi");
    }
    catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return <section className="border-t border-border py-6">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Clock className="size-5 text-primary" />Ish vaqti</h2>
    <p className="mt-1 text-sm text-muted-foreground">Ish vaqtidan tashqari mijozlar botga yozsa, “ish vaqtimiz tugagan” degan xabar oladi. Vaqt har kuni avtomatik takrorlanadi (Toshkent vaqti).</p>
    {currentOpen !== null && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className={`rounded-md px-3 py-1 text-sm font-medium ${currentOpen ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"}`}>Hozirgi holat: {currentOpen ? "🟢 Ochiq — bot ishlayapti" : "🔴 Yopiq — mijozlarga “ish vaqti tugagan” xabari ketadi"}</p>
      {countdown && <p role="timer" aria-label="Ish vaqti hisoblagichi" className="text-sm font-medium text-muted-foreground tabular-nums">{countdown.label}</p>}
    </div>}
    <SettingRow title="Ish vaqti cheklovi yoqilgan" htmlFor="wh-enabled"><Switch id="wh-enabled" checked={h.enabled} onCheckedChange={(enabled) => setH({ ...h, enabled })} /></SettingRow>
    <SettingRow title="Ochilish vaqti" htmlFor="wh-open"><input id="wh-open" type="time" value={h.open} onChange={(e) => setH({ ...h, open: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm" /></SettingRow>
    <SettingRow title="Yopilish vaqti" htmlFor="wh-close"><input id="wh-close" type="time" value={h.close} onChange={(e) => setH({ ...h, close: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm" /></SettingRow>
    <Button className="mt-3" onClick={save} disabled={saving}><Save />{saving ? <><Spinner />Saqlanmoqda…</> : "Saqlash"}</Button>
  </section>;
}

function ShopSettings() {
  const [x, setX] = useState({ adminLogin: "", adminPassword: "", currentPassword: "", cardNumber: "", cardOwner: "" });
  const [saving, setSaving] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [loadingS, setLoadingS] = useState(true);
  useEffect(() => { getShopSettings().then((d) => setX((c) => ({ ...c, ...d }))).catch(() => toast.error("Sozlamalarni yuklab bo‘lmadi")).finally(() => setLoadingS(false)); }, []);
  const saveAdmin = async () => {
    if (x.adminLogin.trim().length < 3) return toast.error("Login kamida 3 ta belgi bo‘lsin");
    if (x.adminPassword && x.adminPassword.length < 4) return toast.error("Parol kamida 4 ta belgi bo‘lsin");
    if (!x.currentPassword) return toast.error("Joriy parolni kiriting");
    setSavingAdmin(true);
    try {
      const r = await saveAdminCreds({ adminLogin: x.adminLogin, adminPassword: x.adminPassword, currentPassword: x.currentPassword });
      setX((c) => ({ ...c, adminLogin: r.adminLogin, adminPassword: "", currentPassword: "" }));
      toast.success("Login va parol bazaga saqlandi");
    } catch (e) { toast.error(e.message); }
    finally { setSavingAdmin(false); }
  };
  const field = (id, title, key, type = "text", placeholder = "") => <SettingRow title={title} htmlFor={id}><input id={id} type={type} value={x[key] ?? ""} placeholder={placeholder} onChange={(e) => setX({ ...x, [key]: e.target.value })} className="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm" /></SettingRow>;
  const save = async () => {
    if (x.cardNumber.replace(/\D/g, "").length !== 16) return toast.error("Karta raqami 16 ta raqam bo‘lishi kerak");
    setSaving(true);
    try { const r = await saveShopSettings({ cardNumber: x.cardNumber, cardOwner: x.cardOwner }); setX((c) => ({ ...c, ...r.settings })); toast.success("Saqlandi — bot endi shu kartani ko‘rsatadi"); }
    catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return <>
    <LoadingOverlay active={loadingS || saving || savingAdmin} text={loadingS ? "Yuklanmoqda…" : "Saqlanmoqda…"} />
    <section className="border-t border-border py-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="size-5 text-primary" />Admin login va parol</h2>
      {field("s-login", "Login", "adminLogin")}
      {field("s-pass", "Yangi parol", "adminPassword", "password", "O‘zgartirmasangiz bo‘sh qoldiring")}
      {field("s-cur", "Joriy parol", "currentPassword", "password", "Tasdiqlash uchun")}
      <Button className="mt-3" onClick={saveAdmin} disabled={savingAdmin}><Save />{savingAdmin ? <><Spinner />Saqlanmoqda…</> : "Login/parolni saqlash"}</Button>
    </section>
    <section className="border-t border-border py-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><CreditCard className="size-5 text-primary" />To‘lov kartasi</h2>
      <p className="mt-1 text-sm text-muted-foreground">Mijoz “Karta orqali” to‘lovni tanlasa, bot shu karta raqamini yuboradi.</p>
      {field("s-card", "Karta raqami", "cardNumber", "text", "8600 0000 0000 0000")}
      {field("s-owner", "Karta egasi (ixtiyoriy)", "cardOwner", "text", "Ism Familiya")}
      <Button className="mt-3" onClick={save} disabled={saving}><Save />{saving ? <><Spinner />Saqlanmoqda…</> : "Saqlash"}</Button>
    </section>
  </>;
}

function RestartBot() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!confirm("Botni qayta ishga tushirasizmi?")) return;
    setBusy(true);
    try { await restartBot(); toast.success("Bot qayta ishga tushirilmoqda..."); }
    catch (e) { toast.error(e.message || "Restart qilib bo‘lmadi"); }
    finally { setTimeout(() => setBusy(false), 5000); }
  };
  return <section className="border-t border-border py-6">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><RefreshCw className="size-5 text-primary" />Botni qayta ishga tushirish</h2>
    <p className="mt-1 text-sm text-muted-foreground">Sozlamalar o‘zgargandan keyin botni restart qiling.</p>
    <Button className="mt-3" variant="destructive" onClick={run} disabled={busy}><RefreshCw className={busy ? "animate-spin" : ""} />{busy ? "Restart..." : "Restart"}</Button>
  </section>;
}

export default function Settings() {
  const { settings, updateSettings, resetSettings } = useSettings();
  return <div className="mx-auto max-w-4xl">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div><p className="mb-1 text-xs font-medium uppercase text-primary">GunAydin Admin</p><h1 className="text-3xl font-bold">Sozlamalar</h1></div>
      <Button variant="outline" onClick={() => { resetSettings(); toast.success("Sozlamalar tiklandi"); }}><RotateCcw />Tiklash</Button>
    </header>
    <WorkHours />
    <ShopSettings />
    <RestartBot />
    <section className="border-t border-border py-6">
      <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold"><Sun className="size-5 text-primary" />Ko‘rinish</h2>
      <div aria-label="Rang rejimi" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {THEMES.map(({ value, label, icon: Icon }) => <Button key={value} variant={settings.theme === value ? "default" : "outline"} aria-pressed={settings.theme === value} className="h-16 justify-start px-5" onClick={() => updateSettings({ theme: value })}><Icon />{label}</Button>)}
      </div>
      <SettingRow title="Ixcham ko‘rinish" htmlFor="compact"><Switch id="compact" checked={settings.compact} onCheckedChange={(compact) => updateSettings({ compact })} /></SettingRow>
    </section>
    <section className="border-t border-border py-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className="size-5 text-primary" />Buyurtma bildirishnomalari</h2>
      <SettingRow title="Yangi buyurtma xabari" htmlFor="notifications"><Switch id="notifications" checked={settings.notifications} onCheckedChange={(notifications) => updateSettings({ notifications })} /></SettingRow>
      <SettingRow title="Xabar ko‘rinish vaqti" htmlFor="duration"><select id="duration" className="h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50" value={settings.notificationDuration} disabled={!settings.notifications} onChange={(e) => updateSettings({ notificationDuration: Number(e.target.value) })}>{[5, 8, 15].map((value) => <option key={value} value={value}>{value} soniya</option>)}</select></SettingRow>
    </section>
    <section className="border-t border-border py-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Volume2 className="size-5 text-primary" />Tovush</h2>
      <SettingRow title="Buyurtma kelganda tovush" htmlFor="sound"><Switch id="sound" checked={settings.sound} onCheckedChange={(sound) => updateSettings({ sound })} /></SettingRow>
      <SettingRow title="Tovush balandligi" htmlFor="volume"><div className="col-span-2 flex w-full max-w-xs items-center gap-3 sm:col-span-1"><input id="volume" type="range" min="0" max="100" step="5" disabled={!settings.sound} value={settings.volume} onChange={(e) => updateSettings({ volume: Number(e.target.value) })} className="min-w-0 flex-1 accent-primary disabled:opacity-50" /><output htmlFor="volume" className="w-12 text-right text-sm tabular-nums">{settings.volume}%</output></div></SettingRow>
      <div className="mt-3 flex flex-wrap gap-3"><Button variant="secondary" disabled={!settings.sound || settings.volume === 0} onClick={() => playOrderSound(settings.volume)}><Volume2 />Tovushni sinash</Button><Button variant="outline" disabled={!settings.notifications} onClick={() => toast.success("🔔 Sinov buyurtmasi", { position: "top-center", description: "GunAydin", duration: settings.notificationDuration * 1000 })}><Bell />Xabarni sinash</Button></div>
    </section>
    <footer className="flex items-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground"><SlidersHorizontal className="size-4 shrink-0" />Shaxsiy sozlamalar · Ushbu brauzer</footer>
  </div>;
}
