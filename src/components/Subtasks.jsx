// src/components/Subtasks.jsx
import { useEffect, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Subtasks({ taskId }) {
  const api = useApi();
  const { auth } = useAuth();
  const user = auth?.user;

  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [adding, setAdding] = useState(false);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  if (!taskId) return null;

  // ───────────────────────────────────────────
  // Load users (for assignee dropdown)
  // ───────────────────────────────────────────
  useEffect(() => {
    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const res = await api.get("/users");
        setUsers(res.data || []);
      } catch (err) {
        console.error("Failed to load users for subtasks:", err);
      } finally {
        setLoadingUsers(false);
      }
    }

    loadUsers();
  }, [api]);

  // ───────────────────────────────────────────
  // Load subtasks for this task
  // ───────────────────────────────────────────
  useEffect(() => {
    async function loadSubtasks() {
      setLoading(true);
      try {
        const res = await api.get(`/subtasks/${taskId}`);
        setSubtasks(res.data || []);
      } catch (err) {
        console.error("Failed to load subtasks:", err);
        setSubtasks([]);
      } finally {
        setLoading(false);
      }
    }

    if (taskId) {
      loadSubtasks();
    }
  }, [api, taskId]);

  // ───────────────────────────────────────────
  // Create subtask
  // ───────────────────────────────────────────
  const handleAddSubtask = async () => {
    if (!newTitle.trim()) {
      toast.error("Subtask name is required");
      return;
    }
    setAdding(true);
    try {
      const payload = {
        task_id: taskId,
        // backend accepts both "title" and "subtask"; we send title
        title: newTitle.trim(),
        assigned_to: newAssignedTo || null,
        priority: "medium",
        status: "pending",
      };

      const res = await api.post("/subtasks", payload);
      const created = res.data;

      setSubtasks((prev) => [...prev, created]);
      setNewTitle("");
      setNewAssignedTo("");
    } catch (err) {
      console.error("Failed to add subtask:", err);
      const msg = err.response?.data?.error || "Failed to add subtask";
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  // ───────────────────────────────────────────
  // Toggle completed / pending via checkbox
  // ───────────────────────────────────────────
  const handleToggleStatus = async (subtask) => {
    const newStatus = subtask.status === "completed" ? "pending" : "completed";

    try {
      const res = await api.put(`/subtasks/${subtask.id}`, {
        status: newStatus,
      });
      const updated = res.data;

      setSubtasks((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
    } catch (err) {
      console.error("Failed to update subtask status:", err);
      const msg =
        err.response?.data?.error || "Failed to update subtask status";
      toast.error(msg);
    }
  };

  // ───────────────────────────────────────────
  // Change assignee from dropdown
  // ───────────────────────────────────────────
  const handleChangeAssignee = async (subtask, assigned_to) => {
    try {
      const res = await api.put(`/subtasks/${subtask.id}`, {
        assigned_to: assigned_to || null,
      });
      const updated = res.data;

      setSubtasks((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
    } catch (err) {
      console.error("Failed to update subtask assignee:", err);
      const msg =
        err.response?.data?.error || "Failed to update subtask assignee";
      toast.error(msg);
    }
  };

  // ───────────────────────────────────────────
  // Delete subtask
  // ───────────────────────────────────────────
  const handleDeleteSubtask = async (subtaskId) => {
    if (!window.confirm("Delete this subtask?")) return;

    try {
      await api.delete(`/subtasks/${subtaskId}`);
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    } catch (err) {
      console.error("Failed to delete subtask:", err);
      const msg =
        err.response?.data?.error || "Failed to delete subtask";
      toast.error(msg);
    }
  };

  // Helper to show assignee name
  const renderAssigneeLabel = (subtask) => {
    if (!subtask.assigned_to) return "Unassigned";
    const u = users.find((x) => x.id === subtask.assigned_to);
    if (!u) return subtask.assigned_to;
    return `${u.username} (${u.email})`;
  };

  return (
    <div className="mt-3 border-t pt-3">
      <h3 className="text-xs font-semibold mb-2">Subtasks</h3>

      {/* Existing subtasks list */}
      {loading ? (
        <p className="text-[11px] text-slate-400">Loading subtasks...</p>
      ) : subtasks.length === 0 ? (
        <p className="text-[11px] text-slate-400">No subtasks yet.</p>
      ) : (
        <div className="space-y-2">
          {subtasks.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 text-[11px] border rounded px-2 py-1 bg-slate-50"
            >
              {/* Checkbox + title */}
              <label className="flex items-center gap-2 flex-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-3 h-3"
                  checked={s.status === "completed"}
                  onChange={() => handleToggleStatus(s)}
                />
                <span
                  className={
                    "truncate " +
                    (s.status === "completed"
                      ? "line-through text-slate-400"
                      : "text-slate-700")
                  }
                  title={s.title || s.subtask}
                >
                  {s.title || s.subtask}
                </span>
              </label>

              {/* Assignee dropdown */}
              <select
                className="border rounded px-2 py-[2px] text-[11px]"
                value={s.assigned_to || ""}
                onChange={(e) =>
                  handleChangeAssignee(s, e.target.value || null)
                }
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.email})
                  </option>
                ))}
              </select>

              {/* Delete button */}
              <button
                type="button"
                onClick={() => handleDeleteSubtask(s.id)}
                className="text-[11px] text-red-500 px-1"
                title="Delete subtask"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New subtask row */}
      <div className="mt-3 flex items-center gap-2 text-[11px]">
        <input
          type="text"
          className="flex-1 border rounded px-2 py-1"
          placeholder="New subtask"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <select
          className="border rounded px-2 py-1"
          value={newAssignedTo}
          onChange={(e) => setNewAssignedTo(e.target.value)}
        >
          <option value="">Unassigned</option>
          {loadingUsers ? (
            <option disabled>Loading...</option>
          ) : (
            users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} ({u.email})
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          disabled={adding}
          onClick={handleAddSubtask}
          className="bg-slate-800 text-white rounded px-3 py-1 disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add"}
        </button>
      </div>
    </div>
  );
}
