// src/components/StudioWorkspacePicker.jsx
// Superadmin selects which workspace's Execution / Intelligence data to view.
import { useState } from "react";
import { getStudioWorkspaceId, setStudioWorkspaceId } from "../services/studioWorkspace";

export default function StudioWorkspacePicker({ onChange }) {
  const [ws, setWs] = useState(getStudioWorkspaceId());
  const apply = () => { const v = ws.trim(); setStudioWorkspaceId(v); onChange && onChange(v); };
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[12px] text-[color:var(--text-soft)]">Workspace</span>
      <input value={ws} onChange={(e) => setWs(e.target.value)} placeholder="workspace id"
        className="rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-[12px] w-[340px]" />
      <button onClick={apply} className="text-[12px] rounded-[6px] border border-[color:var(--border)] px-2.5 py-1 hover:bg-[var(--surface-soft)]">Apply</button>
      {!getStudioWorkspaceId() && <span className="text-[11px] text-[color:var(--score-danger)]">Select a workspace to load its data.</span>}
    </div>
  );
}
