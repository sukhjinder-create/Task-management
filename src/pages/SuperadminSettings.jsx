// src/pages/SuperadminSettings.jsx
import { useState } from "react";
import toast from "react-hot-toast";
import {
  Bell, Database, Lock, ChevronRight,
  Save, RefreshCw, Server, Globe,
} from "lucide-react";

// ── Small toggle component ────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        value ? "bg-indigo-500" : "bg-[var(--surface-soft)] border theme-border"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon, title, children }) {
  return (
    <div className="theme-surface border theme-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b theme-border">
        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-sm font-semibold theme-text">{title}</h2>
      </div>
      <div className="divide-y divide-[var(--border)]">{children}</div>
    </div>
  );
}

// ── Setting row ───────────────────────────────────────────────────────────────
function Row({ label, sub, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium theme-text">{label}</p>
        {sub && <p className="text-xs theme-text-muted mt-0.5">{sub}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ── Plan definitions ──────────────────────────────────────────────────────────
const PLANS = [
  { id: "basic",      label: "Basic",      members: 10,  price: "$0"  },
  { id: "pro",        label: "Pro",        members: 50,  price: "$29" },
  { id: "enterprise", label: "Enterprise", members: 200, price: "$99" },
];

export default function SuperadminSettings() {
  // UI-only toggles (no real backend yet — shows the intended UX)
  const [emailNotifs,   setEmailNotifs]   = useState(true);
  const [auditLog,      setAuditLog]      = useState(true);
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [maintenanceMode, setMaintenance] = useState(false);
  const [saving, setSaving]               = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      // Wire to backend when ready:
      // await api.post("/superadmin/settings", { emailNotifs, auditLog, ... });
      await new Promise(r => setTimeout(r, 600)); // fake save
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPasswords() {
    toast("Use the Workspaces page to reset individual user passwords.", { icon: "ℹ️" });
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold theme-text">Platform Settings</h1>
          <p className="text-xs theme-text-muted mt-0.5">Global configuration for Asystence</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors disabled:opacity-60"
        >
          {saving
            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            : <Save className="w-3.5 h-3.5" />}
          Save Changes
        </button>
      </div>

      {/* General */}
      <Section icon={<Globe className="w-3.5 h-3.5 text-indigo-500" />} title="General">
        <Row label="Platform Name" sub="Displayed across the app and emails">
          <span className="text-sm font-semibold theme-text">Asystence</span>
        </Row>
        <Row label="New Workspace Signups" sub="Allow new workspaces to register">
          <Toggle value={signupEnabled} onChange={setSignupEnabled} />
        </Row>
        <Row label="Maintenance Mode" sub="Blocks all non-superadmin access">
          <Toggle value={maintenanceMode} onChange={setMaintenance} />
        </Row>
      </Section>

      {/* Notifications */}
      <Section icon={<Bell className="w-3.5 h-3.5 text-indigo-500" />} title="Notifications">
        <Row label="Email Notifications" sub="Send system alerts to superadmin email">
          <Toggle value={emailNotifs} onChange={setEmailNotifs} />
        </Row>
        <Row label="Audit Log" sub="Record all superadmin actions">
          <Toggle value={auditLog} onChange={setAuditLog} />
        </Row>
      </Section>

      {/* Plans */}
      <Section icon={<Database className="w-3.5 h-3.5 text-indigo-500" />} title="Plan Limits">
        <div className="px-5 py-4">
          <p className="text-xs theme-text-muted mb-3">Default member limits per plan. Change via workspace edit.</p>
          <div className="grid grid-cols-3 gap-3">
            {PLANS.map(p => (
              <div key={p.id} className="rounded-xl border theme-border p-3.5 space-y-1">
                <p className="text-xs font-semibold theme-text">{p.label}</p>
                <p className="text-xl font-bold theme-text">{p.price}<span className="text-xs font-normal theme-text-muted">/mo</span></p>
                <p className="text-xs theme-text-muted">Up to {p.members} members</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section icon={<Lock className="w-3.5 h-3.5 text-indigo-500" />} title="Security">
        <Row label="Superadmin JWT Secret" sub="Used to sign superadmin tokens — change requires server restart">
          <span className="px-2 py-1 rounded-lg text-xs font-mono bg-[var(--surface-soft)] theme-text-muted">
            ••••••••••••••••
          </span>
        </Row>
        <Row label="Reset User Passwords" sub="Reset passwords for workspace users">
          <button
            onClick={handleResetPasswords}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium theme-surface border theme-border theme-text-muted hover:theme-text transition-colors"
          >
            Go to Workspaces <ChevronRight className="w-3 h-3" />
          </button>
        </Row>
      </Section>

      {/* System */}
      <Section icon={<Server className="w-3.5 h-3.5 text-indigo-500" />} title="System Info">
        <Row label="Backend" sub="Node.js + Express + PostgreSQL">
          <span className="text-xs theme-text-muted">v1.0</span>
        </Row>
        <Row label="Frontend" sub="React + Vite + Tailwind">
          <span className="text-xs theme-text-muted">v1.0</span>
        </Row>
        <Row label="Email Provider" sub="Configure SMTP in .env">
          <span className="text-xs theme-text-muted">SMTP</span>
        </Row>
      </Section>

    </div>
  );
}
