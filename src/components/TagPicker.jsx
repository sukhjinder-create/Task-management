// src/components/TagPicker.jsx
import { useEffect, useRef, useState } from "react";
import { Tag, Plus, X, Check } from "lucide-react";
import { useApi } from "../api";
import toast from "react-hot-toast";

const PRESET_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316",
  "#eab308","#22c55e","#14b8a6","#3b82f6","#64748b",
];

export default function TagPicker({ taskId, readOnly = false }) {
  const api = useApi();
  const [allTags, setAllTags] = useState([]);
  const [taskTags, setTaskTags] = useState([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const ref = useRef(null);

  useEffect(() => {
    api.get("/tags").then(r => setAllTags(r.data)).catch(() => {});
    api.get(`/tags/tasks/${taskId}`).then(r => setTaskTags(r.data)).catch(() => {});
  }, [taskId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isApplied = (tagId) => taskTags.some(t => t.id === tagId);

  const toggleTag = async (tag) => {
    if (readOnly) return;
    try {
      if (isApplied(tag.id)) {
        const res = await api.delete(`/tags/tasks/${taskId}/${tag.id}`);
        setTaskTags(res.data);
      } else {
        const res = await api.post(`/tags/tasks/${taskId}/${tag.id}`);
        setTaskTags(res.data);
      }
    } catch {
      toast.error("Failed to update tag");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post("/tags", { name: newName.trim(), color: newColor });
      const tag = res.data;
      setAllTags(prev => [...prev, tag]);
      // Auto-apply the new tag
      const applyRes = await api.post(`/tags/tasks/${taskId}/${tag.id}`);
      setTaskTags(applyRes.data);
      setNewName("");
      setCreating(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create tag");
      setCreating(false);
    }
  };

  const filtered = allTags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      {/* Applied tags display */}
      <div className="flex items-center flex-wrap gap-1.5 min-h-[24px]">
        {taskTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            {!readOnly && (
              <button
                className="ml-0.5 opacity-70 hover:opacity-100"
                onClick={() => toggleTag(tag)}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </span>
        ))}
        {!readOnly && (
          <button
            className="inline-flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-indigo-600 border border-dashed border-slate-300 hover:border-indigo-400 rounded-full px-1.5 py-0.5 transition-colors"
            onClick={() => setOpen(v => !v)}
          >
            <Tag className="w-2.5 h-2.5" />
            Add tag
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-2 text-xs">
          <input
            autoFocus
            className="w-full border rounded px-2 py-1 mb-2 text-[11px]"
            placeholder="Search tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="max-h-40 overflow-y-auto space-y-0.5 mb-2">
            {filtered.length === 0 && <p className="text-slate-400 text-center py-2">No tags found</p>}
            {filtered.map(tag => (
              <button
                key={tag.id}
                className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 text-left"
                onClick={() => toggleTag(tag)}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 truncate">{tag.name}</span>
                {isApplied(tag.id) && <Check className="w-3 h-3 text-green-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
          {/* Create new */}
          <form onSubmit={handleCreate} className="border-t pt-2 space-y-1.5">
            <p className="text-[10px] text-slate-500 font-semibold uppercase">New tag</p>
            <input
              className="w-full border rounded px-2 py-1 text-[11px]"
              placeholder="Tag name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <div className="flex gap-1 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  type="button"
                  key={c}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${newColor === c ? "border-slate-700 scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="w-full text-[11px] bg-indigo-600 text-white rounded py-1 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create & Apply"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
