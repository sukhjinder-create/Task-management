// src/pages/MyTasks.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import CommentsSection from "../components/CommentsSection.jsx";
import Subtasks from "../components/Subtasks.jsx";
import Select from "react-select";

function statusLabel(status) {
  if (status === "pending") return "Pending";
  if (status === "in-progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (!status) return "No status";
  return status;
}

function priorityLabel(priority) {
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}

function priorityBadgeClass(priority) {
  if (priority === "high") {
    return "bg-red-100 text-red-700 border-red-200";
  }
  if (priority === "low") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function isOverdue(task) {
  if (!task.due_date) return false;
  if (task.status === "completed") return false;

  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return due < today;
}

// Heuristic ordering for statuses so columns feel natural
function statusSortIndex(key, label) {
  const s = (label || key || "").toLowerCase();
  if (
    s.includes("to do") ||
    s.includes("todo") ||
    s.includes("backlog") ||
    s.includes("pending")
  )
    return 1;
  if (
    s.includes("in progress") ||
    s.includes("in-progress") ||
    s.includes("doing") ||
    s.includes("wip")
  )
    return 2;
  if (
    s.includes("review") ||
    s.includes("qa") ||
    s.includes("test") ||
    s.includes("stage")
  )
    return 3;
  if (
    s.includes("done") ||
    s.includes("complete") ||
    s.includes("completed") ||
    s.includes("closed")
  )
    return 4;
  return 5;
}

export default function MyTasks() {
  const api = useApi();
  const { auth } = useAuth();
  const user = auth.user;
  const role = user?.role;
  const location = useLocation();

  const canDrag = role === "admin" || role === "manager" || role === "user";

  const title = role === "user" ? "My Tasks" : "Tasks";
  const subtitle =
    role === "user"
      ? "You only see tasks assigned to you. Drag cards between columns to update status."
      : "You can see tasks across your visible projects. Drag cards between columns to update status.";

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragTaskId, setDragTaskId] = useState(null);

  // Dynamic columns from backend: [{ key, label }]
  const [statusColumns, setStatusColumns] = useState([]);

  // Filters
  const [selectedProjects, setSelectedProjects] = useState([]); // project ids (as strings)
  const [hideEmpty, setHideEmpty] = useState(false);
  const [statusSearch, setStatusSearch] = useState("");

  // Modal state
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const canAdminEdit = role === "admin" || role === "manager";

  const [initialTaskOpened, setInitialTaskOpened] = useState(false);

  // Users list (for mapping assigned_to -> username)
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // 🔹 Helper: map assigned_to ID to username (email)
  const getAssigneeLabel = (id) => {
    if (!id) return null;
    // If it's the logged-in user, we can resolve immediately
    if (user && id === user.id) {
      return `${user.username} (${user.email})`;
    }
    const u = users.find((usr) => usr.id === id);
    // Fallback to id if user not found (shouldn't usually happen)
    return u ? `${u.username} (${u.email})` : id;
  };

  // ===== Load all tasks + global statuses =====
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // 1) Load projects
        const projectsRes = await api.get("/projects");
        const projectsData = projectsRes.data || [];
        setProjects(projectsData);

        // 2) Load tasks per project
        const allTasks = [];
        for (const p of projectsData) {
          try {
            const tasksRes = await api.get(`/tasks/${p.id}`);
            const projectTasks = (tasksRes.data || []).map((t) => ({
              ...t,
              project_name: p.name,
              project_id: p.id,
            }));
            allTasks.push(...projectTasks);
          } catch (err) {
            console.error("Failed to load tasks for project", p.id, err);
          }
        }
        setTasks(allTasks);

        // 3) Load global statuses (union across all projects)
        try {
          const res = await api.get("/project-statuses/global");
          const rows = res.data || [];

          if (rows.length > 0) {
            const cols = rows.map((s) => ({
              key: s.status_key || s.key,
              label: s.label || statusLabel(s.status_key || s.key),
            }));

            cols.sort((a, b) => {
              const ia = statusSortIndex(a.key, a.label);
              const ib = statusSortIndex(b.key, b.label);
              if (ia !== ib) return ia - ib;
              return (a.label || a.key).localeCompare(b.label || b.key);
            });

            setStatusColumns(cols);
          } else {
            // fallback defaults in sensible order
            setStatusColumns([
              { key: "pending", label: "Pending" },
              { key: "in-progress", label: "In Progress" },
              { key: "completed", label: "Completed" },
            ]);
          }
        } catch (err) {
          console.error("Failed to load global statuses", err);
          setStatusColumns([
            { key: "pending", label: "Pending" },
            { key: "in-progress", label: "In Progress" },
            { key: "completed", label: "Completed" },
          ]);
        }
      } catch (err) {
        console.error(err);
        const msg = err.response?.data?.error || "Failed to load tasks";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      load();
    }
  }, [user, api]);

  // ===== Load users for assignee labels (admin/manager usually need this) =====
  useEffect(() => {
    // It's still safe for normal users; if /users is restricted, they'll just see IDs.
    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const res = await api.get("/users");
        setUsers(res.data || []);
      } catch (err) {
        console.error("Error fetching users for labels:", err);
        // Avoid toast spam here; it's a non-critical enhancement.
      } finally {
        setLoadingUsers(false);
      }
    }

    if (user) {
      loadUsers();
    }
  }, [user, api]);

  // ===== Apply project filter =====
  const filteredTasks = useMemo(() => {
    if (!selectedProjects || selectedProjects.length === 0) return tasks;
    const selectedSet = new Set(selectedProjects);
    return tasks.filter((t) => selectedSet.has(String(t.project_id)));
  }, [tasks, selectedProjects]);

  // Project options for react-select
  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        value: String(p.id),
        label: p.name,
      })),
    [projects]
  );

  const selectedProjectOptions = useMemo(
    () => projectOptions.filter((opt) => selectedProjects.includes(opt.value)),
    [projectOptions, selectedProjects]
  );

  // Compact styling so project select looks like normal inputs
  const projectSelectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: 32,
      // no fixed height, allow multi-line chips inside the border
      borderRadius: 6,
      borderColor: state.isFocused ? "#0f172a" : "#e2e8f0",
      boxShadow: "none",
      "&:hover": { borderColor: "#cbd5f5" },
      fontSize: 11,
    }),

    valueContainer: (base) => ({
      ...base,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 6,
      paddingRight: 6,
      gap: 4,
    }),
    multiValue: (base) => ({
      ...base,
      borderRadius: 9999,
      backgroundColor: "#e5edff",
    }),
    multiValueLabel: (base) => ({
      ...base,
      fontSize: 11,
    }),
    multiValueRemove: (base) => ({
      ...base,
      ":hover": {
        backgroundColor: "transparent",
        color: "#ef4444",
      },
    }),
    placeholder: (base) => ({
      ...base,
      fontSize: 11,
      color: "#9ca3af",
    }),
    input: (base) => ({
      ...base,
      fontSize: 11,
      margin: 0,
      padding: 0,
    }),
    menu: (base) => ({
      ...base,
      fontSize: 11,
      zIndex: 40,
    }),
    dropdownIndicator: (base) => ({
      ...base,
      padding: 4,
    }),
    clearIndicator: (base) => ({
      ...base,
      padding: 4,
    }),
    indicatorSeparator: () => ({
      display: "none",
    }),
  };

  // ===== Visible columns after status search =====
  const visibleStatusColumns = useMemo(() => {
    const term = statusSearch.trim().toLowerCase();
    if (!term) return statusColumns;
    return statusColumns.filter((col) => {
      const keyMatch = (col.key || "").toLowerCase().includes(term);
      const labelMatch = (col.label || "").toLowerCase().includes(term);
      return keyMatch || labelMatch;
    });
  }, [statusColumns, statusSearch]);

  // ===== Group tasks by status =====
  const grouped = useMemo(() => {
    const result = {};

    statusColumns.forEach((col) => {
      if (col && col.key) result[col.key] = [];
    });

    for (const t of filteredTasks) {
      const key = t.status;
      if (!key) continue;
      if (!result[key]) result[key] = [];
      result[key].push(t);
    }

    return result;
  }, [filteredTasks, statusColumns]);

  // ===== Stats =====
  const stats = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) {
      return {
        total: 0,
        perStatus: {},
        overdue: 0,
      };
    }

    const perStatus = {};
    let overdue = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const t of filteredTasks) {
      const key = t.status || "no-status";
      perStatus[key] = (perStatus[key] || 0) + 1;

      if (t.due_date && t.status !== "completed") {
        const due = new Date(t.due_date);
        due.setHours(0, 0, 0, 0);
        if (due < today) overdue++;
      }
    }

    return {
      total: filteredTasks.length,
      perStatus,
      overdue,
    };
  }, [filteredTasks]);

  // Drag handlers
  const onDragStart = (taskId) => {
    if (!canDrag) return;
    setDragTaskId(taskId);
  };

  const onDragOver = (e) => {
    if (!canDrag) return;
    e.preventDefault();
  };

  const onDragEnd = () => {
    setDragTaskId(null);
  };

  const onDrop = async (newStatus) => {
    if (!canDrag) return;
    if (!dragTaskId) return;

    const task = tasks.find((t) => t.id === dragTaskId);
    if (!task) return;
    if (task.status === newStatus) {
      setDragTaskId(null);
      return;
    }

    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus });

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
      );

      setSelectedTaskDetails((prev) =>
        prev && prev.id === task.id ? { ...prev, status: newStatus } : prev
      );
    } catch (err) {
      console.error("Failed to update task status:", err);
      const msg =
        err.response?.data?.error || "Failed to update task status";
      toast.error(msg);
    } finally {
      setDragTaskId(null);
    }
  };

  // Attachments
  const loadAttachmentsForTask = async (taskId) => {
    setLoadingAttachments(true);
    setAttachments([]);
    try {
      const res = await api.get(`/tasks/${taskId}/attachments`);
      setAttachments(res.data || []);
    } catch (err) {
      console.error("Failed to load attachments:", err);
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleCardClick = (task) => {
    setSelectedTaskDetails(task);
    setIsEditing(false);
    setEditTask({
      task: task.task || "",
      status: task.status || "",
      assigned_to: task.assigned_to || "",
      due_date: task.due_date ? task.due_date.slice(0, 10) : "",
      description: task.description || "",
      project_name: task.project_name || "",
      project_id: task.project_id || null,
      priority: task.priority || "medium",
    });
    loadAttachmentsForTask(task.id);
  };

  const handleUploadAttachment = async () => {
    if (!selectedTaskDetails) return;
    if (!uploadFile) {
      toast.error("Please select a file first");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      await api.post(
        `/tasks/${selectedTaskDetails.id}/attachments`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setUploadFile(null);
      await loadAttachmentsForTask(selectedTaskDetails.id);
      toast.success("Attachment uploaded");
    } catch (err) {
      console.error("Failed to upload attachment:", err);
      const msg =
        err.response?.data?.error || "Failed to upload attachment";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  // Edit handlers
  const handleEditFieldChange = (e) => {
    const { name, value } = e.target;
    setEditTask((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveEdit = async () => {
    if (!selectedTaskDetails || !editTask) return;
    setSavingEdit(true);
    try {
      const payload = {
        task: editTask.task,
        status: editTask.status || null,
        assigned_to: editTask.assigned_to || null,
        due_date: editTask.due_date || null,
        description: editTask.description,
        priority: editTask.priority || "medium",
      };
      const res = await api.put(`/tasks/${selectedTaskDetails.id}`, payload);
      const updated = res.data;

      setTasks((prev) =>
        prev.map((t) =>
          t.id === updated.id
            ? { ...updated, project_name: t.project_name, project_id: t.project_id }
            : t
        )
      );
      setSelectedTaskDetails((prev) =>
        prev
          ? {
              ...updated,
              project_name: prev.project_name,
              project_id: prev.project_id,
            }
          : prev
      );
      setIsEditing(false);
      toast.success("Task updated");
    } catch (err) {
      console.error("Failed to save task:", err);
      const msg = err.response?.data?.error || "Failed to save task";
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTaskDetails) return;
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    try {
      await api.delete(`/tasks/${selectedTaskDetails.id}`);
      setTasks((prev) =>
        prev.filter((t) => t.id !== selectedTaskDetails.id)
      );
      setSelectedTaskDetails(null);
      setAttachments([]);
      toast.success("Task deleted");
    } catch (err) {
      console.error("Failed to delete task:", err);
      const msg = err.response?.data?.error || "Failed to delete task";
      toast.error(msg);
    }
  };

  // Copy deep link
  const handleCopyTaskLink = async () => {
    if (!selectedTaskDetails) return;
    try {
      let url;
      if (selectedTaskDetails.project_id) {
        url = `${window.location.origin}/projects/${selectedTaskDetails.project_id}?task=${selectedTaskDetails.id}`;
      } else {
        url = `${window.location.origin}/my-tasks?task=${selectedTaskDetails.id}`;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch (err) {
      console.error("Failed to copy link:", err);
      toast.error("Failed to copy link");
    }
  };

  // Deep-link: auto-open ?task=<id>
  useEffect(() => {
    if (initialTaskOpened) return;
    if (!tasks || tasks.length === 0) return;

    const params = new URLSearchParams(location.search);
    const taskId = params.get("task");
    if (!taskId) return;

    const found = tasks.find((t) => String(t.id) === String(taskId));
    if (!found) {
      setInitialTaskOpened(true);
      return;
    }

    handleCardClick(found);
    setInitialTaskOpened(true);
  }, [tasks, location.search, initialTaskOpened]);

  // Filter handlers
  const handleProjectFilterChange = (options) => {
    const values = (options || []).map((opt) => opt.value);
    setSelectedProjects(values);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white rounded-xl shadow p-4 flex flex-col gap-3">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-xs text-slate-500">{subtitle}</p>
          {filteredTasks.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-600">
              Total: <b>{stats.total}</b>
              {visibleStatusColumns.length > 0 && " • "}
              {visibleStatusColumns.map((col, idx) => (
                <span key={col.key}>
                  {col.label}: {stats.perStatus[col.key] ?? 0}
                  {idx < visibleStatusColumns.length - 1 ? " • " : ""}
                </span>
              ))}
              {" • "}
              Overdue:{" "}
              <span
                className={
                  stats.overdue > 0
                    ? "text-red-500 font-semibold"
                    : "text-slate-400"
                }
              >
                {stats.overdue}
              </span>
            </p>
          )}
        </div>

        {/* Filters */}
        <section className="bg-white rounded-xl shadow p-4">
          <div className="flex flex-wrap gap-4 items-start text-[11px]">
            {/* Projects */}
            <div className="flex flex-col gap-1 min-w-[220px] max-w-xs">
              <span className="text-slate-600">Projects (multi-select)</span>
              <Select
                isMulti
                options={projectOptions}
                value={selectedProjectOptions}
                onChange={handleProjectFilterChange}
                styles={projectSelectStyles}
                className="min-w-[220px] text-[11px]"
                classNamePrefix="rs"
                placeholder="Select..."
              />
              <span className="text-[10px] text-slate-400">
                Leave empty for all.
              </span>
            </div>

            {/* Status search */}
            <div className="flex flex-col gap-1 min-w-[220px] max-w-xs">
              <span className="text-slate-600">Status search</span>
              <input
                type="text"
                placeholder="Search status..."
                value={statusSearch}
                onChange={(e) => setStatusSearch(e.target.value)}
                className="border rounded px-2 py-[6px] text-[11px] min-w-[220px]"
              />
              {/* Invisible helper to match height */}
              <span className="text-[10px] text-slate-400 opacity-0">
                Leave empty for all.
              </span>
            </div>

            {/* Button */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] opacity-0">placeholder</span>
              <button
                type="button"
                onClick={() => setHideEmpty((v) => !v)}
                className="inline-flex items-center gap-1 border rounded px-3 py-1 text-[11px] text-slate-700 bg-slate-50 hover:bg-slate-100 h-8"
              >
                {hideEmpty ? "Show empty columns" : "Hide empty columns"}
              </button>
            </div>
          </div>
        </section>
      </section>

      {/* Board */}
      <section className="bg-white rounded-xl shadow p-4">
        {loading ? (
          <div className="text-sm text-slate-500">Loading tasks...</div>
        ) : statusColumns.length === 0 ? (
          <div className="text-sm text-slate-500">
            No status columns defined for your projects yet.
          </div>
        ) : (
          <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 overflow-x-auto pb-2">
            {visibleStatusColumns.map((col) => {
              const colTasks = grouped[col.key] || [];
              if (hideEmpty && colTasks.length === 0) return null;

              return (
                <div
                  key={col.key}
                  className="border border-slate-200 rounded-lg min-h-[200px] p-2 bg-slate-50"
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(col.key)}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold">{col.label}</span>
                    <span className="text-[10px] text-slate-500">
                      {colTasks.length} tasks
                    </span>
                  </div>

                  <div className="space-y-2">
                    {colTasks.map((t) => (
                      <div
                        key={t.id}
                        draggable={canDrag}
                        onDragStart={() => onDragStart(t.id)}
                        onDragEnd={onDragEnd}
                        className={
                          "border rounded-lg px-2 py-2 text-xs bg-white " +
                          (canDrag
                            ? "cursor-grab active:cursor-grabbing "
                            : "cursor-default ") +
                          (isOverdue(t)
                            ? "border-red-300 bg-red-50"
                            : "border-slate-200")
                        }
                        onClick={() => handleCardClick(t)}
                      >
                        <div className="font-medium text-[11px]">
                          {t.task}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Project: {t.project_name}
                        </div>
                        {t.assigned_to && (
                          <div className="text-[10px] text-slate-500">
                            Assigned to: {getAssigneeLabel(t.assigned_to)}
                          </div>
                        )}

                        {(t.subtasks_total ?? 0) > 0 && (
                          <div className="text-[10px] text-slate-500">
                            ({t.subtasks_completed ?? 0}/
                            {t.subtasks_total ?? 0} subtasks completed)
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400">
                          {t.due_date &&
                            `Due: ${new Date(
                              t.due_date
                            ).toLocaleDateString()}`}
                        </div>

                        <div className="mt-1 flex items-center justify-between">
                          <span
                            className={
                              "inline-flex items-center rounded-full border px-2 py-[1px] text-[10px] font-medium " +
                              priorityBadgeClass(t.priority)
                            }
                          >
                            {priorityLabel(t.priority)}
                          </span>
                          {isOverdue(t) && (
                            <span className="text-[10px] text-red-600 font-semibold">
                              Overdue
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Task details MODAL */}
      {selectedTaskDetails && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto">
          <div className="mt-16 mb-8 w-full max-w-3xl px-4">
            <section className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    Task Details: {selectedTaskDetails.task}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Status: {statusLabel(selectedTaskDetails.status)}{" "}
                    {selectedTaskDetails.due_date &&
                      ` • Due: ${new Date(
                        selectedTaskDetails.due_date
                      ).toLocaleDateString()}`}
                  </p>
                  {selectedTaskDetails.project_name && (
                    <p className="text-[11px] text-slate-500">
                      Project: {selectedTaskDetails.project_name}
                    </p>
                  )}

                  {(selectedTaskDetails.subtasks_total ?? 0) > 0 && (
                    <p className="text-[11px] text-slate-500">
                      Progress: {selectedTaskDetails.subtasks_completed ?? 0}/
                      {selectedTaskDetails.subtasks_total ?? 0} subtasks
                      completed
                    </p>
                  )}

                  {selectedTaskDetails.assigned_to && (
                    <p className="text-[11px] text-slate-500">
                      Assigned to:{" "}
                      {getAssigneeLabel(selectedTaskDetails.assigned_to)}
                    </p>
                  )}

                  <p className="text-[11px] text-slate-500">
                    Priority:{" "}
                    {priorityLabel(
                      selectedTaskDetails.priority || "medium"
                    )}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {canAdminEdit && (
                    <div className="flex gap-2">
                      <button
                        className="text-[11px] text-blue-600 underline"
                        onClick={() => setIsEditing((v) => !v)}
                      >
                        {isEditing ? "Cancel edit" : "Edit task"}
                      </button>
                      <button
                        className="text-[11px] text-red-600 underline"
                        onClick={handleDeleteTask}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      className="text-[11px] text-slate-600 underline"
                      onClick={handleCopyTaskLink}
                    >
                      Copy link
                    </button>
                    <button
                      className="text-[11px] text-slate-500 underline"
                      onClick={() => {
                        setSelectedTaskDetails(null);
                        setAttachments([]);
                        setIsEditing(false);
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>

              {/* Read-only description */}
              {!isEditing && (
                <div className="mt-3">
                  <h3 className="text-xs font-semibold mb-1">Description</h3>
                  {selectedTaskDetails.description ? (
                    <div
                      className="prose prose-sm max-w-none text-xs"
                      dangerouslySetInnerHTML={{
                        __html: selectedTaskDetails.description,
                      }}
                    />
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      No description provided.
                    </p>
                  )}
                </div>
              )}

              {/* Simple edit form */}
              {isEditing && editTask && (
                <div className="mt-3 border-t pt-3">
                  <h3 className="text-xs font-semibold mb-2">
                    Edit task (admin / manager)
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-2">
                      <label className="block">Title</label>
                      <input
                        type="text"
                        name="task"
                        value={editTask.task}
                        onChange={handleEditFieldChange}
                        className="w-full border rounded px-2 py-1"
                      />

                      <label className="block mt-2">Status</label>
                      <select
                        name="status"
                        value={editTask.status || ""}
                        onChange={handleEditFieldChange}
                        className="w-full border rounded px-2 py-1"
                      >
                        <option value="">No status</option>
                        {statusColumns.map((col) => (
                          <option key={col.key} value={col.key}>
                            {col.label}
                          </option>
                        ))}
                      </select>

                      <label className="block mt-2">Priority</label>
                      <select
                        name="priority"
                        value={editTask.priority || "medium"}
                        onChange={handleEditFieldChange}
                        className="w-full border rounded px-2 py-1"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>

                      <label className="block mt-2">Due date</label>
                      <input
                        type="date"
                        name="due_date"
                        value={editTask.due_date || ""}
                        onChange={handleEditFieldChange}
                        className="w-full border rounded px-2 py-1"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block">Assign to</label>
                      <input
                        type="text"
                        name="assigned_to"
                        value={editTask.assigned_to || ""}
                        onChange={handleEditFieldChange}
                        className="w-full border rounded px-2 py-1"
                        placeholder="User ID or leave blank"
                      />

                      <label className="block mt-2">Description</label>
                      <textarea
                        name="description"
                        value={editTask.description || ""}
                        onChange={handleEditFieldChange}
                        className="w-full border rounded px-2 py-1 min-h-[80px]"
                        placeholder="Update description (HTML or text)"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={handleSaveEdit}
                      className="bg-blue-600 text-white text-[11px] rounded px-3 py-1 disabled:opacity-50"
                    >
                      {savingEdit ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </div>
              )}

              {/* Subtasks panel */}
              <Subtasks taskId={selectedTaskDetails.id} />

              {/* Comments */}
              <div className="mt-3 border-t pt-3">
                <h3 className="text-xs font-semibold mb-1">Comments</h3>
                <CommentsSection taskId={selectedTaskDetails.id} />
              </div>

              {/* Attachments */}
              <div className="mt-3 border-t pt-3">
                <h3 className="text-xs font-semibold mb-1">Attachments</h3>

                {loadingAttachments ? (
                  <p className="text-[11px] text-slate-400">
                    Loading attachments...
                  </p>
                ) : attachments.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    No attachments.
                  </p>
                ) : (
                  <ul className="text-[11px] text-slate-600 list-disc ml-4">
                    {attachments.map((att) => (
                      <li key={att.id}>{att.original_name}</li>
                    ))}
                  </ul>
                )}

                {selectedTaskDetails && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="file"
                      className="text-[11px]"
                      onChange={(e) =>
                        setUploadFile(e.target.files?.[0] || null)
                      }
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={handleUploadAttachment}
                      className="bg-slate-800 text-white text-[11px] rounded px-3 py-1 disabled:opacity-50"
                    >
                      {uploading ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
