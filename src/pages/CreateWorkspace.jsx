// src/pages/CreateWorkspace.jsx
import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";

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
    <div>
      <h2>Create New Workspace</h2>

      <form onSubmit={handleCreateWorkspace}>
        <div>
          <label>Workspace Name</label>
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Owner Email</label>
          <input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Owner Password</label>
          <input
            type="password"
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Plan</label>
          <select
            value={workspacePlan}
            onChange={(e) => setWorkspacePlan(e.target.value)}
          >
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
          </select>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Workspace"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default CreateWorkspace;
