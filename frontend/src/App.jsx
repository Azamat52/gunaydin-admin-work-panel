import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

import AdminLayout from "@/components/admin/AdminLayout";
import { Toaster } from "@/components/ui/sonner";
import Customers from "@/pages/Customers";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Orders from "@/pages/Orders";
import Products from "@/pages/Products";
import Categories from "@/pages/Categories";
import Promotions from "@/pages/Promotions";
import PromotionDetail from "@/pages/PromotionDetail";
import Stats from "@/pages/Stats";
import Settings from "@/pages/Settings";
import { SettingsProvider } from "@/store/settings-store";
import { AdminStoreProvider } from "@/store/admin-store";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Sahifa topilmadi</h2>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Boshqaruv paneliga
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
      <AdminStoreProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="categories" element={<Categories />} />
            <Route path="products" element={<Products />} />
            <Route path="orders" element={<Orders />} />
            <Route path="promotions" element={<Promotions />} />
            <Route path="promotions/:id" element={<PromotionDetail />} />
            <Route path="customers" element={<Customers />} />
            <Route path="stats" element={<Stats />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </AdminStoreProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
}
