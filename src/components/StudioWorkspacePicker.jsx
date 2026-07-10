// src/components/StudioWorkspacePicker.jsx
// Superadmin selects which workspace's Execution / Intelligence data to view — by name.
import { useEffect, useState } from "react";
import { getStudioWorkspaceId, setStudioWorkspaceId, listWorkspacesForPicker } from "../services/studioWorkspace";

export default function StudioWorkspacePicker({ onChange }) {
  const [workspaces, setWorkspaces] = useState(null);
  const [sel, setSel] = useState(getStudioWorkspaceId());

  useEffect(() => {
    listWorkspacesForPicker()
      .then((ws) => {
        setWorkspaces(ws);
        // Auto-select the first workspace if none chosen yet, so data loads immediately.
        if (!getStudioWorkspaceId() && ws[0]) { setStudioWorkspaceId(ws[0].id); setSel(ws[0].id); onChange && onChange(ws[0].id); }
      })
      .catch(() => setWorkspaces([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (id) => { setSel(id); setStudioWorkspaceId(id); onChange && onChange(id); };

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[12px] text-[color:var(--text-soft)]">Workspace</span>
      {workspaces === null ? (
        <span className="text-[12px] text-[color:var(--text-soft)]">loading…</span>
      ) : workspaces.length === 0 ? (
        <span className="text-[12px] text-[color:var(--score-danger)]">no workspaces found</span>
      ) : (
        <select value={sel} onChange={(e) => choose(e.target.value)}
          className="rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-[12.5px] text-[color:var(--text)] min-w-[240px]">
          <option value="">Select a workspace…</option>
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      )}
    </div>
  );
}
