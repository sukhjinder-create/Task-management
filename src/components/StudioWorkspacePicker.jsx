// src/components/StudioWorkspacePicker.jsx
// Superadmin selects which workspace's Execution / Intelligence data to view — by name —
// and can ENABLE/DISABLE the platform for that workspace right here.
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getStudioWorkspaceId, setStudioWorkspaceId, listWorkspacesForPicker, getPlatformFeatures, setPlatformFeature } from "../services/studioWorkspace";

export default function StudioWorkspacePicker({ onChange, feature }) {
  const [workspaces, setWorkspaces] = useState(null);
  const [sel, setSel] = useState(getStudioWorkspaceId());
  const [enabled, setEnabled] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadEnabled = async (ws) => {
    if (!feature || !ws) return setEnabled(null);
    try { const f = await getPlatformFeatures(ws); setEnabled(Boolean(f?.[feature])); } catch { setEnabled(null); }
  };

  useEffect(() => {
    listWorkspacesForPicker().then((ws) => {
      setWorkspaces(ws);
      const cur = getStudioWorkspaceId() || ws[0]?.id || "";
      if (cur && !getStudioWorkspaceId()) { setStudioWorkspaceId(cur); setSel(cur); onChange && onChange(cur); }
      if (cur) loadEnabled(cur);
    }).catch(() => setWorkspaces([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (id) => { setSel(id); setStudioWorkspaceId(id); loadEnabled(id); onChange && onChange(id); };
  const toggle = async () => {
    if (!sel || !feature) return;
    setBusy(true);
    try {
      const next = !enabled;
      await setPlatformFeature(feature, sel, next);
      setEnabled(next);
      toast.success(next ? "Enabled for this workspace" : "Disabled for this workspace");
      onChange && onChange(sel); // reload data now that it's enabled
    } catch (e) { toast.error(e?.response?.data?.error || "Failed to update"); }
    finally { setBusy(false); }
  };

  const label = feature === "execution" ? "Execution Platform" : "Enterprise Intelligence";

  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-[color:var(--text-soft)]">Workspace</span>
        {workspaces === null ? <span className="text-[12px] text-[color:var(--text-soft)]">loading…</span>
          : workspaces.length === 0 ? <span className="text-[12px] text-[color:var(--score-danger)]">no workspaces</span>
          : (
            <select value={sel} onChange={(e) => choose(e.target.value)}
              className="rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-[12.5px] text-[color:var(--text)] min-w-[240px]">
              <option value="">Select a workspace…</option>
              {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
      </div>
      {feature && sel && enabled !== null && (
        <button onClick={toggle} disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition-colors disabled:opacity-50 ${enabled ? "text-emerald-500 border-emerald-500/40 bg-emerald-500/10" : "text-[color:var(--text-soft)] border-[color:var(--border)] hover:bg-[var(--surface-soft)]"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-[color:var(--text-soft)]"}`} />
          {label}: {busy ? "…" : enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
        </button>
      )}
    </div>
  );
}
