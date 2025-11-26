// src/pages/ProjectTasks.jsx
import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import CommentsSection from "../components/CommentsSection.jsx";
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

export default function ProjectTasks() {
  const { projectId } = useParams();
  const api = useApi();
  const { auth } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState("");
  const [overdueFilter, setOverdueFilter] = useState(false);

  const [newTask, setNewTask] = useState({
    task: "",
    status: "pending",
    assigned_to: "",
    due_date: "",
  });
  const [creating, setCreating] = useState(false);

  const [users, setUsers] = useState([]);
  const [canSeeUsers, setCanSeeUsers] = useState(true);

  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [viewMode, setViewMode] = useState("board"); // "board" | "list"

  const role = auth.user.role;
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isUser = role === "user";

  const canManageTasks = isAdmin || isManager;

  // 🔹 Helper: show username instead of raw UUID
  const getAssigneeLabel = (task) => {
    if (!task.assigned_to) return "Unassigned";
    const user = users.find((u) => u.id === task.assigned_to);
    if (!user) return task.assigned_to; // fallback to UUID if user isn't loaded
    return `${user.username} (${user.role})`;
  };

  // Fetch project
  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await api.get(`/projects/${projectId}`);
        setProject(res.data);
      } catch (err) {
        console.error(err);
        const msg = err.response?.data?.error || "Failed to load project";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoadingProject(false);
      }
    }
    fetchProject();
  }, [projectId]);

  // Fetch users (for assigning / labels). If 403 -> just hide list and show raw id.
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await api.get("/users");
        setUsers(res.data || []);
        setCanSeeUsers(true);
      } catch (err) {
        console.warn(
          "Could not load users (probably not admin/manager):",
          err?.response?.status
        );
        setCanSeeUsers(false);
      }
    }
    fetchUsers();
  }, []);

  async function loadTasks() {
    setLoadingTasks(true);
    setError("");
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (assignedToFilter) params.assigned_to = assignedToFilter;
      if (overdueFilter) params.overdue = true;

      const res = await api.get(`/tasks/${projectId}`, { params });
      setTasks(res.data || []);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || "Failed to load tasks";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingTasks(false);
    }
  }

  // initial + on filters change
  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, assignedToFilter, overdueFilter, projectId]);

  const handleNewTaskChange = (e) => {
    const { name, value } = e.target;
    setNewTask((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!canManageTasks) {
      toast.error("You don't have permission to create tasks.");
      return;
    }
    if (!newTask.task.trim()) return;

    setCreating(true);
    setError("");
    try {
      const body = {
        task: newTask.task,
        project_id: projectId,
        status: newTask.status,
        added_by: auth.user.username,
        assigned_to: newTask.assigned_to || undefined,
        due_date: newTask.due_date || undefined,
      };

      const res = await api.post("/tasks", body);
      setTasks((prev) => [res.data, ...prev]);
      setNewTask({
        task: "",
        status: "pending",
        assigned_to: "",
        due_date: "",
      });
      toast.success("Task created");
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.error ||
        "Failed to create task (check assigned_to / permissions)";
      setError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleMarkCompleted = async (task) => {
    const isMine = task.assigned_to === auth.user.id;

    if (!canManageTasks && !(isUser && isMine)) {
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
      setTasks((prev) => prev.map((t) => (t.id === task.id ? res.data : t)));
      toast.success("Task marked as completed");
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || "Failed to update task";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleDeleteTask = async (task) => {
    if (!canManageTasks) {
      toast.error("You don't have permission to delete tasks.");
      return;
    }
    if (!window.confirm("Delete this task?")) return;
    try {
      await api.delete(`/tasks/${task.id}`);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast.success("Task deleted");
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || "Failed to delete task";
      setError(msg);
      toast.error(msg);
    }
  };

  // Kanban drag handlers
  const handleDragStart = (taskId) => {
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDropOnColumn = async (newStatus) => {
    if (!draggedTaskId) return;
    const task = tasks.find((t) => t.id === draggedTaskId);
    if (!task) return;

    const isMine = task.assigned_to === auth.user.id;

    if (!canManageTasks && !(isUser && isMine)) {
      toast.error("You don't have permission to move this task.");
      setDraggedTaskId(null);
      return;
    }

    if (task.status === newStatus) {
      setDraggedTaskId(null);
      return;
    }

    try {
      const res = await api.put(`/tasks/${task.id}`, {
        task: task.task,
        status: newStatus,
        assigned_to: task.assigned_to || null,
        due_date: task.due_date || null,
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? res.data : t)));
      toast.success(`Task moved to "${newStatus}"`);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || "Failed to move task";
      setError(msg);
      toast.error(msg);
    } finally {
      setDraggedTaskId(null);
    }
  };

  // dashboard stats
  const { totalTasks, pendingCount, inProgressCount, completedCount, overdueCount } =
    useMemo(() => {
      const total = tasks.length;
      let pending = 0;
      let inProgress = 0;
      let completed = 0;
      let overdue = 0;

      tasks.forEach((t) => {
        if (t.status === "pending") pending++;
        else if (t.status === "in-progress") inProgress++;
        else if (t.status === "completed") completed++;

        if (isTaskOverdue(t)) overdue++;
      });

      return {
        totalTasks: total,
        pendingCount: pending,
        inProgressCount: inProgress,
        completedCount: completed,
        overdueCount: overdue,
      };
    }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (assignedToFilter && t.assigned_to !== assignedToFilter) return false;
      if (overdueFilter && !isTaskOverdue(t)) return false;
      return true;
    });
  }, [tasks, statusFilter, assignedToFilter, overdueFilter]);

  const columns = [
    { key: "pending", label: "Pending" },
    { key: "in-progress", label: "In Progress" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="space-y-6">
      {/* PROJECT HEADER */}
      <section className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">
            {loadingProject ? "Loading project..." : project?.name || "Project"}
          </h1>
          <p className="text-xs text-slate-500">
            Role: {role} • Tasks in this project only
          </p>
        </div>
        <div className="text-xs space-x-2">
          <button
            onClick={() => setViewMode("board")}
            className={`px-3 py-1 rounded-lg border text-xs ${
              viewMode === "board"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-700 border-slate-300"
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1 rounded-lg border text-xs ${
              viewMode === "list"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-700 border-slate-300"
            }`}
          >
            List
          </button>
        </div>
      </section>

      {/* DASHBOARD STATS */}
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

      {/* CREATE TASK – ONLY ADMIN/MANAGER */}
      {canManageTasks && (
        <section className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-semibold mb-3">Create Task</h2>
          <form onSubmit={handleCreateTask} className="grid md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <input
                type="text"
                name="task"
                placeholder="Task description"
                value={newTask.task}
                onChange={handleNewTaskChange}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <select
                name="status"
                value={newTask.status}
                onChange={handleNewTaskChange}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <input
                type="date"
                name="due_date"
                value={newTask.due_date}
                onChange={handleNewTaskChange}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              {canSeeUsers && users.length > 0 ? (
                <select
                  name="assigned_to"
                  value={newTask.assigned_to}
                  onChange={handleNewTaskChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.role})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="assigned_to"
                  placeholder="Assigned to (user id, optional)"
                  value={newTask.assigned_to}
                  onChange={handleNewTaskChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Task"}
              </button>
            </div>
          </form>
        </section>
      )}

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

        {canSeeUsers && users.length > 0 ? (
          <select
            value={assignedToFilter}
            onChange={(e) => setAssignedToFilter(e.target.value)}
            className="border rounded-lg px-3 py-1 text-sm"
          >
            <option value="">All assignees</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} ({u.role})
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder="Assigned to (user id)"
            value={assignedToFilter}
            onChange={(e) => setAssignedToFilter(e.target.value)}
            className="border rounded-lg px-3 py-1 text-sm"
          />
        )}

        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={overdueFilter}
            onChange={(e) => setOverdueFilter(e.target.checked)}
          />
          Overdue only
        </label>

        <button
          onClick={loadTasks}
          className="ml-auto text-xs border border-slate-300 rounded-lg px-3 py-1 hover:bg-slate-50"
        >
          Refresh
        </button>
      </section>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* VIEW: KANBAN or LIST */}
      {viewMode === "board" ? (
        <section className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-semibold mb-3">Kanban Board</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {columns.map((col) => (
              <div
                key={col.key}
                className="border border-slate-200 rounded-lg min-h-[200px] p-2 bg-slate-50"
                onDragOver={handleDragOver}
                onDrop={() => handleDropOnColumn(col.key)}
              >
                <div className="text-xs font-semibold mb-2 flex justify-between items-center">
                  <span>{col.label}</span>
                  <span className="text-[10px] text-slate-500">
                    {
                      filteredTasks.filter((t) => t.status === col.key).length
                    }{" "}
                    tasks
                  </span>
                </div>
                <div className="space-y-2">
                  {filteredTasks
                    .filter((t) => t.status === col.key)
                    .map((t) => {
                      const overdue = isTaskOverdue(t);
                      const isMine = t.assigned_to === auth.user.id;
                      const canDrag =
                        canManageTasks || (isUser && isMine);

                      return (
                        <div
                          key={t.id}
                          draggable={canDrag}
                          onDragStart={() => handleDragStart(t.id)}
                          className={`border rounded-lg px-2 py-2 text-xs cursor-grab ${
                            overdue
                              ? "border-red-300 bg-red-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="font-medium text-[11px] flex items-center gap-1">
                            {t.task}
                            {overdue && (
                              <span className="text-[9px] text-red-700 border border-red-300 bg-red-50 rounded px-1">
                                Overdue
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Assigned: {getAssigneeLabel(t)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {t.due_date && (
                              <>Due: {new Date(t.due_date).toLocaleDateString()}</>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-semibold mb-3">Tasks (List)</h2>

          {loadingTasks && (
            <div className="text-sm text-slate-500">Loading tasks...</div>
          )}

          {!loadingTasks && filteredTasks.length === 0 && (
            <div className="text-sm text-slate-500">
              No tasks for this project with current filters.
            </div>
          )}

          <div className="space-y-3">
            {filteredTasks.map((t) => {
              const overdue = isTaskOverdue(t);
              const isMine = t.assigned_to === auth.user.id;
              const canUpdateStatus =
                canManageTasks || (isUser && isMine);

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
                      <div className="font-medium text-sm flex items-center gap-2">
                        {t.task}
                        {overdue && (
                          <span className="text-[10px] text-red-700 border border-red-300 bg-red-50 rounded px-1">
                            Overdue
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        Status: {t.status} • Assigned to: {getAssigneeLabel(t)}
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
                      {canManageTasks && (
                        <button
                          onClick={() => handleDeleteTask(t)}
                          className="text-[11px] border border-red-300 text-red-600 rounded px-2 py-1 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <CommentsSection taskId={t.id} />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
