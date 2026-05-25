// src/pages/Enterprise.jsx
// Enterprise Settings: MFA, SSO, Audit Logs, API Keys, Webhooks
import { Fragment, useState, useEffect } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  Shield, Key, Globe, FileText, Webhook, QrCode,
  Plus, Trash2, Copy, Eye, EyeOff, ChevronDown, ChevronUp,
  RefreshCw, CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";

const TABS = [
  { id: "mfa",     label: "MFA / 2FA",     icon: Key },
  { id: "sso",     label: "SSO / SAML",    icon: Globe },
  { id: "audit",   label: "Audit Logs",    icon: FileText },
  { id: "apikeys", label: "API Keys",      icon: Shield },
  { id: "webhooks",label: "Webhooks",      icon: Webhook },
];

export default function Enterprise() {
  const [tab, setTab] = useState("mfa");
  const { auth } = useAuth();

  if (!["admin", "owner"].includes(auth?.user?.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[color:var(--text-muted)]">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">Admin</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">Enterprise Settings</h1>
          <p className="text-[13px] text-[color:var(--text-muted)] mt-1">Security, compliance, and integration settings for your workspace.</p>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[color:var(--border)] mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === id
                ? "border-b-2 border-[color:var(--primary)] text-[color:var(--primary)] -mb-px"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "mfa"      && <MfaTab />}
      {tab === "sso"      && <SsoTab />}
      {tab === "audit"    && <AuditTab />}
      {tab === "apikeys"  && <ApiKeysTab />}
      {tab === "webhooks" && <WebhooksTab />}
    </div>
  );
}

