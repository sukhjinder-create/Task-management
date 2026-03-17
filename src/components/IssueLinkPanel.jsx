// src/components/IssueLinkPanel.jsx
import { useEffect, useState } from "react";
import { Link2, Plus, X, Search } from "lucide-react";
import { useApi } from "../api";
import toast from "react-hot-toast";

const LINK_TYPES = [
  { value: "blocks",        label: "Blocks" },
  { value: "is_blocked_by", label: "Is blocked by" },
  { value: "relates_to",   label: "Relates to" },
  { value: "duplicates",   label: "Duplicates" },
  { value: "duplicate_of", label: "Duplicate of" },
  { value: "parent_of",    label: "Parent of" },
  { value: "child_of",     label: "Child of" },
];

const LINK_COLORS = {
  blocks:        "bg-red-50 text-red-700 border-red-200",
  is_blocked_by: "bg-orange-50 text-orange-700 border-orange-200",
  relates_to:    "bg-blue-50 text-blue-700 border-blue-200",
  duplicates:    "bg-purple-50 text-purple-700 border-purple-200",
  duplicate_of:  "bg-purple-50 text-purple-700 border-purple-200",
  parent_of:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  child_of:      "bg-teal-50 text-teal-700 border-teal-200",
};

export default function IssueLinkPanel({ taskId, canEdit }) {
  const api = useApi();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [linkType, setLinkType] = useState("relates_to");

  useEffect(() => {
    load();
  }, [taskId]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/task-links/${taskId}`);
      setLinks(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/task-links/search/tasks?q=${encodeURIComponent(searchQ)}&exclude=${taskId}`);
        setSearchResults(res.data);
      } catch { /* ignore */ }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  const handleAdd = async () => {
    if (!selectedTarget) { toast.error("Select a task to link"); return; }
    try {
      await api.post("/task-links", {
        source_task_id: taskId,
        target_task_id: selectedTarget.id,
        link_type: linkType,
      });
      await load();
      setShowAdd(false);
      setSearchQ("");
      setSelectedTarget(null);
      setSearchResults([]);
      toast.success("Link added");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add link");
    }
  };

  const handleRemove = async (linkId) => {
    try {
      await api.delete(`/task-links/${linkId}`);
      setLinks(prev => prev.filter(l => l.id !== linkId));
      toast.success("Link removed");
    } catch {
      toast.error("Failed to remove link");
    }
  };

  // Group by link_type
  const grouped = links.reduce((acc, l) => {
    (acc[l.link_type] = acc[l.link_type] || []).push(l);
    return acc;
  }, {});

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-slate-400" />
          Issue Links
          {links.length > 0 && <span className="text-slate-400 font-normal">({links.length})</span>}
        </h3>
        {canEdit && (
          <button
            className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5"
            onClick={() => setShowAdd(v => !v)}
          >
            <Plus className="w-3 h-3" /> Add link
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-[11px] text-slate-400">Loading…</p>
      ) : links.length === 0 && !showAdd ? (
        <p className="text-[11px] text-slate-400">No links yet.</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
                {LINK_TYPES.find(l => l.value === type)?.label || type}
              </p>
              {items.map(link => (
                <div
                  key={link.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 border text-[11px] mb-1 ${LINK_COLORS[link.link_type] || "bg-slate-50 text-slate-700 border-slate-200"}`}
                >
                  {link.linked_display_id && (
                    <span className="font-mono font-semibold text-[10px]">{link.linked_display_id}</span>
                  )}
                  <span className="flex-1 truncate">{link.linked_task_title}</span>
                  <span className="text-[10px] opacity-70 capitalize">{link.linked_status}</span>
                  {canEdit && (
                    <button
                      className="opacity-50 hover:opacity-100 ml-1"
                      onClick={() => handleRemove(link.id)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Add link form */}
      {showAdd && canEdit && (
        <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
          <select
            className="w-full border rounded px-2 py-1 text-[11px]"
            value={linkType}
            onChange={e => setLinkType(e.target.value)}
          >
            {LINK_TYPES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-2 top-1.5 w-3 h-3 text-slate-400" />
            <input
              className="w-full border rounded pl-6 pr-2 py-1 text-[11px]"
              placeholder="Search task by title or ID..."
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setSelectedTarget(null); }}
            />
          </div>
          {selectedTarget && (
            <div className="bg-indigo-50 border border-indigo-200 rounded px-2 py-1 text-[11px] flex items-center gap-2">
              {selectedTarget.display_id && <span className="font-mono text-indigo-500">{selectedTarget.display_id}</span>}
              <span className="flex-1 truncate">{selectedTarget.task}</span>
              <button onClick={() => setSelectedTarget(null)}><X className="w-3 h-3" /></button>
            </div>
          )}
          {searching && <p className="text-[11px] text-slate-400">Searching…</p>}
          {!selectedTarget && searchResults.length > 0 && (
            <div className="max-h-36 overflow-y-auto border rounded bg-white divide-y divide-slate-100">
              {searchResults.map(t => (
                <button
                  key={t.id}
                  className="w-full text-left px-2 py-1.5 hover:bg-slate-50 text-[11px] flex items-center gap-2"
                  onClick={() => { setSelectedTarget(t); setSearchQ(t.task); setSearchResults([]); }}
                >
                  {t.display_id && <span className="font-mono text-indigo-500 shrink-0">{t.display_id}</span>}
                  <span className="truncate">{t.task}</span>
                  <span className="text-slate-400 shrink-0 capitalize">{t.status}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button className="text-[11px] text-slate-500 px-2 py-1 border rounded" onClick={() => { setShowAdd(false); setSearchQ(""); setSelectedTarget(null); }}>Cancel</button>
            <button
              className="text-[11px] bg-indigo-600 text-white px-3 py-1 rounded disabled:opacity-50"
              disabled={!selectedTarget}
              onClick={handleAdd}
            >
              Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
