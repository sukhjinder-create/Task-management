// src/components/SavedFiltersPanel.jsx
import { useEffect, useState } from "react";
import { Bookmark, Plus, Trash2, Share2 } from "lucide-react";
import { useApi } from "../api";
import toast from "react-hot-toast";

export default function SavedFiltersPanel({ projectId, currentFilters, onApply }) {
  const api = useApi();
  const [filters, setFilters] = useState([]);
  const [showSave, setShowSave] = useState(false);
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [projectId]);

  async function load() {
    try {
      const res = await api.get(`/saved-filters?project_id=${projectId || ""}`);
      setFilters(res.data);
    } catch { /* ignore */ }
  }

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post("/saved-filters", {
        project_id: projectId,
        name: name.trim(),
        filter_config: currentFilters,
        is_shared: isShared,
      });
      await load();
      setName("");
      setShowSave(false);
      toast.success("Filter saved");
    } catch {
      toast.error("Failed to save filter");
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/saved-filters/${id}`);
      setFilters(prev => prev.filter(f => f.id !== id));
      toast.success("Filter removed");
    } catch {
      toast.error("Failed to delete filter");
    }
  };

  return (
    <div className="relative">
      <button
        className="flex items-center gap-1.5 text-[11px] border border-[color:var(--border)] rounded-lg px-2 py-1 hover:border-[color:var(--primary)] text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors"
        onClick={() => setShowSave(v => !v)}
        title="Saved filters"
      >
        <Bookmark className="w-3 h-3" />
        Saved
        {filters.length > 0 && <span className="text-[color:var(--text-soft)]">({filters.length})</span>}
      </button>

      {showSave && (
        <div className="absolute right-0 top-8 z-30 w-64 bg-[var(--surface)] border border-[color:var(--border)] rounded-xl p-3 text-xs shadow-xl">
          <p className="text-[10px] uppercase tracking-wide text-[color:var(--text-muted)] font-semibold mb-2">Saved Filters</p>

          {filters.length === 0 ? (
            <p className="text-[color:var(--text-soft)] text-center py-2 text-[11px]">No saved filters yet</p>
          ) : (
            <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
              {filters.map(f => (
                <div key={f.id} className="flex items-center gap-1 group">
                  <button
                    className="flex-1 text-left px-2 py-1 rounded hover:bg-[var(--surface-soft)] hover:text-[color:var(--primary)] text-[color:var(--text-muted)] text-[11px] flex items-center gap-1.5 transition-colors"
                    onClick={() => { onApply(f.filter_config); setShowSave(false); }}
                  >
                    {f.is_shared && <Share2 className="w-2.5 h-2.5 text-[color:var(--text-soft)]" />}
                    <span className="truncate">{f.name}</span>
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 p-0.5 transition-colors"
                    onClick={() => handleDelete(f.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-[color:var(--border)] pt-2">
            <form onSubmit={handleSave} className="space-y-1.5">
              <input
                className="w-full bg-[var(--surface)] border border-[color:var(--border)] text-[color:var(--text)] rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-[color:var(--primary)]"
                placeholder="Filter name..."
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <label className="flex items-center gap-1.5 text-[11px] text-[color:var(--text-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={e => setIsShared(e.target.checked)}
                  className="w-3 h-3"
                />
                Share with team
              </label>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="w-full text-[11px] bg-[color:var(--primary)] text-white rounded-lg py-1 disabled:opacity-50 flex items-center justify-center gap-1 hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3 h-3" />
                {saving ? "Saving…" : "Save current filters"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
