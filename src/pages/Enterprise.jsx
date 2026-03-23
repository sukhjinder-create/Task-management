// src/pages/Enterprise.jsx
// Enterprise Settings: MFA, SSO, Audit Logs, API Keys, Webhooks
import { useState, useEffect } from "react";
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
        <p className="theme-text-muted">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold theme-text flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-500" /> Enterprise Settings
        </h1>
        <p className="theme-text-muted text-sm mt-1">Security, compliance, and integration settings for your workspace.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b theme-border mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              tab === id
                ? "border-b-2 border-indigo-500 text-indigo-600 -mb-px"
                : "theme-text-muted hover:theme-text"
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
      <div className="theme-surface-card rounded-xl p-6 border theme-border">
        <h2 className="font-semibold theme-text mb-1">Two-Factor Authentication</h2>
        <p className="theme-text-muted text-sm mb-4">Add an extra layer of security to your account using an authenticator app.</p>

        {status?.mfa_enabled ? (
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-600 font-medium">MFA is enabled</span>
            <button onClick={disable} className="ml-auto px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50">
              Disable
            </button>
          </div>
        ) : qr ? (
          <div className="space-y-4">
            <p className="text-sm theme-text-muted">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code below.</p>
            <img src={qr} alt="QR Code" className="w-48 h-48 border rounded-lg" />
            <div className="flex gap-2 max-w-xs">
              <input
                value={code} onChange={e => setCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                className="flex-1 px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text"
              />
              <button onClick={confirmSetup} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                Verify
              </button>
            </div>
          </div>
        ) : (
          <button onClick={startSetup} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            Enable MFA
          </button>
        )}

        {backupCodes.length > 0 && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ Save your backup codes — they won't be shown again</p>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map(c => (
                <code key={c} className="text-xs bg-white px-2 py-1 rounded border border-amber-200 font-mono">{c}</code>
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
    <div className="theme-surface-card rounded-xl p-6 border theme-border space-y-4">
      <h2 className="font-semibold theme-text">SAML SSO Configuration</h2>
      <p className="text-sm theme-text-muted">Connect your Identity Provider (IdP) so team members can sign in using your company's SSO.</p>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="w-4 h-4 rounded" />
        <span className="text-sm theme-text font-medium">Enable SSO for this workspace</span>
      </label>

      {[
        { key: "entry_point", label: "IdP SSO URL (Entry Point)", placeholder: "https://idp.example.com/sso/saml" },
        { key: "issuer", label: "SP Entity ID / Issuer", placeholder: "https://yourapp.com/auth/saml" },
        { key: "sp_callback_url", label: "ACS URL (Callback)", placeholder: "https://yourapp.com/auth/sso/saml/callback" },
        { key: "attribute_email", label: "Email Attribute Name", placeholder: "email" },
        { key: "attribute_name", label: "Name Attribute Name", placeholder: "displayName" },
      ].map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="block text-sm font-medium theme-text mb-1">{label}</label>
          <input
            value={form[key] || ""}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            placeholder={placeholder}
            className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text"
          />
        </div>
      ))}

      <div>
        <label className="block text-sm font-medium theme-text mb-1">IdP Certificate (PEM)</label>
        <textarea
          value={form.cert || ""}
          onChange={e => setForm(f => ({ ...f, cert: e.target.value }))}
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
          rows={4}
          className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text font-mono"
        />
        {config?.cert_snippet && <p className="text-xs theme-text-muted mt-1">Current: {config.cert_snippet}</p>}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.force_sso || false} onChange={e => setForm(f => ({ ...f, force_sso: e.target.checked }))} className="w-4 h-4 rounded" />
        <span className="text-sm theme-text">Force SSO (disable password login)</span>
      </label>

      <button onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
        {saving ? "Saving…" : "Save SSO Config"}
      </button>
    </div>
  );
}

