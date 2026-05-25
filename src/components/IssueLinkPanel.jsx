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
  blocks:        "border-[color:var(--border)] text-[color:var(--text-soft)]",
  is_blocked_by: "border-[color:var(--primary)]/40 text-[color:var(--primary)]",
  relates_to:    "border-[color:var(--border)] text-[color:var(--text-soft)]",
  duplicates:    "border-[color:var(--border)] text-[color:var(--text-muted)]",
  duplicate_of:  "border-[color:var(--border)] text-[color:var(--text-muted)]",
  parent_of:     "border-[color:var(--primary)]/30 text-[color:var(--text-soft)]",
  child_of:      "border-[color:var(--border)] text-[color:var(--text-soft)]",
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
    <div className="mt-3 border-t border-[color:var(--border)] pt-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold flex items-center gap-1.5 text-[color:var(--text)]">
          <Link2 className="w-3.5 h-3.5 text-[color:var(--text-muted)]" />
          Issue Links
          {links.length > 0 && (
            <span className="text-[color:var(--text-muted)] font-normal">({links.length})</span>
          )}
        </h3>
        {canEdit && (
          <button
            className="text-[11px] text-[color:var(--primary)] hover:underline flex items-center gap-0.5"
            onClick={() => setShowAdd(v => !v)}
          >
            <Plus className="w-3 h-3" /> Add link
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-[11px] text-[color:var(--text-muted)]">Loading…</p>
      ) : links.length === 0 && !showAdd ? (
        <p className="text-[11px] text-[color:var(--text-muted)]">No links yet.</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <p className="text-[10px] uppercase tracking-wide text-[color:var(--text-muted)] font-semibold mb-1">
                {LINK_TYPES.find(l => l.value === type)?.label || type}
              </p>
              {items.map(link => (
                <div
                  key={link.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 border text-[11px] mb-1 border-[color:var(--border)] ${LINK_COLORS[link.link_type] || "text-[color:var(--text-soft)]"}`}
                >
                  {link.linked_display_id && (
                    <span className="font-mono font-semibold text-[10px] text-[color:var(--primary)]">{link.linked_display_id}</span>
                  )}
                  <span className="flex-1 truncate text-[color:var(--text)]">{link.linked_task_title}</span>
                  <span className="text-[10px] text-[color:var(--text-muted)] capitalize">{link.linked_status}</span>
                  {canEdit && (
                    <button
                      className="opacity-50 hover:opacity-100 ml-1 text-[color:var(--text-muted)] hover:text-red-400"
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
        <div className="mt-2 p-2 border border-[color:var(--border)] rounded-lg space-y-2">
          <select
            className="w-full bg-[var(--surface)] border border-[color:var(--border)] text-[color:var(--text)] rounded px-2 py-1 text-[11px] focus:outline-none focus:border-[color:var(--primary)]"
            value={linkType}
            onChange={e => setLinkType(e.target.value)}
          >
            {LINK_TYPES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-2 top-1.5 w-3 h-3 text-[color:var(--text-muted)]" />
            <input
              className="w-full bg-[var(--surface)] border border-[color:var(--border)] text-[color:var(--text)] rounded pl-6 pr-2 py-1 text-[11px] focus:outline-none focus:border-[color:var(--primary)] placeholder:text-[color:var(--text-muted)]"
              placeholder="Search task by title or ID..."
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setSelectedTarget(null); }}
            />
          </div>
          {selectedTarget && (
            <div className="bg-[var(--surface-soft)] border border-[color:var(--primary)] rounded px-2 py-1 text-[11px] flex items-center gap-2">
              {selectedTarget.display_id && (
                <span className="font-mono text-[color:var(--primary)]">{selectedTarget.display_id}</span>
              )}
              <span className="flex-1 truncate text-[color:var(--text)]">{selectedTarget.task}</span>
              <button onClick={() => setSelectedTarget(null)} className="text-[color:var(--text-muted)] hover:text-[color:var(--text)]">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {searching && <p className="text-[11px] text-[color:var(--text-muted)]">Searching…</p>}
          {!selectedTarget && searchResults.length > 0 && (
            <div className="max-h-36 overflow-y-auto border border-[color:var(--border)] rounded bg-[var(--surface)] divide-y divide-[color:var(--border)]">
              {searchResults.map(t => (
                <button
                  key={t.id}
                  className="w-full text-left px-2 py-1.5 hover:bg-[var(--surface-soft)] text-[11px] flex items-center gap-2"
                  onClick={() => { setSelectedTarget(t); setSearchQ(t.task); setSearchResults([]); }}
                >
                  {t.display_id && (
                    <span className="font-mono text-[color:var(--primary)] shrink-0">{t.display_id}</span>
                  )}
                  <span className="truncate text-[color:var(--text)]">{t.task}</span>
                  <span className="text-[color:var(--text-muted)] shrink-0 capitalize">{t.status}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              className="text-[11px] text-[color:var(--text-muted)] px-2 py-1 border border-[color:var(--border)] rounded hover:text-[color:var(--text)]"
              onClick={() => { setShowAdd(false); setSearchQ(""); setSelectedTarget(null); }}
            >
              Cancel
            </button>
            <button
              className="text-[11px] bg-[color:var(--primary)] text-[color:var(--primary-contrast)] px-3 py-1 rounded disabled:opacity-50"
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
