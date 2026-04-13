// src/pages/SuperadminBackups.jsx
import { useState, useEffect, useCallback } from "react";
import { Database, RefreshCw, Play, CheckCircle, XCircle, Clock, HardDrive, Cloud } from "lucide-react";

function getSuperadminToken() {
  try {
    const raw = localStorage.getItem("superadmin_auth");
    return raw ? JSON.parse(raw)?.token : null;
  } catch { return null; }
}

async function apiFetch(path, opts = {}) {
  const token = window.__SUPERADMIN_TOKEN__ || getSuperadminToken();
  const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const msg = payload?.error || payload?.message || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

function fmtBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function StatusBadge({ status }) {
  const map = {
    success: { icon: <CheckCircle className="w-3.5 h-3.5" />, cls: "bg-green-100 text-green-700" },
    failed:  { icon: <XCircle    className="w-3.5 h-3.5" />, cls: "bg-red-100 text-red-700"   },
    running: { icon: <Clock      className="w-3.5 h-3.5 animate-spin" />, cls: "bg-blue-100 text-blue-700" },
  };
  const { icon, cls } = map[status] || { icon: null, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {icon}{status}
    </span>
  );
}

function StorageBadge({ type }) {
  if (type === "s3") return (
    <span className="inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
      <Cloud className="w-3 h-3" /> S3
    </span>
  );
  if (type === "local") return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
      <HardDrive className="w-3 h-3" /> local
    </span>
  );
  return <span className="text-xs text-gray-400">—</span>;
}

