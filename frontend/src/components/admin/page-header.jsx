import { ArrowDown, ArrowUp } from "lucide-react";
function PageHeader({
  title,
  subtitle,
  action
}) {
  return <div className="mb-6 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>;
}
function StatCard({
  label,
  value,
  hint,
  icon,
  trend
}) {
  const up = trend && trend.value >= 0;
  return <div className="panel min-w-0 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon ? <span className="text-primary">{icon}</span> : null}
      </div>
      <p className="stat-value mt-2 break-words font-display text-2xl font-bold">{value}</p>
      {trend ? <p className={`mt-1 flex flex-wrap items-center gap-1 text-xs font-semibold ${up ? "text-success" : "text-destructive"}`}>
          {up ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
          {up ? "+" : ""}{trend.value}% <span className="font-normal text-muted-foreground">{trend.label}</span>
        </p> : null}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>;
}
export {
  PageHeader,
  StatCard
};
