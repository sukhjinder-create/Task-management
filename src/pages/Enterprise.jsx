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
  { id: "sso",     label: "Identity",      icon: Globe },
  { id: "security",label: "Security",      icon: Shield },
  { id: "privacy", label: "Privacy",       icon: Shield },
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
      <div className="flex gap-1 overflow-x-auto border-b border-[color:var(--border)] mb-6">
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
      {tab === "security" && <SecurityTab />}
      {tab === "privacy"  && <PrivacyTab />}
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
  const [form, setForm] = useState({ enabled: false, provider: "saml", entry_point: "", issuer: "", cert: "", force_sso: false, jit_enabled: true, allowed_domains: "", oidc_scopes: "openid email profile" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/auth/sso/config").then(r => {
      setConfig(r.data);
      setForm(f => ({
        ...f,
        ...r.data,
        allowed_domains: (r.data.allowed_domains || []).join(", "),
        oidc_scopes: (r.data.oidc_scopes || ["openid", "email", "profile"]).join(" "),
      }));
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        allowed_domains: String(form.allowed_domains || "").split(",").map(value => value.trim()).filter(Boolean),
        oidc_scopes: String(form.oidc_scopes || "").split(/\s+/).filter(Boolean),
      };
      const r = await api.put("/auth/sso/config", payload);
      setConfig(r.data);
      toast.success("SSO configuration saved");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setSaving(false);
  };

  return (
    <div className="border border-[color:var(--border)] rounded-lg p-6 space-y-4">
      <h2 className="font-semibold text-[color:var(--text)]">Enterprise identity</h2>
      <p className="text-sm text-[color:var(--text-muted)]">Connect your identity provider with SAML or OpenID Connect. Existing sign-in stays available until you enforce SSO.</p>

      <div>
        <label className="block text-sm font-medium text-[color:var(--text)] mb-1">Protocol</label>
        <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]">
          <option value="saml">SAML 2.0</option>
          <option value="oidc">OpenID Connect</option>
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="w-4 h-4 rounded" />
        <span className="text-sm text-[color:var(--text)] font-medium">Enable SSO for this workspace</span>
      </label>

      {form.provider === "saml" && [
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

      {form.provider === "saml" && <div>
        <label className="block text-sm font-medium text-[color:var(--text)] mb-1">IdP Certificate (PEM)</label>
        <textarea
          value={form.cert || ""}
          onChange={e => setForm(f => ({ ...f, cert: e.target.value }))}
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] font-mono"
        />
        {config?.cert_snippet && <p className="text-xs text-[color:var(--text-muted)] mt-1">Current: {config.cert_snippet}</p>}
      </div>}

      {form.provider === "oidc" && [
        { key: "oidc_issuer_url", label: "Issuer URL", placeholder: "https://login.example.com" },
        { key: "oidc_client_id", label: "Client ID", placeholder: "asystence-production" },
        { key: "oidc_client_secret", label: "Client secret", placeholder: config?.oidc_client_secret_configured ? "Configured — leave blank to keep it" : "Client secret" },
        { key: "sp_callback_url", label: "Callback URL", placeholder: "https://api.example.com/auth/sso/oidc/callback" },
        { key: "oidc_scopes", label: "Scopes", placeholder: "openid email profile" },
      ].map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-[color:var(--text)] mb-1">{label}</label>
          <input type={key === "oidc_client_secret" ? "password" : "text"} value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]" />
        </div>
      ))}

      <div>
        <label className="block text-sm font-medium text-[color:var(--text)] mb-1">Allowed email domains</label>
        <input value={form.allowed_domains || ""} onChange={e => setForm(f => ({ ...f, allowed_domains: e.target.value }))} placeholder="example.com, subsidiary.com" className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]" />
        <p className="mt-1 text-xs text-[color:var(--text-muted)]">Optional. Separate domains with commas.</p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.jit_enabled !== false} onChange={e => setForm(f => ({ ...f, jit_enabled: e.target.checked }))} className="w-4 h-4 rounded" />
        <span className="text-sm text-[color:var(--text)]">Create users on first approved SSO sign-in</span>
      </label>

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

