// src/pages/SuperadminAiStudio.jsx
//
// Epic C — Superadmin AI Studio. The single control plane for the AI Platform.
// Reuses the existing design tokens (--surface / --border / --text / --primary),
// lucide icons, and the SuperAdminLayout. Wired to the real backend via
// services/aiStudioApi.js. UNVERIFIED AT RUNTIME (no browser/DB in the build env).

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  LayoutDashboard, Server, Cpu, Boxes, FileText, SlidersHorizontal, PlayCircle,
  BarChart3, DollarSign, HeartPulse, ScrollText, Route as RouteIcon, Lock, RefreshCw,
} from "lucide-react";
import { superadminAiStudio as api } from "../services/aiStudioApi";
import superadminApi from "../superadminApi";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "providers", label: "Providers", icon: Server },
  { key: "models", label: "Models", icon: Cpu },
  { key: "capabilities", label: "Capabilities", icon: Boxes },
  { key: "prompts", label: "Prompt Registry", icon: FileText },
  { key: "profiles", label: "Runtime Profiles", icon: SlidersHorizontal },
  { key: "playground", label: "Playground", icon: PlayCircle },
  { key: "usage", label: "Usage", icon: BarChart3 },
  { key: "cost", label: "Cost", icon: DollarSign },
  { key: "health", label: "Health", icon: HeartPulse },
  { key: "audit", label: "Audit History", icon: ScrollText },
  { key: "traces", label: "Trace Explorer", icon: RouteIcon },
];

// ── Shared UI (matches existing tokens) ───────────────────────────────────────
const card = "rounded-lg border border-[color:var(--border)] bg-[var(--surface)]";
const mutedText = "text-[color:var(--text-muted)]";

