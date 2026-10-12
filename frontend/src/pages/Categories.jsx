import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, FolderTree, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Spinner } from "@/components/admin/loader";
import { Switch } from "@/components/ui/switch";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { productImage } from "@/data/products";
import { fmtSum } from "@/lib/bot-types";
import { useAdminStore } from "@/store/admin-store";

const empty = { id: "", name: "", emoji: "", description: "", sort: 0, active: true };

export default function Categories() {
  const { categories, products, saveCategory, deleteCategory, reorderCategories, loading } = useAdminStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [toggling, setToggling] = useState(null);
  const countOf = (id) => products.filter((p) => p.category === id).length;
  const visible = useMemo(() => categories.filter((c) => {
    if (q && !`${c.name} ${c.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "active") return c.active !== false;
    if (filter === "hidden") return c.active === false;
    if (filter === "empty") return countOf(c.id) === 0;
    return true;
  }), [categories, products, q, filter]);
  const toggleActive = async (c) => {
    setToggling(c.id);
    const ok = await saveCategory({ ...c, active: c.active === false });
    setToggling(null);
    if (ok) toast.success(c.active === false ? "Kategoriya botda ko‘rinadi" : "Kategoriya botdan yashirildi");
  };
  const move = (c, dir) => {
    const ids = categories.map((x) => x.id);
    const i = ids.indexOf(c.id), j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void reorderCategories(ids);
  };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);

  const startCreate = () => { setForm({ ...empty, sort: categories.length }); setOpen(true); };
  const startEdit = (c) => { setForm({ ...c }); setOpen(true); };
  const save = async () => {
    if (!form.name.trim()) return toast.error("Kategoriya nomini kiriting");
    setSaving(true);
    const ok = await saveCategory(form);
    setSaving(false);
    if (ok) { toast.success(form.id ? "Kategoriya yangilandi" : "Kategoriya yaratildi"); setOpen(false); }
  };
  const remove = async (c) => {
    if (products.some((p) => p.category === c.id)) return toast.error("Avval bu kategoriyadagi mahsulotlarni o‘chiring yoki ko‘chiring");
    if (!confirm(`"${c.name}" kategoriyasini o‘chirasizmi?`)) return;
    if (await deleteCategory(c.id)) { toast.success("O‘chirildi"); setSelected(null); }
  };

  const current = categories.find((c) => c.id === selected);
  const dialog = <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{form.id ? "Kategoriyani tahrirlash" : "Yangi kategoriya"}</DialogTitle>
        <DialogDescription>Bot menyusida shu nom bilan ko‘rinadi.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <div className="grid gap-1.5"><Label htmlFor="c-emoji">Emoji</Label><Input id="c-emoji" value={form.emoji} maxLength={8} placeholder="Emoji" onChange={(e) => setForm({ ...form, emoji: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="c-name">Nomi</Label><Input id="c-name" value={form.name} maxLength={40} placeholder="Masalan: Burger" onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        </div>
        <div className="grid gap-1.5"><Label htmlFor="c-desc">Tavsif</Label><Textarea id="c-desc" value={form.description} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label htmlFor="c-sort">Tartib raqami</Label><Input id="c-sort" type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })} /></div>
        <div className="flex items-center justify-between rounded-md border p-3"><div><Label htmlFor="c-active">Botda ko‘rsatish</Label><p className="text-xs text-muted-foreground">O‘chirilsa, mijozlar bu kategoriyani ko‘rmaydi</p></div><Switch id="c-active" checked={form.active !== false} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button><Button onClick={save} disabled={saving}>{saving ? <><Spinner />Saqlanmoqda…</> : "Saqlash"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;

  if (current) {
    const items = products.filter((p) => p.category === current.id);
    return <div>
      <Button variant="ghost" className="mb-3" onClick={() => setSelected(null)}><ArrowLeft />Kategoriyalar</Button>
      <PageHeader title={`${current.emoji ? current.emoji + " " : ""}${current.name}`} subtitle={current.description || `${items.length} ta mahsulot`}
        action={<div className="flex gap-2"><Button variant="outline" disabled={toggling === current.id} onClick={() => toggleActive(current)}>{toggling === current.id ? <Spinner /> : current.active === false ? <Eye /> : <EyeOff />}{current.active === false ? "Ko‘rsatish" : "Yashirish"}</Button><Button variant="outline" onClick={() => startEdit(current)}><Pencil />Tahrirlash</Button><Button variant="outline" onClick={() => remove(current)}><Trash2 />O‘chirish</Button></div>} />
      {items.length === 0 ? <div className="panel"><EmptyState title="Bu kategoriyada mahsulot yo‘q" hint="Mahsulotlar bo‘limida qo‘shing va shu kategoriyani tanlang" /></div> :
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((p) => <div key={p.id} className="panel flex items-center gap-3 p-3">
          {productImage(p) ? <img src={productImage(p)} alt={p.name.uz} className="size-14 rounded-md object-cover" /> : <div className="size-14 rounded-md bg-secondary" />}
          <div className="min-w-0 flex-1"><p className="truncate font-medium">{p.name.uz}</p><p className="text-sm text-primary">{fmtSum(p.price)}</p><p className="text-xs text-muted-foreground">{p.available ? "Sotuvda" : "Mavjud emas"}</p></div>
        </div>)}</div>}
      {dialog}
    </div>;
  }

  return <div>
    <PageHeader title="Kategoriyalar" subtitle={`${categories.length} ta kategoriya · ${categories.filter((c) => c.active === false).length} ta yashirin · ${categories.filter((c) => countOf(c.id) === 0).length} ta bo‘sh`} action={<Button onClick={startCreate}><Plus />Kategoriya yaratish</Button>} />
    {categories.length > 0 && <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Kategoriya qidirish…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {[["all", "Barchasi"], ["active", "Faol"], ["hidden", "Yashirin"], ["empty", "Bo‘sh"]].map(([k, t]) => <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{t}</Button>)}
    </div>}
    {categories.length > 0 && visible.length === 0 ? <div className="panel"><EmptyState icon={Search} title="Hech narsa topilmadi" hint="Qidiruv yoki filtrni o‘zgartiring" /></div> :
      !loading && categories.length === 0 ? <div className="panel"><EmptyState icon={FolderTree} title="Hali kategoriya yo‘q" hint="“Kategoriya yaratish” tugmasini bosing" /></div> :
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((c) => {
          const count = countOf(c.id);
          const idx = categories.findIndex((x) => x.id === c.id);
          return <div key={c.id} className={`panel flex items-center gap-2 p-4 ${c.active === false ? "opacity-60" : ""}`}>
            <div className="flex flex-col"><Button variant="ghost" size="icon" className="size-6" aria-label="Yuqoriga" disabled={idx === 0} onClick={() => move(c, -1)}><ArrowUp /></Button><Button variant="ghost" size="icon" className="size-6" aria-label="Pastga" disabled={idx === categories.length - 1} onClick={() => move(c, 1)}><ArrowDown /></Button></div>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setSelected(c.id)}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-xl">{c.emoji || "📂"}</span>
              <span className="min-w-0"><span className="block truncate font-medium">{c.name}</span><span className={`block text-xs ${count === 0 ? "text-destructive" : "text-muted-foreground"}`}>{count === 0 ? "Mahsulot yo‘q" : `${count} ta mahsulot`}{c.active === false ? " · Yashirin" : ""}</span></span>
            </button>
            {toggling === c.id ? <Spinner /> : <Switch aria-label="Botda ko‘rsatish" checked={c.active !== false} onCheckedChange={() => toggleActive(c)} />}
            <Button variant="ghost" size="icon" aria-label="Tahrirlash" onClick={() => startEdit(c)}><Pencil /></Button>
            <Button variant="ghost" size="icon" aria-label="O‘chirish" onClick={() => remove(c)}><Trash2 /></Button>
          </div>;
        })}</div>}
    {dialog}
  </div>;
}
