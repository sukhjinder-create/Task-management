import { Palette } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const LABELS = {
  system: "System",
  light: "Light",
  dark: "Dark",
  ocean: "Ocean",
  forest: "Forest",
  sunset: "Sunset",
  yellow: "Yellow",
};

export default function ThemeSwitcher({ compact = false }) {
  const { theme, setTheme, themes } = useTheme();

  return (
    <label
      className={`inline-flex items-center gap-2 ${
        compact ? "text-xs" : "text-sm"
      } theme-text`}
      title="Theme"
    >
      <Palette className={compact ? "w-4 h-4" : "w-5 h-5"} />
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className={`rounded-lg border px-2 py-1 ${
          compact ? "text-xs" : "text-sm"
        } theme-input`}
      >
        {themes.map((t) => (
          <option key={t} value={t}>
            {LABELS[t] || t}
          </option>
        ))}
      </select>
    </label>
  );
}