function Help({ children }) {
  return <p className={`text-xs ${mutedText} mt-1 leading-relaxed`}>{children}</p>;
}
function Loading() {
  return <div className={`${mutedText} text-sm flex items-center gap-2 py-8 justify-center`}><RefreshCw className="w-4 h-4 animate-spin" /> Loading…</div>;
}
function Empty({ label }) {
  return <div className={`${mutedText} text-sm text-center py-8`}>{label || "No data yet."}</div>;
}
function LockBadge({ level }) {
  const map = {
    global_locked: { t: "Locked by platform", c: "text-red-400 bg-red-500/10" },
    workspace_locked: { t: "Pinned", c: "text-amber-400 bg-amber-500/10" },
    workspace_customizable: { t: "Customizable", c: "text-emerald-400 bg-emerald-500/10" },
  };
  const m = map[level] || map.workspace_customizable;
  return <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${m.c}`}><Lock className="w-3 h-3" />{m.t}</span>;
}
function Table({ columns, rows, render }) {
  if (!rows?.length) return <Empty />;
  return (
    <div className={`${card} overflow-hidden`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[color:var(--border)]">
            {columns.map((c) => <th key={c} className={`text-left font-medium ${mutedText} px-4 py-2.5`}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[color:var(--border)] last:border-0 hover:bg-[var(--surface-soft)]">
              {render(r).map((cell, j) => <td key={j} className="px-4 py-2.5 text-[color:var(--text)]">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function StatCard({ label, value, hint }) {
  return (
    <div className={`${card} p-4`}>
      <p className={`text-xs ${mutedText}`}>{label}</p>
      <p className="text-2xl font-semibold text-[color:var(--text)] mt-1">{value}</p>
      {hint && <Help>{hint}</Help>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SuperadminAiStudio() {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const loaders = {
      overview: () => api.overview(),
      providers: () => api.providers(),
      models: () => api.models(),
      capabilities: () => api.capabilities(),
      prompts: () => api.capabilities().then(() => api.overview().then((o) => ({ overview: o }))), // prompts handled in its own view
      profiles: () => api.profiles(),
      usage: () => api.usage({ period: "month" }),
      cost: () => api.cost({ period: "month" }),
      health: () => Promise.all([api.effectiveConfig && null, api.permissions && null]).then(() => ({})),
      audit: () => api.overview(), // audit list fetched in view
      traces: () => api.overview(),
    };
    if (tab === "capabilities" || tab === "playground" || tab === "prompts" || tab === "health" || tab === "audit" || tab === "traces") { setData({}); return; }
    setLoading(true);
    (loaders[tab] || (() => Promise.resolve(null)))()
      .then((d) => alive && setData(d))
      .catch((e) => alive && (toast.error(e?.response?.data?.error || "Failed to load"), setData(null)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [tab]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--text)]">AI Studio</h1>
        <p className={`text-sm ${mutedText}`}>The control plane for every AI capability in Asystence. No code or database edits required.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              tab === key ? "bg-[var(--surface-soft)] text-[color:var(--text)] border border-[color:var(--border)]" : `${mutedText} hover:bg-[var(--surface-soft)]`
            }`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <>
          {tab === "overview" && data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Providers" value={data.counts?.providers ?? "—"} hint={`${data.counts?.providersConfigured ?? 0} with a key configured`} />
                <StatCard label="Models" value={data.counts?.models ?? "—"} />
                <StatCard label="Capabilities" value={data.counts?.capabilities ?? "—"} />
                <StatCard label="Runtime Profiles" value={data.counts?.profiles ?? "—"} />
              </div>
              <div className={`${card} p-4`}>
                <p className="text-sm text-[color:var(--text)]">Platform status</p>
                <Help>Execution flag: <b>{data.platform?.enabled ? "ON" : "OFF (legacy path)"}</b> · Contract {data.platform?.contractVersion}. When OFF, all AI runs through the legacy path — safe by default.</Help>
              </div>
            </div>
          )}

          {tab === "providers" && (
            <Table columns={["Provider", "Protocol", "Auth", "Key", "Availability"]} rows={data || []}
              render={(p) => [
                <b>{p.displayName}</b>, p.adapterProtocol, p.authStyle,
                p.keyOwnership?.configured ? <span className="text-emerald-400">configured · {p.keyOwnership.keyRef?.ref}</span> : <span className={mutedText}>not set · {p.keyOwnership?.keyRef?.ref || "—"}</span>,
                p.availability,
              ]} />
          )}

          {tab === "models" && (
            <Table columns={["Provider", "Model", "Context", "Vision", "Tools", "Cost class"]} rows={data || []}
              render={(m) => [m.providerKey, <b>{m.key}</b>, `${(m.contextWindowTokens / 1000) | 0}k`, m.supports?.vision ? "yes" : "no", m.supports?.tools ? "yes" : "no", m.costClass]} />
          )}

          {tab === "capabilities" && <CapabilityConfig />}

          {tab === "profiles" && (
            <Table columns={["Profile", "Temperature", "Max tokens", "Top-p"]} rows={data || []}
              render={(p) => [<b>{p.key}</b>, p.params?.temperature ?? "—", p.params?.maxTokens ?? "—", p.params?.topP ?? "—"]} />
          )}

          {tab === "usage" && (
            <Table columns={["Capability", "Provider", "Requests", "In tokens", "Out tokens", "Failures"]} rows={data?.rows || []}
              render={(r) => [r.capability_key, r.provider_key, r.requests, r.input_tokens, r.output_tokens, r.failures]} />
          )}

          {tab === "cost" && (
            <div className="space-y-3">
              <StatCard label="Total actual cost (this month)" value={`$${data?.totalActualUsd ?? 0}`} hint="Computed from recorded usage × model pricing." />
              <Table columns={["Capability", "Provider", "Estimated $", "Actual $", "Requests"]} rows={data?.rows || []}
                render={(r) => [r.capability_key, r.provider_key, Number(r.estimated_usd).toFixed(6), Number(r.actual_usd).toFixed(6), r.requests]} />
            </div>
          )}

          {tab === "prompts" && <PromptRegistry />}
          {tab === "playground" && <Playground />}
          {tab === "health" && <Health />}
          {tab === "audit" && <Audit />}
          {tab === "traces" && <Traces />}
        </>
      )}
    </div>
  );
}

