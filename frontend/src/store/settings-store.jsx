import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, SETTINGS_KEY, normalizeSettings, readSettings } from "@/lib/preferences";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setSettings(readSettings());
    setReady(true);
    const sync = (event) => { if (event.key === SETTINGS_KEY || event.key === null) setSettings(readSettings()); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.classList.toggle("light", !dark);
      document.documentElement.dataset.density = settings.compact ? "compact" : "comfortable";
    };
    apply();
    media.addEventListener("change", apply);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Storage may be unavailable. */ }
    return () => media.removeEventListener("change", apply);
  }, [settings, ready]);

  const updateSettings = (patch) => setSettings((current) => normalizeSettings({ ...current, ...patch }));
  const resetSettings = () => setSettings({ ...DEFAULT_SETTINGS });
  return <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings requires SettingsProvider");
  return context;
}