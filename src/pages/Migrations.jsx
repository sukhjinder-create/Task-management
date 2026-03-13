import { useState, useEffect, useCallback, useRef } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "react-router-dom";
import {
  Hash, CheckCircle, AlertCircle, ExternalLink, Loader2,
  ChevronRight, Users, MessageSquare, Trash2, Clock,
  FolderKanban, RefreshCw, ChevronDown, ChevronUp, ArrowLeft,
  Search,
} from "lucide-react";

/* ─────────────────────────────────────────────
   SHARED: Mode Toggle (skip / replace)
───────────────────────────────────────────── */
function ModeToggle({ mode, onChange }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="theme-text-muted text-xs">If data exists:</span>
      <div className="flex rounded-lg border theme-border overflow-hidden text-xs font-medium">
        {["skip", "replace"].map((m) => (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`px-3 py-1.5 capitalize transition-colors
              ${mode === m ? "bg-primary-600 text-white" : "theme-surface theme-text-muted hover:theme-text"}`}
          >
            {m}
          </button>
        ))}
      </div>
      <span className="text-xs theme-text-muted">
        {mode === "skip" ? "Keep existing data, add new" : "Delete old import data, re-import fresh"}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SHARED: Import History Panel
───────────────────────────────────────────── */
function ImportHistory({ source, onDeleted }) {
  const api = useApi();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/migration-history?source=${source}`);
      setHistory(res.data || []);
    } catch (_) {}
    setLoading(false);
  }, [api, source]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id, importNumber) {
    if (!window.confirm(`Delete Import #${importNumber}? This will permanently remove all data created by this import.`)) return;
    setDeleting(id);
    try {
      await api.delete(`/migration-history/${id}`);
      setHistory((h) => h.filter((r) => r.id !== id));
      onDeleted?.();
    } catch (err) {
      alert(err.response?.data?.error || "Delete failed");
    }
    setDeleting(null);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-sm theme-text-muted gap-2">
      <Loader2 size={15} className="animate-spin" /> Loading history…
    </div>
  );

  if (!history.length) return (
    <div className="text-center py-12 theme-text-muted text-sm">
      No imports yet for this source.
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs theme-text-muted">{history.length} import{history.length !== 1 ? "s" : ""} total</span>
        <button onClick={load} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      {history.map((rec) => (
        <div key={rec.id} className="theme-surface border theme-border rounded-xl p-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold theme-text">Import #{rec.import_number}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium
                ${rec.status === "completed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {rec.status}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs theme-text-muted mb-2">
              <Clock size={11} />
              {new Date(rec.created_at).toLocaleString()}
            </div>
            {rec.status === "running" && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600 mb-1">
                <Loader2 size={11} className="animate-spin" /> Importing in background…
              </div>
            )}
            {rec.stats && (
              <div className="flex flex-wrap gap-3 text-xs theme-text-muted">
                {rec.stats.usersCreated != null && (
                  <span><strong className="theme-text">{rec.stats.usersCreated}</strong> users created</span>
                )}
                {rec.stats.usersLinked != null && (
                  <span><strong className="theme-text">{rec.stats.usersLinked}</strong> users linked</span>
                )}
                {rec.stats.channelsCreated != null && (
                  <span><strong className="theme-text">{rec.stats.channelsCreated}</strong> channels</span>
                )}
                {rec.stats.messagesImported != null && (
                  <span><strong className="theme-text">{rec.stats.messagesImported}</strong> messages</span>
                )}
                {rec.stats.importedTasks != null && (
                  <span><strong className="theme-text">{rec.stats.importedTasks}</strong> tasks</span>
                )}
              </div>
            )}
            {rec.stats?.errors?.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-amber-600 cursor-pointer">{rec.stats.errors.length} warning{rec.stats.errors.length !== 1 ? "s" : ""}</summary>
                <ul className="mt-1 space-y-0.5 max-h-24 overflow-y-auto pl-2">
                  {rec.stats.errors.slice(0, 10).map((e, i) => (
                    <li key={i} className="text-[11px] text-amber-600">{e}</li>
                  ))}
                  {rec.stats.errors.length > 10 && (
                    <li className="text-[11px] text-amber-400">…and {rec.stats.errors.length - 10} more</li>
                  )}
                </ul>
              </details>
            )}
          </div>
          <button
            onClick={() => handleDelete(rec.id, rec.import_number)}
            disabled={deleting === rec.id}
            className="shrink-0 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {deleting === rec.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   SLACK PANEL
───────────────────────────────────────────── */
const SLACK_STEPS = ["Setup", "Connect", "Preview", "Migrate"];
const BOT_SCOPES = [
  { scope: "channels:read",    why: "List public channels" },
  { scope: "channels:history", why: "Read messages from public channels" },
  { scope: "channels:join",    why: "Join channels to read their history" },
  { scope: "users:read",       why: "List workspace members" },
  { scope: "users:read.email", why: "Match users by email" },
];
const USER_SCOPES = [
  { scope: "channels:read",    why: "List public channels" },
  { scope: "channels:history", why: "Read message history from channels you're a member of" },
  { scope: "users:read",       why: "List workspace members" },
  { scope: "users:read.email", why: "Match users by email" },
];

function groupChannels(channels) {
  const groups = {};
  for (const ch of channels) {
    const prefix = ch.name.split(/[-_]/)[0] || "general";
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(ch);
  }
  return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
}

function SlackPanel({ onImportDone }) {
  const api = useApi();
  const [step, setStep] = useState(0);
  const [token, setToken] = useState("");
  const [preview, setPreview] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState("");
  const [selectedChannels, setSelectedChannels] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);
  const [migrateError, setMigrateError] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [mode, setMode] = useState("skip");
  const [autoJoin, setAutoJoin] = useState(false);
  const [runningImport, setRunningImport] = useState(null); // { runId, importNumber }
  const pollRef = useRef(null);

  // Poll history until the running import completes
  function startPolling(runId) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get("/migration-history?source=slack");
        const record = (res.data || []).find((r) => r.id === runId);
        if (record && record.status !== "running") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setRunningImport(null);
          setMigrateResult(record.stats || {});
          setStep(3);
          onImportDone?.();
        }
      } catch (_) {}
    }, 3000);
  }

  // Cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function handleValidate() {
    setValidating(true); setValidateError("");
    try {
      const res = await api.post("/integrations/slack/validate", { token });
      setPreview(res.data);
      setSelectedChannels(res.data.channels.map((c) => c.id));
      const allGroups = {};
      groupChannels(res.data.channels).forEach(([k]) => { allGroups[k] = true; });
      setExpandedGroups(allGroups);
      setStep(2);
    } catch (err) { setValidateError(err.response?.data?.error || err.message); }
    setValidating(false);
  }

  async function handleMigrate() {
    setMigrating(true); setMigrateError("");
    try {
      const res = await api.post("/integrations/slack/migrate", { token, selectedChannelIds: selectedChannels, mode, autoJoin });
      if (res.data.started) {
        // Background migration — move to step 3 immediately and poll
        setRunningImport({ runId: res.data.runId, importNumber: res.data.importNumber });
        setStep(3);
        startPolling(res.data.runId);
      } else {
        setMigrateResult(res.data);
        setStep(3);
        onImportDone?.();
      }
    } catch (err) { setMigrateError(err.response?.data?.error || err.message); }
    setMigrating(false);
  }

  function toggleChannel(id) {
    setSelectedChannels((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }

  function toggleGroup(prefix, ids) {
    const allSelected = ids.every((id) => selectedChannels?.includes(id));
    setSelectedChannels((prev) =>
      allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...(prev || []), ...ids])]
    );
  }

  return (
    <div>
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {SLACK_STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full
              ${i === step ? "bg-primary-600 text-white" : i < step ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
              {i < step && <CheckCircle size={11} />}
              {label}
            </div>
            {i < SLACK_STEPS.length - 1 && <ChevronRight size={12} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 0: Setup */}
      {step === 0 && (
        <div className="space-y-5">
          {/* Option A — User Token (recommended) */}
          <div className="theme-surface border theme-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Recommended</span>
              <h3 className="font-semibold theme-text">Option A — User OAuth Token</h3>
            </div>
            <p className="text-xs theme-text-muted">No need to create a Slack App. Use your own Slack account token — you're already a member of all public channels, so no joining is required.</p>
            <ol className="space-y-3 text-sm theme-text-muted list-none">
              {[
                <>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-primary-600 underline inline-flex items-center gap-1">api.slack.com/apps <ExternalLink size={11}/></a> → <strong>Create New App → From scratch</strong></>,
                <>Name it anything, pick your workspace</>,
                <>Go to <strong>OAuth & Permissions → User Token Scopes</strong> and add these scopes:</>,
              ].map((text, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">{i+1}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            <div className="rounded-lg border theme-border overflow-hidden text-sm">
              <div className="flex bg-gray-50 dark:bg-gray-800 border-b theme-border px-3 py-2 font-medium theme-text-muted text-xs">
                <span className="w-48">Scope</span><span>Used for</span>
              </div>
              {USER_SCOPES.map((s) => (
                <div key={s.scope} className="flex border-b theme-border last:border-0 px-3 py-2">
                  <code className="w-48 text-xs text-primary-600 font-mono">{s.scope}</code>
                  <span className="text-xs theme-text-muted">{s.why}</span>
                </div>
              ))}
            </div>
            <ol className="space-y-3 text-sm theme-text-muted list-none">
              {[
                <><strong>Install to Workspace</strong> and approve permissions</>,
                <>Copy the <strong>User OAuth Token</strong> (starts with <code className="text-xs bg-gray-100 px-1 rounded">xoxp-</code>)</>,
              ].map((text, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">{i+4}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Option B — Bot Token */}
          <div className="theme-surface border theme-border rounded-xl p-5 space-y-4">
            <h3 className="font-semibold theme-text text-sm">Option B — Bot Token</h3>
            <p className="text-xs theme-text-muted">Create a Slack App with a bot token. Requires <code className="text-xs bg-gray-100 px-1 rounded">channels:join</code> scope so the bot can enter each channel before reading messages.</p>
            <ol className="space-y-3 text-sm theme-text-muted list-none">
              {[
                <>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-primary-600 underline inline-flex items-center gap-1">api.slack.com/apps <ExternalLink size={11}/></a> → <strong>Create New App → From scratch</strong></>,
                <>Name it anything, pick your workspace</>,
                <>Go to <strong>OAuth & Permissions → Bot Token Scopes</strong> and add:</>,
              ].map((text, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">{i+1}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            <div className="rounded-lg border theme-border overflow-hidden text-sm">
              <div className="flex bg-gray-50 dark:bg-gray-800 border-b theme-border px-3 py-2 font-medium theme-text-muted text-xs">
                <span className="w-48">Scope</span><span>Used for</span>
              </div>
              {BOT_SCOPES.map((s) => (
                <div key={s.scope} className="flex border-b theme-border last:border-0 px-3 py-2">
                  <code className="w-48 text-xs text-primary-600 font-mono">{s.scope}</code>
                  <span className="text-xs theme-text-muted">{s.why}</span>
                </div>
              ))}
            </div>
            <ol className="space-y-3 text-sm theme-text-muted list-none">
              {[
                <><strong>Install to Workspace</strong> and approve permissions</>,
                <>Copy the <strong>Bot User OAuth Token</strong> (starts with <code className="text-xs bg-gray-100 px-1 rounded">xoxb-</code>)</>,
              ].map((text, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">{i+4}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </div>

          <button onClick={() => setStep(1)} className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm transition-colors">
            I have my token →
          </button>
        </div>
      )}

      {/* Step 1: Token */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="theme-surface border theme-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold theme-text">Paste your Slack Token</h3>
            <p className="text-xs theme-text-muted">Accepts both User OAuth Token (<code className="bg-gray-100 px-1 rounded">xoxp-</code>) and Bot Token (<code className="bg-gray-100 px-1 rounded">xoxb-</code>).</p>
            <input
              type="password" value={token} onChange={(e) => setToken(e.target.value)}
              placeholder="xoxp-... or xoxb-..."
              className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-text theme-bg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            />
            {validateError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />{validateError}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="px-4 py-2.5 border theme-border rounded-lg text-sm theme-text hover:bg-gray-50">Back</button>
            <button
              onClick={handleValidate} disabled={(!token.startsWith("xoxb-") && !token.startsWith("xoxp-")) || validating}
              className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {validating ? <><Loader2 size={14} className="animate-spin"/>Connecting…</> : "Connect & Preview →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview with grouped channels */}
      {step === 2 && preview && (
        <div className="space-y-4">
          {/* History access warning — shown before migration if scope is wrong */}
          {preview.historyAccess && !preview.historyAccess.ok && preview.historyAccess.error === "missing_scope" && (
            <div className="border border-red-300 bg-red-50 rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Missing scope: channels:history</p>
                  <p className="text-xs text-red-600 mt-1">
                    Make sure <code className="bg-red-100 px-1 rounded">channels:history</code> is added under
                    {" "}<strong>User Token Scopes</strong> (not Bot Token Scopes), then reinstall the app and copy the new <code className="bg-red-100 px-1 rounded">xoxp-</code> token.
                  </p>
                </div>
              </div>
            </div>
          )}
          {preview.historyAccess && !preview.historyAccess.ok && preview.historyAccess.error === "not_in_channel" && (
            <div className="border border-amber-300 bg-amber-50 rounded-xl p-4 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
              <p className="text-xs text-amber-700">
                You are not a member of some channels — those channels are greyed out below and will be skipped.
                To import them, join those channels in Slack first, then come back and re-import.
              </p>
            </div>
          )}
          {preview.historyAccess?.ok && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle size={13} /> Message history access confirmed
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Users, label: "Users", value: preview.userCount },
              { icon: Hash, label: "Channels", value: preview.channelCount },
              { icon: MessageSquare, label: "Messages", value: "All" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="theme-surface border theme-border rounded-xl p-4 text-center">
                <Icon size={18} className="mx-auto mb-1.5 text-primary-500" />
                <div className="text-xl font-bold theme-text">{value}</div>
                <div className="text-xs theme-text-muted">{label}</div>
              </div>
            ))}
          </div>

          <div className="theme-surface border theme-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm theme-text">Select channels</h3>
              <div className="flex gap-2 text-xs">
                <button onClick={() => setSelectedChannels(preview.channels.map((c) => c.id))} className="text-primary-600 hover:underline">All</button>
                <span className="theme-text-muted">·</span>
                <button onClick={() => setSelectedChannels([])} className="text-primary-600 hover:underline">None</button>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {groupChannels(preview.channels).map(([prefix, chs]) => {
                const chIds = chs.map((c) => c.id);
                const allSelected = chIds.every((id) => selectedChannels?.includes(id));
                const someSelected = chIds.some((id) => selectedChannels?.includes(id));
                const isExpanded = expandedGroups[prefix];

                return (
                  <div key={prefix} className="border theme-border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 cursor-pointer"
                      onClick={() => setExpandedGroups((prev) => ({ ...prev, [prefix]: !prev[prefix] }))}>
                      <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                        onChange={() => toggleGroup(prefix, chIds)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-primary-600" />
                      <span className="text-xs font-semibold theme-text uppercase tracking-wide flex-1">{prefix}</span>
                      <span className="text-xs theme-text-muted">{chs.length} channels</span>
                      {isExpanded ? <ChevronUp size={13} className="theme-text-muted" /> : <ChevronDown size={13} className="theme-text-muted" />}
                    </div>
                    {isExpanded && (
                      <div className="divide-y theme-border">
                        {chs.map((ch) => (
                          <label key={ch.id} className={`flex items-center gap-2.5 px-4 py-1.5 hover:bg-gray-50 cursor-pointer ${!ch.isMember ? "opacity-50" : ""}`}>
                            <input type="checkbox" checked={selectedChannels?.includes(ch.id) ?? true}
                              onChange={() => toggleChannel(ch.id)} className="accent-primary-600"
                              disabled={!ch.isMember} />
                            <Hash size={12} className="text-gray-400 shrink-0" />
                            <span className="text-sm theme-text flex-1">{ch.name}</span>
                            {ch.isArchived && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">archived</span>}
                            {!ch.isMember && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded">not a member</span>}
                            <span className="text-xs theme-text-muted">{ch.memberCount}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-2">
              <p className="text-xs theme-text-muted">
                {selectedChannels?.length ?? preview.channelCount} of {preview.channelCount} selected
              </p>
              {(() => {
                const notMember = preview.channels.filter((c) => !c.isMember).length;
                return notMember > 0 ? (
                  <p className="text-xs text-amber-600">
                    {notMember} channel{notMember !== 1 ? "s" : ""} {autoJoin ? "will be auto-joined" : "not a member — will be skipped"}
                  </p>
                ) : null;
              })()}
            </div>
          </div>

          <ModeToggle mode={mode} onChange={setMode} />

          {/* Auto-join toggle — only shown when there are non-member channels */}
          {preview.channels.some((c) => !c.isMember) && (
            <label className="flex items-start gap-3 cursor-pointer select-none theme-surface border theme-border rounded-xl p-4">
              <input
                type="checkbox"
                checked={autoJoin}
                onChange={(e) => setAutoJoin(e.target.checked)}
                className="mt-0.5 accent-primary-600"
              />
              <div>
                <p className="text-sm font-medium theme-text">Auto-join non-member channels</p>
                <p className="text-xs theme-text-muted mt-0.5">
                  The migration will join channels you're not a member of to read their history.
                  Requires <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">channels:join</code> scope in your User Token Scopes.
                  <span className="text-amber-600 font-medium"> Note: Slack will post a visible "joined" message in each channel.</span>
                </p>
              </div>
            </label>
          )}

          <div className="theme-surface border border-amber-200 bg-amber-50 rounded-xl p-3 text-xs text-amber-800">
            New users will be created with a temporary password. They can reset it via their email.
          </div>

          {migrateError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />{migrateError}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2.5 border theme-border rounded-lg text-sm theme-text hover:bg-gray-50">Back</button>
            <button
              onClick={handleMigrate} disabled={migrating || !selectedChannels?.length}
              className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {migrating
                ? <><Loader2 size={14} className="animate-spin"/>Migrating… this may take a few minutes</>
                : `Import ${selectedChannels?.length ?? preview.channelCount} channels →`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Running or Done */}
      {step === 3 && (
        <div className="space-y-4">
          {runningImport ? (
            /* Still running in background */
            <div className="theme-surface border theme-border rounded-xl p-8 text-center space-y-4">
              <Loader2 size={40} className="mx-auto animate-spin text-primary-500" />
              <h3 className="text-base font-bold theme-text">Importing your Slack workspace…</h3>
              <p className="text-sm theme-text-muted">
                This runs in the background — all messages will be imported. You can leave this page;
                check <strong>Import History</strong> tab to see when it finishes.
              </p>
              <div className="text-xs theme-text-muted">Import #{runningImport.importNumber} · polling every 3s…</div>
            </div>
          ) : migrateResult ? (
            /* Completed */
            <>
              <div className="theme-surface border border-green-200 bg-green-50 rounded-xl p-5 text-center">
                <CheckCircle size={36} className="mx-auto mb-2 text-green-500" />
                <h3 className="text-base font-bold theme-text">Migration complete</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Users created", value: migrateResult.usersCreated },
                  { label: "Users linked", value: migrateResult.usersLinked },
                  { label: "Channels created", value: migrateResult.channelsCreated },
                  { label: "Messages imported", value: migrateResult.messagesImported },
                ].map(({ label, value }) => (
                  <div key={label} className="theme-surface border theme-border rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-primary-600">{value ?? "—"}</div>
                    <div className="text-xs theme-text-muted">{label}</div>
                  </div>
                ))}
              </div>
              {migrateResult.errors?.length > 0 && (
                <div className="theme-surface border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-amber-700 mb-2">{migrateResult.errors.length} warnings</p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {migrateResult.errors.map((e, i) => <li key={i} className="text-xs text-amber-600">{e}</li>)}
                  </ul>
                </div>
              )}
            </>
          ) : null}
          <div className="flex gap-3">
            <button onClick={() => { setStep(0); setToken(""); setPreview(null); setMigrateResult(null); setRunningImport(null); if (pollRef.current) clearInterval(pollRef.current); }}
              className="flex-1 py-2.5 border theme-border rounded-lg text-sm theme-text hover:bg-gray-50">
              Import another workspace
            </button>
            <a href="/chat" className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm text-center flex items-center justify-center">
              Go to Chat →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   ASANA PANEL  — full viewer with task preview
───────────────────────────────────────────── */
function AsanaPanel({ onImportDone, autoConnect }) {
  const api = useApi();
  const { auth } = useAuth();
  const [status, setStatus] = useState("idle"); // idle | checking | connected | disconnected
  const [projects, setProjects] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);
  const [migrateError, setMigrateError] = useState("");
  const [mode, setMode] = useState("skip");
  const searchTimeout = useRef(null);

  const checkConnection = useCallback(async () => {
    setStatus("checking");
    try {
      const res = await api.get("/integrations/asana/projects");
      setProjects(res.data || []);
      setStatus("connected");
    } catch {
      setStatus("disconnected");
    }
  }, [api]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Re-check after OAuth redirect
  useEffect(() => {
    if (autoConnect) checkConnection();
  }, [autoConnect, checkConnection]);

  function connectOAuth() {
    const token = auth?.token || window.__AUTH_TOKEN__;
    if (!token) { alert("Not authenticated"); return; }
    window.location.href =
      `${import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"}/oauth/asana/connect?token=${token}`;
  }

  async function loadTasks(project, pg = 1, q = "") {
    setLoadingTasks(true);
    try {
      const res = await api.get(`/integrations/asana/projects/${project.gid}/tasks`, {
        params: { page: pg, limit: 25, search: q },
      });
      setTasks(res.data.data || []);
      setHasMore(res.data.hasMore || false);
      setPage(pg);
    } catch { setTasks([]); }
    setLoadingTasks(false);
  }

  function openProject(p) {
    setSelectedProject(p);
    setSearch(""); setPage(1); setMigrateResult(null); setMigrateError("");
    loadTasks(p, 1, "");
  }

  function handleSearchChange(val) {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      if (selectedProject) loadTasks(selectedProject, 1, val);
    }, 350);
  }

  async function handleMigrate() {
    if (!selectedProject) return;
    setMigrating(true); setMigrateError("");
    try {
      const res = await api.post(`/integrations/asana/projects/${selectedProject.gid}/migrate`, { mode });
      setMigrateResult(res.data);
      onImportDone?.();
    } catch (err) {
      setMigrateError(err.response?.data?.error || err.message);
    }
    setMigrating(false);
  }

  if (status === "checking") return (
    <div className="flex items-center justify-center py-16 gap-2 text-sm theme-text-muted">
      <Loader2 size={15} className="animate-spin" /> Checking Asana connection…
    </div>
  );

  if (status === "disconnected") return (
    <div className="text-center py-10 space-y-4">
      <FolderKanban size={40} className="mx-auto text-gray-300" />
      <div>
        <h3 className="font-semibold theme-text mb-1">Connect Asana</h3>
        <p className="text-sm theme-text-muted max-w-xs mx-auto">
          Authorize this app to access your Asana workspace via OAuth.
        </p>
      </div>
      <button
        onClick={connectOAuth}
        className="mx-auto flex items-center gap-2 px-5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-lg text-sm"
      >
        <ExternalLink size={14} /> Connect Asana via OAuth
      </button>
    </div>
  );

  // Task view
  if (selectedProject) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => { setSelectedProject(null); setTasks([]); setMigrateResult(null); }}
          className="flex items-center gap-1.5 text-xs theme-text-muted hover:theme-text border theme-border rounded-lg px-2.5 py-1.5">
          <ArrowLeft size={13} /> Back
        </button>
        <h3 className="font-semibold theme-text text-sm flex-1 truncate">{selectedProject.name}</h3>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-8 pr-3 py-2 border theme-border rounded-lg text-sm theme-text theme-bg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <ModeToggle mode={mode} onChange={setMode} />

      {migrateResult && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle size={14} /> Imported {migrateResult.importedTasks} tasks (Import #{migrateResult.importNumber})
        </div>
      )}
      {migrateError && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />{migrateError}
        </div>
      )}

      <div className="theme-surface border theme-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b theme-border flex items-center justify-between">
          <span className="text-xs theme-text-muted">{tasks.length} tasks shown</span>
          <button
            onClick={handleMigrate} disabled={migrating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
          >
            {migrating ? <><Loader2 size={12} className="animate-spin" />Importing…</> : "Import project →"}
          </button>
        </div>
        {loadingTasks ? (
          <div className="flex items-center justify-center py-8 gap-2 text-sm theme-text-muted">
            <Loader2 size={14} className="animate-spin" /> Loading tasks…
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium theme-text-muted">Task</th>
                <th className="p-3 text-left font-medium theme-text-muted">Assignee</th>
                <th className="p-3 text-left font-medium theme-text-muted">Status</th>
                <th className="p-3 text-left font-medium theme-text-muted">Modified</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.gid} className="border-t theme-border hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="p-3 theme-text">{t.name}</td>
                  <td className="p-3 theme-text-muted">{t.assignee?.name || "—"}</td>
                  <td className="p-3">
                    <button
                      onClick={async () => {
                        try {
                          await api.patch(`/integrations/asana/tasks/${t.gid}/status`, { completed: !t.completed });
                          setTasks((prev) => prev.map((x) => x.gid === t.gid ? { ...x, completed: !x.completed } : x));
                        } catch { /* non-fatal */ }
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer hover:opacity-80
                        ${t.completed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {t.completed ? "Done" : "Mark Done"}
                    </button>
                  </td>
                  <td className="p-3 theme-text-muted">{t.modified_at ? new Date(t.modified_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-sm theme-text-muted">No tasks found</td></tr>
              )}
            </tbody>
          </table>
        )}
        {(page > 1 || hasMore) && (
          <div className="flex items-center justify-between px-4 py-2 border-t theme-border text-xs">
            <button disabled={page === 1} onClick={() => loadTasks(selectedProject, page - 1, search)}
              className="px-3 py-1 border theme-border rounded disabled:opacity-40 theme-text">Previous</button>
            <span className="theme-text-muted">Page {page}</span>
            <button disabled={!hasMore} onClick={() => loadTasks(selectedProject, page + 1, search)}
              className="px-3 py-1 border theme-border rounded disabled:opacity-40 theme-text">Next</button>
          </div>
        )}
      </div>
    </div>
  );

  // Project list
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm theme-text-muted">{projects?.length ?? 0} project{projects?.length !== 1 ? "s" : ""} found</span>
        <button onClick={checkConnection} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {projects?.length === 0 && (
        <p className="text-center py-6 text-sm theme-text-muted">No projects found in your Asana workspace.</p>
      )}

      <div className="space-y-2">
        {(projects || []).map((p) => (
          <button key={p.gid} onClick={() => openProject(p)}
            className="w-full theme-surface border theme-border rounded-xl p-4 flex items-center justify-between gap-4 hover:shadow text-left">
            <div>
              <p className="text-sm font-medium theme-text">{p.name}</p>
              <p className="text-xs theme-text-muted mt-0.5">Click to preview tasks before importing</p>
            </div>
            <ChevronRight size={16} className="text-gray-400 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   YOUTRACK PANEL  — full viewer with task preview
───────────────────────────────────────────── */
function YouTrackPanel({ onImportDone }) {
  const api = useApi();
  const [baseUrl, setBaseUrl] = useState("");
  const [ytToken, setYtToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [projects, setProjects] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);
  const [migrateError, setMigrateError] = useState("");
  const [mode, setMode] = useState("skip");
  const searchTimeout = useRef(null);

  useEffect(() => {
    async function tryAutoConnect() {
      try {
        const res = await api.get("/integrations/youtrack/projects");
        const data = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
        setProjects(data);
        setConnected(true);
      } catch { /* not connected */ }
    }
    tryAutoConnect();
  }, [api]);

  async function handleConnect() {
    setConnecting(true); setConnectError("");
    try {
      await api.post("/integrations/youtrack/connect", { baseUrl, token: ytToken });
      setConnected(true);
      await loadProjects();
    } catch (err) {
      setConnectError(err.response?.data?.error || "Connection failed");
    }
    setConnecting(false);
  }

  async function loadProjects() {
    setLoadingProjects(true);
    try {
      const res = await api.get("/integrations/youtrack/projects");
      const data = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
      setProjects(data);
    } catch (_) {}
    setLoadingProjects(false);
  }

  async function loadTasks(project, pg = 1, q = "") {
    setLoadingTasks(true);
    try {
      const key = project.shortName || project.id;
      const res = await api.get(`/integrations/youtrack/projects/${key}/tasks`, {
        params: { page: pg, limit: 25, search: q },
      });
      setTasks(res.data.data || []);
      setHasMore(res.data.hasMore || false);
      setPage(pg);
    } catch { setTasks([]); }
    setLoadingTasks(false);
  }

  function openProject(p) {
    setSelectedProject(p);
    setSearch(""); setPage(1); setMigrateResult(null); setMigrateError("");
    loadTasks(p, 1, "");
  }

  function handleSearchChange(val) {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      if (selectedProject) loadTasks(selectedProject, 1, val);
    }, 400);
  }

  async function handleMigrate() {
    if (!selectedProject) return;
    const key = selectedProject.shortName || selectedProject.id;
    setMigrating(true); setMigrateError("");
    try {
      const res = await api.post(`/integrations/youtrack/projects/${key}/migrate`, { mode });
      setMigrateResult(res.data);
      onImportDone?.();
    } catch (err) {
      setMigrateError(err.response?.data?.error || err.message);
    }
    setMigrating(false);
  }

  if (!connected) return (
    <div className="space-y-4">
      <div className="theme-surface border theme-border rounded-xl p-5 space-y-3">
        <h3 className="font-semibold theme-text">Connect YouTrack</h3>
        <div>
          <label className="block text-xs font-medium theme-text mb-1">YouTrack Base URL</label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://yourcompany.youtrack.cloud"
            className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-text theme-bg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-xs font-medium theme-text mb-1">Permanent Token</label>
          <input type="password" value={ytToken} onChange={(e) => setYtToken(e.target.value)} placeholder="perm:..."
            className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-text theme-bg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono" />
        </div>
        {connectError && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />{connectError}
          </div>
        )}
      </div>
      <button onClick={handleConnect} disabled={!baseUrl || !ytToken || connecting}
        className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2">
        {connecting ? <><Loader2 size={14} className="animate-spin"/>Connecting…</> : "Connect & Load Projects"}
      </button>
    </div>
  );

  // Task view
  if (selectedProject) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => { setSelectedProject(null); setTasks([]); setMigrateResult(null); }}
          className="flex items-center gap-1.5 text-xs theme-text-muted hover:theme-text border theme-border rounded-lg px-2.5 py-1.5">
          <ArrowLeft size={13} /> Back
        </button>
        <h3 className="font-semibold theme-text text-sm flex-1 truncate">{selectedProject.name || selectedProject.shortName}</h3>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search} onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search issues…"
          className="w-full pl-8 pr-3 py-2 border theme-border rounded-lg text-sm theme-text theme-bg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <ModeToggle mode={mode} onChange={setMode} />

      {migrateResult && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle size={14} /> Imported {migrateResult.importedTasks} tasks (Import #{migrateResult.importNumber})
        </div>
      )}
      {migrateError && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />{migrateError}
        </div>
      )}

      <div className="theme-surface border theme-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b theme-border flex items-center justify-between">
          <span className="text-xs theme-text-muted">{tasks.length} issues shown</span>
          <button
            onClick={handleMigrate} disabled={migrating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
          >
            {migrating ? <><Loader2 size={12} className="animate-spin" />Importing…</> : "Import project →"}
          </button>
        </div>
        {loadingTasks ? (
          <div className="flex items-center justify-center py-8 gap-2 text-sm theme-text-muted">
            <Loader2 size={14} className="animate-spin" /> Loading issues…
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="p-3 text-left font-medium theme-text-muted">Issue</th>
                <th className="p-3 text-left font-medium theme-text-muted">Assignee</th>
                <th className="p-3 text-left font-medium theme-text-muted">Status</th>
                <th className="p-3 text-left font-medium theme-text-muted">Modified</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-t theme-border hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="p-3 theme-text">{t.title || t.name || "—"}</td>
                  <td className="p-3 theme-text-muted">{t.assignee?.name || t.assignee || "—"}</td>
                  <td className="p-3">
                    <button
                      onClick={async () => {
                        try {
                          await api.patch(`/integrations/youtrack/tasks/${t.id}/status`, { completed: !t.completed });
                          setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, completed: !x.completed } : x));
                        } catch { /* non-fatal */ }
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer hover:opacity-80
                        ${t.completed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {t.completed ? "Done" : "Mark Done"}
                    </button>
                  </td>
                  <td className="p-3 theme-text-muted">
                    {t.lastModified || t.updated ? new Date(t.lastModified || t.updated).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-sm theme-text-muted">No issues found</td></tr>
              )}
            </tbody>
          </table>
        )}
        {(page > 1 || hasMore) && (
          <div className="flex items-center justify-between px-4 py-2 border-t theme-border text-xs">
            <button disabled={page === 1} onClick={() => loadTasks(selectedProject, page - 1, search)}
              className="px-3 py-1 border theme-border rounded disabled:opacity-40 theme-text">Previous</button>
            <span className="theme-text-muted">Page {page}</span>
            <button disabled={!hasMore} onClick={() => loadTasks(selectedProject, page + 1, search)}
              className="px-3 py-1 border theme-border rounded disabled:opacity-40 theme-text">Next</button>
          </div>
        )}
      </div>
    </div>
  );

  // Project list
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle size={14} /> Connected to YouTrack
        </div>
        <button onClick={loadProjects} disabled={loadingProjects} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      {loadingProjects && (
        <div className="flex items-center justify-center py-8 gap-2 text-sm theme-text-muted">
          <Loader2 size={14} className="animate-spin" />Loading projects…
        </div>
      )}
      {!loadingProjects && projects?.length === 0 && (
        <p className="text-center py-6 text-sm theme-text-muted">No projects found.</p>
      )}
      <div className="space-y-2">
        {(projects || []).map((p) => {
          const id = p.id || p.shortName;
          return (
            <button key={id} onClick={() => openProject(p)}
              className="w-full theme-surface border theme-border rounded-xl p-4 flex items-center justify-between gap-4 hover:shadow text-left">
              <div>
                <p className="text-sm font-medium theme-text">{p.name || p.shortName}</p>
                <p className="text-xs theme-text-muted mt-0.5">Click to preview issues before importing</p>
              </div>
              <ChevronRight size={16} className="text-gray-400 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SOURCE TAB WRAPPER  (Import | History sub-tabs)
───────────────────────────────────────────── */
function SourceTab({ source, ImportPanel, autoConnect }) {
  const [subTab, setSubTab] = useState("import");
  const [historyKey, setHistoryKey] = useState(0);

  return (
    <div>
      <div className="flex gap-1 mb-5 border-b theme-border">
        {["import", "history"].map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors
              ${subTab === t ? "border-primary-600 text-primary-600" : "border-transparent theme-text-muted hover:theme-text"}`}>
            {t}
          </button>
        ))}
      </div>

      {subTab === "import" && (
        <ImportPanel onImportDone={() => { setHistoryKey((k) => k + 1); }} autoConnect={autoConnect} />
      )}
      {subTab === "history" && (
        <ImportHistory key={historyKey} source={source} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROOT PAGE
───────────────────────────────────────────── */
const SOURCES = [
  { id: "slack",    label: "Slack",    icon: Hash,         color: "text-purple-600", Panel: SlackPanel },
  { id: "asana",    label: "Asana",    icon: FolderKanban, color: "text-pink-600",   Panel: AsanaPanel },
  { id: "youtrack", label: "YouTrack", icon: FolderKanban, color: "text-blue-600",   Panel: YouTrackPanel },
];

export default function Migrations() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const sourceParam = params.get("source");
  const connected = params.get("connected") === "true";

  const [activeSource, setActiveSource] = useState(
    SOURCES.find((s) => s.id === sourceParam) ? sourceParam : "slack"
  );

  const current = SOURCES.find((s) => s.id === activeSource);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-7">
        <h1 className="text-2xl font-bold theme-text">Migrations</h1>
        <p className="theme-text-muted text-sm mt-1">
          Import users, channels, and tasks from external tools into this workspace.
        </p>
      </div>

      {/* Source tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {SOURCES.map(({ id, label, icon: Icon, color }) => (
          <button key={id} onClick={() => setActiveSource(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors
              ${activeSource === id
                ? "bg-primary-600 text-white border-primary-600"
                : "theme-surface theme-border theme-text-muted hover:theme-text"}`}>
            <Icon size={14} className={activeSource === id ? "" : color} />
            {label}
          </button>
        ))}
      </div>

      {/* Active source panel */}
      <div className="theme-surface border theme-border rounded-2xl p-6">
        {current && (
          <SourceTab
            key={activeSource}
            source={activeSource}
            ImportPanel={current.Panel}
            autoConnect={connected && sourceParam === activeSource}
          />
        )}
      </div>
    </div>
  );
}
