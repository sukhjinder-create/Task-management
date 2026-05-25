import { Palette } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const LABELS = {
  system: "System",
  light:  "Light",
  dark:   "Dark",
  ocean:  "Ocean",
  forest: "Forest",
  sunset: "Sunset",
  yellow: "Yellow",
};

export default function ThemeSwitcher({ compact = false }) {
  const { theme, setTheme, themes } = useTheme();
  return (
    <label
      className="inline-flex items-center gap-1.5 text-[color:var(--text-muted)]"
      title="Theme"
    >
      <Palette className="w-3.5 h-3.5" />
      <div className="relative">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className={`appearance-none cursor-pointer pl-2 pr-7 ${
            compact ? "h-7 text-xs" : "h-8 text-sm"
          } bg-[var(--surface-soft)] border border-[color:var(--border)] rounded-[6px] text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)] transition-[border-color,box-shadow] duration-150`}
        >
          {themes.map((t) => (
            <option key={t} value={t}>
              {LABELS[t] || t}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[color:var(--text-soft)]"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </label>
  );
}
