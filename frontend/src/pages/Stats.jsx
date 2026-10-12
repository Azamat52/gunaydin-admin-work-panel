import { useEffect, useMemo, useState } from "react";
import { ChartPie, UtensilsCrossed } from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis
} from "recharts";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { STATUS_LABELS, fmtSum, isActive, isCancelled, isCompleted, orderSum, pctChange } from "@/lib/bot-types";
import { useAdminStore } from "@/store/admin-store";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const dayLabel = (key) => `${key.slice(8, 10)}.${key.slice(5, 7)}`;

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "12px"
};

function StatsPage() {
  useEffect(() => {
    document.title = "Statistika — GunAydin Admin";
  }, []);

  const { orders, products, customers, categoryLabel } = useAdminStore();
  const [days, setDays] = useState(14);

  const paid = useMemo(() => orders.filter(isCompleted), [orders]);
  const pending = useMemo(() => orders.filter(isActive), [orders]);
  const cancelled = useMemo(() => orders.filter(isCancelled), [orders]);

  // --- Savdo bo'yicha mahsulotlar ---
  const itemTotals = useMemo(() => {
    const map = new Map();
    for (const o of paid) {
      for (const i of o.items) {
        const prev = map.get(i.productId) ?? { name: i.name, qty: 0, revenue: 0 };
        map.set(i.productId, {
          name: prev.name,
          qty: prev.qty + i.quantity,
          revenue: prev.revenue + i.price * i.quantity
        });
      }
    }
    return map;
  }, [paid]);

  const top = Array.from(itemTotals.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  // --- Kategoriya bo'yicha savdo ---
  const catData = useMemo(() => {
    const map = new Map();
    for (const [pid, v] of itemTotals) {
      const cat = products.find((p) => p.id === pid)?.category ?? "other";
      map.set(cat, (map.get(cat) ?? 0) + v.revenue);
    }
    return Array.from(map.entries()).map(([cat, value]) => ({
      name: categoryLabel(cat),
      value
    }));
  }, [itemTotals, products]);

  // --- Kunlik daromad va buyurtmalar (tanlangan davr) ---
  const daily = useMemo(() => {
    const result = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      result.push({ key: dayKey(d), name: dayLabel(dayKey(d)), revenue: 0, count: 0 });
    }
    const byKey = new Map(result.map((r) => [r.key, r]));
    for (const o of paid) {
      const key = dayKey(new Date(o.createdAt));
      const row = byKey.get(key);
      if (row) {
        row.revenue += o.total;
        row.count += 1;
      }
    }
    return result;
  }, [paid, days]);

  // --- Soatlik yuklanish ---
  const hourly = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ name: `${h}:00`, count: 0 }));
    for (const o of paid) arr[new Date(o.createdAt).getHours()].count += 1;
    return arr;
  }, [paid]);

  // --- To'lov usullari ---
  const paymentData = useMemo(() => {
    const map = new Map();
    for (const o of paid) {
      const m = o.paymentMethod ?? "other";
      map.set(m, (map.get(m) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([m, value]) => ({
      name: m === "card" ? "Karta" : m,
      value
    }));
  }, [paid]);

  // --- Yetkazish / olib ketish ---
  const deliveryData = useMemo(() => {
    const d = paid.filter((o) => o.deliveryType === "delivery").length;
    const p = paid.length - d;
    return [
      { name: "Yetkazib berish", value: d },
      { name: "Olib ketish", value: p }
    ].filter((x) => x.value > 0);
  }, [paid]);

  // --- Umumiy ko'rsatkichlar ---
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const avgCheck = Math.round(revenue / Math.max(paid.length, 1));
  const totalQty = Array.from(itemTotals.values()).reduce((s, v) => s + v.qty, 0);

  // --- Bugungi ko'rsatkichlar ---
  const today = dayKey(new Date());
  const todayOrders = paid.filter((o) => dayKey(new Date(o.createdAt)) === today);
  const todayRevenue = orderSum(todayOrders);
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const yesterday = dayKey(yd);
  const yesterdayRevenue = orderSum(paid.filter((o) => dayKey(new Date(o.createdAt)) === yesterday));
  const now = new Date();
  const thisMonth = monthKey(now);
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = monthKey(lm);
  // O'tgan oyning shu kunigacha bo'lgan qismi bilan solishtiriladi (adolatli taqqoslash)
  const monthRevenue = orderSum(paid.filter((o) => monthKey(new Date(o.createdAt)) === thisMonth));
  const lastMonthRevenue = orderSum(paid.filter((o) => {
    const d = new Date(o.createdAt);
    return monthKey(d) === lastMonth && d.getDate() <= now.getDate();
  }));

  // --- Qayta buyurtma bergan mijozlar ---
  const repeatCustomers = useMemo(() => {
    const map = new Map();
    for (const o of paid) map.set(o.phone, (map.get(o.phone) ?? 0) + 1);
    return Array.from(map.values()).filter((n) => n > 1).length;
  }, [paid]);

  // --- Holat bo'yicha taqsimot ---
  const statusData = useMemo(() => {
    const map = new Map();
    for (const o of orders) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return Array.from(map.entries()).map(([s, value]) => ({
      name: STATUS_LABELS[s] ?? s,
      value
    }));
  }, [orders]);

  return <>
      <PageHeader title="Statistika" subtitle="Buyurtmalar asosida hisoblangan" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bugungi tushum" value={fmtSum(todayRevenue)} trend={{ value: pctChange(todayRevenue, yesterdayRevenue), label: "kechaga nisbatan" }} hint={`${todayOrders.length} ta yakunlangan buyurtma`} />
        <StatCard label="Oylik tushum" value={fmtSum(monthRevenue)} trend={{ value: pctChange(monthRevenue, lastMonthRevenue), label: "o'tgan oyga nisbatan" }} hint={`O'tgan oy shu kungacha: ${fmtSum(lastMonthRevenue)}`} />
        <StatCard label="Umumiy tushum" value={fmtSum(revenue)} hint="Faqat yetkazilgan va olib ketilgan" />
        <StatCard label="Yakunlangan buyurtmalar" value={String(paid.length)} hint={`Jami ${orders.length} ta buyurtmadan`} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Kutilayotgan tushum" value={fmtSum(orderSum(pending))} hint={`${pending.length} ta jarayondagi buyurtma`} />
        <StatCard label="Yetkazilgan" value={String(paid.filter((o) => o.status === "delivered").length)} hint={fmtSum(paid.filter((o) => o.status === "delivered").reduce((s, o) => s + o.total, 0))} />
        <StatCard label="Olib ketilgan" value={String(paid.filter((o) => o.status === "picked_up").length)} hint={fmtSum(paid.filter((o) => o.status === "picked_up").reduce((s, o) => s + o.total, 0))} />
        <StatCard label="Bekor qilingan" value={String(cancelled.length)} hint={`${fmtSum(cancelled.reduce((s, o) => s + o.total, 0))} yo'qotilgan`} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="O'rtacha chek" value={fmtSum(avgCheck)} hint="Bitta yakunlangan buyurtmaga" />
        <StatCard label="Sotilgan pozitsiya" value={String(totalQty)} />
        <StatCard
          label="Yetkazib berish"
          value={`${Math.round((paid.filter((o) => o.deliveryType === "delivery").length / Math.max(paid.length, 1)) * 100)}%`}
          hint="Qolgani olib ketish"
        />
        <StatCard label="Doimiy mijozlar" value={String(repeatCustomers)} hint="2+ marta buyurtma bergan" />
      </div>

      <div className="panel mt-6 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Daromad dinamikasi</h2>
          <div className="flex gap-1">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  days === d ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                }`}
              >
                {d} kun
              </button>
            ))}
          </div>
        </div>
        {daily.every((d) => d.revenue === 0) ? (
          <EmptyState icon={ChartPie} hint="Tanlangan davrda savdo yo'q." className="h-72" />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickFormatter={(v) => `${Math.round(v / 1e3)}k`}
                />
                <Tooltip formatter={(v, name) => (name === "revenue" ? fmtSum(Number(v)) : v)} contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="revenue" name="revenue" stroke="var(--primary)" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <h2 className="mb-4 text-base font-semibold">Top mahsulotlar (savdo)</h2>
          {top.length === 0 ? <EmptyState icon={UtensilsCrossed} hint="Sotuvlar bo'lgach, top mahsulotlar shu yerda chiqadi." className="h-72" /> : <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickFormatter={(v) => `${Math.round(v / 1e3)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  width={95}
                  tickFormatter={(v) => String(v).length > 14 ? `${String(v).slice(0, 13)}…` : v}
                />
                <Tooltip formatter={(v) => fmtSum(Number(v))} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>}
        </div>

        <div className="panel p-4">
          <h2 className="mb-4 text-base font-semibold">Soatlik yuklanish</h2>
          {paid.length === 0 ? <EmptyState icon={ChartPie} hint="Buyurtmalar bo'lgach, eng band soatlar shu yerda chiqadi." className="h-72" /> : <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} interval={2} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} ta`, "Buyurtma"]} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="panel p-4">
          <h2 className="mb-4 text-base font-semibold">Kategoriya bo'yicha savdo</h2>
          {catData.length === 0 ? <EmptyState icon={ChartPie} hint="Kategoriyalar bo'yicha savdo hali yo'q." className="h-64" /> : <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" outerRadius={80} strokeWidth={0}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => fmtSum(Number(v))} contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>}
        </div>

        <div className="panel p-4">
          <h2 className="mb-4 text-base font-semibold">To'lov usullari</h2>
          {paymentData.length === 0 ? <EmptyState icon={ChartPie} hint="To'lovlar hali yo'q." className="h-64" /> : <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentData} dataKey="value" nameKey="name" outerRadius={80} strokeWidth={0}>
                  {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v} ta`, "Buyurtma"]} contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>}
        </div>

        <div className="panel p-4">
          <h2 className="mb-4 text-base font-semibold">Yetkazish turi</h2>
          {deliveryData.length === 0 ? <EmptyState icon={ChartPie} hint="Buyurtmalar hali yo'q." className="h-64" /> : <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={deliveryData} dataKey="value" nameKey="name" outerRadius={80} strokeWidth={0}>
                  {deliveryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v} ta`, "Buyurtma"]} contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <h2 className="mb-4 text-base font-semibold">Buyurtmalar holati</h2>
          {statusData.length === 0 ? <EmptyState icon={ChartPie} hint="Buyurtmalar hali yo'q." className="h-64" /> : <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={95}
                  tickFormatter={(v) => String(v).length > 14 ? `${String(v).slice(0, 13)}…` : v} />
                <Tooltip formatter={(v) => [`${v} ta`, "Buyurtma"]} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="value" fill="var(--chart-3)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>}
        </div>

      </div>
    </>;
}

export {
  StatsPage as default
};
