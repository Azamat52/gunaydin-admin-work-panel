import { Spinner } from "@/components/admin/loader";
import { AdminLink as Link } from "@/components/admin/admin-navigation";
import { CalendarDays, Gift, Minus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/admin/empty-state";
import { productImage, promotionImage } from "@/data/products";
import { ImagePicker } from "@/components/admin/image-picker";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fmtSum, isPromoExpired, isPromoUpcoming, promoEndMs, promoStartMs } from "@/lib/bot-types";
import { withExtras, PROMO_TYPES, autoBadge, fmtLeft, msLeft, promoRule, promoSummary, promoTypeOf } from "@/lib/promo-types";
import { useAdminStore } from "@/store/admin-store";

const toLocalInput = (v, defTime) => (!v ? "" : v.length <= 10 ? `${v}T${defTime}` : v.slice(0, 16));

const emptyForm = () => ({
  emoji: "🎁",
  badge: "-10%",
  active: true,
  type: "percent",
  value: 10,
  buyQty: 1,
  getQty: 1,
  setPrice: 0,
  minOrder: 0,
  giftProductId: "",
  hoursFrom: "12:00",
  hoursTo: "16:00",
  items: [],
  extraProducts: [],
  title: { uz: "", ru: "", en: "" },
  description: { uz: "", ru: "", en: "" },
  startsAt: "",
  endsAt: "",
});

export const fmtDay = (d) => {
  const [date, time] = d.split("T");
  return date.split("-").reverse().join(".") + (time ? ` ${time.slice(0, 5)}` : "");
};

