import { FolderTree, BarChart3, Gift, LayoutDashboard, LogOut, Package, Settings, ShoppingBag, Users, MoreHorizontal } from "lucide-react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { AUTH_KEY, AdminStoreProvider, getCreds, useAdminStore } from "@/store/admin-store";

import { Button } from "@/components/ui/button";
import { adminLogout } from "@/lib/admin.functions";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminNavigationContext } from "./admin-navigation";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Categories from "@/pages/Categories";
import Orders from "@/pages/Orders";
import Promotions from "@/pages/Promotions";
import Customers from "@/pages/Customers";
import Stats from "@/pages/Stats";
import SettingsPage from "@/pages/Settings";
import PromotionDetail from "@/pages/PromotionDetail";
import { LoadingOverlay, PageLoader, TopBar } from "./loader";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

function PageGate() {
  const { loading, busy } = useAdminStore();
  return <><TopBar active={loading || busy} /><LoadingOverlay active={busy && !loading} text="Saqlanmoqda…" />{loading ? <PageLoader text="Ma'lumotlar yuklanmoqda…" /> : <Outlet />}</>;
}

function LiveUsers() {
  const { liveUsers } = useAdminStore();
  return (
    <div className="fixed right-6 top-5 z-50 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow">
      <span className="size-2 animate-pulse rounded-full bg-primary" />
      Jonli mijozlar: {liveUsers}
    </div>
  );
}

function NewBadge({ to }) {
  const { newOrdersCount } = useAdminStore();
  if (to !== "/orders" || !newOrdersCount) return null;
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-5 text-primary-foreground">
      {newOrdersCount > 99 ? "99+" : newOrdersCount}
    </span>
  );
}

function LiveDot() {
  const { live } = useAdminStore();
  return (
    <span
      title={live ? "Jonli ulanish faol" : "Server bilan aloqa yo'q — qayta ulanmoqda"}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${live ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}
    >
      <span className={`size-1.5 rounded-full ${live ? "animate-pulse bg-primary" : "bg-destructive"}`} />
      {live ? "Jonli" : "Oflayn"}
    </span>
  );
}

const NAV = [
  { to: "/", label: "Boshqaruv", icon: LayoutDashboard },
  { to: "/categories", label: "Kategoriyalar", icon: FolderTree },
  { to: "/products", label: "Mahsulotlar", icon: Package },
  { to: "/orders", label: "Buyurtmalar", icon: ShoppingBag },
  { to: "/promotions", label: "Aksiyalar", icon: Gift },
  { to: "/customers", label: "Mijozlar", icon: Users },
  { to: "/stats", label: "Statistika", icon: BarChart3 },
  { to: "/settings", label: "Sozlamalar", icon: Settings },
];

const desk = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm";
const PANELS = { "/": Dashboard, "/categories": Categories, "/products": Products, "/orders": Orders, "/promotions": Promotions, "/customers": Customers, "/stats": Stats, "/settings": SettingsPage };
const MAIN_TABS = [NAV[0], NAV[3], NAV[2], NAV[6]];
const EXTRA_TABS = [NAV[1], NAV[4], NAV[5], NAV[7]];
const sectionOf = (path) => NAV.find((item) => item.to !== "/" && path.startsWith(item.to))?.to ?? "/";

