import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { playOrderSound, unlockSound } from "@/lib/notify";
import { useSettings } from "@/store/settings-store";
import { fmtSum } from "@/lib/bot-types";
import { toast } from "sonner";
import { io } from "socket.io-client";
import {
  getAdminData,
  removeProduct,
  removePromotion,
  saveProduct,
  savePromotion,
  updateOrderStatus,
  API_URL,
  saveCategory,
  removeCategory,
  reorderCategories
} from "@/lib/admin.functions";
const AUTH_KEY = "eb-admin-auth";
function getCreds() {
  if (typeof window === "undefined") return null;
  try {
    const v = JSON.parse(localStorage.getItem(AUTH_KEY) ?? "null");
    return v && typeof v.token === "string" ? v : null;
  } catch {
    return null;
  }
}
const AdminContext = createContext(null);
function AdminStoreProvider({ children }) {
  const { settings } = useSettings();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveUsers, setLiveUsers] = useState(0);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(0);
  const knownIds = useRef(null);
  // Yangi buyurtmalarni aniqlash: tepadan bildirishnoma + tovush
  useEffect(() => {
    if (loading) return;
    if (knownIds.current === null) {
      knownIds.current = new Set(orders.map((o) => o.id));
      return;
    }
    const fresh = orders.filter((o) => !knownIds.current.has(o.id));
    orders.forEach((o) => knownIds.current.add(o.id));
    if (fresh.length === 0) return;
    if (settings.sound) playOrderSound(settings.volume);
    if (!settings.notifications) return;
    fresh.forEach((o) => {
      toast.success(`🔔 Yangi buyurtma: ${o.id}`, {
        position: "top-center",
        duration: settings.notificationDuration * 1000,
        description: `${o.userName ?? "Mijoz"} · ${fmtSum(o.total)}`
      });
    });
  }, [orders, loading, settings]);
  useEffect(() => {
    window.addEventListener("pointerdown", unlockSound);
    window.addEventListener("keydown", unlockSound);
    return () => {
      window.removeEventListener("pointerdown", unlockSound);
      window.removeEventListener("keydown", unlockSound);
    };
  }, []);
  const refresh = useCallback(async () => {
    const c = getCreds();
    if (!c) return setLoading(false);
    try {
      const d = await getAdminData({ data: c });
      setCategories(d.categories ?? []);
      setProducts(d.products);
      setOrders(d.orders);
      setPromotions(d.promotions);
      setCustomers(d.customers);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const c = getCreds();
    if (!c) return setLoading(false);
    void refresh();
    const socket = io(API_URL, { auth: c, reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });
    const upsert = (o) => setOrders((l) => {
      const i = l.findIndex((x) => x.id === o.id);
      if (i === -1) return [o, ...l];
      const n = l.slice(); n[i] = o; return n;
    });
    socket.on("connect", () => { setLive(true); void refresh(); });
    socket.on("disconnect", () => setLive(false));
    socket.on("state", (d) => {
      if (typeof d.liveUsers === "number") setLiveUsers(d.liveUsers);
      setCategories(d.categories ?? []);
      setProducts(d.products);
      setOrders(d.orders);
      setPromotions(d.promotions);
      setCustomers(d.customers);
      setLoading(false);
    });
    socket.on("live", (n) => setLiveUsers(n));
    socket.on("dbError", (m) => toast.error(m, { position: "top-center", duration: 15000 }));
    socket.on("order:new", upsert);
    socket.on("order:updated", upsert);
    socket.on("connect_error", (e) => {
      console.error(e);
      setLive(false);
      setLoading(false);
    });
    return () => {
      socket.disconnect();
    };
  }, [refresh]);
  const run = useCallback(
    async (fn) => {
      const c = getCreds();
      if (!c) { toast.error("Avval tizimga kiring"); return false; }
      setBusy((b) => b + 1);
      try {
        await fn(c);
      } catch (e) {
        console.error(e);
        toast.error(e.message || "Saqlab bo'lmadi");
        await refresh();
        setBusy((b) => b - 1);
        return false;
      }
      await refresh();
      setBusy((b) => b - 1);
      return true;
    },
    [refresh]
  );
  const value = useMemo(
    () => ({
      categories,
      categoryLabel: (id) => { const c = categories.find((x) => x.id === id); return c ? `${c.emoji ? c.emoji + " " : ""}${c.name}` : id; },
      saveCategory: (category) => run((c) => saveCategory({ data: { ...c, category } })),
      deleteCategory: (id) => run((c) => removeCategory({ data: { ...c, id } })),
      products,
      orders,
      newOrdersCount: orders.filter((o) => o.status === "new").length,
      promotions,
      customers,
      loading,
      busy: busy > 0,
      reorderCategories: (ids) => { setCategories((l) => ids.map((id, i) => ({ ...l.find((x) => x.id === id), sort: i }))); return run((c) => reorderCategories({ data: { ...c, ids } })); },
      liveUsers,
      live,
      refresh,
      addProduct: async (p) => {
        const product = { ...p, id: `custom_${Date.now()}` };
        setProducts((l) => [...l, product]);
        return run((c) => saveProduct({ data: { ...c, product } }));
      },
      updateProduct: async (id, patch) => {
        const cur = products.find((p) => p.id === id);
        if (!cur) return false;
        const product = { ...cur, ...patch, id };
        setProducts((l) => l.map((p) => p.id === id ? product : p));
        return run((c) => saveProduct({ data: { ...c, product } }));
      },
      deleteProduct: (id) => {
        setProducts((l) => l.filter((p) => p.id !== id));
        void run((c) => removeProduct({ data: { ...c, id } }));
      },
      setOrderStatus: (id, status, reason) => {
        setOrders((l) => l.map((o) => o.id === id ? { ...o, status, ...(reason ? { cancelReason: reason } : {}) } : o));
        void run((c) => updateOrderStatus({ data: { ...c, id, status, reason } }));
      },
      addPromotion: async (p) => {
        const promotion = { ...p, id: `promo_${Date.now()}` };
        setPromotions((l) => [...l, promotion]);
        const ok = await run((c) => savePromotion({ data: { ...c, promotion } }));
        if (!ok) setPromotions((l) => l.filter((x) => x.id !== promotion.id));
        return ok;
      },
      updatePromotion: async (id, patch) => {
        const cur = promotions.find((p) => p.id === id);
        if (!cur) return false;
        const promotion = { ...cur, ...patch, id };
        setPromotions((l) => l.map((p) => p.id === id ? promotion : p));
        const ok = await run((c) => savePromotion({ data: { ...c, promotion } }));
        if (!ok) setPromotions((l) => l.map((p) => p.id === id ? cur : p));
        return ok;
      },
      deletePromotion: (id) => {
        setPromotions((l) => l.filter((p) => p.id !== id));
        void run((c) => removePromotion({ data: { ...c, id } }));
      }
    }),
    [categories, products, orders, promotions, customers, loading, busy, live, refresh, run]
  );
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}
function useAdminStore() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdminStore must be used inside AdminStoreProvider");
  return ctx;
}
export {
  AUTH_KEY,
  AdminStoreProvider,
  getCreds,
  useAdminStore
};
