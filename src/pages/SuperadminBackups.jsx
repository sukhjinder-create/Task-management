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
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
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
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState(null);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsRes, latestRes] = await Promise.all([
        apiFetch("/superadmin/backups"),
        apiFetch("/superadmin/backups/latest"),
      ]);
      setLogs(logsRes.logs || []);
      setLatest(latestRes.backup || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function triggerBackup() {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      await apiFetch("/superadmin/backups/trigger", { method: "POST" });
      setTriggerMsg("Backup started. Refresh in a minute to see the result.");
      setTimeout(() => load(), 8000); // auto-refresh after 8s
    } catch (e) {
      setTriggerMsg(`Failed to trigger: ${e.message}`);
    } finally {
      setTriggering(false);
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
    </div>
  );
}
