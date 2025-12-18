// src/pages/SuperAdminWorkspaces.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import toast from "react-hot-toast";

/**
 * SuperadminWorkspaces (UX-cleaned)
 * ⚠️ NO LOGIC REMOVED OR CHANGED
 * - layout & hierarchy improved
 * - clearer status visibility
 * - enterprise-style spacing
 */

function getSuperadminAxios() {
  const tokenFromWindow = window.__SUPERADMIN_TOKEN__ || null;
  let raw = null;
  try {
    raw = localStorage.getItem("superadmin_auth");
  } catch {}
  const parsed = raw ? JSON.parse(raw) : null;
  const token = tokenFromWindow || parsed?.token || null;

  return axios.create({
    baseURL: API_BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export default function SuperadminWorkspaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  // create form
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("basic");
  const [memberLimit, setMemberLimit] = useState(10);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerName, setOwnerName] = useState("");

  // editing
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingPlan, setEditingPlan] = useState("");
  const [editingLimit, setEditingLimit] = useState(10);

  const axiosSuper = getSuperadminAxios();

  useEffect(() => {
    load();
    const ev = () => load();
    window.addEventListener("superadmin:login", ev);
    return () => window.removeEventListener("superadmin:login", ev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setServerError(null);
    try {
      const res = await axiosSuper.get("/superadmin/workspaces");
      setWorkspaces(res.data || []);
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || "Failed to load";
      setServerError(msg);
      toast.error("Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  }

  function validateCreate() {
    if (!name.trim()) return "Workspace name is required";
    if (!ownerEmail.trim()) return "Owner email is required";
    if (!ownerPassword.trim()) return "Owner password is required";
    if (!Number.isFinite(Number(memberLimit)) || Number(memberLimit) <= 0)
      return "Member limit must be a positive number";
    return null;
  }

  async function handleCreate(e) {
    e?.preventDefault?.();
    setServerError(null);

    const v = validateCreate();
    if (v) {
      setServerError(v);
      toast.error(v);
      return;
    }

    try {
      setLoading(true);
      await axiosSuper.post("/superadmin/workspaces", {
        name,
        plan,
        member_limit: Number(memberLimit) || 10,
        ownerEmail,
        ownerPassword,
        ownerName,
      });

      toast.success("Workspace created");
      setName("");
      setPlan("basic");
      setMemberLimit(10);
      setOwnerEmail("");
      setOwnerPassword("");
      setOwnerName("");
      load();
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err.message ||
        "Create failed";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete workspace? This will disable it.")) return;
    try {
      setLoading(true);
      await axiosSuper.delete(`/superadmin/workspaces/${id}`);
      toast.success("Workspace disabled");
      load();
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err.message ||
        "Delete failed";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(ws) {
    setEditingId(ws.id);
    setEditingName(ws.name || "");
    setEditingPlan(ws.plan || "basic");
    setEditingLimit(ws.member_limit || 10);
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      setLoading(true);
      await axiosSuper.put(`/superadmin/workspaces/${editingId}`, {
        name: editingName,
        plan: editingPlan,
        member_limit: Number(editingLimit) || 10,
      });
      toast.success("Workspace updated");
      setEditingId(null);
      load();
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err.message ||
        "Update failed";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(ws) {
    try {
      setLoading(true);
      await axiosSuper.put(`/superadmin/workspaces/${ws.id}/status`, {
        is_active: !ws.is_active,
      });
      toast.success("Workspace status updated");
      load();
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err.message ||
        "Update failed";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-semibold">Superadmin</h1>
          <p className="text-sm text-slate-500">Workspace management console</p>
        </div>

        {/* ERROR */}
        {serverError && (
          <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded">
            {serverError}
          </div>
        )}

        {/* CREATE WORKSPACE */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-sm font-semibold mb-4">Create Workspace</h2>

          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <input className="input" placeholder="Workspace name" value={name} onChange={(e) => setName(e.target.value)} />
            <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <input type="number" className="input" value={memberLimit} onChange={(e) => setMemberLimit(e.target.value)} />

            <input className="input md:col-span-2" placeholder="Owner email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
            <input type="password" className="input" placeholder="Owner password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} />
            <input className="input md:col-span-2" placeholder="Owner name (optional)" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />

            <div className="md:col-span-3 flex gap-2">
              <button disabled={loading} className="btn-primary">Create Workspace</button>
              <button type="button" onClick={() => {
                setName(""); setPlan("basic"); setMemberLimit(10);
                setOwnerEmail(""); setOwnerPassword(""); setOwnerName("");
              }} className="btn-secondary">Reset</button>
            </div>
          </form>
        </div>

        {/* WORKSPACE LIST */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-sm font-semibold mb-4">Workspaces</h2>

          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : workspaces.length === 0 ? (
            <p className="text-sm text-slate-500">No workspaces found</p>
          ) : (
            <div className="divide-y">
              {workspaces.map((ws) => (
                <div key={ws.id} className="py-4 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{ws.name}</div>
                    <div className="text-xs text-slate-500">
                      {ws.plan} • limit {ws.member_limit}
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    <span className={`text-xs px-2 py-1 rounded ${ws.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {ws.is_active ? "Active" : "Disabled"}
                    </span>

                    {editingId === ws.id ? (
                      <>
                        <button onClick={saveEdit} className="btn-primary-sm">Save</button>
                        <button onClick={() => setEditingId(null)} className="btn-secondary-sm">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(ws)} className="btn-secondary-sm">Edit</button>
                        <button onClick={() => toggleActive(ws)} className="btn-secondary-sm">
                          {ws.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button onClick={() => handleDelete(ws.id)} className="btn-danger-sm">Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
