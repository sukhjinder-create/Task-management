// src/components/WorkspaceMembersModal.jsx
import { useEffect, useState } from "react";
import { useApi } from "../api";
import toast from "react-hot-toast";

/**
 * Modal to list/add/remove workspace members.
 *
 * - GET /workspaces/:id/members
 * - POST /workspaces/:id/members  { user_id, role }
 * - DELETE /workspaces/:id/members/:userId
 *
 * Note: Backend enforces "one account per workspace" rule and will return 409
 * if user belongs to some other workspace.
 */

export default function WorkspaceMembersModal({ workspace, onClose, onMembersChanged }) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [emailOrId, setEmailOrId] = useState("");
  const [role, setRole] = useState("member");

  useEffect(() => {
    if (!workspace) return;
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  async function loadMembers() {
    setLoading(true);
    try {
      const res = await api.get(`/workspaces/${workspace.id}/members`);
      setMembers(res.data || []);
    } catch (err) {
      console.error("Load members failed:", err);
      toast.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!emailOrId.trim()) {
      toast.error("Enter user email or ID");
      return;
    }

    setAdding(true);

    try {
      let userId = emailOrId.trim();

      // If looks like an email, try resolve via /users?email=...
      if (userId.includes("@")) {
        try {
          const lookup = await api.get(`/users?email=${encodeURIComponent(userId)}`);
          const found = (lookup.data || [])[0];
          if (!found) {
            toast.error("User not found by email. Create the user first in Users admin.");
            setAdding(false);
            return;
          }
          userId = found.id;
        } catch (err) {
          console.warn("User lookup by email failed:", err);
          toast.error("User lookup failed");
          setAdding(false);
          return;
        }
      }

      const res = await api.post(`/workspaces/${workspace.id}/members`, {
        user_id: userId,
        role,
      });

      setMembers((prev) => [...prev, res.data]);
      setEmailOrId("");
      toast.success("Member added");
      onMembersChanged?.();
    } catch (err) {
      console.error("Add member failed:", err);
      const msg = err?.response?.data?.error || "Add member failed";
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(userId) {
    if (!window.confirm("Remove member from workspace?")) return;

    try {
      await api.delete(`/workspaces/${workspace.id}/members/${userId}`);
      setMembers((prev) => prev.filter((m) => String(m.user_id) !== String(userId)));
      toast.success("Member removed");
      onMembersChanged?.();
    } catch (err) {
      console.error("Remove failed:", err);
      toast.error(err?.response?.data?.error || "Remove failed");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black opacity-30"
        onClick={() => onClose && onClose()}
      />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl z-10 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{workspace.name} — Members</h3>
            <div className="text-xs text-slate-500">Workspace ID: {workspace.id}</div>
          </div>
          <div>
            <button
              onClick={() => onClose && onClose()}
              className="px-3 py-1 rounded border bg-white hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Add member */}
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
            <div className="md:col-span-3">
              <input
                value={emailOrId}
                onChange={(e) => setEmailOrId(e.target.value)}
                placeholder="User email or ID"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="admin">Workspace Admin</option>
              </select>
            </div>

            <div className="md:col-span-2 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setEmailOrId("");
                }}
                className="bg-white border px-3 py-2 rounded text-sm"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={adding}
                className="bg-blue-600 text-white px-3 py-2 rounded text-sm"
              >
                {adding ? "Adding..." : "Add member"}
              </button>
            </div>
          </form>

          {/* Members list */}
          <div>
            <div className="text-sm text-slate-500 mb-2">
              {loading ? "Loading members..." : `${members.length} members`}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-medium">{m.username || m.email || m.user_id}</div>
                    <div className="text-xs text-slate-500">
                      role: {m.role || "member"} · added: {new Date(m.created_at || Date.now()).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRemove(m.user_id)}
                      className="text-sm bg-red-600 text-white px-2 py-1 rounded"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {members.length === 0 && !loading && (
                <div className="text-sm text-slate-500">No members yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
