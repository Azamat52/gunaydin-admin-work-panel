const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
async function call(path, method, c, body) {
  const jsonBody = body === void 0 ? null : JSON.stringify(body);
  if (jsonBody && new TextEncoder().encode(jsonBody).length > 95000) {
    throw new Error("Rasm yoki matn juda katta. Qisqartirib qayta saqlang.");
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...c?.token ? { Authorization: `Bearer ${c.token}` } : {}
    },
    body: jsonBody
  });
  if (!res.ok) {
    if (res.status === 413) throw new Error("Rasm yoki matn juda katta.");
    const j = await res.json().catch(() => null);
    throw new Error(j?.error || `Saqlab bo‘lmadi (API ${res.status}).`);
  }
  return res.json();
}
const adminLogin = ({ data }) => call("/api/login", "POST", null, data);
const getAdminData = ({ data }) => call(
  "/api/data",
  "GET",
  data
);
const saveProduct = ({ data: { product, ...c } }) => call("/api/products/" + encodeURIComponent(product.id), "PUT", c, product);
const saveCategory = ({ data: { category, ...c } }) => call("/api/categories/" + encodeURIComponent(category.id || "new"), "PUT", c, category);
const reorderCategories = ({ data: { ids, ...c } }) => call("/api/categories/reorder", "POST", c, { ids });
const removeCategory = ({ data: { id, ...c } }) => call("/api/categories/" + encodeURIComponent(id), "DELETE", c);
const removeProduct = ({ data: { id, ...c } }) => call("/api/products/" + encodeURIComponent(id), "DELETE", c);
const savePromotion = ({ data: { promotion, ...c } }) => call("/api/promotions/" + encodeURIComponent(promotion.id), "PUT", c, promotion);
const removePromotion = ({ data: { id, ...c } }) => call("/api/promotions/" + encodeURIComponent(id), "DELETE", c);
const updateOrderStatus = ({ data: { id, status, reason, ...c } }) => call(`/api/orders/${encodeURIComponent(id)}/status`, "PATCH", c, { status, reason });
async function fetchReceipt({ id, ...c }) {
  const res = await fetch(`${API_URL}/api/orders/${encodeURIComponent(id)}/receipt`, {
    headers: { Authorization: `Bearer ${c.token}` }
  });
  if (!res.ok) throw new Error("Chekni yuklab bo‘lmadi.");
  return res.blob();
}
function storedCreds() {
  try { const v = JSON.parse(localStorage.getItem("eb-admin-auth") ?? "null"); return v && typeof v.token === "string" ? v : null; } catch { return null; }
}
const getWorkHours = () => call("/api/data", "GET", storedCreds()).then((d) => ({ workHours: d.workHours, openNow: d.openNow }));
const saveWorkHours = (hours) => call("/api/settings/work-hours", "PUT", storedCreds(), hours);
const getShopSettings = () => call("/api/settings/shop", "GET", storedCreds());
const saveShopSettings = async (x) => {
  const r = await call("/api/settings/shop", "PUT", storedCreds(), x);
  return r;
};
const saveAdminCreds = (x) => call("/api/settings/admin", "PUT", storedCreds(), x);
const adminLogout = () => call("/api/logout", "POST", storedCreds(), {}).catch(() => null);
const restartBot = () => call("/api/restart", "POST", storedCreds(), {});
export {
  saveAdminCreds,
  saveCategory,
  reorderCategories,
  removeCategory,
  adminLogout,
  restartBot,
  getShopSettings,
  saveShopSettings,
  fetchReceipt,
  storedCreds,
  getWorkHours,
  saveWorkHours,
  API_URL,
  adminLogin,
  getAdminData,
  removeProduct,
  removePromotion,
  saveProduct,
  savePromotion,
  updateOrderStatus
};
