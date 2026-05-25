// src/pages/CreateWorkspace.jsx
import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { ArrowRight, AlertCircle } from "lucide-react";

const CreateWorkspace = () => {
  const [workspaceName, setWorkspaceName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [workspacePlan, setWorkspacePlan] = useState("basic");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🔐 keep auth logic local (no service folder needed)
  const getAuthHeader = () => {
    try {
      const raw = localStorage.getItem("superadmin_auth");
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.token
        ? { Authorization: `Bearer ${parsed.token}` }
        : {};
    } catch {
      return {};
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await axios.post(
        `${API_BASE_URL}/superadmin/workspaces`,
        {
          name: workspaceName,
          ownerEmail,
          ownerPassword,
          plan: workspacePlan,
        },
        {
          headers: getAuthHeader(),
        }
      );

      // ✅ success handling can be added here later
      setWorkspaceName("");
      setOwnerEmail("");
      setOwnerPassword("");
      setWorkspacePlan("basic");
    } catch (err) {
      console.error("Create workspace failed:", err);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Error creating workspace"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-lg">
      {/* Section heading */}
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">
          Superadmin
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-[color:var(--text)]">
          Create new workspace
        </h2>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          Provision a new tenant workspace with an owner account.
        </p>
      </div>

      <div className="border border-[color:var(--border)] rounded-lg p-6">
        <form className="space-y-4" onSubmit={handleCreateWorkspace}>
          <div>
            <label className="block text-xs font-medium text-[color:var(--text-muted)] mb-1.5 tracking-tight">
              Workspace name
            </label>
            <input
              type="text"
              className="w-full h-10 bg-[var(--surface)] border border-[color:var(--border)] rounded-[8px] px-3 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Acme Corp"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[color:var(--text-muted)] mb-1.5 tracking-tight">
              Owner email
            </label>
            <input
              type="email"
              className="w-full h-10 bg-[var(--surface)] border border-[color:var(--border)] rounded-[8px] px-3 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@company.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[color:var(--text-muted)] mb-1.5 tracking-tight">
              Owner password
            </label>
            <input
              type="password"
              className="w-full h-10 bg-[var(--surface)] border border-[color:var(--border)] rounded-[8px] px-3 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[color:var(--text-muted)] mb-1.5 tracking-tight">
              Plan
            </label>
            <select
              className="w-full h-10 bg-[var(--surface)] border border-[color:var(--border)] rounded-[8px] px-3 text-sm text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
              value={workspacePlan}
              onChange={(e) => setWorkspacePlan(e.target.value)}
            >
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
            </select>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-[8px] border border-[color:var(--border)]">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[color:var(--primary)]" />
              <p className="text-xs text-[color:var(--text-muted)] leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 inline-flex items-center justify-center gap-2 bg-[var(--primary)] text-white rounded-[8px] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Creating…" : (<>Create workspace <ArrowRight className="w-4 h-4" /></>)}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateWorkspace;
