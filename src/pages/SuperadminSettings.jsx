// src/pages/SuperadminSettings.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Bell, Database, Lock, ChevronRight,
  Save, RefreshCw, Server, Globe, KeyRound,
} from "lucide-react";
import superadminApi from "../superadminApi";
import { useSuperadminAuth } from "../context/SuperadminAuthContext";

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

// ── Small toggle component ────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        value
          ? "bg-[color:var(--primary)]"
          : "bg-[var(--surface-soft)] border border-[color:var(--border)]"
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
    <div className="border border-[color:var(--border)] rounded-lg overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[color:var(--border)] bg-[var(--surface-soft)]">
        <div className="w-7 h-7 rounded-lg bg-[var(--primary-soft)] flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-sm font-semibold text-[color:var(--text)]">{title}</h2>
      </div>
      <div className="divide-y divide-[color:var(--border)]">{children}</div>
    </div>
  );
}

// ── Setting row ───────────────────────────────────────────────────────────────
function Row({ label, sub, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[color:var(--text)]">{label}</p>
        {sub && <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{sub}</p>}
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
  const navigate = useNavigate();
  const { logout } = useSuperadminAuth();
  // UI-only toggles (no real backend yet — shows the intended UX)
  const [emailNotifs,   setEmailNotifs]   = useState(true);
  const [auditLog,      setAuditLog]      = useState(true);
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [maintenanceMode, setMaintenance] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

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

  async function handleChangePassword(event) {
    event.preventDefault();
    if (!currentPassword) {
      toast.error("Enter your current password");
      return;
    }
    if (!STRONG_PASSWORD.test(newPassword)) {
      toast.error("Use 12+ characters with upper, lower, number, and symbol");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      await superadminApi.put("/superadmin/change-password", {
        currentPassword,
        newPassword,
      });
      toast.success("Password changed. Please sign in again.");
      logout();
      navigate("/superadmin/login", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.error || "Password change failed");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">Superadmin</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">Platform Settings</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[color:var(--primary)] text-white hover:bg-[color:var(--primary-hover)] transition-colors disabled:opacity-60"
        >
          {saving
            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            : <Save className="w-3.5 h-3.5" />}
          Save Changes
        </button>
      </header>

      {/* General */}
      <Section icon={<Globe className="w-3.5 h-3.5 text-[color:var(--primary)]" />} title="General">
        <Row label="Platform Name" sub="Displayed across the app and emails">
          <span className="inline-flex items-center gap-1.5">
            <img src="/asystence-logo.png" alt="" aria-hidden="true" className="h-4 w-4 object-contain" />
            <span className="text-sm font-semibold text-[color:var(--text)]">Asystence</span>
          </span>
        </Row>
        <Row label="New Workspace Signups" sub="Allow new workspaces to register">
          <Toggle value={signupEnabled} onChange={setSignupEnabled} />
        </Row>
        <Row label="Maintenance Mode" sub="Blocks all non-superadmin access">
          <Toggle value={maintenanceMode} onChange={setMaintenance} />
        </Row>
      </Section>

      {/* Notifications */}
      <Section icon={<Bell className="w-3.5 h-3.5 text-[color:var(--primary)]" />} title="Notifications">
        <Row label="Email Notifications" sub="Send system alerts to superadmin email">
          <Toggle value={emailNotifs} onChange={setEmailNotifs} />
        </Row>
        <Row label="Audit Log" sub="Record all superadmin actions">
          <Toggle value={auditLog} onChange={setAuditLog} />
        </Row>
      </Section>

      {/* Plans */}
      <Section icon={<Database className="w-3.5 h-3.5 text-[color:var(--primary)]" />} title="Plan Limits">
        <div className="px-5 py-4">
          <p className="text-xs text-[color:var(--text-muted)] mb-3">Default member limits per plan. Change via workspace edit.</p>
          <div className="grid grid-cols-3 gap-3">
            {PLANS.map(p => (
              <div key={p.id} className="rounded-lg border border-[color:var(--border)] p-3.5 space-y-1">
                <p className="text-xs font-semibold text-[color:var(--text)]">{p.label}</p>
                <p className="text-xl font-bold text-[color:var(--text)]">{p.price}<span className="text-xs font-normal text-[color:var(--text-muted)]">/mo</span></p>
                <p className="text-xs text-[color:var(--text-muted)]">Up to {p.members} members</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section icon={<Lock className="w-3.5 h-3.5 text-[color:var(--primary)]" />} title="Security">
        <Row label="Superadmin JWT Secret" sub="Used to sign superadmin tokens — change requires server restart">
          <span className="px-2 py-1 rounded-lg text-xs font-mono bg-[var(--surface-soft)] text-[color:var(--text-muted)]">
            ••••••••••••••••
          </span>
        </Row>
        <form className="px-5 py-4" onSubmit={handleChangePassword}>
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-[var(--primary-soft)] p-2">
              <KeyRound className="h-4 w-4 text-[color:var(--primary)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[color:var(--text)]">Change Super Admin password</p>
              <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">Requires your current password and signs out every Super Admin session.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label htmlFor="current-superadmin-password" className="mb-1.5 block text-xs font-medium text-[color:var(--text-muted)]">Current password</label>
              <input
                id="current-superadmin-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                className="h-10 w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 text-sm text-[color:var(--text)] focus:border-[color:var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring)]"
              />
            </div>
            <div>
              <label htmlFor="new-superadmin-password" className="mb-1.5 block text-xs font-medium text-[color:var(--text-muted)]">New password</label>
              <input
                id="new-superadmin-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="12+ strong characters"
                className="h-10 w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring)]"
              />
            </div>
            <div>
              <label htmlFor="confirm-superadmin-password" className="mb-1.5 block text-xs font-medium text-[color:var(--text-muted)]">Confirm new password</label>
              <input
                id="confirm-superadmin-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                className="h-10 w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 text-sm text-[color:var(--text)] focus:border-[color:var(--primary)] focus:outline-none focus:shadow-[0_0_0_3px_var(--ring)]"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-[color:var(--text-soft)]">Uppercase, lowercase, number, and symbol required.</p>
            <button
              type="submit"
              disabled={changingPassword}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[color:var(--primary)] px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {changingPassword ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              Change password
            </button>
          </div>
        </form>
        <Row label="Reset User Passwords" sub="Reset passwords for workspace users">
          <button
            onClick={handleResetPasswords}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-[color:var(--border)] text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors"
          >
            Go to Workspaces <ChevronRight className="w-3 h-3" />
          </button>
        </Row>
      </Section>

      {/* System */}
      <Section icon={<Server className="w-3.5 h-3.5 text-[color:var(--primary)]" />} title="System Info">
        <Row label="Backend" sub="Node.js + Express + PostgreSQL">
          <span className="text-xs text-[color:var(--text-muted)]">v1.0</span>
        </Row>
        <Row label="Frontend" sub="React + Vite + Tailwind">
          <span className="text-xs text-[color:var(--text-muted)]">v1.0</span>
        </Row>
        <Row label="Email Provider" sub="Configure SMTP in .env">
          <span className="text-xs text-[color:var(--text-muted)]">SMTP</span>
        </Row>
      </Section>

    </div>
  );
}
