// src/components/Subtasks.jsx
import { useEffect, useState } from "react";
import { ListTodo, Trash2, Check } from "lucide-react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { Button, Badge, Avatar } from "./ui";

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
    <div className="mt-4 border-t border-gray-200 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <ListTodo className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-900">Subtasks</h3>
        {subtasks.length > 0 && (
          <Badge color="neutral" size="sm">
            {subtasks.filter(s => s.status === "completed").length}/{subtasks.length}
          </Badge>
        )}
      </div>

      {/* Existing subtasks list */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading subtasks...</p>
      ) : subtasks.length === 0 ? (
        <p className="text-sm text-gray-400 mb-3">No subtasks yet. Add one below!</p>
      ) : (
        <div className="space-y-2 mb-4">
          {subtasks.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 hover:bg-white transition-colors"
            >
              {/* Checkbox + title */}
              <label className="flex items-center gap-3 flex-1 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    checked={s.status === "completed"}
                    onChange={() => handleToggleStatus(s)}
                  />
                  {s.status === "completed" && (
                    <Check className="w-3 h-3 text-white absolute top-0.5 left-0.5 pointer-events-none" />
                  )}
                </div>
                <span
                  className={
                    "truncate " +
                    (s.status === "completed"
                      ? "line-through text-gray-400"
                      : "text-gray-900 group-hover:text-primary-600")
                  }
                  title={s.title || s.subtask}
                >
                  {s.title || s.subtask}
                </span>
              </label>

              {/* Assignee */}
              {s.assigned_to && (
                <Avatar
                  name={users.find(u => u.id === s.assigned_to)?.username || "User"}
                  src={users.find(u => u.id === s.assigned_to)?.avatar_url}
                  size="xs"
                  className="shrink-0"
                />
              )}

              {/* Assignee dropdown */}
              <select
                className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:border-primary-500 focus:ring-primary-500/20"
                value={s.assigned_to || ""}
                onChange={(e) =>
                  handleChangeAssignee(s, e.target.value || null)
                }
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>

              {/* Delete button */}
              <Button
                type="button"
                onClick={() => handleDeleteSubtask(s.id)}
                variant="ghost"
                size="xs"
                className="text-danger-600 hover:bg-danger-50 shrink-0"
                title="Delete subtask"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* New subtask row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500/20"
          placeholder="New subtask"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
        />
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500/20"
          value={newAssignedTo}
          onChange={(e) => setNewAssignedTo(e.target.value)}
        >
          <option value="">Unassigned</option>
          {loadingUsers ? (
            <option disabled>Loading...</option>
          ) : (
            users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))
          )}
        </select>
        <Button
          type="button"
          disabled={adding}
          loading={adding}
          onClick={handleAddSubtask}
          variant="primary"
          size="sm"
        >
          Add
        </Button>
      </div>
    </div>
  );
}
