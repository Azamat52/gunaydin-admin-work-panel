import { Spinner } from "@/components/admin/loader";
import { Pencil, Plus, Search, Trash2, UtensilsCrossed } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/admin/empty-state";
import { ImagePicker } from "@/components/admin/image-picker";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { productImage } from "@/data/products";
import { fmtSum } from "@/lib/bot-types";
import { useAdminStore } from "@/store/admin-store";
const emptyForm = (category = "") => ({
  category,
  emoji: "",
  price: 0,
  popular: false,
  available: true,
  name: { uz: "", ru: "", en: "" },
  description: { uz: "", ru: "", en: "" }
});
function ProductsPage() {
  useEffect(() => {
    document.title = "Mahsulotlar \u2014 GunAydin Admin";
  }, []);
  const { products, categories, categoryLabel, addProduct, updateProduct, deleteProduct } = useAdminStore();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageBusy, setImageBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(
    () => products.filter((p) => {
      const matchCat = cat === "all" || p.category === cat;
      const q = query.trim().toLowerCase();
      const matchQ = !q || p.name.uz.toLowerCase().includes(q);
      return matchCat && matchQ;
    }),
    [products, cat, query]
  );
  const openNew = () => {
    setEditId(null);
    setForm(emptyForm(categories[0]?.id));
    setOpen(true);
  };
  const openEdit = (p) => {
    setEditId(p.id);
    const { id: _id, ...rest } = p;
    setForm({ ...rest, name: { ...p.name }, description: { ...p.description } });
    setOpen(true);
  };
  const save = async () => {
    if (!form.category) return toast.error("Avval Kategoriyalar bo‘limida kategoriya yarating");
    if (imageBusy || saving) return;
    if (!form.name.uz.trim() || form.price <= 0) {
      toast.error("O'zbekcha nom va narxni to'ldiring");
      return;
    }
    setSaving(true);
    try {
      const cat = categories.find((c) => c.id === form.category);
      const data = { ...form, emoji: cat?.emoji || "" };
      const ok = editId ? await updateProduct(editId, data) : await addProduct(data);
      if (!ok) return;
      toast.success(editId ? "Mahsulot yangilandi" : "Mahsulot qo'shildi");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };
  return <>
      <PageHeader
    title="Mahsulotlar"
    subtitle={`${products.length} ta mahsulot \xB7 1 tilda`}
    action={<Button onClick={openNew}>
            <Plus className="size-4" /> Yangi mahsulot
          </Button>}
  />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    placeholder="Mahsulot qidirish..."
    className="pl-9"
  />
        </div>
        <div className="flex flex-wrap gap-1">
          <FilterChip active={cat === "all"} onClick={() => setCat("all")} label="Hammasi" />
          {categories.map(({ id: c }) => <FilterChip
    key={c}
    active={cat === c}
    onClick={() => setCat(c)}
    label={categoryLabel(c)}
  />)}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => <div key={p.id} className="panel group flex flex-col overflow-hidden transition-shadow hover:shadow-glow">
            <div className="relative aspect-[4/3] overflow-hidden">
              {productImage(p) ? (<img
    src={productImage(p)}
    alt={p.name.uz}
    loading="lazy"
    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
  />) : (<div aria-hidden="true" className="size-full object-cover transition-transform duration-300 group-hover:scale-105 bg-secondary" />)}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
              <p className="absolute bottom-2 left-3 rounded-full bg-background/80 px-2.5 py-1 text-sm font-semibold text-primary backdrop-blur">
                {fmtSum(p.price)}
              </p>
              {p.popular ? <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                  Hit
                </span> : null}
              {!p.available ? <span className="absolute left-3 top-3 rounded-full bg-destructive/90 px-2.5 py-1 text-xs font-medium text-destructive-foreground">
                  Mavjud emas
                </span> : null}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4 pt-1">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name.uz}</p>
                <p className="text-xs text-muted-foreground">
                  {categoryLabel(p.category)}
                </p>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{p.description.uz}</p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <Switch
    checked={p.available}
    onCheckedChange={(v) => {
      updateProduct(p.id, { available: v });
      toast.success(v ? "Sotuvda" : "Sotuvdan olindi");
    }}
  />
                  <span className="text-xs text-muted-foreground">
                    {p.available ? "Sotuvda" : "Mavjud emas"}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
    size="icon"
    variant="ghost"
    onClick={() => {
      deleteProduct(p.id);
      toast.success("O'chirildi");
    }}
  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          </div>)}
        {filtered.length === 0 ? <div className="panel col-span-full">
            <EmptyState icon={UtensilsCrossed} hint="Bu bo'limda hali mahsulotlar yo'q." />
          </div> : null}
      </div>

      <Dialog open={open} onOpenChange={(value) => { if (!imageBusy && !saving) setOpen(value); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}</DialogTitle>
            <DialogDescription>Nom va tavsifni uchta tilda kiriting.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <ImagePicker key={editId || 'new'} value={form.image} onChange={(image) => setForm((current) => ({ ...current, image }))} onBusyChange={setImageBusy} disabled={saving} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

              <div className="grid gap-1.5">
                <Label>Narx (so'm)</Label>
                <Input
    type="number"
    value={form.price || ""}
    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
  />
              </div>
              <div className="grid gap-1.5">
                <Label>Kategoriya</Label>
                <select
    value={form.category}
    onChange={(e) => setForm({ ...form, category: e.target.value })}
    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
  >
                  {categories.length === 0 && <option value="">Avval kategoriya yarating</option>}
                  {categories.map(({ id: c }) => <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>)}
                </select>
              </div>
            </div>

            {["uz"].map((lang) => <div key={lang} className="grid gap-1.5">
                <Label>Nom va tavsif</Label>
                <Input
    value={form.name[lang]}
    onChange={(e) => setForm({ ...form, name: { ...form.name, [lang]: e.target.value } })}
    placeholder="Nom"
  />
                <Textarea
    value={form.description[lang]}
    onChange={(e) => setForm({ ...form, description: { ...form.description, [lang]: e.target.value } })}
    placeholder="Tavsif"
    rows={2}
  />
              </div>)}

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
    checked={form.available}
    onCheckedChange={(v) => setForm({ ...form, available: v })}
  />
                Sotuvda
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
    checked={!!form.popular}
    onCheckedChange={(v) => setForm({ ...form, popular: v })}
  />
                Hit mahsulot
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" disabled={imageBusy || saving} onClick={() => setOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={save} disabled={imageBusy || saving}>{saving ? <><Spinner />Saqlanmoqda…</> : "Saqlash"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
}
function FilterChip({
  active,
  onClick,
  label
}) {
  return <button
    onClick={onClick}
    className={active ? "rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary" : "rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"}
  >
      {label}
    </button>;
}
export {
  ProductsPage as default
};
