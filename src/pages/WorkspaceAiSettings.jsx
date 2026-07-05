// src/pages/WorkspaceAiSettings.jsx
//
// Epic C — Workspace AI Studio. Workspace admins see the effective AI config for
// each capability and may override only what the platform leaves unlocked. Locked
// state is visualized. Reuses design tokens + the workspace API. UNVERIFIED AT RUNTIME.

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Boxes, PlayCircle, BarChart3, Lock, Unlock } from "lucide-react";
import { workspaceAiStudio as api } from "../services/aiStudioApi";
import baseApi from "../api";

const card = "rounded-lg border border-[color:var(--border)] bg-[var(--surface)]";
const mutedText = "text-[color:var(--text-muted)]";

function LockState({ editable, badge, help }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${editable ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`} title={help}>
      {editable ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}{badge}
    </span>
  );
}

export default function WorkspaceAiSettings() {
  const [tab, setTab] = useState("settings");
  const [caps, setCaps] = useState(null);
  const [sel, setSel] = useState(null);
  const [controls, setControls] = useState(null);
  const [override, setOverride] = useState({});

  useEffect(() => { api.capabilities().then(setCaps).catch(() => setCaps([])); }, []);

  const open = async (key) => {
    setSel(key); setControls(null); setOverride({});
    try { setControls(await api.controls(key)); } catch { setControls({ error: true }); }
  };
  const save = async () => {
    try { await api.previewOverride(sel, { override }); await apiPut(sel, override); toast.success("Override saved"); open(sel); }
    catch (e) { toast.error(e?.response?.data?.reason || e?.response?.data?.error || "Not permitted"); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--text)]">AI Settings</h1>
        <p className={`text-sm ${mutedText}`}>Configure how AI features behave for your workspace. Some settings are managed centrally by the platform.</p>
      </div>

      <div className="flex gap-1">
        {[["settings", "Settings", Boxes], ["playground", "Playground", PlayCircle], ["usage", "Usage", BarChart3]].map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${tab === k ? "bg-[var(--surface-soft)] text-[color:var(--text)] border border-[color:var(--border)]" : mutedText}`}>
            <Icon className="w-4 h-4" />{l}
          </button>
        ))}
      </div>

      {tab === "settings" && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className={`${card} p-3 space-y-1`}>
            <p className="text-sm font-medium text-[color:var(--text)] px-1 pb-1">Capabilities</p>
            {caps === null ? <p className={`${mutedText} text-sm p-2`}>Loading…</p> :
              caps.map((c) => (
                <button key={c.key} onClick={() => open(c.key)} className={`block w-full text-left px-2 py-1.5 rounded text-sm ${sel === c.key ? "bg-[var(--surface-soft)] text-[color:var(--text)]" : mutedText}`}>{c.name}</button>
              ))}
          </div>
          <div className="md:col-span-2">
            {!sel ? <p className={`${mutedText} text-sm`}>Select a capability to view and override its configuration.</p> :
              !controls ? <p className={`${mutedText} text-sm`}>Loading…</p> :
              controls.error ? <p className={`${mutedText} text-sm`}>Could not load controls.</p> : (
                <div className={`${card} p-4 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[color:var(--text)]">{controls.capability?.name}</p>
                    <LockState {...(Object.values(controls.controls)[0] || {})} />
                  </div>
                  {Object.entries(controls.controls).map(([field, c]) => (
                    <div key={field}>
                      <label className={`text-xs ${mutedText} capitalize`}>{field}</label>
                      <input
                        defaultValue={c.value ?? ""}
                        disabled={!c.editable}
                        onChange={(e) => setOverride((o) => ({ ...o, [field]: e.target.value }))}
                        placeholder={c.platformDefault ?? "platform default"}
                        className="w-full mt-1 bg-[var(--app-bg)] border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm text-[color:var(--text)] disabled:opacity-50"
                      />
                      <p className={`text-[11px] ${mutedText} mt-0.5`}>Platform default: {c.platformDefault ?? "—"} · {c.help}</p>
                    </div>
                  ))}
                  {Object.values(controls.controls)[0]?.editable && (
                    <button onClick={save} className="px-3 py-1.5 rounded-lg text-sm bg-[color:var(--primary)] text-white">Save override</button>
                  )}
                </div>
              )}
          </div>
        </div>
      )}

      {tab === "playground" && <WsPlayground caps={caps || []} />}
      {tab === "usage" && <WsUsage />}
    </div>
  );
}

function WsPlayground({ caps }) {
  const [capability, setCapability] = useState("workspace_assistant");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState(null);
  const run = async () => {
    try { setResult(await api.playground(capability, prompt)); } catch (e) { toast.error(e?.response?.data?.error || "Run failed"); }
  };
  return (
    <div className={`${card} p-4 space-y-3 max-w-2xl`}>
      <select value={capability} onChange={(e) => setCapability(e.target.value)} className="w-full bg-[var(--app-bg)] border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm text-[color:var(--text)]">
        {caps.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
      </select>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} placeholder="Test a prompt…" className="w-full bg-[var(--app-bg)] border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm text-[color:var(--text)]" />
      <button onClick={run} className="px-3 py-1.5 rounded-lg text-sm bg-[color:var(--primary)] text-white">Run</button>
      {result && <div className="text-sm text-[color:var(--text)] whitespace-pre-wrap pt-2 border-t border-[color:var(--border)]">{result.text}</div>}
    </div>
  );
}

function WsUsage() {
  const [usage, setUsage] = useState(null);
  useEffect(() => { api.usage({ period: "month" }).then(setUsage).catch(() => setUsage({ rows: [] })); }, []);
  if (!usage) return <p className={`${mutedText} text-sm`}>Loading…</p>;
  if (!usage.rows?.length) return <p className={`${mutedText} text-sm`}>No AI usage recorded yet this month.</p>;
  return (
    <div className={`${card} overflow-hidden`}>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-[color:var(--border)]">{["Capability", "Requests", "Tokens"].map((h) => <th key={h} className={`text-left ${mutedText} px-4 py-2`}>{h}</th>)}</tr></thead>
        <tbody>{usage.rows.map((r, i) => <tr key={i} className="border-b border-[color:var(--border)] last:border-0"><td className="px-4 py-2 text-[color:var(--text)]">{r.capability_key}</td><td className="px-4 py-2 text-[color:var(--text)]">{r.requests}</td><td className="px-4 py-2 text-[color:var(--text)]">{Number(r.input_tokens) + Number(r.output_tokens)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

// Persist an override via the workspace API (PUT). Uses the same api instance.
function apiPut(key, override) { return baseApi.put(`/ai-studio/capabilities/${encodeURIComponent(key)}/override`, { override }).then((r) => r.data); }
