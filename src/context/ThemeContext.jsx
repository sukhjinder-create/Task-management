import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "app_theme";
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
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEME_OPTIONS.includes(stored)) return stored;
  } catch {}
  return "system";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme);
  const resolvedTheme = resolveTheme(theme);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
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