function SecurityTab() {
  const api = useApi();
  const [policy, setPolicy] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [domains, setDomains] = useState([]);
  const [domain, setDomain] = useState("");
  const [dnsRecord, setDnsRecord] = useState(null);
  const [scimTokens, setScimTokens] = useState([]);
  const [serviceAccounts, setServiceAccounts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [roleForm, setRoleForm] = useState({ name: "", base_role: "user", permissions: ["read:tasks"] });
  const [credentials, setCredentials] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiSafety, setAiSafety] = useState(null);

  const load = async () => {
    try {
      const [policyRes, sessionsRes, domainsRes, scimRes, accountsRes, rolesRes, permissionsRes, usersRes] = await Promise.all([
        api.get("/enterprise-security/policy"), api.get("/enterprise-security/sessions"),
        api.get("/enterprise-security/domains"), api.get("/enterprise-security/scim-tokens"),
        api.get("/enterprise-security/service-accounts"),
        api.get("/enterprise-security/roles"), api.get("/enterprise-security/permissions"), api.get("/users"),
      ]);
      setPolicy({ ...policyRes.data, allowed_ip_cidrs: (policyRes.data.allowed_ip_cidrs || []).join("\n") });
      setSessions(sessionsRes.data || []);
      setDomains(domainsRes.data || []);
      setScimTokens(scimRes.data || []);
      setServiceAccounts(accountsRes.data?.serviceAccounts || []);
      setRoles(rolesRes.data || []);
      setPermissions(permissionsRes.data || []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.users || []);
    } catch (error) { toast.error(error.response?.data?.error || "Could not load security settings"); }
  };

  useEffect(() => {
    load();
    api.get("/ai-studio/safety").then(response => setAiSafety(response.data)).catch(() => {});
  }, []);

  const savePolicy = async () => {
    setSaving(true);
    try {
      const payload = { ...policy, allowed_ip_cidrs: String(policy.allowed_ip_cidrs || "").split(/[\n,]/).map(value => value.trim()).filter(Boolean) };
      const response = await api.put("/enterprise-security/policy", payload);
      setPolicy({ ...response.data, allowed_ip_cidrs: (response.data.allowed_ip_cidrs || []).join("\n") });
      toast.success("Security policy saved");
    } catch (error) { toast.error(error.response?.data?.error || "Could not save policy"); }
    setSaving(false);
  };

  const addDomain = async () => {
    if (!domain.trim()) return;
    try {
      const response = await api.post("/enterprise-security/domains", { domain });
      setDomains(current => [response.data, ...current.filter(item => item.id !== response.data.id)]);
      setDnsRecord(response.data.dns_record);
      setDomain("");
    } catch (error) { toast.error(error.response?.data?.error || "Could not add domain"); }
  };

  const verifyDomain = async (id) => {
    try {
      const response = await api.post(`/enterprise-security/domains/${id}/verify`);
      setDomains(current => current.map(item => item.id === id ? { ...item, ...response.data } : item));
      toast.success("Domain verified");
    } catch (error) { toast.error(error.response?.data?.error || "TXT record was not found"); }
  };

  const createCredential = async (kind) => {
    if (!name.trim()) return toast.error("Name is required");
    try {
      const response = kind === "scim"
        ? await api.post("/enterprise-security/scim-tokens", { name })
        : await api.post("/enterprise-security/service-accounts", { name, scopes: ["read:tasks", "write:tasks"] });
      setCredentials({ kind, ...response.data });
      setName("");
      await load();
    } catch (error) { toast.error(error.response?.data?.error || "Could not create credential"); }
  };

  const revoke = async (resource, id) => {
    try {
      await api.delete(`/enterprise-security/${resource}/${id}`);
      await load();
      toast.success("Access revoked");
    } catch (error) { toast.error(error.response?.data?.error || "Could not revoke access"); }
  };

  const createRole = async () => {
    if (!roleForm.name.trim()) return toast.error("Role name is required");
    try {
      await api.post("/enterprise-security/roles", roleForm);
      setRoleForm({ name: "", base_role: "user", permissions: ["read:tasks"] });
      await load();
      toast.success("Custom role created");
    } catch (error) { toast.error(error.response?.data?.error || "Could not create role"); }
  };

  const saveAiSafety = async () => {
    try {
      const response = await api.put("/ai-studio/safety", aiSafety);
      setAiSafety(response.data);
      toast.success("AI safety policy saved");
    } catch (error) { toast.error(error.response?.data?.error || "Could not save AI safety policy"); }
  };

  const assignRole = async (roleId, userId) => {
    if (!userId) return;
    try {
      await api.put(`/enterprise-security/roles/${roleId}/members/${userId}`);
      await load();
      toast.success("Role assigned");
    } catch (error) { toast.error(error.response?.data?.error || "Could not assign role"); }
  };

  if (!policy) return <p className="text-sm text-[color:var(--text-muted)]">Loading security settings…</p>;

  return (
    <div className="space-y-6">
      <section className="border border-[color:var(--border)] rounded-lg p-5 space-y-4">
        <div><h2 className="font-semibold text-[color:var(--text)]">Workspace security policy</h2><p className="text-sm text-[color:var(--text-muted)]">Defaults stay user-friendly. Turn on stronger controls when your organization is ready.</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[["session_max_age_minutes", "Maximum session (minutes)"], ["idle_timeout_minutes", "Idle timeout (minutes)"], ["api_key_max_age_days", "Credential lifetime (days)"], ["audit_retention_days", "Audit retention (days)"], ["data_retention_days", "Data retention (days, optional)"]].map(([key, label]) => (
            <label key={key} className="text-sm text-[color:var(--text)]">{label}<input type="number" min="1" value={policy[key] ?? ""} onChange={event => setPolicy(current => ({ ...current, [key]: event.target.value === "" ? null : Number(event.target.value) }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)]" /></label>
          ))}
        </div>
        <label className="block text-sm text-[color:var(--text)]">Allowed IP ranges (one CIDR per line)<textarea value={policy.allowed_ip_cidrs || ""} onChange={event => setPolicy(current => ({ ...current, allowed_ip_cidrs: event.target.value }))} rows={3} placeholder="203.0.113.0/24" className="mt-1 w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] font-mono text-xs" /></label>
        <div className="flex flex-wrap gap-4">
          {[["require_mfa", "Require MFA"], ["enforce_sso", "Require SSO"], ["guest_access_enabled", "Allow guest access"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm text-[color:var(--text)]"><input type="checkbox" checked={Boolean(policy[key])} onChange={event => setPolicy(current => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}
        </div>
        <button onClick={savePolicy} disabled={saving} className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium disabled:opacity-60">{saving ? "Saving…" : "Save policy"}</button>
      </section>

      {aiSafety && <section className="border border-[color:var(--border)] rounded-lg p-5 space-y-3"><div><h2 className="font-semibold text-[color:var(--text)]">AI data safety</h2><p className="text-sm text-[color:var(--text-muted)]">Apply workspace-wide protection without changing how people ask for help.</p></div><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm text-[color:var(--text)]">Enforcement<select value={aiSafety.enforcementMode} onChange={event => setAiSafety(current => ({ ...current, enforcementMode: event.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)]"><option value="off">Off</option><option value="variables">Protect variables</option><option value="strict">Strict</option></select></label><label className="text-sm text-[color:var(--text)]">PII redaction<select value={aiSafety.piiRedaction} onChange={event => setAiSafety(current => ({ ...current, piiRedaction: event.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)]"><option value="off">Off</option><option value="input">Inputs</option><option value="output">Outputs</option><option value="both">Inputs and outputs</option></select></label><label className="text-sm text-[color:var(--text)]">Structured output<select value={aiSafety.outputSchemaMode} onChange={event => setAiSafety(current => ({ ...current, outputSchemaMode: event.target.value }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)]"><option value="advisory">Advisory</option><option value="enforce">Enforce schemas</option></select></label></div><button onClick={saveAiSafety} className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm">Save AI safety</button></section>}

      <section className="border border-[color:var(--border)] rounded-lg p-5 space-y-3">
        <h2 className="font-semibold text-[color:var(--text)]">Verified domains</h2>
        <div className="flex gap-2"><input value={domain} onChange={event => setDomain(event.target.value)} placeholder="example.com" className="flex-1 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm" /><button onClick={addDomain} className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm">Add</button></div>
        {dnsRecord && <div className="rounded-lg bg-[var(--surface-soft)] p-3 text-xs text-[color:var(--text)]"><p>Add this DNS record, then verify:</p><code className="break-all">{dnsRecord.type} {dnsRecord.name} {dnsRecord.value}</code></div>}
        {domains.map(item => <div key={item.id} className="flex items-center gap-3 py-2 border-t border-[color:var(--border)] text-sm"><span className="flex-1 text-[color:var(--text)]">{item.domain}</span><span className={item.status === "verified" ? "text-[color:var(--score-good)]" : "text-[color:var(--text-muted)]"}>{item.status}</span>{item.status !== "verified" && <button onClick={() => verifyDomain(item.id)} className="text-[color:var(--primary)]">Verify</button>}<button onClick={() => revoke("domains", item.id)} aria-label={`Remove ${item.domain}`} className="text-[color:var(--score-danger)]"><Trash2 className="w-4 h-4" /></button></div>)}
      </section>

      <section className="border border-[color:var(--border)] rounded-lg p-5 space-y-3">
        <h2 className="font-semibold text-[color:var(--text)]">Provisioning and machine access</h2>
        <p className="text-sm text-[color:var(--text-muted)]">Use SCIM for your directory, or OAuth client credentials for server-to-server integrations.</p>
        {credentials && <div className="rounded-lg border border-[color:var(--score-good)] p-3 text-sm text-[color:var(--text)]"><p className="font-medium">Copy now — this secret will not be shown again.</p><code className="block mt-2 break-all text-xs">{credentials.token || `${credentials.client_id}:${credentials.client_secret}`}</code><button onClick={() => navigator.clipboard.writeText(credentials.token || `${credentials.client_id}:${credentials.client_secret}`)} className="mt-2 text-[color:var(--primary)]">Copy credential</button></div>}
        <div className="flex flex-wrap gap-2"><input value={name} onChange={event => setName(event.target.value)} placeholder="Credential name" className="flex-1 min-w-48 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm" /><button onClick={() => createCredential("scim")} className="px-3 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)]">Create SCIM token</button><button onClick={() => createCredential("oauth")} className="px-3 py-2 bg-[var(--primary)] text-white rounded-lg text-sm">Create service account</button></div>
        {[...scimTokens.map(item => ({ ...item, kind: "SCIM", resource: "scim-tokens" })), ...serviceAccounts.map(item => ({ ...item, kind: "OAuth", resource: "service-accounts" }))].map(item => <div key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-2 border-t border-[color:var(--border)] text-sm"><span className="rounded bg-[var(--surface-soft)] px-2 py-0.5 text-xs text-[color:var(--text-muted)]">{item.kind}</span><span className="flex-1 text-[color:var(--text)]">{item.name}</span><code className="hidden sm:block text-xs text-[color:var(--text-muted)]">{item.token_prefix || item.client_id}</code><button onClick={() => revoke(item.resource, item.id)} className="text-[color:var(--score-danger)]">Revoke</button></div>)}
      </section>

      <details className="border border-[color:var(--border)] rounded-lg p-5">
        <summary className="cursor-pointer font-semibold text-[color:var(--text)]">Custom roles</summary>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">Start from a familiar base role, then grant only the capabilities this team needs.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={roleForm.name} onChange={event => setRoleForm(current => ({ ...current, name: event.target.value }))} placeholder="Role name" className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm" /><select value={roleForm.base_role} onChange={event => setRoleForm(current => ({ ...current, base_role: event.target.value }))} className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm"><option value="user">User</option><option value="manager">Manager</option><option value="admin">Admin</option></select></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{permissions.map(permission => <label key={permission} className="flex items-center gap-2 text-xs text-[color:var(--text-muted)]"><input type="checkbox" checked={roleForm.permissions.includes(permission)} onChange={event => setRoleForm(current => ({ ...current, permissions: event.target.checked ? [...current.permissions, permission] : current.permissions.filter(item => item !== permission) }))} />{permission}</label>)}</div>
        <button onClick={createRole} className="mt-3 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm">Create role</button>
        <div className="mt-4 space-y-2">{roles.map(role => <div key={role.id} className="flex flex-wrap items-center gap-2 border-t border-[color:var(--border)] pt-3 text-sm"><div className="min-w-40 flex-1"><p className="font-medium text-[color:var(--text)]">{role.name}</p><p className="text-xs text-[color:var(--text-muted)]">{role.base_role} · {role.member_count} member(s)</p></div><select aria-label={`Assign ${role.name}`} defaultValue="" onChange={event => { assignRole(role.id, event.target.value); event.target.value = ""; }} className="px-2 py-1.5 rounded border border-[color:var(--border)] bg-[var(--surface)] text-xs"><option value="">Assign member…</option>{users.filter(user => !["owner", "system"].includes(user.role)).map(user => <option key={user.id} value={user.id}>{user.username || user.email}</option>)}</select><button onClick={() => revoke("roles", role.id)} aria-label={`Delete ${role.name}`} className="text-[color:var(--score-danger)]"><Trash2 className="w-4 h-4" /></button></div>)}</div>
      </details>

      <section className="border border-[color:var(--border)] rounded-lg p-5 space-y-2">
        <h2 className="font-semibold text-[color:var(--text)]">Active sessions</h2>
        {sessions.map(session => <div key={session.id} className="flex items-center gap-3 py-2 border-t border-[color:var(--border)] text-sm"><div className="flex-1"><p className="text-[color:var(--text)]">{session.username || session.email}</p><p className="text-xs text-[color:var(--text-muted)]">{session.ip_address || "Unknown IP"} · {new Date(session.last_seen_at || session.created_at).toLocaleString()}</p></div><button onClick={() => revoke("sessions", session.id)} className="text-[color:var(--score-danger)]">Revoke</button></div>)}
        {!sessions.length && <p className="text-sm text-[color:var(--text-muted)]">No active sessions.</p>}
      </section>
    </div>
  );
}

function PrivacyTab() {
  const api = useApi();
  const [requests, setRequests] = useState([]);
  const [holds, setHolds] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ user_id: "", reason: "", reference: "" });

  const load = async () => {
    try {
      const [requestResponse, holdResponse, userResponse] = await Promise.all([api.get("/gdpr/erasure-requests"), api.get("/gdpr/legal-holds"), api.get("/users")]);
      setRequests(requestResponse.data || []);
      setHolds(holdResponse.data || []);
      setUsers(Array.isArray(userResponse.data) ? userResponse.data : userResponse.data?.users || []);
    } catch (error) { toast.error(error.response?.data?.error || "Could not load privacy requests"); }
  };
  useEffect(() => { load(); }, []);

  const processRequest = async (id, status) => {
    if (status === "completed" && !window.confirm("Execute irreversible account anonymization? Records required for audit and legal obligations will be retained.")) return;
    try {
      await api.patch(`/gdpr/erasure-requests/${id}`, { status, ...(status === "completed" ? { confirm: "ERASE" } : {}) });
      await load();
      toast.success(status === "completed" ? "Erasure completed" : "Request is being processed");
    } catch (error) { toast.error(error.response?.data?.error || "Could not process the request"); }
  };

  const addHold = async (event) => {
    event.preventDefault();
    try {
      await api.post("/gdpr/legal-holds", form);
      setForm({ user_id: "", reason: "", reference: "" });
      await load();
      toast.success("Legal hold applied");
    } catch (error) { toast.error(error.response?.data?.error || "Could not apply legal hold"); }
  };

  const releaseHold = async (id) => {
    try { await api.post(`/gdpr/legal-holds/${id}/release`); await load(); toast.success("Legal hold released"); }
    catch (error) { toast.error(error.response?.data?.error || "Could not release legal hold"); }
  };

  return <div className="space-y-6"><section className="border border-[color:var(--border)] rounded-lg p-5"><h2 className="font-semibold text-[color:var(--text)]">Erasure requests</h2><p className="mt-1 text-sm text-[color:var(--text-muted)]">Exports are self-service. Erasure stays reviewable and legal holds always win.</p><div className="mt-3 space-y-2">{requests.map(item => <div key={item.id} className="flex flex-wrap items-center gap-2 border-t border-[color:var(--border)] py-3 text-sm"><div className="min-w-48 flex-1"><p className="font-medium text-[color:var(--text)]">{item.username || item.email || item.user_id}</p><p className="text-xs text-[color:var(--text-muted)]">Requested {new Date(item.requested_at).toLocaleString()} · {item.status}</p></div>{item.status === "pending" && <button onClick={() => processRequest(item.id, "processing")} className="text-[color:var(--primary)]">Start review</button>}{["pending", "processing"].includes(item.status) && <button onClick={() => processRequest(item.id, "completed")} className="text-[color:var(--score-danger)]">Complete erasure</button>}</div>)}{!requests.length && <p className="mt-3 text-sm text-[color:var(--text-muted)]">No erasure requests.</p>}</div></section><section className="border border-[color:var(--border)] rounded-lg p-5"><h2 className="font-semibold text-[color:var(--text)]">Legal holds</h2><form onSubmit={addHold} className="mt-3 grid gap-2 sm:grid-cols-3"><select value={form.user_id} onChange={event => setForm(current => ({ ...current, user_id: event.target.value }))} className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm" required><option value="">Choose user</option>{users.map(user => <option key={user.id} value={user.id}>{user.username || user.email}</option>)}</select><input value={form.reason} onChange={event => setForm(current => ({ ...current, reason: event.target.value }))} placeholder="Reason" className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm" required /><input value={form.reference} onChange={event => setForm(current => ({ ...current, reference: event.target.value }))} placeholder="Case reference (optional)" className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm" /><button className="w-fit px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm">Apply hold</button></form><div className="mt-3 space-y-2">{holds.map(item => <div key={item.id} className="flex items-center gap-3 border-t border-[color:var(--border)] py-3 text-sm"><div className="flex-1"><p className="font-medium text-[color:var(--text)]">{item.username || item.email}</p><p className="text-xs text-[color:var(--text-muted)]">{item.reason}{item.reference ? ` · ${item.reference}` : ""}</p></div><span className="text-xs text-[color:var(--text-muted)]">{item.active ? "Active" : "Released"}</span>{item.active && <button onClick={() => releaseHold(item.id)} className="text-[color:var(--score-danger)]">Release</button>}</div>)}</div></section></div>;
}

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

  const verifyIntegrity = async () => {
    try {
      const response = await api.get("/audit/integrity");
      response.data.valid ? toast.success(`Audit chain verified (${response.data.checked || 0} entries)`) : toast.error("Audit chain verification failed");
    } catch (error) { toast.error(error.response?.data?.error || "Could not verify audit chain"); }
  };

  const exportLogs = async (format) => {
    try {
      const response = await api.get(`/audit/export?format=${format}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `asystence-audit.${format === "jsonl" ? "jsonl" : "csv"}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) { toast.error(error.response?.data?.error || "Could not export audit logs"); }
  };

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
        <button onClick={verifyIntegrity} className="px-3 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)]">Verify chain</button>
        <button onClick={() => exportLogs("csv")} className="px-3 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)]">Export CSV</button>
        <button onClick={() => exportLogs("jsonl")} className="px-3 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)]">Export JSONL</button>
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
  const [scopeOptions, setScopeOptions] = useState([]);
  const [form, setForm] = useState({ name: "", scopes: ["read:tasks","write:tasks"] });
  const [newKey, setNewKey] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/api-keys"), api.get("/api-keys/scopes")]).then(([keysResponse, scopesResponse]) => {
      setKeys(keysResponse.data || []);
      setScopeOptions(scopesResponse.data || []);
    }).catch(() => {});
  }, []);

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
        <div className="mt-3 flex flex-wrap gap-2">{scopeOptions.map(scope => <label key={scope} className="flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--text-muted)]"><input type="checkbox" checked={form.scopes.includes(scope)} onChange={event => setForm(current => ({ ...current, scopes: event.target.checked ? [...current.scopes, scope] : current.scopes.filter(item => item !== scope) }))} />{scope}</label>)}</div>
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