// ─── MFA Tab ──────────────────────────────────────────────────────────────────
function MfaTab() {
  const api = useApi();
  const [status, setStatus] = useState(null);
  const [qr, setQr] = useState(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/mfa/status").then(r => setStatus(r.data)).catch(() => {});
  }, []);

  const startSetup = async () => {
    setLoading(true);
    try {
      const r = await api.post("/mfa/setup");
      setQr(r.data.qrCodeDataUrl);
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setLoading(false);
  };

  const confirmSetup = async () => {
    if (!code) return toast.error("Enter the 6-digit code");
    setLoading(true);
    try {
      const r = await api.post("/mfa/confirm", { token: code });
      setBackupCodes(r.data.backupCodes || []);
      setStatus({ mfa_enabled: true });
      setQr(null);
      toast.success("MFA enabled!");
    } catch (err) { toast.error(err.response?.data?.error || "Invalid code"); }
    setLoading(false);
  };

  const disable = async () => {
    const c = prompt("Enter your current MFA code to disable:");
    if (!c) return;
    try {
      await api.post("/mfa/disable", { token: c });
      setStatus({ mfa_enabled: false });
      toast.success("MFA disabled");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="border border-[color:var(--border)] rounded-lg p-6">
        <h2 className="font-semibold text-[color:var(--text)] mb-1">Two-Factor Authentication</h2>
        <p className="text-[color:var(--text-muted)] text-sm mb-4">Add an extra layer of security to your account using an authenticator app.</p>

        {status?.mfa_enabled ? (
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-[color:var(--score-good)]" />
            <span className="text-[color:var(--score-good)] font-medium">MFA is enabled</span>
            <button onClick={disable} className="ml-auto px-3 py-1.5 text-sm text-[color:var(--score-danger)] border border-[color:var(--border)] rounded-lg hover:bg-[var(--surface-soft)]">
              Disable
            </button>
          </div>
        ) : qr ? (
          <div className="space-y-4">
            <p className="text-sm text-[color:var(--text-muted)]">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code below.</p>
            <img src={qr} alt="QR Code" className="w-48 h-48 border border-[color:var(--border)] rounded-lg" />
            <div className="flex gap-2 max-w-xs">
              <input
                value={code} onChange={e => setCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                className="flex-1 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]"
              />
              <button onClick={confirmSetup} disabled={loading} className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90">
                Verify
              </button>
            </div>
          </div>
        ) : (
          <button onClick={startSetup} disabled={loading} className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90">
            Enable MFA
          </button>
        )}

        {backupCodes.length > 0 && (
          <div className="mt-4 p-4 border border-[color:var(--primary)] rounded-lg">
            <p className="text-sm font-semibold text-[color:var(--primary)] mb-2">Save your backup codes — they won't be shown again</p>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map(c => (
                <code key={c} className="text-xs bg-[var(--surface)] px-2 py-1 rounded border border-[color:var(--border)] font-mono text-[color:var(--text)]">{c}</code>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SSO Tab ──────────────────────────────────────────────────────────────────
function SsoTab() {
  const api = useApi();
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ enabled: false, provider: "saml", entry_point: "", issuer: "", cert: "", force_sso: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/auth/sso/config").then(r => {
      setConfig(r.data);
      setForm(f => ({ ...f, ...r.data }));
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put("/auth/sso/config", form);
      setConfig(r.data);
      toast.success("SSO configuration saved");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setSaving(false);
  };

  return (
    <div className="border border-[color:var(--border)] rounded-lg p-6 space-y-4">
      <h2 className="font-semibold text-[color:var(--text)]">SAML SSO Configuration</h2>
      <p className="text-sm text-[color:var(--text-muted)]">Connect your Identity Provider (IdP) so team members can sign in using your company's SSO.</p>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="w-4 h-4 rounded" />
        <span className="text-sm text-[color:var(--text)] font-medium">Enable SSO for this workspace</span>
      </label>

      {[
        { key: "entry_point", label: "IdP SSO URL (Entry Point)", placeholder: "https://idp.example.com/sso/saml" },
        { key: "issuer", label: "SP Entity ID / Issuer", placeholder: "https://yourapp.com/auth/saml" },
        { key: "sp_callback_url", label: "ACS URL (Callback)", placeholder: "https://yourapp.com/auth/sso/saml/callback" },
        { key: "attribute_email", label: "Email Attribute Name", placeholder: "email" },
        { key: "attribute_name", label: "Name Attribute Name", placeholder: "displayName" },
      ].map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-[color:var(--text)] mb-1">{label}</label>
          <input
            value={form[key] || ""}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            placeholder={placeholder}
            className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]"
          />
        </div>
      ))}

      <div>
        <label className="block text-sm font-medium text-[color:var(--text)] mb-1">IdP Certificate (PEM)</label>
        <textarea
          value={form.cert || ""}
          onChange={e => setForm(f => ({ ...f, cert: e.target.value }))}
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] font-mono"
        />
        {config?.cert_snippet && <p className="text-xs text-[color:var(--text-muted)] mt-1">Current: {config.cert_snippet}</p>}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.force_sso || false} onChange={e => setForm(f => ({ ...f, force_sso: e.target.checked }))} className="w-4 h-4 rounded" />
        <span className="text-sm text-[color:var(--text)]">Force SSO (disable password login)</span>
      </label>

      <button onClick={save} disabled={saving} className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60">
        {saving ? "Saving…" : "Save SSO Config"}
      </button>
    </div>
  );
}

// ─── Audit helpers ────────────────────────────────────────────────────────────

