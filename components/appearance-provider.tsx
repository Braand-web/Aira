"use client";

import {createContext, useContext, useSyncExternalStore, type ReactNode} from "react";
import {ThemeProvider} from "next-themes";
import {ACCENT_STORAGE_KEY, MODE_STORAGE_KEY, accentTheme, type AccentTheme} from "@/lib/appearance";

const CHANGE_EVENT = "braand:accent-change";
const AppearanceContext = createContext<{accent: AccentTheme; setAccent: (accent: AccentTheme) => void} | null>(null);

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== ACCENT_STORAGE_KEY && event.key !== null) return;
    document.documentElement.dataset.accent = accentTheme(event.newValue);
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function setAccent(value: AccentTheme) {
  const accent = accentTheme(value);
  document.documentElement.dataset.accent = accent;
  try { window.localStorage.setItem(ACCENT_STORAGE_KEY, accent); } catch { /* The current page still follows the choice when storage is unavailable. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function AppearanceProvider({children}: {children: ReactNode}) {
  const accent = useSyncExternalStore(subscribe, () => accentTheme(document.documentElement.dataset.accent), () => "default" as const);
  return <ThemeProvider attribute="class" storageKey={MODE_STORAGE_KEY} defaultTheme="system" enableSystem enableColorScheme disableTransitionOnChange>
    <AppearanceContext.Provider value={{accent, setAccent}}>{children}</AppearanceContext.Provider>
  </ThemeProvider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("AppearanceProvider is required.");
  return context;
}