// ─── Audit Logs Tab ───────────────────────────────────────────────────────────
function AuditTab() {
  const api = useApi();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ action: "", entityType: "", limit: 50, offset: 0 });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const r = await api.get(`/audit?${params}`);
      setLogs(r.data.logs || []);
      setTotal(r.data.total || 0);
    } catch { toast.error("Failed to load audit logs"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters.offset]);

  const ACTION_COLORS = {
    "user.login": "bg-blue-100 text-blue-700",
    "user.mfa.enabled": "bg-green-100 text-green-700",
    "task.create": "bg-indigo-100 text-indigo-700",
    "gdpr.erasure_request": "bg-red-100 text-red-700",
    default: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <input
          value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value, offset: 0 }))}
          placeholder="Filter by action…"
          className="px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text w-48"
        />
        <select
          value={filters.entityType} onChange={e => setFilters(f => ({ ...f, entityType: e.target.value, offset: 0 }))}
          className="px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text"
        >
          <option value="">All entities</option>
          {["user","task","project","wiki_page","leave_request","review","api_key","webhook"].map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <button onClick={load} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-1">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        <span className="text-sm theme-text-muted self-center">{total} total entries</span>
      </div>

      <div className="theme-surface-card rounded-xl border theme-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-soft)] border-b theme-border">
            <tr>
              {["Time","User","Action","Entity","IP"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold theme-text-muted uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 theme-text-muted">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 theme-text-muted">No audit logs found</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className="border-b theme-border hover:bg-[var(--surface-soft)]">
                <td className="px-4 py-3 text-xs theme-text-muted whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-xs theme-text">{log.username || log.user_id?.slice(0,8) || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || ACTION_COLORS.default}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs theme-text-muted">{log.entity_type && `${log.entity_type}:${log.entity_id?.slice(0,8)}`}</td>
                <td className="px-4 py-3 text-xs theme-text-muted">{log.ip_address || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {total > filters.limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t theme-border">
            <button
              onClick={() => setFilters(f => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
              disabled={filters.offset === 0}
              className="px-3 py-1.5 text-sm border theme-border rounded-lg disabled:opacity-40"
            >← Prev</button>
            <span className="text-sm theme-text-muted">{filters.offset + 1}–{Math.min(filters.offset + filters.limit, total)} of {total}</span>
            <button
              onClick={() => setFilters(f => ({ ...f, offset: f.offset + f.limit }))}
              disabled={filters.offset + filters.limit >= total}
              className="px-3 py-1.5 text-sm border theme-border rounded-lg disabled:opacity-40"
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
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm font-semibold text-green-800 mb-2">✓ API key created — save it now, it won't be shown again!</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white px-3 py-2 rounded border border-green-200 font-mono break-all">
              {showKey ? newKey : "•".repeat(newKey.length)}
            </code>
            <button onClick={() => setShowKey(s => !s)} className="p-2 text-green-700"><Eye className="w-4 h-4" /></button>
            <button onClick={() => copy(newKey)} className="p-2 text-green-700"><Copy className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <div className="theme-surface-card rounded-xl p-5 border theme-border">
        <h3 className="font-medium theme-text mb-3">Create New API Key</h3>
        <div className="flex gap-3 flex-wrap">
          <input
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Key name (e.g. CI/CD Pipeline)"
            className="flex-1 min-w-48 px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text"
          />
          <button onClick={create} disabled={creating} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1">
            <Plus className="w-4 h-4" /> Create Key
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {keys.map(k => (
          <div key={k.id} className="flex items-center gap-3 theme-surface-card rounded-xl px-4 py-3 border theme-border">
            <div className="flex-1">
              <p className="text-sm font-medium theme-text">{k.name}</p>
              <p className="text-xs theme-text-muted font-mono">{k.key_prefix}••••••••</p>
            </div>
            <div className="flex gap-1 flex-wrap">
              {(k.scopes || []).slice(0, 3).map(s => (
                <span key={s} className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{s}</span>
              ))}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${k.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {k.is_active ? "Active" : "Inactive"}
            </span>
            {k.last_used_at && <span className="text-xs theme-text-muted hidden sm:block">Used {new Date(k.last_used_at).toLocaleDateString()}</span>}
            <button onClick={() => del(k.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {keys.length === 0 && <p className="text-center py-8 theme-text-muted text-sm">No API keys yet. Create one above.</p>}
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
      <div className="theme-surface-card rounded-xl p-5 border theme-border space-y-3">
        <h3 className="font-medium theme-text">Create Webhook</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" className="px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
          <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://your-endpoint.com/hook" className="px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
          <input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} placeholder="Secret (optional)" className="px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
        </div>
        <div>
          <p className="text-xs font-medium theme-text-muted mb-2">Events to subscribe to:</p>
          <div className="flex flex-wrap gap-2">
            {events.map(e => (
              <button
                key={e} onClick={() => toggleEvent(e)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${form.events.includes(e) ? "bg-indigo-600 text-white border-indigo-600" : "theme-border theme-text-muted hover:border-indigo-400"}`}
              >{e}</button>
            ))}
          </div>
        </div>
        <button onClick={create} disabled={creating} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Create Webhook
        </button>
      </div>

      <div className="space-y-3">
        {hooks.map(hook => (
          <div key={hook.id} className="theme-surface-card rounded-xl border theme-border overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium theme-text">{hook.name}</p>
                <p className="text-xs theme-text-muted font-mono truncate max-w-xs">{hook.url}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${hook.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {hook.is_active ? "Active" : "Paused"}
              </span>
              {hook.failure_count > 0 && (
                <span className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{hook.failure_count} fails</span>
              )}
              <button onClick={() => testHook(hook.id)} className="text-xs px-2 py-1 border theme-border rounded hover:bg-[var(--surface-soft)] theme-text">Test</button>
              <button
                onClick={() => { setExpanded(e => e === hook.id ? null : hook.id); loadDeliveries(hook.id); }}
                className="p-1 theme-text-muted"
              >{expanded === hook.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
              <button onClick={() => del(hook.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>

            {expanded === hook.id && (
              <div className="border-t theme-border px-4 py-3">
                <p className="text-xs font-medium theme-text-muted mb-2">Events: {(hook.events || []).join(", ") || "None"}</p>
                <p className="text-xs font-medium theme-text mb-2">Recent Deliveries</p>
                {(deliveries[hook.id] || []).slice(0, 5).map(d => (
                  <div key={d.id} className="flex items-center gap-3 py-1.5 text-xs border-b theme-border last:border-0">
                    {d.success ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                    <span className="theme-text-muted w-20">{d.event}</span>
                    <span className="theme-text-muted">{d.response_status || "—"}</span>
                    <span className="theme-text-muted ml-auto">{d.duration_ms}ms</span>
                    <span className="theme-text-muted">{new Date(d.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
                {!deliveries[hook.id]?.length && <p className="text-xs theme-text-muted">No deliveries yet.</p>}
              </div>
            )}
          </div>
        ))}
        {hooks.length === 0 && <p className="text-center py-8 theme-text-muted text-sm">No webhooks configured.</p>}
      </div>
    </div>
  );
}
