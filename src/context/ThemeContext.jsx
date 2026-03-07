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
    root.setAttribute("data-theme", resolvedTheme);
    root.style.colorScheme = resolvedTheme === "dark" ? "dark" : "light";
  }, [resolvedTheme]);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        const root = document.documentElement;
        const nextResolved = getSystemTheme();
        root.setAttribute("data-theme", nextResolved);
        root.style.colorScheme = nextResolved === "dark" ? "dark" : "light";
      }
    };
    media.addEventListener?.("change", handler);
    return () => media.removeEventListener?.("change", handler);
  }, [theme]);

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
