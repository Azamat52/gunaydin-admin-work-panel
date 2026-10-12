import { Loader2 } from "lucide-react";
function Spinner({ className = "" }) {
  return <Loader2 className={`size-4 animate-spin ${className}`} aria-hidden="true" />;
}
function BrandSpinner() {
  return <div className="relative size-16">
    <div className="absolute inset-0 rounded-full border-4 border-primary/15" />
    <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary border-r-primary/60" />
    <img src="/gunaydin-logo.jpg" alt="" className="absolute inset-2 size-12 animate-pulse rounded-full object-cover" />
  </div>;
}
function PageLoader({ text = "Yuklanmoqda…" }) {
  return <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground" role="status">
    <BrandSpinner />
    <p className="text-sm">{text}</p>
  </div>;
}
function TopBar({ active }) {
  if (!active) return null;
  return <div className="fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/20" role="progressbar" aria-label="Yuklanmoqda">
    <div className="h-full w-1/3 animate-[topbar_1s_ease-in-out_infinite] bg-primary" />
  </div>;
}
function LoadingOverlay({ active, text = "Yuklanmoqda…" }) {
  if (!active) return null;
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/60 backdrop-blur-sm" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-10 py-7 shadow-xl">
      <BrandSpinner />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  </div>;
}
export { Spinner, PageLoader, TopBar, LoadingOverlay };