function describeAudit(log) {
  const m   = log.metadata  || {};
  const o   = log.old_value || {};
  const n   = log.new_value || {};

  switch (log.action) {
    // Auth
    case "user.login":             return "Signed in";
    case "user.logout":            return "Signed out";
    case "user.mfa.enabled":       return "Enabled two-factor authentication";
    case "user.mfa.disabled":      return "Disabled two-factor authentication";
    case "user.password.changed":  return "Changed password";
    case "user.profile.updated":   return "Updated profile settings";
    case "sso.login":              return `Signed in via SSO${m.provider ? ` (${m.provider})` : ""}`;
    case "mfa.backup_code.used":   return "Used a MFA backup code";

    // Tasks
    case "task.create": return `Created task${m.name ? ` "${m.name}"` : ""}${m.projectName ? ` in "${m.projectName}"` : ""}`;
    case "task.update": {
      const changed = Object.keys(n).filter(k => JSON.stringify(o[k]) !== JSON.stringify(n[k]));
      if (changed.length > 0)
        return `Updated task — changed: ${changed.map(k => `${k} from "${o[k] ?? "—"}" to "${n[k] ?? "—"}"`).join("; ")}`;
      return `Updated task${m.name ? ` "${m.name}"` : ""}`;
    }
    case "task.delete": return `Deleted task${m.name ? ` "${m.name}"` : ""}`;
    case "task.assign": return `Assigned task to ${n.assignee || m.assignee || "someone"}`;
    case "task.status": return `Changed task status: "${o.status || "—"}" → "${n.status || m.status || "—"}"`;

    // Projects
    case "project.create":        return `Created project${m.name ? ` "${m.name}"` : ""}`;
    case "project.update":        return `Updated project${m.name ? ` "${m.name}"` : ""}`;
    case "project.delete":        return `Deleted project${m.name ? ` "${m.name}"` : ""}`;
    case "project.member.add":    return `Added member${m.username ? ` ${m.username}` : ""} to project${m.projectName ? ` "${m.projectName}"` : ""}`;
    case "project.member.remove": return `Removed member${m.username ? ` ${m.username}` : ""} from project${m.projectName ? ` "${m.projectName}"` : ""}`;

    // Leave
    case "leave.request.create":  return `Submitted leave request${m.type ? ` (${m.type})` : ""}${m.start_date ? ` · ${m.start_date}` : ""}${m.end_date ? ` → ${m.end_date}` : ""}`;
    case "leave.request.approve": return `Approved leave request${m.username ? ` for ${m.username}` : ""}`;
    case "leave.request.reject":  return `Rejected leave request${m.username ? ` for ${m.username}` : ""}${m.reason ? ` — "${m.reason}"` : ""}`;
    case "leave.request.cancel":  return "Cancelled leave request";

    // Reviews
    case "review.submit":          return `Submitted review${m.revieweeName ? ` for ${m.revieweeName}` : ""}${m.cycleName ? ` in cycle "${m.cycleName}"` : ""}${m.score ? ` · ${m.score}/5` : ""}`;
    case "review.cycle.create":    return `Created review cycle${m.name ? ` "${m.name}"` : ""}`;
    case "review.cycle.activate":  return `Activated review cycle${m.name ? ` "${m.name}"` : ""}`;
    case "review.cycle.complete":  return `Completed review cycle${m.name ? ` "${m.name}"` : ""}`;

    // Reports & exports
    case "report.download":   return `Downloaded ${m.reportType || "report"}${m.format ? ` (${m.format.toUpperCase()})` : ""}${m.month ? ` for ${m.month}` : ""}${m.projectName ? ` — "${m.projectName}"` : ""}`;
    case "report.export":     return `Exported report as ${m.format?.toUpperCase() || "CSV"}${m.projectName ? ` for project "${m.projectName}"` : ""}`;
    case "attendance.export": return `Exported attendance report${m.month ? ` for ${m.month}` : ""}`;

    // Workspace / Users
    case "workspace.settings.update": return "Updated workspace settings";
    case "user.role.change":   return `Changed role: "${o.role || "—"}" → "${n.role || "—"}"${m.targetUsername ? ` for ${m.targetUsername}` : ""}`;
    case "user.invite":        return `Invited${m.email ? ` ${m.email}` : " user"} to workspace`;
    case "user.remove":        return `Removed${m.username ? ` ${m.username}` : " user"} from workspace`;

    // Wiki
    case "wiki.page.create": return `Created wiki page${m.title ? ` "${m.title}"` : ""}`;
    case "wiki.page.update": return `Edited wiki page${m.title ? ` "${m.title}"` : ""}`;
    case "wiki.page.delete": return `Deleted wiki page${m.title ? ` "${m.title}"` : ""}`;

    // API Keys / Webhooks
    case "api_key.create":  return `Created API key${m.name ? ` "${m.name}"` : ""}`;
    case "api_key.revoke":  return `Revoked API key${m.name ? ` "${m.name}"` : ""}`;
    case "webhook.create":  return `Added webhook${m.url ? ` → ${m.url}` : ""}`;
    case "webhook.delete":  return `Removed webhook${m.url ? ` → ${m.url}` : ""}`;

    // GDPR
    case "gdpr.erasure_request": return "Submitted GDPR data erasure request";
    case "gdpr.consent":         return "Updated data consent preferences";

    default: {
      const readable = log.action.split(".").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
      return m.name ? `${readable}: "${m.name}"` : readable;
    }
  }
}

