import { Users } from "lucide-react";
import { useMemo, useEffect } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { fmtDate, fmtSum, isCompleted } from "@/lib/bot-types";
import { useAdminStore } from "@/store/admin-store";
function CustomersPage() {
  useEffect(() => {
    document.title = "Mijozlar \u2014 GunAydin Admin";
  }, []);
  const { customers, orders } = useAdminStore();
  const rows = useMemo(
    () => customers.map((c) => {
      const own = orders.filter((o) => o.userId === c.userId && isCompleted(o));
      return {
        ...c,
        count: own.length,
        spent: own.reduce((s, o) => s + o.total, 0),
        last: own[0]?.createdAt
      };
    }).sort((a, b) => b.spent - a.spent),
    [customers, orders]
  );
  return <>
      <PageHeader title="Mijozlar" subtitle={`${customers.length} ta bot foydalanuvchisi`} />

      <div className="grid gap-3 lg:hidden">{rows.map((c) => <article key={c.userId} className="panel min-w-0 p-4"><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><div className="min-w-0"><p className="break-words font-medium">{c.name}</p><p className="break-all text-xs text-muted-foreground">{c.username ? `@${c.username}` : `ID ${c.userId}`}</p></div></div><p className="mt-3 text-sm text-muted-foreground">{c.phone ?? "—"}</p><div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-sm"><span>{c.count} ta buyurtma</span><span className="font-medium text-primary">{fmtSum(c.spent)}</span></div><p className="mt-2 text-xs text-muted-foreground">Oxirgi xarid: {c.last ? fmtDate(c.last) : "—"}</p></article>)}{!rows.length ? <EmptyState icon={Users} hint="Botdan foydalanuvchilar hali yo'q." /> : null}</div>
      <div className="panel hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">Mijoz</th>
              <th className="p-3">Telefon</th>
              <th className="p-3">Buyurtma</th>
              <th className="p-3">Sarflangan</th>
              <th className="p-3">Oxirgi xarid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => <tr key={c.userId}>
                <td className="p-3">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.username ? `@${c.username}` : `ID ${c.userId}`}
                  </p>
                </td>
                <td className="p-3 text-muted-foreground">{c.phone ?? "\u2014"}</td>
                
                <td className="p-3">{c.count}</td>
                <td className="p-3 font-medium text-primary">{fmtSum(c.spent)}</td>
                <td className="p-3 text-muted-foreground">
                  {c.last ? fmtDate(c.last) : "\u2014"}
                </td>
              </tr>)}
            {rows.length === 0 ? <tr>
                <td colSpan={6}>
                  <EmptyState icon={Users} hint="Botdan foydalanuvchilar hali yo'q." />
                </td>
              </tr> : null}
          </tbody>
        </table>
      </div>
    </>;
}
export {
  CustomersPage as default
};