export default function SuperadminBackups() {
  const [logs, setLogs]       = useState([]);
  const [latest, setLatest]   = useState(null);
  const [recoveryJobs, setRecoveryJobs] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState(null);
  const [workspaceIdInput, setWorkspaceIdInput] = useState("");
  const [sourceUrlInput, setSourceUrlInput] = useState("");
  const [recoveryConfig, setRecoveryConfig] = useState({ serverDefaultSourceConfigured: false });
  const [recoveryDryRun, setRecoveryDryRun] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryMsg, setRecoveryMsg] = useState(null);
  const [error, setError]     = useState(null);

  const hasRunningBackup = logs.some((log) => log.status === "running");
  const hasRunningRecovery = recoveryJobs.some((job) => job.status === "running");
  const shouldAutoRefresh = hasRunningBackup || hasRunningRecovery || triggering || recovering;
  const activeRecoveryJob =
    recoveryJobs.find((job) => job.status === "running" || job.status === "pending") || null;
  const workspaceOptions = (workspaces || [])
    .filter((ws) => ws?.id && ws?.name)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const workspaceNameMap = new Map(workspaceOptions.map((ws) => [ws.id, ws.name]));
  const liveEvents = Array.isArray(activeRecoveryJob?.event_log)
    ? activeRecoveryJob.event_log.slice(-8).reverse()
    : [];
  const canRecover = !!workspaceIdInput && !recovering;

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [logsRes, latestRes, recoveryRes, recoveryConfigRes] = await Promise.all([
        apiFetch("/superadmin/backups"),
        apiFetch("/superadmin/backups/latest"),
        apiFetch("/superadmin/backups/recovery-jobs?limit=20"),
        apiFetch("/superadmin/backups/recovery-config").catch(() => ({ serverDefaultSourceConfigured: false })),
      ]);
      setLogs(logsRes.logs || []);
      setLatest(latestRes.backup || null);
      setRecoveryJobs(recoveryRes.jobs || []);
      setRecoveryConfig({
        serverDefaultSourceConfigured: !!recoveryConfigRes?.serverDefaultSourceConfigured,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadWorkspaces = useCallback(async () => {
    setWorkspacesLoading(true);
    try {
      const ws = await apiFetch("/superadmin/workspaces");
      setWorkspaces(Array.isArray(ws) ? ws : []);
    } catch {
      setWorkspaces([]);
    } finally {
      setWorkspacesLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);
  useEffect(() => {
    if (!shouldAutoRefresh) return undefined;
    const timer = setInterval(() => { load({ silent: true }); }, 15000);
    return () => clearInterval(timer);
  }, [load, shouldAutoRefresh]);

  async function triggerBackup() {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      await apiFetch("/superadmin/backups/trigger", { method: "POST" });
      setTriggerMsg("Backup started. Refresh in a minute to see the result.");
      setTimeout(() => load({ silent: true }), 8000); // auto-refresh after 8s
    } catch (e) {
      setTriggerMsg(`Failed to trigger: ${e.message}`);
    } finally {
      setTriggering(false);
    }
  }

  async function triggerWorkspaceRecovery() {
    const workspaceId = workspaceIdInput.trim();
    if (!workspaceId) {
      setRecoveryMsg("Please select a workspace.");
      return;
    }

    setRecovering(true);
    setRecoveryMsg(null);
    try {
      const payload = {
        workspaceId,
        dryRun: recoveryDryRun,
      };
      if (sourceUrlInput.trim()) payload.sourceDatabaseUrl = sourceUrlInput.trim();

      const res = await apiFetch("/superadmin/backups/recover-workspace", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setRecoveryMsg(
        `${res.message} Job ID: ${res.job?.id || "—"}. Existing rows are skipped/updated safely.`
      );
      setTimeout(() => load({ silent: true }), 2000);
    } catch (e) {
      setRecoveryMsg(`Failed to start recovery: ${e.message}`);
    } finally {
      setRecovering(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/10 flex items-center justify-center">
            <Database className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold theme-text">Database Backups</h1>
            <p className="text-xs theme-text-muted mt-0.5">Automated daily backups · 30-day retention</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium theme-text-muted hover:bg-[var(--surface-soft)] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={triggerBackup}
            disabled={triggering}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60"
          >
            <Play className="w-4 h-4" />
            {triggering ? "Starting…" : "Run Backup Now"}
          </button>
        </div>
      </div>

      {/* Trigger feedback */}
      {triggerMsg && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
          {triggerMsg}
        </div>
      )}

      {/* Recovery controls */}
      <div className="theme-surface border theme-border rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold theme-text">Workspace Recovery</p>
            <p className="text-xs theme-text-muted mt-0.5">
              Recover data for one workspace from snapshot source. Existing records are skipped/merged.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium theme-text-muted mb-1">Workspace</label>
            <select
              value={workspaceIdInput}
              onChange={(e) => setWorkspaceIdInput(e.target.value)}
              disabled={workspacesLoading || recovering}
              className="w-full border theme-border theme-surface rounded-lg px-3 py-2 text-sm theme-text"
            >
              <option value="">
                {workspacesLoading ? "Loading workspaces..." : "Select workspace"}
              </option>
              {workspaceOptions.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.owner_email || "no-owner"})
                </option>
              ))}
            </select>
            {workspaceIdInput && (
              <p className="text-[11px] theme-text-muted mt-1 font-mono">
                {workspaceIdInput}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium theme-text-muted mb-1">Source Snapshot DB URL (optional override)</label>
            <input
              value={sourceUrlInput}
              onChange={(e) => setSourceUrlInput(e.target.value)}
              placeholder="Leave blank to use server default"
              className="w-full border theme-border theme-surface rounded-lg px-3 py-2 text-sm theme-text"
            />
            <p className="text-[11px] mt-1 theme-text-muted">
              {recoveryConfig.serverDefaultSourceConfigured
                ? "Server source is configured. Leave this blank for one-click recovery."
                : "Leave blank for one-click auto recovery from latest backup. Only use this for custom source override."}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={loadWorkspaces}
              disabled={workspacesLoading}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-2 rounded-lg border theme-border theme-text-muted hover:bg-[var(--surface-soft)]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${workspacesLoading ? "animate-spin" : ""}`} />
              Reload List
            </button>
            <label className="inline-flex items-center gap-2 text-sm theme-text">
              <input
                type="checkbox"
                checked={recoveryDryRun}
                onChange={(e) => setRecoveryDryRun(e.target.checked)}
                className="rounded border theme-border"
              />
              Dry run
            </label>
            <button
              onClick={triggerWorkspaceRecovery}
              disabled={!canRecover}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-60"
            >
              <Play className="w-4 h-4" />
              {recovering ? "Starting…" : "Recover Workspace"}
            </button>
          </div>
        </div>
        {recoveryMsg && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            {recoveryMsg}
          </div>
        )}
      </div>

      {/* Latest backup summary */}
      {latest && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Last Backup", value: fmtDate(latest.completed_at) },
            { label: "File Size", value: fmtBytes(latest.file_size_bytes) },
            { label: "Storage", value: latest.storage_type?.toUpperCase() || "—" },
            { label: "Triggered By", value: latest.triggered_by || "—" },
          ].map(({ label, value }) => (
            <div key={label} className="theme-surface border theme-border rounded-xl p-4">
              <p className="text-xs font-semibold theme-text-muted uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm font-semibold theme-text truncate">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Logs table */}
      <div className="theme-surface border theme-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b theme-border">
          <p className="text-sm font-semibold theme-text">Backup History</p>
        </div>

        {loading ? (
          <div className="py-12 text-center theme-text-muted text-sm">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center theme-text-muted text-sm">No backups yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b theme-border bg-[var(--surface-soft)]">
                  {["Status", "File", "Size", "Storage", "Triggered By", "Started At", "Duration", "Error"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold theme-text-muted uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y theme-border">
                {logs.map((log) => {
                  const duration = log.completed_at && log.started_at
                    ? `${((new Date(log.completed_at) - new Date(log.started_at)) / 1000).toFixed(1)}s`
                    : "—";
                  return (
                    <tr key={log.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                      <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                      <td className="px-4 py-3 theme-text-muted font-mono text-xs max-w-[200px] truncate" title={log.file_name}>
                        {log.file_name || "—"}
                      </td>
                      <td className="px-4 py-3 theme-text whitespace-nowrap">{fmtBytes(log.file_size_bytes)}</td>
                      <td className="px-4 py-3"><StorageBadge type={log.storage_type} /></td>
                      <td className="px-4 py-3 theme-text capitalize">{log.triggered_by || "—"}</td>
                      <td className="px-4 py-3 theme-text-muted whitespace-nowrap">{fmtDate(log.started_at)}</td>
                      <td className="px-4 py-3 theme-text">{duration}</td>
                      <td className="px-4 py-3 text-red-500 text-xs max-w-[200px] truncate" title={log.error_message || ""}>
                        {log.error_message || ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live recovery progress */}
      {activeRecoveryJob && (
        <div className="theme-surface border theme-border rounded-xl p-4 mt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold theme-text">Live Recovery Progress</p>
            <StatusBadge status={activeRecoveryJob.status} />
          </div>

          <div className="mt-3 h-2 rounded-full bg-[var(--surface-soft)] overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, Number(activeRecoveryJob.progress_pct || 0)))}%` }}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-xs theme-text-muted">
            <span>Workspace: <span className="theme-text font-medium">{workspaceNameMap.get(activeRecoveryJob.workspace_id) || activeRecoveryJob.workspace_id}</span></span>
            <span>Progress: <span className="theme-text font-medium">{Number(activeRecoveryJob.progress_pct || 0).toFixed(1)}%</span></span>
            <span>Scanned: <span className="theme-text font-medium">{activeRecoveryJob.rows_scanned ?? 0}</span></span>
            <span>Written: <span className="theme-text font-medium">{activeRecoveryJob.rows_written ?? 0}</span></span>
            <span>Table: <span className="theme-text font-medium">{activeRecoveryJob.current_table || "—"}</span></span>
          </div>

          {activeRecoveryJob.progress_message && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[var(--surface-soft)] text-xs theme-text">
              {activeRecoveryJob.progress_message}
            </div>
          )}

          <div className="mt-3 rounded-lg border theme-border overflow-hidden">
            <div className="px-3 py-2 text-xs font-semibold theme-text-muted border-b theme-border bg-[var(--surface-soft)]">
              Live Log
            </div>
            {liveEvents.length === 0 ? (
              <div className="px-3 py-3 text-xs theme-text-muted">No live events yet.</div>
            ) : (
              <div className="max-h-44 overflow-y-auto">
                {liveEvents.map((evt, idx) => (
                  <div key={`${evt.at || "evt"}-${idx}`} className="px-3 py-2 text-xs border-b theme-border last:border-b-0">
                    <p className="theme-text">{evt.message || "—"}</p>
                    <p className="theme-text-muted mt-0.5">
                      {fmtDate(evt.at)} · scanned {evt.rowsScanned ?? 0} · wrote {evt.rowsWritten ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recovery jobs */}
      <div className="theme-surface border theme-border rounded-xl overflow-hidden mt-6">
        <div className="px-4 py-3 border-b theme-border">
          <p className="text-sm font-semibold theme-text">Workspace Recovery Jobs</p>
        </div>
        {loading ? (
          <div className="py-12 text-center theme-text-muted text-sm">Loading…</div>
        ) : recoveryJobs.length === 0 ? (
          <div className="py-12 text-center theme-text-muted text-sm">No recovery jobs yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b theme-border bg-[var(--surface-soft)]">
                  {["Status", "Workspace", "Mode", "Started", "Completed", "Progress", "Rows Scanned", "Rows Written", "Message", "Error"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold theme-text-muted uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y theme-border">
                {recoveryJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                    <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-3 theme-text text-xs">
                      <p className="font-medium">{workspaceNameMap.get(job.workspace_id) || "Unknown workspace"}</p>
                      <p className="font-mono theme-text-muted">{job.workspace_id}</p>
                    </td>
                    <td className="px-4 py-3 theme-text">{job.dry_run ? "Dry run" : "Apply"}</td>
                    <td className="px-4 py-3 theme-text-muted whitespace-nowrap">{fmtDate(job.started_at || job.created_at)}</td>
                    <td className="px-4 py-3 theme-text-muted whitespace-nowrap">{fmtDate(job.completed_at)}</td>
                    <td className="px-4 py-3 theme-text whitespace-nowrap">{Number(job.progress_pct || 0).toFixed(1)}%</td>
                    <td className="px-4 py-3 theme-text">{job.rows_scanned ?? 0}</td>
                    <td className="px-4 py-3 theme-text">{job.rows_written ?? 0}</td>
                    <td className="px-4 py-3 theme-text text-xs max-w-[250px] truncate" title={job.progress_message || ""}>
                      {job.progress_message || ""}
                    </td>
                    <td className="px-4 py-3 text-red-500 text-xs max-w-[220px] truncate" title={job.error_message || ""}>
                      {job.error_message || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