// ── Capability configuration (per-feature provider / model / prompt + lock) ────
const inputCls = "w-full mt-1 bg-[var(--app-bg)] border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm text-[color:var(--text)]";
const LOCKS = [
  { v: "workspace_customizable", l: "Customizable — workspaces may override" },
  { v: "global_locked", l: "Locked — no workspace may override" },
];

function Field({ label, value, onChange, options, allowEmpty = "Use default", disabled }) {
  return (
    <div>
      <label className={`text-xs ${mutedText} capitalize`}>{label}</label>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`${inputCls} disabled:opacity-50`}>
        {allowEmpty != null && <option value="">{allowEmpty}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function CapabilityConfig() {
  const [caps, setCaps] = useState(null);
  const [providers, setProviders] = useState([]);
  const [models, setModels] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [saved, setSaved] = useState({});
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ provider: "", model: "", promptKey: "", runtimeProfile: "", lockLevel: "workspace_customizable" });
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState({ provider: "", model: "" });

  const reloadSaved = async () => {
    try { const rows = await api.savedConfigs(); setSaved(Object.fromEntries((rows || []).map((r) => [r.capabilityKey, r]))); } catch { setSaved({}); }
  };
  useEffect(() => {
    (async () => {
      try {
        const [c, p, m, pf, pr] = await Promise.all([api.capabilities(), api.providers(), api.models(), api.profiles(), api.prompts().catch(() => [])]);
        setCaps(c); setProviders(p || []); setModels(m || []); setProfiles(pf || []); setPrompts(pr || []);
      } catch { setCaps([]); }
      reloadSaved();
    })();
  }, []);

  const open = (key) => {
    setSel(key);
    const s = saved[key] || {};
    setForm({ provider: s.provider || "", model: s.model || "", promptKey: s.promptKey || "", runtimeProfile: s.runtimeProfile || "", lockLevel: s.lockLevel || "workspace_customizable" });
  };

  const providerOpts = providers.map((p) => ({ value: p.key, label: p.displayName || p.key }));
  const modelOpts = (prov) => models.filter((m) => !prov || m.providerKey === prov).map((m) => ({ value: m.key, label: `${m.key}${m.providerKey ? ` (${m.providerKey})` : ""}` }));
  const promptOpts = prompts.map((p) => ({ value: p.key, label: p.key }));
  const profileOpts = profiles.map((p) => ({ value: p.key, label: p.key }));

  const save = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const r = await api.saveCapabilityConfig({ capabilityKey: sel, provider: form.provider || null, model: form.model || null, promptKey: form.promptKey || null, runtimeProfile: form.runtimeProfile || null });
      if (r?.ok === false) { toast.error(r.reason === "incompatible_provider" ? "Provider/model doesn't meet this feature's requirements" : (r.reason || "Save failed")); return; }
      await api.setLock(sel, form.lockLevel);
      toast.success("Saved — this now overrides the hardcoded default for this feature");
      reloadSaved();
    } catch (e) { toast.error(e?.response?.data?.error || "Save failed"); }
    finally { setBusy(false); }
  };

  const applyToAll = async () => {
    if (!bulk.provider) { toast.error("Pick a provider first"); return; }
    setBusy(true);
    try {
      for (const c of caps || []) await api.saveCapabilityConfig({ capabilityKey: c.key, provider: bulk.provider, model: bulk.model || null });
      toast.success(`Applied ${bulk.provider}${bulk.model ? ` / ${bulk.model}` : ""} to every feature`);
      reloadSaved();
    } catch (e) { toast.error(e?.response?.data?.error || "Bulk apply failed"); }
    finally { setBusy(false); }
  };

  if (caps === null) return <Loading />;
  return (
    <div className="space-y-4">
      {/* Platform default (whole platform) */}
      <div className={`${card} p-4`}>
        <p className="text-sm font-medium text-[color:var(--text)]">Platform default provider</p>
        <Help>Set one AI provider for <b>every</b> feature at once. Individual features below can still override it.</Help>
        <div className="grid md:grid-cols-3 gap-3 mt-2 items-end">
          <Field label="Provider" value={bulk.provider} onChange={(v) => setBulk({ provider: v, model: "" })} options={providerOpts} allowEmpty="Select provider" />
          <Field label="Model" value={bulk.model} onChange={(v) => setBulk((b) => ({ ...b, model: v }))} options={modelOpts(bulk.provider)} allowEmpty="Provider default" />
          <button onClick={applyToAll} disabled={busy} className="h-[38px] px-3 rounded-lg text-sm bg-[color:var(--primary)] text-white disabled:opacity-50">Apply to all features</button>
        </div>
      </div>

      {/* Per-feature editor */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className={`${card} p-3 space-y-1`}>
          <p className="text-sm font-medium text-[color:var(--text)] px-1 pb-1">Features</p>
          {(caps || []).map((c) => {
            const s = saved[c.key];
            return (
              <button key={c.key} onClick={() => open(c.key)} className={`block w-full text-left px-2 py-1.5 rounded text-sm ${sel === c.key ? "bg-[var(--surface-soft)] text-[color:var(--text)]" : mutedText}`}>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate">{c.name}</span>
                  {s?.provider && <span className="text-[10px] text-emerald-400 shrink-0">{s.provider}</span>}
                </span>
                {s?.lockLevel && <span className="block"><LockBadge level={s.lockLevel} /></span>}
              </button>
            );
          })}
        </div>
        <div className="md:col-span-2">
          {!sel ? <Help>Select a feature to choose its AI provider, model, prompt and runtime — and whether workspaces may override it.</Help> : (
            <div className={`${card} p-4 space-y-3`}>
              <p className="text-sm font-medium text-[color:var(--text)]">{caps.find((c) => c.key === sel)?.name || sel}</p>
              <Field label="Provider" value={form.provider} onChange={(v) => setForm((f) => ({ ...f, provider: v, model: "" }))} options={providerOpts} allowEmpty="Use platform/hardcoded default" />
              <Field label="Model" value={form.model} onChange={(v) => setForm((f) => ({ ...f, model: v }))} options={modelOpts(form.provider)} allowEmpty="Provider default" disabled={!form.provider} />
              <Field label="Prompt" value={form.promptKey} onChange={(v) => setForm((f) => ({ ...f, promptKey: v }))} options={promptOpts} allowEmpty="Use hardcoded prompt" />
              <Field label="Runtime profile" value={form.runtimeProfile} onChange={(v) => setForm((f) => ({ ...f, runtimeProfile: v }))} options={profileOpts} allowEmpty="Capability default" />
              <Field label="Workspace override policy" value={form.lockLevel} onChange={(v) => setForm((f) => ({ ...f, lockLevel: v }))} options={LOCKS.map((l) => ({ value: l.v, label: l.l }))} allowEmpty={null} />
              <div className="flex items-center gap-2">
                <button onClick={save} disabled={busy} className="px-3 py-1.5 rounded-lg text-sm bg-[color:var(--primary)] text-white disabled:opacity-50">{busy ? "Saving…" : "Save feature config"}</button>
                <Help>Saved values override the hardcoded codebase defaults. Lock to stop workspaces overriding.</Help>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Prompt Registry + versioning ──────────────────────────────────────────────
function PromptRegistry() {
  const [prompts, setPrompts] = useState(null);
  const [sel, setSel] = useState(null);
  const [versions, setVersions] = useState([]);
  const [body, setBody] = useState("");

  const load = () => api.overview().then(() => fetch2());
  const fetch2 = async () => { try { const p = await promptsApi.list(); setPrompts(p); } catch { setPrompts([]); } };
  useEffect(() => { fetch2(); }, []);
  const openPrompt = async (key) => { setSel(key); try { setVersions(await promptsApi.versions(key)); } catch { setVersions([]); } };
  const createVersion = async () => {
    if (!sel || !body.trim()) return;
    try { await promptsApi.createVersion(sel, body); toast.success("Draft version created"); setBody(""); openPrompt(sel); }
    catch (e) { toast.error(e?.response?.data?.error || "Failed"); }
  };
  const transition = async (v, to) => {
    try { await promptsApi.transition(sel, v, to); toast.success(`Version ${v} → ${to}`); openPrompt(sel); }
    catch (e) { toast.error(e?.response?.data?.reason || "Transition not allowed"); }
  };

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className={`${card} p-3 space-y-1`}>
        <p className="text-sm font-medium text-[color:var(--text)] px-1 pb-1">Prompts</p>
        {prompts === null ? <Loading /> : prompts.length === 0 ? <Empty label="No prompts yet." /> :
          prompts.map((p) => (
            <button key={p.key} onClick={() => openPrompt(p.key)} className={`block w-full text-left px-2 py-1.5 rounded text-sm ${sel === p.key ? "bg-[var(--surface-soft)] text-[color:var(--text)]" : mutedText}`}>{p.key}</button>
          ))}
      </div>
      <div className="md:col-span-2 space-y-3">
        {!sel ? <Help>Select a prompt to view its versions. Prompts move through draft → testing → published, with rollback.</Help> : (
          <>
            <Table columns={["Version", "Status", "Actions"]} rows={versions}
              render={(v) => [v.version, v.status,
                <span className="flex gap-1">
                  {v.status !== "published" && <button onClick={() => transition(v.version, "published")} className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Publish</button>}
                  {v.status === "published" && <button onClick={() => transition(v.version, "archived")} className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">Archive</button>}
                  {v.status === "archived" && <button onClick={() => transition(v.version, "published")} className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">Rollback</button>}
                </span>,
              ]} />
            <div className={`${card} p-3`}>
              <p className="text-sm text-[color:var(--text)]">New draft version</p>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Prompt body…"
                className="w-full mt-2 bg-[var(--app-bg)] border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm text-[color:var(--text)]" />
              <button onClick={createVersion} className="mt-2 px-3 py-1.5 rounded-lg text-sm bg-[color:var(--primary)] text-white">Create draft</button>
              <Help>New versions start as drafts. Publishing a version automatically archives the previously-published one.</Help>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Playground ────────────────────────────────────────────────────────────────
function Playground() {
  const [capability, setCapability] = useState("workspace_assistant");
  const [caps, setCaps] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.capabilities().then((c) => setCaps(c)).catch(() => setCaps([])); }, []);
  const run = async () => {
    setBusy(true); setResult(null);
    try { setResult(await playgroundApi.run(capability, prompt)); }
    catch (e) { toast.error(e?.response?.data?.error || "Run failed"); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className={`${card} p-4 space-y-3`}>
        <div>
          <label className={`text-xs ${mutedText}`}>Capability</label>
          <select value={capability} onChange={(e) => setCapability(e.target.value)}
            className="w-full mt-1 bg-[var(--app-bg)] border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm text-[color:var(--text)]">
            {caps.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={`text-xs ${mutedText}`}>Prompt</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} placeholder="Type a prompt to test…"
            className="w-full mt-1 bg-[var(--app-bg)] border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm text-[color:var(--text)]" />
        </div>
        <button onClick={run} disabled={busy} className="px-3 py-1.5 rounded-lg text-sm bg-[color:var(--primary)] text-white disabled:opacity-50">
          {busy ? "Running…" : "Run"}
        </button>
        <Help>Runs the capability once through the real gateway (provider negotiation, safety, cost). The result is not saved.</Help>
      </div>
      <div className={`${card} p-4`}>
        <p className="text-sm text-[color:var(--text)] mb-2">Result</p>
        {!result ? <Empty label="Run a prompt to see the output, provider, cost and safety." /> : (
          <div className="space-y-2 text-sm">
            <div className="text-[color:var(--text)] whitespace-pre-wrap">{result.text}</div>
            <div className={`${mutedText} text-xs space-y-0.5 pt-2 border-t border-[color:var(--border)]`}>
              <p>Provider: {result.response?.resolution?.provider} · Model: {result.response?.resolution?.model}</p>
              <p>Cost: ${result.response?.cost?.actual ?? 0} · Latency: {result.response?.latencyMs}ms</p>
              <p>Safety: {result.response?.safety?.inputVerdict} / {result.response?.safety?.outputVerdict}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Health / Audit / Traces ───────────────────────────────────────────────────
function Health() {
  const [cap, setCap] = useState(null);
  const [prov, setProv] = useState(null);
  useEffect(() => { healthApi.capabilities().then(setCap).catch(() => setCap([])); healthApi.providers().then(setProv).catch(() => setProv([])); }, []);
  return (
    <div className="space-y-4">
      <div><p className="text-sm text-[color:var(--text)] mb-2">Provider health</p>
        <Table columns={["Provider", "Requests", "Success %", "Avg latency", "Failures"]} rows={prov || []}
          render={(r) => [r.provider_key, r.requests, `${r.success_rate}%`, `${r.avg_latency_ms}ms`, r.failures]} /></div>
      <div><p className="text-sm text-[color:var(--text)] mb-2">Capability health</p>
        <Table columns={["Capability", "Requests", "Success %", "Avg latency"]} rows={cap || []}
          render={(r) => [r.capability_key, r.requests, `${r.success_rate}%`, `${r.avg_latency_ms}ms`]} /></div>
    </div>
  );
}
function Audit() {
  const [rows, setRows] = useState(null);
  useEffect(() => { auditApi.list().then(setRows).catch(() => setRows([])); }, []);
  if (rows === null) return <Loading />;
  return <Table columns={["When", "Actor", "Action", "Object"]} rows={rows}
    render={(r) => [new Date(r.ts).toLocaleString(), `${r.actor_type}:${r.actor_id ?? ""}`, r.action, `${r.object_type}/${r.object_key ?? ""}`]} />;
}
function Traces() {
  const [rows, setRows] = useState(null);
  useEffect(() => { tracesApi.list().then(setRows).catch(() => setRows([])); }, []);
  if (rows === null) return <Loading />;
  return (
    <div className="space-y-2">
      <Help>Every AI execution, traceable to the business event that triggered it. Correlated by trace id across multi-step runs.</Help>
      <Table columns={["When", "Capability", "Provider", "Status", "Latency", "Trigger"]} rows={rows}
        render={(r) => [new Date(r.ts).toLocaleString(), r.capability_key, r.provider_key, r.status, `${r.latency_ms}ms`, r.trigger_type || "—"]} />
    </div>
  );
}

// Thin wrappers so the components above read cleanly (all hit the same client).
const promptsApi = {
  list: () => superadminGet("/prompts"),
  versions: (k) => superadminGet(`/prompts/${encodeURIComponent(k)}/versions`),
  createVersion: (k, body) => superadminPost(`/prompts/${encodeURIComponent(k)}/versions`, { body }),
  transition: (k, v, to) => superadminPost(`/prompts/${encodeURIComponent(k)}/versions/${v}/transition`, { to }),
};
const playgroundApi = { run: (capability, prompt) => superadminPost("/playground", { capability, prompt }) };
const healthApi = { capabilities: () => superadminGet("/health/capabilities"), providers: () => superadminGet("/health/providers") };
const auditApi = { list: () => superadminGet("/audit") };
const tracesApi = { list: () => superadminGet("/traces") };

// Minimal helpers using the existing superadmin axios instance.
function superadminGet(path) { return superadminApi.get(`/superadmin/ai-studio${path}`).then((r) => r.data); }
function superadminPost(path, body) { return superadminApi.post(`/superadmin/ai-studio${path}`, body).then((r) => r.data); }
