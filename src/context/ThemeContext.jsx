import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "app_theme";
const BRAND_VERSION_KEY = "app_theme_brand_version";
const BRAND_THEME_VERSION = "dark-orange-2026-06";
const THEME_OPTIONS = [
  "system",
  "light",
  "dark",
  "ocean",
  "forest",
  "sunset",
  "yellow",
];

function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme) {
  // "system" resolves for consumers that need to know the actual effective mode
  // but we never put "dark"/"light" on the element for system — CSS handles it
  return theme === "system" ? getSystemTheme() : theme;
}

function readInitialTheme() {
  try {
    const storedVersion = localStorage.getItem(BRAND_VERSION_KEY);
    if (storedVersion !== BRAND_THEME_VERSION) {
      localStorage.setItem(STORAGE_KEY, "dark");
      localStorage.setItem(BRAND_VERSION_KEY, BRAND_THEME_VERSION);
      return "dark";
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEME_OPTIONS.includes(stored)) return stored;
  } catch {}
  // New product face — enterprise dark is the default for new users.
  return "dark";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme);
  const resolvedTheme = resolveTheme(theme);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
      localStorage.setItem(BRAND_VERSION_KEY, BRAND_THEME_VERSION);
    } catch {}
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      // Keep data-theme="system" — CSS media query inside [data-theme="system"]
      // handles the dark/light switch automatically without JS rerender
      root.setAttribute("data-theme", "system");
      // "light dark" tells the browser to adapt scrollbars, form controls, etc.
      root.style.colorScheme = "light dark";
    } else {
      root.setAttribute("data-theme", theme);
      root.style.colorScheme = resolvedTheme === "dark" ? "dark" : "light";
    }
  }, [theme, resolvedTheme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      themes: THEME_OPTIONS,
    }),
    [theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