/** Re-renders every 30s so countdowns stay fresh. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  return now;
}

export function PromoPeriod({ p }) {
  const now = useNow();
  const left = msLeft(p, now);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <CalendarDays className="size-3.5" />
        {p.startsAt || p.endsAt ? `${p.startsAt ? fmtDay(p.startsAt) : "…"} — ${p.endsAt ? fmtDay(p.endsAt) : "muddatsiz"}` : "Muddatsiz"}
      </span>
      {isPromoExpired(p, now) ? (
        <span className="rounded-full bg-destructive/15 px-2 py-0.5 font-medium text-destructive">Muddati tugagan</span>
      ) : isPromoUpcoming(p, now) ? (
        <span className="rounded-full bg-secondary px-2 py-0.5">Hali boshlanmagan</span>
      ) : left !== null ? (
        <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">{fmtLeft(left)} qoldi</span>
      ) : null}
    </div>
  );
}

function PromotionsPage() {
  const { promotions, products: menuProducts, categories, addPromotion, updatePromotion, deletePromotion } = useAdminStore();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageBusy, setImageBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [badgeTouched, setBadgeTouched] = useState(false);
  const [extra, setExtra] = useState({ name: "", price: "", category: "" });
  const products = menuProducts;
  const formProducts = withExtras(form, menuProducts);
  const isExtra = (id) => (form.extraProducts ?? []).some((e) => e.id === id);
  const addExtra = () => {
    const name = extra.name.trim();
    const price = Number(extra.price);
    if (!name) return toast.error("Mahsulot nomini kiriting");
    if (!(price > 0)) return toast.error("Narxni kiriting");
    if (!extra.category) return toast.error("Kategoriyani tanlang");
    const id = `extra_${Date.now()}`;
    const product = { id, name: { uz: name, ru: name, en: name }, description: { uz: "", ru: "", en: "" }, price, category: extra.category, emoji: "🎁", available: true };
    setForm((f) => {
      const next = { ...f, extraProducts: [...(f.extraProducts ?? []), product], items: [...f.items, { productId: id, qty: 1 }] };
      if (!badgeTouched) next.badge = autoBadge(next);
      return next;
    });
    setExtra({ name: "", price: "", category: extra.category });
  };
  const removeExtra = (id) => set({
    extraProducts: (form.extraProducts ?? []).filter((e) => e.id !== id),
    items: form.items.filter((i) => i.productId !== id),
    ...(form.giftProductId === id ? { giftProductId: "" } : {}),
  });

  const set = (patch) => setForm((f) => {
    const next = { ...f, ...patch };
    if (!badgeTouched) next.badge = autoBadge(next);
    return next;
  });

  const openNew = () => {
    setEditId(null);
    setBadgeTouched(false);
    setForm(emptyForm());
    setQ("");
    setExtra({ name: "", price: "", category: "" });
    setOpen(true);
  };
  const openEdit = (p) => {
    setEditId(p.id);
    setBadgeTouched(true);
    const { id: _id, ...rest } = p;
    setForm({ ...emptyForm(), ...rest, type: promoTypeOf(p), items: [...(p.items ?? [])], extraProducts: [...(p.extraProducts ?? [])], title: { uz: "", ru: "", en: "", ...p.title }, description: { uz: "", ru: "", en: "", ...p.description } });
    setQ("");
    setOpen(true);
  };

  const qtyOf = (id) => form.items.find((i) => i.productId === id)?.qty ?? 0;
  const setQty = (id, qty) => {
    const items = form.items.filter((i) => i.productId !== id);
    if (qty > 0) items.push({ productId: id, qty });
    set({ items });
  };

  const save = async () => {
    if (imageBusy || saving) return;
    if (!form.title.uz.trim()) return toast.error("O'zbekcha sarlavhani kiriting");
    if (form.startsAt && form.endsAt && promoEndMs(form) <= promoStartMs(form)) return toast.error("Tugash vaqti boshlanishdan keyin bo'lsin");
    if (form.active && isPromoExpired(form)) return toast.error("Muddati o'tgan aksiyani faol qilib bo'lmaydi");
    const needsProducts = !["delivery", "gift"].includes(form.type);
    if (needsProducts && form.items.length === 0) return toast.error("Aksiyaga kamida bitta mahsulot qo'shing");
    if (form.type === "combo" && !(Number(form.setPrice) > 0)) return toast.error("Set narxini kiriting");
    if (form.type === "gift" && !form.giftProductId) return toast.error("Sovg'a mahsulotni tanlang");
    setSaving(true);
    try {
      const ok = editId ? await updatePromotion(editId, form) : await addPromotion(form);
      if (!ok) return;
      toast.success(editId ? "Aksiya yangilandi" : "Aksiya qo'shildi");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const type = form.type;
  const summary = promoSummary(form, products);
  const filtered = formProducts.filter((p) => p.name.uz.toLowerCase().includes(q.toLowerCase()));
  const num = (k) => (e) => set({ [k]: Number(e.target.value) || 0 });

  return (
    <>
      <PageHeader
        title="Aksiyalar"
        subtitle={`${promotions.filter((p) => p.active && !isPromoExpired(p)).length} ta faol aksiya`}
        action={<Button onClick={openNew}><Plus className="size-4" /> Yangi aksiya</Button>}
      />

      {promotions.length === 0 ? (
        <div className="panel"><EmptyState icon={Gift} hint="Hali aksiyalar yo'q. «Yangi aksiya» tugmasi orqali qo'shing." /></div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {promotions.map((p) => {
          const t = PROMO_TYPES[promoTypeOf(p)];
          const s = promoSummary(p, products);
          return (
            <div key={p.id} className="panel group flex flex-col overflow-hidden transition-shadow hover:shadow-glow">
              <Link to={`/promotions/${p.id}`} className="relative block aspect-[2/1] overflow-hidden">
                {promotionImage(p) ? (<img src={promotionImage(p)} alt={p.title.uz} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />) : (<div aria-hidden="true" className="size-full object-cover transition-transform duration-300 group-hover:scale-105 bg-secondary" />)}
                <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card to-transparent" />
                <span className="absolute right-3 top-3 rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground shadow-glow">{p.badge}</span>
                <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium">{t.emoji} {t.label}</span>
              </Link>
              <div className="flex flex-1 flex-col gap-2 p-4 pt-2">
                <Link to={`/promotions/${p.id}`} className="font-medium hover:text-primary">{p.title.uz}</Link>
                <p className="text-sm text-primary">{promoRule(p, products)}</p>
                <PromoPeriod p={p} />
                {s.items.length ? (
                  <p className="text-xs text-muted-foreground">
                    {s.items.length} ta mahsulot
                    {s.saved > 0 ? <> · <span className="line-through">{fmtSum(s.full)}</span> → <b className="text-foreground">{fmtSum(s.final)}</b></> : null}
                  </p>
                ) : null}
                <div className="mt-auto flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={p.active && !isPromoExpired(p)}
                      disabled={isPromoExpired(p)}
                      onCheckedChange={async (v) => { if (await updatePromotion(p.id, { active: v })) toast.success(v ? "Aksiya yoqildi" : "Aksiya o'chirildi"); }}
                    />
                    {isPromoExpired(p) ? "Avtomatik o'chirildi" : !p.active ? "Yashirilgan" : isPromoUpcoming(p) ? "Boshlanishni kutmoqda" : "Botda ko'rinadi"}
                  </label>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => { if (!window.confirm(`«${p.title.uz}» aksiyasini o'chirasizmi?`)) return; if ((await deletePromotion(p.id)) !== false) toast.success("O'chirildi"); }}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!imageBusy && !saving) setOpen(v); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Aksiyani tahrirlash" : "Yangi aksiya"}</DialogTitle>
            <DialogDescription>Aksiya turini, mahsulotlarni va muddatni tanlang.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Aksiya turi</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(PROMO_TYPES).map(([key, t]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set({ type: key })}
                    className={`rounded-xl border p-2.5 text-left transition-colors ${type === key ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"}`}
                  >
                    <p className="text-sm font-medium">{t.emoji} {t.label}</p>
                    <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{t.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {["percent", "happy", "birthday", "second"].includes(type) ? (
                <div className="grid gap-1.5"><Label>Chegirma (%)</Label><Input type="number" min={1} max={100} value={form.value} onChange={num("value")} /></div>
              ) : null}
              {type === "fixed" ? (
                <div className="grid gap-1.5"><Label>Chegirma summasi (so'm)</Label><Input type="number" min={0} step={1000} value={form.value} onChange={num("value")} /></div>
              ) : null}
              {type === "bogo" ? (
                <>
                  <div className="grid gap-1.5"><Label>Nechta olsa (N)</Label><Input type="number" min={1} value={form.buyQty} onChange={num("buyQty")} /></div>
                  <div className="grid gap-1.5"><Label>Nechtasi bepul (M)</Label><Input type="number" min={1} value={form.getQty} onChange={num("getQty")} /></div>
                </>
              ) : null}
              {type === "combo" ? (
                <div className="grid gap-1.5"><Label>Set narxi (so'm)</Label><Input type="number" min={0} step={1000} value={form.setPrice} onChange={num("setPrice")} /></div>
              ) : null}
              {type === "happy" ? (
                <>
                  <div className="grid gap-1.5"><Label>Soat (dan)</Label><Input type="time" value={form.hoursFrom} onChange={(e) => set({ hoursFrom: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>Soat (gacha)</Label><Input type="time" value={form.hoursTo} onChange={(e) => set({ hoursTo: e.target.value })} /></div>
                </>
              ) : null}
              {["gift", "delivery"].includes(type) ? (
                <div className="grid gap-1.5"><Label>Minimal buyurtma (so'm)</Label><Input type="number" min={0} step={1000} value={form.minOrder} onChange={num("minOrder")} /></div>
              ) : null}
              {type === "gift" ? (
                <div className="grid gap-1.5">
                  <Label>Sovg'a mahsulot</Label>
                  <select className="h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm" value={form.giftProductId} onChange={(e) => set({ giftProductId: e.target.value })}>
                    <option value="">— tanlang —</option>
                    {formProducts.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name.uz}{isExtra(p.id) ? " (menyuda yo'q)" : ""}</option>)}
                  </select>
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label>Belgi (badge)</Label>
                <Input value={form.badge} onChange={(e) => { setBadgeTouched(true); setForm((f) => ({ ...f, badge: e.target.value })); }} />
              </div>
            </div>

            {type !== "delivery" ? (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Aksiyadagi mahsulotlar {type === "gift" ? "(ixtiyoriy)" : ""}</Label>
                  <span className="text-xs text-muted-foreground">{form.items.length} ta tanlandi</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Mahsulot qidirish" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="grid gap-2 rounded-xl border border-dashed border-border p-3">
                  <p className="text-xs text-muted-foreground">Menyuda yo'q mahsulot qo'shish — faqat shu aksiya uchun. Botda menyuda ko'rinmaydi va aksiya o'chganda o'chib ketadi.</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_10rem_auto]">
                    <Input placeholder="Nomi" value={extra.name} onChange={(e) => setExtra((x) => ({ ...x, name: e.target.value }))} />
                    <Input type="number" min={0} step={1000} placeholder="Narxi" value={extra.price} onChange={(e) => setExtra((x) => ({ ...x, price: e.target.value }))} />
                    <select className="h-9 rounded-md border border-input bg-background text-foreground px-2 text-sm" value={extra.category} onChange={(e) => setExtra((x) => ({ ...x, category: e.target.value }))}>
                      <option value="">Kategoriya</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                    </select>
                    <Button type="button" variant="outline" onClick={addExtra}><Plus className="size-4" /> Qo'shish</Button>
                  </div>
                </div>
                <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {filtered.map((p) => {
                    const qty = qtyOf(p.id);
                    return (
                      <div key={p.id} className={`flex items-center gap-3 p-2 ${qty ? "bg-primary/5" : ""}`}>
                        {productImage(p) ? (<img src={productImage(p)} alt="" className="size-10 rounded-lg object-cover" />) : (<div aria-hidden="true" className="size-10 rounded-lg object-cover bg-secondary" />)}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{p.name.uz}{isExtra(p.id) ? <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">menyuda yo'q</span> : null}</p>
                          <p className="text-xs text-muted-foreground">{fmtSum(p.price)}</p>
                        </div>
                        {isExtra(p.id) ? (
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => removeExtra(p.id)}><Trash2 className="size-3.5 text-destructive" /></Button>
                        ) : null}
                        {qty ? (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => setQty(p.id, qty - 1)}><Minus className="size-3.5" /></Button>
                            <span className="w-5 text-center text-sm font-medium">{qty}</span>
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => setQty(p.id, qty + 1)}><Plus className="size-3.5" /></Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setQty(p.id, 1)}>Qo'shish</Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {summary.items.length ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Asl narx: <span className="line-through">{fmtSum(summary.full)}</span></span>
                    <span>Aksiya narxi: <b className="text-primary">{fmtSum(summary.final)}</b>{summary.saved > 0 ? <span className="ml-1 text-xs text-muted-foreground">(-{fmtSum(summary.saved)})</span> : null}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <ImagePicker key={editId || "new"} value={form.image} onChange={(image) => setForm((c) => ({ ...c, image }))} onBusyChange={setImageBusy} disabled={saving} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label>Boshlanish (sana va soat)</Label><Input type="datetime-local" value={toLocalInput(form.startsAt, "00:00")} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} /></div>
              <div className="grid gap-1.5"><Label>Tugash (sana va soat)</Label><Input type="datetime-local" value={toLocalInput(form.endsAt, "23:59")} min={form.startsAt ? toLocalInput(form.startsAt, "00:00") : undefined} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} /></div>
              <p className="sm:col-span-2 text-xs text-muted-foreground">Bo'sh qoldirilsa — muddatsiz. Tugash vaqti kelganda aksiya avtomatik o'chadi (Toshkent vaqti).</p>
            </div>

            {["uz"].map((lang) => (
              <div key={lang} className="grid gap-1.5">
                <Label>Sarlavha va matn</Label>
                <Input value={form.title[lang]} onChange={(e) => setForm((f) => ({ ...f, title: { ...f.title, [lang]: e.target.value } }))} placeholder="Sarlavha" />
                <Textarea rows={2} value={form.description[lang]} onChange={(e) => setForm((f) => ({ ...f, description: { ...f.description, [lang]: e.target.value } }))} placeholder="Matn" />
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} /> Faol
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" disabled={imageBusy || saving} onClick={() => setOpen(false)}>Bekor qilish</Button>
            <Button onClick={save} disabled={imageBusy || saving}>{saving ? <><Spinner />Saqlanmoqda…</> : "Saqlash"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PromotionsPage;