function AuditDetail({ log }) {
  const m = log.metadata || {};
  const hasOld = log.old_value && Object.keys(log.old_value).length > 0;
  const hasNew = log.new_value && Object.keys(log.new_value).length > 0;
  const metaKeys = Object.keys(m).filter(k => m[k] != null && m[k] !== "");

  const renderKV = (obj) => Object.entries(obj).map(([k, v]) => (
    <div key={k} className="flex gap-2 text-[11px]">
      <span className="text-[color:var(--text-muted)] w-28 shrink-0 capitalize">{k.replace(/_/g, " ")}</span>
      <span className="text-[color:var(--text)] font-medium break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
    </div>
  ));

  return (
    <div className="grid gap-4 md:grid-cols-3 text-xs">
      {/* Context */}
      {metaKeys.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[color:var(--text-muted)] uppercase tracking-wide mb-2">Context</p>
          <div className="space-y-1">{renderKV(m)}</div>
        </div>
      )}

      {/* Before → After */}
      {(hasOld || hasNew) && (
        <div className={metaKeys.length > 0 ? "" : "md:col-span-2"}>
          <p className="text-[10px] font-semibold text-[color:var(--text-muted)] uppercase tracking-wide mb-2">Changes</p>
          <div className="space-y-1.5">
            {Array.from(new Set([...Object.keys(log.old_value || {}), ...Object.keys(log.new_value || {})])).map(k => {
              const before = log.old_value?.[k];
              const after  = log.new_value?.[k];
              const changed = JSON.stringify(before) !== JSON.stringify(after);
              return (
                <div key={k} className="flex gap-2 text-[11px] items-start">
                  <span className="text-[color:var(--text-muted)] w-24 shrink-0 capitalize">{k.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {before != null && <span className={`px-1.5 py-0.5 rounded ${changed ? "bg-[var(--score-danger)]/10 text-[color:var(--score-danger)] line-through" : "bg-[var(--surface-soft)] text-[color:var(--text)]"}`}>{String(before)}</span>}
                    {changed && before != null && after != null && <span className="text-[color:var(--text-muted)]">→</span>}
                    {after  != null && changed && <span className="px-1.5 py-0.5 rounded bg-[var(--score-good)]/10 text-[color:var(--score-good)]">{String(after)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No detail available */}
      {metaKeys.length === 0 && !hasOld && !hasNew && (
        <div className="md:col-span-3 text-[color:var(--text-muted)] text-[11px]">No additional details recorded.</div>
      )}
    </div>
  );
}

// ─── Audit Logs Tab ───────────────────────────────────────────────────────────
function AuditTab() {
  const api = useApi();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState({ action: "", entityType: "" });
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const r = await api.get(`/audit?${params}`);
      setLogs(r.data.logs || []);
      setTotal(r.data.total || 0);
    } catch { toast.error("Failed to load audit logs"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, pageSize, filters.action, filters.entityType]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, total);

  const ACTION_COLORS = {
    "user.login":             "bg-[var(--surface-soft)] text-[color:var(--text-soft)]",
    "user.logout":            "bg-[var(--surface-soft)] text-[color:var(--text-muted)]",
    "user.mfa.enabled":       "bg-[var(--score-good)]/10 text-[color:var(--score-good)]",
    "user.mfa.disabled":      "bg-[var(--score-danger)]/10 text-[color:var(--score-danger)]",
    "task.create":            "bg-[var(--primary)]/10 text-[color:var(--primary)]",
    "task.update":            "bg-[var(--surface-soft)] text-[color:var(--text-soft)]",
    "task.delete":            "bg-[var(--score-danger)]/10 text-[color:var(--score-danger)]",
    "project.create":         "bg-[var(--primary)]/10 text-[color:var(--primary)]",
    "review.submit":          "bg-[var(--score-good)]/10 text-[color:var(--score-good)]",
    "review.cycle.create":    "bg-[var(--primary)]/10 text-[color:var(--primary)]",
    "leave.request.create":   "bg-[var(--surface-soft)] text-[color:var(--text-soft)]",
    "leave.request.approve":  "bg-[var(--score-good)]/10 text-[color:var(--score-good)]",
    "leave.request.reject":   "bg-[var(--score-danger)]/10 text-[color:var(--score-danger)]",
    "report.download":        "bg-[var(--primary)]/10 text-[color:var(--primary)]",
    "report.export":          "bg-[var(--primary)]/10 text-[color:var(--primary)]",
    "attendance.export":      "bg-[var(--primary)]/10 text-[color:var(--primary)]",
    "gdpr.erasure_request":   "bg-[var(--score-danger)]/10 text-[color:var(--score-danger)]",
    "api_key.create":         "bg-[var(--primary)]/10 text-[color:var(--primary)]",
    "api_key.revoke":         "bg-[var(--score-danger)]/10 text-[color:var(--score-danger)]",
    default:                  "bg-[var(--surface-soft)] text-[color:var(--text-muted)]",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <input
          value={filters.action} onChange={e => { setPage(1); setFilters(f => ({ ...f, action: e.target.value })); }}
          placeholder="Filter by action…"
          className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] w-48"
        />
        <select
          value={filters.entityType} onChange={e => { setPage(1); setFilters(f => ({ ...f, entityType: e.target.value })); }}
          className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]"
        >
          <option value="">All entities</option>
          {["user","task","project","wiki_page","leave_request","review","api_key","webhook","comments","chat","notifications","attendance","reports","workspace","goals"].map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select
          value={pageSize}
          onChange={e => { setPage(1); setPageSize(Number(e.target.value)); }}
          className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]"
        >
          {[10, 25, 50, 100].map(size => (
            <option key={size} value={size}>{size} / page</option>
          ))}
        </select>
        <button onClick={load} className="px-3 py-2 bg-[var(--primary)] text-white rounded-lg text-sm flex items-center gap-1 hover:opacity-90">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        <span className="text-sm text-[color:var(--text-muted)] self-center">{total} total entries</span>
      </div>

      <div className="border border-[color:var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-soft)] border-b border-[color:var(--border)]">
            <tr>
              {["Time","User","Action","Entity","IP","Details"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-[color:var(--text-soft)] uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-[color:var(--text-muted)]">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-[color:var(--text-muted)]">No audit logs found</td></tr>
            ) : logs.map(log => (
              <Fragment key={log.id}>
                <tr className="border-b border-[color:var(--border)] last:border-0 hover:bg-[var(--surface-soft)]">
                  <td className="px-4 py-3 text-xs text-[color:var(--text-muted)] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-[color:var(--text)]">
                    <div>{log.username || log.user_id?.slice(0,8) || "—"}</div>
                    {log.email && <div className="text-[color:var(--text-muted)]">{log.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className={`w-fit px-2 py-0.5 rounded-full text-[10px] font-medium ${ACTION_COLORS[log.action] || ACTION_COLORS.default}`}>
                        {log.action}
                      </span>
                      <span className="text-xs text-[color:var(--text)]">{describeAudit(log)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[color:var(--text-muted)]">{log.entity_type || "—"}</td>
                  <td className="px-4 py-3 text-xs text-[color:var(--text-muted)]">{log.ip_address || "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {(log.old_value || log.new_value || (log.metadata && Object.keys(log.metadata).length > 0)) && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[color:var(--border)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
                      >
                        {expandedId === log.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {expandedId === log.id ? "Hide" : "Details"}
                      </button>
                    )}
                  </td>
                </tr>
                {expandedId === log.id && (
                  <tr className="border-b border-[color:var(--border)] bg-[var(--surface-soft)]">
                    <td colSpan={6} className="px-5 py-4">
                      <AuditDetail log={log} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>

        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[color:var(--border)]">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-[color:var(--border)] rounded-lg text-[color:var(--text)] hover:bg-[var(--surface-soft)] disabled:opacity-40"
            >← Prev</button>
            <span className="text-sm text-[color:var(--text-muted)]">
              {startRow}–{endRow} of {total} · Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-[color:var(--border)] rounded-lg text-[color:var(--text)] hover:bg-[var(--surface-soft)] disabled:opacity-40"
            >Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── API Keys Tab ─────────────────────────────────────────────────────────────
function ApiKeysTab() {
  const api = useApi();
  const [keys, setKeys] = useState([]);
  const [form, setForm] = useState({ name: "", scopes: ["read:tasks","write:tasks"] });
  const [newKey, setNewKey] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { api.get("/api-keys").then(r => setKeys(r.data || [])).catch(() => {}); }, []);

  const create = async () => {
    if (!form.name) return toast.error("Name is required");
    setCreating(true);
    try {
      const r = await api.post("/api-keys", form);
      setNewKey(r.data.key);
      setKeys(prev => [r.data, ...prev]);
      setForm({ name: "", scopes: ["read:tasks","write:tasks"] });
      toast.success("API key created");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setCreating(false);
  };

  const del = async (id) => {
    if (!confirm("Delete this API key? This cannot be undone.")) return;
    await api.delete(`/api-keys/${id}`).catch(() => {});
    setKeys(prev => prev.filter(k => k.id !== id));
    toast.success("Key deleted");
  };

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success("Copied!"); };

  return (
    <div className="space-y-6">
      {newKey && (
        <div className="p-4 border border-[color:var(--score-good)] rounded-lg">
          <p className="text-sm font-semibold text-[color:var(--score-good)] mb-2">API key created — save it now, it won't be shown again!</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-[var(--surface)] px-3 py-2 rounded border border-[color:var(--border)] font-mono break-all text-[color:var(--text)]">
              {showKey ? newKey : "•".repeat(newKey.length)}
            </code>
            <button onClick={() => setShowKey(s => !s)} className="p-2 text-[color:var(--text-muted)] hover:text-[color:var(--text)]">
              <Eye className="w-4 h-4" />
            </button>
            <button onClick={() => copy(newKey)} className="p-2 text-[color:var(--text-muted)] hover:text-[color:var(--text)]">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="border border-[color:var(--border)] rounded-lg p-5">
        <h3 className="font-medium text-[color:var(--text)] mb-3">Create New API Key</h3>
        <div className="flex gap-3 flex-wrap">
          <input
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Key name (e.g. CI/CD Pipeline)"
            className="flex-1 min-w-48 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]"
          />
          <button onClick={create} disabled={creating} className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Create Key
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {keys.map(k => (
          <div key={k.id} className="flex items-center gap-3 border border-[color:var(--border)] rounded-lg px-4 py-3 hover:bg-[var(--surface-soft)]">
            <div className="flex-1">
              <p className="text-sm font-medium text-[color:var(--text)]">{k.name}</p>
              <p className="text-xs text-[color:var(--text-muted)] font-mono">{k.key_prefix}••••••••</p>
            </div>
            <div className="flex gap-1 flex-wrap">
              {(k.scopes || []).slice(0, 3).map(s => (
                <span key={s} className="text-xs px-2 py-0.5 bg-[var(--primary)]/10 text-[color:var(--primary)] rounded-full">{s}</span>
              ))}
            </div>
            <span className={`text-xs font-medium ${k.is_active ? "text-[color:var(--score-good)]" : "text-[color:var(--text-muted)]"}`}>
              {k.is_active ? "Active" : "Inactive"}
            </span>
            {k.last_used_at && <span className="text-xs text-[color:var(--text-muted)] hidden sm:block">Used {new Date(k.last_used_at).toLocaleDateString()}</span>}
            <button onClick={() => del(k.id)} className="p-1.5 text-[color:var(--score-danger)] hover:bg-[var(--surface-soft)] rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {keys.length === 0 && <p className="text-center py-8 text-[color:var(--text-muted)] text-sm">No API keys yet. Create one above.</p>}
      </div>
    </div>
  );
}

// ─── Webhooks Tab ─────────────────────────────────────────────────────────────
function WebhooksTab() {
  const api = useApi();
  const [hooks, setHooks] = useState([]);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ name: "", url: "", secret: "", events: [] });
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [deliveries, setDeliveries] = useState({});

  useEffect(() => {
    api.get("/webhooks").then(r => setHooks(r.data || [])).catch(() => {});
    api.get("/webhooks/events/list").then(r => setEvents(r.data || [])).catch(() => {});
  }, []);

  const create = async () => {
    if (!form.name || !form.url) return toast.error("Name and URL required");
    setCreating(true);
    try {
      const r = await api.post("/webhooks", form);
      setHooks(prev => [r.data, ...prev]);
      setForm({ name: "", url: "", secret: "", events: [] });
      toast.success("Webhook created");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setCreating(false);
  };

  const del = async (id) => {
    if (!confirm("Delete this webhook?")) return;
    await api.delete(`/webhooks/${id}`).catch(() => {});
    setHooks(prev => prev.filter(h => h.id !== id));
  };

  const testHook = async (id) => {
    try {
      await api.post(`/webhooks/${id}/test`);
      toast.success("Test ping sent");
    } catch { toast.error("Failed to send test"); }
  };

  const loadDeliveries = async (id) => {
    if (deliveries[id]) return;
    const r = await api.get(`/webhooks/${id}/deliveries`).catch(() => ({ data: [] }));
    setDeliveries(d => ({ ...d, [id]: r.data }));
  };

  const toggleEvent = (e) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(e) ? f.events.filter(x => x !== e) : [...f.events, e],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="border border-[color:var(--border)] rounded-lg p-5 space-y-3">
        <h3 className="font-medium text-[color:var(--text)]">Create Webhook</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name"
            className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]" />
          <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://your-endpoint.com/hook"
            className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]" />
          <input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} placeholder="Secret (optional)"
            className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]" />
        </div>
        <div>
          <p className="text-xs font-medium text-[color:var(--text-muted)] mb-2">Events to subscribe to:</p>
          <div className="flex flex-wrap gap-2">
            {events.map(e => (
              <button
                key={e} onClick={() => toggleEvent(e)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${form.events.includes(e) ? "bg-[var(--primary)] text-white border-[color:var(--primary)]" : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"}`}
              >{e}</button>
            ))}
          </div>
        </div>
        <button onClick={create} disabled={creating} className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Create Webhook
        </button>
      </div>

      <div className="space-y-3">
        {hooks.map(hook => (
          <div key={hook.id} className="border border-[color:var(--border)] rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-soft)]">
              <div className="flex-1">
                <p className="text-sm font-medium text-[color:var(--text)]">{hook.name}</p>
                <p className="text-xs text-[color:var(--text-muted)] font-mono truncate max-w-xs">{hook.url}</p>
              </div>
              <span className={`text-xs font-medium ${hook.is_active ? "text-[color:var(--score-good)]" : "text-[color:var(--text-muted)]"}`}>
                {hook.is_active ? "Active" : "Paused"}
              </span>
              {hook.failure_count > 0 && (
                <span className="text-xs text-[color:var(--score-danger)] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />{hook.failure_count} fails
                </span>
              )}
              <button onClick={() => testHook(hook.id)}
                className="text-xs px-2 py-1 border border-[color:var(--border)] rounded hover:bg-[var(--surface-soft)] text-[color:var(--text)]">
                Test
              </button>
              <button
                onClick={() => { setExpanded(e => e === hook.id ? null : hook.id); loadDeliveries(hook.id); }}
                className="p-1 text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
              >{expanded === hook.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
              <button onClick={() => del(hook.id)} className="p-1.5 text-[color:var(--score-danger)] hover:bg-[var(--surface-soft)] rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {expanded === hook.id && (
              <div className="border-t border-[color:var(--border)] px-4 py-3">
                <p className="text-xs font-medium text-[color:var(--text-muted)] mb-2">Events: {(hook.events || []).join(", ") || "None"}</p>
                <p className="text-xs font-medium text-[color:var(--text)] mb-2">Recent Deliveries</p>
                {(deliveries[hook.id] || []).slice(0, 5).map(d => (
                  <div key={d.id} className="flex items-center gap-3 py-1.5 text-xs border-b border-[color:var(--border)] last:border-0">
                    {d.success
                      ? <CheckCircle className="w-3.5 h-3.5 text-[color:var(--score-good)]" />
                      : <XCircle className="w-3.5 h-3.5 text-[color:var(--score-danger)]" />}
                    <span className="text-[color:var(--text-muted)] w-20">{d.event}</span>
                    <span className="text-[color:var(--text-muted)]">{d.response_status || "—"}</span>
                    <span className="text-[color:var(--text-muted)] ml-auto">{d.duration_ms}ms</span>
                    <span className="text-[color:var(--text-muted)]">{new Date(d.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
                {!deliveries[hook.id]?.length && <p className="text-xs text-[color:var(--text-muted)]">No deliveries yet.</p>}
              </div>
            )}
          </div>
        ))}
        {hooks.length === 0 && <p className="text-center py-8 text-[color:var(--text-muted)] text-sm">No webhooks configured.</p>}
      </div>
    </div>
  );
}
