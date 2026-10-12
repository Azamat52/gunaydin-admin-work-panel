import { useEffect } from "react";
import { AdminLink as Link } from "@/components/admin/admin-navigation";
import { ChartColumn, Package, Receipt, ShoppingBag, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { fmtDate, fmtSum, isActive, isCompleted, orderSum, pctChange } from "@/lib/bot-types";
import { useAdminStore } from "@/store/admin-store";
function Dashboard() {
  useEffect(() => {
    document.title = "Boshqaruv paneli \u2014 GunAydin Admin";
  }, []);
  const { orders, products, customers } = useAdminStore();
  const paid = orders.filter(isCompleted);
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const avg = paid.length ? Math.round(revenue / paid.length) : 0;
  const activeOrders = orders.filter(isActive);
  const dk = (d) => d.toLocaleDateString("ru-RU");
  const today = dk(new Date());
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const todayRev = orderSum(paid.filter((o) => dk(new Date(o.createdAt)) === today));
  const yRev = orderSum(paid.filter((o) => dk(new Date(o.createdAt)) === dk(yd)));
  const byDay = /* @__PURE__ */ new Map();
  for (const o of paid) {
    const key = new Date(o.createdAt).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit"
    });
    byDay.set(key, (byDay.get(key) ?? 0) + o.total);
  }
  const chartData = Array.from(byDay.entries()).map(([day, total]) => ({ day, total })).reverse();
  return <>
      <PageHeader title="Boshqaruv paneli" subtitle="GunAydin Telegram bot ko'rsatkichlari" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
    label="Umumiy savdo"
    value={fmtSum(revenue)}
    hint={`${paid.length} ta yakunlangan · bugun ${fmtSum(todayRev)}`}
    trend={{ value: pctChange(todayRev, yRev), label: "bugun / kecha" }}
    icon={<TrendingUp className="size-4" />}
  />
        <StatCard
    label="Faol buyurtmalar"
    value={String(activeOrders.length)}
    hint="Tayyorlanmoqda / yo'lda"
    icon={<ShoppingBag className="size-4" />}
  />
        <StatCard
    label="O'rtacha chek"
    value={fmtSum(avg)}
    hint="Bitta buyurtmaga"
    icon={<Package className="size-4" />}
  />
        <StatCard
    label="Mijozlar"
    value={String(customers.length)}
    hint={`${products.filter((p) => p.available).length} ta mahsulot sotuvda`}
    icon={<Users className="size-4" />}
  />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold">Kunlik savdo</h2>
          {chartData.length === 0 ? <EmptyState icon={ChartColumn} hint="Buyurtmalar tushgach, kunlik savdo shu yerda ko'rinadi." className="h-64" /> : <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis
    stroke="var(--muted-foreground)"
    fontSize={12}
    tickFormatter={(v) => `${Math.round(v / 1e3)}k`}
  />
                <Tooltip
    formatter={(v) => fmtSum(Number(v))}
    contentStyle={{
      background: "var(--popover)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      color: "var(--popover-foreground)"
    }}
  />
                <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>}
        </div>

        <div className="panel p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Oxirgi buyurtmalar</h2>
            <Link to="/orders" className="text-xs text-primary hover:underline">
              Barchasi
            </Link>
          </div>
          {orders.length === 0 ? <EmptyState icon={Receipt} hint="Hali buyurtmalar yo'q." /> : null}
          <ul className="space-y-3">
            {orders.slice(0, 6).map((o) => <li key={o.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {o.id} · {o.userName}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{fmtSum(o.total)}</p>
                  <StatusBadge status={o.status} />
                </div>
              </li>)}
          </ul>
        </div>
      </div>
    </>;
}
export {
  Dashboard as default
};
