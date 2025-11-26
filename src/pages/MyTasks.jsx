// src/pages/MyTasks.jsx
import { useEffect, useState, useMemo } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const STATUS_OPTIONS = ["pending", "in-progress", "completed"];

function isTaskOverdue(task) {
  if (!task.due_date) return false;
  if (task.status === "completed") return false;
  const due = new Date(task.due_date);
  const today = new Date();
  const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  return dueDateOnly < todayOnly;
}

export default function MyTasks() {
  const api = useApi();
  const { auth } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projectTasks, setProjectTasks] = useState([]); // [{ project, tasks: [] }]

  const [statusFilter, setStatusFilter] = useState("");
  const [overdueFilter, setOverdueFilter] = useState(false);

  const role = auth.user.role;
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const canManageTasks = isAdmin || isManager;

  // Load all projects user can see, then only tasks assigned to this user
  useEffect(() => {
    async function loadMyTasks() {
      setLoading(true);
      setError("");
      try {
        const projectsRes = await api.get("/projects");
        const projects = projectsRes.data || [];

        const allProjectTasks = [];

        for (const p of projects) {
          try {
            const tasksRes = await api.get(`/tasks/${p.id}`);
            const allTasks = tasksRes.data || [];
            const myTasks = allTasks.filter(
              (t) => t.assigned_to === auth.user.id
            );
            if (myTasks.length > 0) {
              allProjectTasks.push({ project: p, tasks: myTasks });
            }
          } catch (err) {
            console.error("Failed to load tasks for project", p.id, err);
          }
        }

        setProjectTasks(allProjectTasks);
      } catch (err) {
        console.error(err);
        const msg = err.response?.data?.error || "Failed to load my tasks";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    loadMyTasks();
  }, []);

  // Flatten into a list for easier filtering
  const flatTasks = useMemo(() => {
    const list = [];
    projectTasks.forEach(({ project, tasks }) => {
      tasks.forEach((t) => {
        list.push({ ...t, _project: project });
      });
    });
    return list;
  }, [projectTasks]);

  const filteredTasks = useMemo(() => {
    return flatTasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (overdueFilter && !isTaskOverdue(t)) return false;
      return true;
    });
  }, [flatTasks, statusFilter, overdueFilter]);

  const totalTasks = filteredTasks.length;
  const pendingCount = filteredTasks.filter((t) => t.status === "pending").length;
  const inProgressCount = filteredTasks.filter(
    (t) => t.status === "in-progress"
  ).length;
  const completedCount = filteredTasks.filter(
    (t) => t.status === "completed"
  ).length;
  const overdueCount = filteredTasks.filter((t) => isTaskOverdue(t)).length;

  const handleMarkCompleted = async (task) => {
    // MyTasks only shows tasks assigned to current user,
    // but allow admin/manager to also act logically.
    const isMine = task.assigned_to === auth.user.id;
    if (!isMine && !canManageTasks) {
      toast.error("You don't have permission to update this task.");
      return;
    }

    try {
      const res = await api.put(`/tasks/${task.id}`, {
        task: task.task,
        status: "completed",
        assigned_to: task.assigned_to || null,
        due_date: task.due_date || null,
      });

      // update in projectTasks state
      setProjectTasks((prev) =>
        prev.map(({ project, tasks }) => ({
          project,
          tasks: tasks.map((t) => (t.id === task.id ? res.data : t)),
        }))
      );
      toast.success("Task marked as completed");
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || "Failed to update task";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <section className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">My Tasks</h1>
          <p className="text-xs text-slate-500">
            Tasks assigned to you across all accessible projects.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Logged in as <span className="font-semibold">{auth.user.username}</span> ({role})
        </div>
      </section>

      {/* DASHBOARD */}
      <section className="bg-white rounded-xl shadow p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <div>
          <div className="text-slate-500">Total tasks</div>
          <div className="text-lg font-semibold">{totalTasks}</div>
        </div>
        <div>
          <div className="text-slate-500">Pending</div>
          <div className="text-lg font-semibold">{pendingCount}</div>
        </div>
        <div>
          <div className="text-slate-500">In progress</div>
          <div className="text-lg font-semibold">{inProgressCount}</div>
        </div>
        <div>
          <div className="text-slate-500">Completed</div>
          <div className="text-lg font-semibold">{completedCount}</div>
        </div>
        <div>
          <div className="text-slate-500">Overdue</div>
          <div className="text-lg font-semibold text-red-600">
            {overdueCount}
          </div>
        </div>
      </section>

      {/* FILTERS */}
      <section className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-center">
        <span className="text-sm font-semibold mr-2">Filters:</span>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-1 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={overdueFilter}
            onChange={(e) => setOverdueFilter(e.target.checked)}
          />
          Overdue only
        </label>
      </section>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* TASK LIST */}
      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-sm font-semibold mb-3">Tasks</h2>

        {loading && (
          <div className="text-sm text-slate-500">Loading your tasks...</div>
        )}

        {!loading && filteredTasks.length === 0 && (
          <div className="text-sm text-slate-500">
            No tasks assigned to you with current filters.
          </div>
        )}

        <div className="space-y-3">
          {filteredTasks.map((t) => {
            const overdue = isTaskOverdue(t);
            const canUpdateStatus =
              t.assigned_to === auth.user.id || canManageTasks;

            return (
              <div
                key={t.id}
                className={`border rounded-lg px-3 py-2 ${
                  overdue
                    ? "border-red-300 bg-red-50"
                    : "border-slate-100 bg-white"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">
                      Project:{" "}
                      <span className="font-semibold">
                        {t._project?.name || "Unknown"}
                      </span>
                    </div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {t.task}
                      {overdue && (
                        <span className="text-[10px] text-red-700 border border-red-300 bg-red-50 rounded px-1">
                          Overdue
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      Status: {t.status} • Assigned to:{" "}
                      <span className="font-semibold">
                        {auth.user.username} ({role})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Created:{" "}
                      {t.created_at
                        ? new Date(t.created_at).toLocaleString()
                        : "N/A"}
                      {t.due_date && (
                        <> • Due: {new Date(t.due_date).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {canUpdateStatus && t.status !== "completed" && (
                      <button
                        onClick={() => handleMarkCompleted(t)}
                        className="text-[11px] border border-green-300 text-green-700 rounded px-2 py-1 hover:bg-green-50"
                      >
                        Mark completed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
