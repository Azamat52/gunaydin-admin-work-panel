export const SETTINGS_KEY = "eb-admin-settings";
export const DEFAULT_SETTINGS = Object.freeze({
  theme: "dark",
  notifications: true,
  sound: true,
  volume: 70,
  notificationDuration: 8,
  compact: false,
});

export function normalizeSettings(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    theme: ["dark", "light", "system"].includes(input.theme) ? input.theme : DEFAULT_SETTINGS.theme,
    notifications: typeof input.notifications === "boolean" ? input.notifications : true,
    sound: typeof input.sound === "boolean" ? input.sound : true,
    volume: typeof input.volume === "number" && Number.isFinite(input.volume) ? Math.min(100, Math.max(0, input.volume)) : 70,
    notificationDuration: [5, 8, 15].includes(input.notificationDuration) ? input.notificationDuration : 8,
    compact: typeof input.compact === "boolean" ? input.compact : false,
  };
}

export function readSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try { return normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null")); }
  catch { return { ...DEFAULT_SETTINGS }; }
}