function MobileWorkspace({ logout }) {
  const location = useLocation();
  const [active, setActive] = useState(() => sectionOf(location.pathname));
  const [visited, setVisited] = useState(() => [sectionOf(location.pathname)]);
  const [detail, setDetail] = useState(() => location.pathname.startsWith("/promotions/") ? location.pathname.split("/")[2] : null);
  const [more, setMore] = useState(false);
  const scrolls = useRef({});
  const open = (path) => {
    const next = sectionOf(path);
    scrolls.current[active] = window.scrollY;
    setVisited((old) => old.includes(next) ? old : [...old, next]);
    setActive(next);
    setDetail(path.startsWith("/promotions/") ? path.split("/")[2] : null);
    setMore(false);
    requestAnimationFrame(() => window.scrollTo(0, scrolls.current[next] ?? 0));
  };
  const tab = ({ to, label, icon: Icon }) => <Button key={to} id={`tab-${sectionOf(to).slice(1) || "home"}`} variant="ghost" role="tab" aria-label={label} aria-selected={active === to} aria-controls={`panel-${to.slice(1) || "home"}`} className={`mobile-tab ${active === to ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} onClick={() => open(to)}><span className="relative"><Icon /><NewBadge to={to} /></span><span>{label}</span></Button>;
  return <AdminNavigationContext.Provider value={{ open }}>
    <header className="mobile-header grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-sidebar px-4 py-3"><div className="flex min-w-0 items-center gap-2"><img src="/gunaydin-logo.jpg" alt="GünAydın Turkish Food" className="size-10 shrink-0 rounded-md object-cover" /><div><p className="font-brand text-2xl text-primary">GünAydın</p><p className="text-xs text-muted-foreground">Admin panel</p></div></div><div className="flex shrink-0 items-center gap-2"><LiveDot /><Button variant="ghost" size="icon" aria-label="Chiqish" title="Chiqish" onClick={logout}><LogOut /></Button></div></header>
    <main className="admin-main mobile-main min-w-0 flex-1 px-4 py-5">
      {visited.map((path) => { const Panel = PANELS[path]; return <section key={path} id={`panel-${path.slice(1) || "home"}`} role="tabpanel" aria-labelledby={`tab-${path.slice(1) || "home"}`} hidden={active !== path}><Panel /></section>; })}
    </main>
    <nav aria-label="Admin bo‘limlari" className="mobile-tabbar" role="tablist">{MAIN_TABS.map(tab)}<Button id="tab-more" variant="ghost" className={`mobile-tab ${EXTRA_TABS.some((t) => t.to === active) ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} aria-label="Boshqa bo‘limlar" aria-expanded={more} onClick={() => setMore(true)}><MoreHorizontal /><span>Yana</span></Button></nav>
    <Sheet open={more} onOpenChange={setMore}><SheetContent side="bottom" className="mobile-more"><SheetHeader><SheetTitle>Bo‘limlar</SheetTitle><SheetDescription>GünAydın Admin</SheetDescription></SheetHeader><div role="tablist" aria-label="Qo‘shimcha bo‘limlar" className="mt-4 grid grid-cols-3 gap-2">{EXTRA_TABS.map(tab)}</div></SheetContent></Sheet>
    <Sheet open={Boolean(detail)} onOpenChange={(v) => { if (!v) setDetail(null); }}><SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl"><SheetHeader className="mb-5"><SheetTitle>Aksiya</SheetTitle><SheetDescription>Aksiya tafsilotlari</SheetDescription></SheetHeader>{detail ? <PromotionDetail promotionId={detail} /> : null}</SheetContent></Sheet>
  </AdminNavigationContext.Provider>;
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!getCreds()) navigate("/login", { replace: true });
    else setReady(true);
  }, [navigate]);
  if (!ready) return <div className="min-h-dvh bg-background" />;

  const logout = () => {
    adminLogout();
    localStorage.removeItem(AUTH_KEY);
    navigate("/login", { replace: true });
  };

  return (
    <AdminStoreProvider>
      <div className="admin-shell flex min-h-dvh bg-background">
        {isMobile ? <MobileWorkspace logout={logout} /> : <>
        <aside className="sticky top-0 hidden h-dvh w-48 lg:w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
          <div className="mb-6 flex items-center gap-2 px-2">
            <img src="/gunaydin-logo.jpg" alt="GünAydın Turkish Food" className="size-10 shrink-0 rounded-md object-cover" />
            <div className="min-w-0">
              <p className="font-brand text-2xl leading-tight text-primary">GünAydın</p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">Admin panel <LiveDot /></p>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  isActive
                    ? `${desk} bg-primary/15 !text-primary font-medium`
                    : `${desk} text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`
                }
              >
                <Icon className="size-4" />
                {label}
                <NewBadge to={to} />
              </NavLink>
            ))}
          </nav>
          <Button variant="ghost"
            onClick={logout}
            className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" />
            Chiqish
          </Button>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="admin-main min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
            <PageGate />
            <LiveUsers />
          </main>
        </div>
        </>}
      </div>
    </AdminStoreProvider>
  );
}
