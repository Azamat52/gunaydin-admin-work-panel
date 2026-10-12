import { Spinner } from "@/components/admin/loader";
import { AdminLink as Link } from "@/components/admin/admin-navigation";
import { useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { productImage, promotionImage } from "@/data/products";
import { fmtSum } from "@/lib/bot-types";
import { PROMO_TYPES, promoRule, promoSummary, promoTypeOf, promoUnitPrice } from "@/lib/promo-types";
import { useAdminStore } from "@/store/admin-store";
import { PromoPeriod } from "@/pages/Promotions";

export default function PromotionDetail({ promotionId }) {
  const params = useParams();
  const id = promotionId ?? params.id;
  const { promotions, products, loading } = useAdminStore();
  const p = promotions.find((x) => x.id === id);
  if (!p) {
    return (
      <div className="panel p-8 text-center text-sm text-muted-foreground">
        {loading ? <Spinner className="inline" /> : "Aksiya topilmadi."}
        <div className="mt-4"><Link to="/promotions" className="text-primary hover:underline">Aksiyalarga qaytish</Link></div>
      </div>
    );
  }
  const type = promoTypeOf(p);
  const t = PROMO_TYPES[type];
  const s = promoSummary(p, products);
  const perItem = ["percent", "fixed", "happy", "birthday"].includes(type);
  const gift = [...products, ...(p.extraProducts ?? [])].find((x) => x.id === p.giftProductId);

  return (
    <div className="space-y-6">
      <Link to="/promotions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Aksiyalar
      </Link>

      <div className="panel overflow-hidden md:flex">
        {promotionImage(p) ? (<img src={promotionImage(p)} alt={p.title.uz} className="aspect-[2/1] w-full object-cover md:aspect-auto md:w-2/5" />) : (<div aria-hidden="true" className="aspect-[2/1] w-full object-cover md:aspect-auto md:w-2/5 bg-secondary" />)}
        <div className="flex-1 space-y-3 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">{t.emoji} {t.label}</span>
            <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">{p.badge}</span>
          </div>
          <h1 className="text-2xl font-bold md:text-3xl">{p.title.uz}</h1>
          <p className="text-primary">{promoRule(p, products)}</p>
          <PromoPeriod p={p} />
          {p.description?.uz ? <p className="whitespace-pre-line text-sm text-muted-foreground">{p.description.uz}</p> : null}
          {gift ? (
            <div className="flex items-center gap-3 rounded-xl bg-secondary p-3">
              {productImage(gift) ? (<img src={productImage(gift)} alt="" className="size-12 rounded-lg object-cover" />) : (<div aria-hidden="true" className="size-12 rounded-lg object-cover bg-secondary" />)}
              <div><p className="text-xs text-muted-foreground">Sovg'a</p><p className="text-sm font-medium">{gift.name.uz} — bepul</p></div>
            </div>
          ) : null}
        </div>
      </div>

      {s.items.length ? (
        <div className="panel p-4 md:p-6">
          <h2 className="mb-4 text-lg font-semibold">Aksiyadagi mahsulotlar</h2>
          <div className="divide-y divide-border">
            {s.items.map(({ product, qty }) => {
              const unit = perItem ? promoUnitPrice(p, product) : product.price;
              return (
                <div key={product.id} className="flex items-center gap-3 py-3">
                  {productImage(product) ? (<img src={productImage(product)} alt="" className="size-14 rounded-xl object-cover" />) : (<div aria-hidden="true" className="size-14 rounded-xl object-cover bg-secondary" />)}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{product.name.uz}</p>
                    <p className="text-xs text-muted-foreground">{qty} ta</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Boshlang‘ich narx</p>
                    <p className={unit < product.price ? "text-xs text-muted-foreground line-through" : "font-semibold"}>{fmtSum(product.price)}</p>
                    {unit < product.price ? <p className="font-semibold">{fmtSum(unit)}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary px-4 py-3">
            <span className="text-sm text-muted-foreground">Jami asl narx: <span className="line-through">{fmtSum(s.full)}</span></span>
            <span className="text-lg">Aksiya bilan: <b className="text-primary">{fmtSum(s.final)}</b></span>
            {s.saved > 0 ? <span className="w-full text-xs text-muted-foreground">Mijoz tejaydi: {fmtSum(s.saved)}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
