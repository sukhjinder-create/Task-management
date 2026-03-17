// src/pages/MyTasks.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Calendar, User as UserIcon, AlertCircle, CheckCircle2, Edit2, Trash2, Link as LinkIcon, Upload, Bug, Zap, Star, Wrench, ShieldAlert, BarChart2, Hash, Layers, Flag, Plus, X, Filter } from "lucide-react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import CommentsSection from "../components/CommentsSection.jsx";
import Subtasks from "../components/Subtasks.jsx";
import Select from "react-select";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Card, Badge, Button } from "../components/ui";
import TagPicker from "../components/TagPicker.jsx";
import IssueLinkPanel from "../components/IssueLinkPanel.jsx";
import TimeTrackingPanel from "../components/TimeTrackingPanel.jsx";
import WatchersVotesBar from "../components/WatchersVotesBar.jsx";

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

function priorityBadgeColor(priority) {
  if (priority === "high") return "danger";
  if (priority === "low") return "success";
  return "warning";
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

const TASK_TYPES = [
  { value: "task",        label: "Task",        color: "text-slate-500",   bg: "bg-slate-100"   },
  { value: "bug",         label: "Bug",         color: "text-red-600",     bg: "bg-red-50"      },
  { value: "feature",     label: "Feature",     color: "text-indigo-600",  bg: "bg-indigo-50"   },
  { value: "improvement", label: "Improvement", color: "text-emerald-600", bg: "bg-emerald-50"  },
  { value: "chore",       label: "Chore",       color: "text-amber-600",   bg: "bg-amber-50"    },
];

const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21];

function TaskTypeIcon({ type, className = "w-3 h-3" }) {
  if (type === "bug")         return <Bug          className={className} />;
  if (type === "feature")     return <Zap          className={className} />;
  if (type === "improvement") return <Star         className={className} />;
  if (type === "chore")       return <Wrench       className={className} />;
  return                             <CheckCircle2 className={className} />;
}

function TaskTypeBadge({ type }) {
  const t = TASK_TYPES.find(x => x.value === type) || TASK_TYPES[0];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${t.bg} ${t.color}`}>
      <TaskTypeIcon type={type} />
      {t.label}
    </span>
  );
}

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "image"],
    ["clean"],
  ],
};

const quillFormats = [
  "header", "bold", "italic", "underline",
  "list", "bullet", "link", "image",
];

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
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const canAdminEdit = role === "admin" || role === "manager";

  // ─── NEW FEATURE STATE ────────────────────────────────────
  const [filterType, setFilterType] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const editEditorRef = useRef(null);

  const [taskViewMode, setTaskViewMode] = useState("board"); // "board" | "list"
  const [listSort, setListSort] = useState({ col: "created_at", dir: "desc" });

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
            const colsMap = new Map();

for (const s of rows) {
  const key = s.status_key || s.key;
  if (!key) continue;

  if (!colsMap.has(key)) {
    colsMap.set(key, {
      key,
      label: s.label || statusLabel(key),
    });
  }
}

const cols = Array.from(colsMap.values());

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
    let list = tasks;
    if (selectedProjects && selectedProjects.length > 0) {
      const selectedSet = new Set(selectedProjects);
      list = list.filter((t) => selectedSet.has(String(t.project_id)));
    }
    if (filterType) list = list.filter(t => (t.task_type || "task") === filterType);
    return list;
  }, [tasks, selectedProjects, filterType]);

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

  const loadLogsForTask = async (taskId) => {
  setLoadingLogs(true);
  setActivityLogs([]);
  try {
    const res = await api.get(`/tasks/${taskId}/logs`);
    setActivityLogs(res.data || []);
  } catch (err) {
    console.error("Failed to load activity logs:", err);
    setActivityLogs([]);
  } finally {
    setLoadingLogs(false);
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
      task_type: task.task_type || "task",
      story_points: task.story_points != null ? String(task.story_points) : "",
      is_blocked: task.is_blocked || false,
    });
    loadAttachmentsForTask(task.id);
    loadLogsForTask(task.id);
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

  const handleEditDescriptionChange = (value) => {
    setEditTask((prev) => ({
      ...prev,
      description: value,
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
        task_type: editTask.task_type || "task",
        story_points: editTask.story_points ? parseInt(editTask.story_points) : null,
        is_blocked: editTask.is_blocked || false,
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;
      if (e.key === "Escape" && selectedTaskDetails) {
        setSelectedTaskDetails(null); setAttachments([]); setIsEditing(false);
      }
      if (e.key === "f") { e.preventDefault(); setShowFilters(v => !v); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedTaskDetails]);

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
      const url = selectedTaskDetails.project_id
        ? `${window.location.origin}/projects/${selectedTaskDetails.project_id}?task=${selectedTaskDetails.id}`
        : `${window.location.origin}/my-tasks?task=${selectedTaskDetails.id}`;
      const id = selectedTaskDetails.display_id;
      const titleText = selectedTaskDetails.task;
      const label = id ? `${id} ${titleText}` : titleText;
      const htmlContent = id ? `<a href="${url}">${id}</a> ${titleText}` : `<a href="${url}">${titleText}</a>`;
      const plainContent = `${label}\n${url}`;
      if (navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([htmlContent], { type: "text/html" }),
            "text/plain": new Blob([plainContent], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plainContent);
      }
      toast.success("Link copied");
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

  const formatLogMessage = (log) => {
  const user = log.actor_username || "Someone";

  const parse = (value) => {
    if (!value) return null;
    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      return value;
    }
  };

  const oldVal = parse(log.old_value);
  const newVal = parse(log.new_value);

  switch (log.action_type) {
    case "STATUS_CHANGED": {
      const oldStatus = oldVal?.status || oldVal;
      const newStatus = newVal?.status || newVal;
      return `Status changed from "${oldStatus}" to "${newStatus}" by ${user}`;
    }

    case "PRIORITY_CHANGED": {
      const oldPriority = oldVal?.priority || oldVal;
      const newPriority = newVal?.priority || newVal;
      return `Priority changed from "${oldPriority}" to "${newPriority}" by ${user}`;
    }

    case "ASSIGNEE_CHANGED": {
  const from = log.old_assignee_username || "Unassigned";
  const to = log.new_assignee_username || "Unassigned";
  const actor = log.actor_username || "Someone";

  return `Assignee changed from "${from}" to "${to}" by ${actor}`;
}

    case "DESCRIPTION_UPDATED":
      return `Description updated by ${user}`;

    case "TITLE_CHANGED": {
      const oldTitle = oldVal?.task || oldVal;
      const newTitle = newVal?.task || newVal;
      return `Title changed from "${oldTitle}" to "${newTitle}" by ${user}`;
    }

    case "COMMENT_ADDED":
      return `Comment added by ${user}`;

    case "TASK_CREATED":
      return `Task created by ${user}`;

    case "TASK_DELETED":
      return `Task deleted by ${user}`;

    default:
      return `${log.action_type} by ${user}`;
  }
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
                <span key={`${col.key}-${idx}`}>
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

      {/* Board / List */}
      <section className="bg-white rounded-xl shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Tasks</h2>
          <div className="flex items-center gap-2">
            <button
              className={`text-[11px] border rounded-lg px-2 py-1 flex items-center gap-1 ${showFilters || filterType || filterProject ? "bg-indigo-600 text-white border-indigo-600" : "text-slate-600 border-slate-200 hover:bg-slate-50"}`}
              onClick={() => setShowFilters(v => !v)}
              title="Filter (f)"
            >
              <Filter className="w-3 h-3" /> Filter
            </button>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px]">
              <button
                className={`px-2 py-1 flex items-center gap-1 ${taskViewMode === "board" ? "bg-slate-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setTaskViewMode("board")}
              >
                <Layers className="w-3 h-3" /> Board
              </button>
              <button
                className={`px-2 py-1 flex items-center gap-1 ${taskViewMode === "list" ? "bg-slate-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setTaskViewMode("list")}
              >
                <Flag className="w-3 h-3" /> List
              </button>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="mb-3 flex items-center flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-600">Filters:</span>
            <select
              className="text-[11px] border rounded px-2 py-1"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="">All types</option>
              {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {(filterType || filterProject) && (
              <button className="text-[11px] text-red-500 hover:underline" onClick={() => { setFilterType(""); setFilterProject(""); }}>Clear</button>
            )}
          </div>
        )}
        {loading ? (
          <div className="text-sm text-slate-500">Loading tasks...</div>
        ) : taskViewMode === "list" ? (
          (() => {
            const sortedList = [...filteredTasks].sort((a, b) => {
              const dir = listSort.dir === "asc" ? 1 : -1;
              if (listSort.col === "story_points") return dir * ((a.story_points ?? -1) - (b.story_points ?? -1));
              const va = a[listSort.col] ?? "";
              const vb = b[listSort.col] ?? "";
              return dir * String(va).localeCompare(String(vb));
            });
            const SortBtn = ({ col, label }) => (
              <button
                className="flex items-center gap-0.5 hover:text-indigo-600"
                onClick={() => setListSort(s => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }))}
              >
                {label}{listSort.col === col ? (listSort.dir === "asc" ? " ↑" : " ↓") : ""}
              </button>
            );
            return (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left w-24">ID</th>
                      <th className="px-3 py-2 text-left"><SortBtn col="task" label="Title" /></th>
                      <th className="px-3 py-2 text-left w-28">Project</th>
                      <th className="px-3 py-2 text-left w-24"><SortBtn col="task_type" label="Type" /></th>
                      <th className="px-3 py-2 text-left w-24"><SortBtn col="status" label="Status" /></th>
                      <th className="px-3 py-2 text-left w-24"><SortBtn col="priority" label="Priority" /></th>
                      <th className="px-3 py-2 text-left w-16"><SortBtn col="story_points" label="Pts" /></th>
                      <th className="px-3 py-2 text-left w-28"><SortBtn col="due_date" label="Due" /></th>
                      <th className="px-3 py-2 text-left w-32">Assignee</th>
                      <th className="px-3 py-2 text-left w-16">Flags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedList.map(t => (
                      <tr
                        key={t.id}
                        className={`cursor-pointer hover:bg-slate-50 transition-colors ${isOverdue(t) ? "bg-red-50" : ""}`}
                        onClick={() => handleCardClick(t)}
                      >
                        <td className="px-3 py-2 font-mono text-indigo-500 font-semibold text-[10px]">{t.display_id || "—"}</td>
                        <td className="px-3 py-2 font-medium text-slate-800 max-w-[200px] truncate">
                          {t.task}
                          {(t.subtasks_total ?? 0) > 0 && (
                            <span className="ml-1.5 text-[10px] text-slate-400">{t.subtasks_completed}/{t.subtasks_total} st</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-indigo-500 text-[11px] truncate">{t.project_name}</td>
                        <td className="px-3 py-2"><TaskTypeBadge type={t.task_type || "task"} /></td>
                        <td className="px-3 py-2 capitalize text-slate-600">{statusLabel(t.status)}</td>
                        <td className="px-3 py-2">
                          <Badge color={priorityBadgeColor(t.priority)} size="sm" variant="subtle">{priorityLabel(t.priority)}</Badge>
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-slate-600">
                          {t.story_points != null ? t.story_points : <span className="text-slate-300">—</span>}
                        </td>
                        <td className={`px-3 py-2 ${isOverdue(t) ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                          {t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-600 truncate max-w-[120px]">
                          {t.assigned_to ? getAssigneeLabel(t.assigned_to) : <span className="text-slate-300">Unassigned</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {t.is_blocked && <ShieldAlert className="w-3.5 h-3.5 text-red-500" title="Blocked" />}
                            {isOverdue(t) && <AlertCircle className="w-3.5 h-3.5 text-red-400" title="Overdue" />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()
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
                      <Card
                        key={t.id}
                        draggable={canDrag}
                        onDragStart={() => onDragStart(t.id)}
                        onDragEnd={onDragEnd}
                        className={
                          "transition-all " +
                          (canDrag
                            ? "cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5 "
                            : "cursor-default ") +
                          (isOverdue(t)
                            ? "border-danger-300 bg-danger-50"
                            : "border-gray-200 hover:border-primary-200")
                        }
                        onClick={() => handleCardClick(t)}
                      >
                        <Card.Content className="p-3 space-y-2">
                          {/* ID + type + blocked + points row */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {t.display_id && (
                              <span className="text-[10px] font-mono text-indigo-500 font-semibold flex items-center gap-0.5">
                                <Hash className="w-3 h-3" />{t.display_id}
                              </span>
                            )}
                            <TaskTypeBadge type={t.task_type || "task"} />
                            {t.is_blocked && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                                <ShieldAlert className="w-3 h-3" /> Blocked
                              </span>
                            )}
                            {t.story_points != null && (
                              <span className="ml-auto text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                                {t.story_points} pts
                              </span>
                            )}
                          </div>

                          <div className="font-medium text-sm text-gray-900">{t.task}</div>

                          <div className="text-[11px] text-indigo-500 font-medium">{t.project_name}</div>

                          {t.assigned_to && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <UserIcon className="w-3 h-3" />
                              {getAssigneeLabel(t.assigned_to)}
                            </div>
                          )}

                          {(t.subtasks_total ?? 0) > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <CheckCircle2 className="w-3 h-3" />
                              {t.subtasks_completed ?? 0}/{t.subtasks_total ?? 0} subtasks
                            </div>
                          )}

                          {t.due_date && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Calendar className="w-3 h-3" />
                              {new Date(t.due_date).toLocaleDateString()}
                            </div>
                          )}

                          <div className="mt-2 flex items-center justify-between flex-wrap gap-1">
                            <Badge color={priorityBadgeColor(t.priority)} size="sm" variant="subtle">
                              {priorityLabel(t.priority)}
                            </Badge>
                            {t.sprint_name && (
                              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                <Layers className="w-2.5 h-2.5" />
                                {t.sprint_name}
                              </span>
                            )}
                            {isOverdue(t) && (
                              <Badge color="danger" size="sm" variant="solid" className="gap-1">
                                <AlertCircle className="w-3 h-3" /> Overdue
                              </Badge>
                            )}
                          </div>
                        </Card.Content>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Task details panel */}
      {selectedTaskDetails && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto">
          <div className="mt-16 mb-8 w-full max-w-3xl px-4">
            <section className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  {/* Ticket ID + badges row */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {selectedTaskDetails.display_id && (
                      <span className="font-mono text-[11px] text-indigo-500 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                        {selectedTaskDetails.display_id}
                      </span>
                    )}
                    <TaskTypeBadge type={selectedTaskDetails.task_type || "task"} />
                    {selectedTaskDetails.is_blocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                        <ShieldAlert className="w-3 h-3" /> Blocked
                      </span>
                    )}
                    {selectedTaskDetails.story_points != null && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                        <BarChart2 className="w-3 h-3" /> {selectedTaskDetails.story_points} pts
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-semibold">
                    {selectedTaskDetails.task}{" "}
                    {(selectedTaskDetails.subtasks_total ?? 0) > 0 && (
                      <span className="ml-1 text-[11px] font-normal text-slate-500">
                        ({selectedTaskDetails.subtasks_completed ?? 0}/{selectedTaskDetails.subtasks_total ?? 0} subtasks)
                      </span>
                    )}
                  </h2>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    <p className="text-[11px] text-slate-500">
                      Status: <span className="font-medium text-slate-700">{statusLabel(selectedTaskDetails.status)}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Priority: <span className="font-medium text-slate-700">{priorityLabel(selectedTaskDetails.priority || "medium")}</span>
                    </p>
                    {selectedTaskDetails.project_name && (
                      <p className="text-[11px] text-slate-500">
                        Project: <span className="font-medium text-slate-700">{selectedTaskDetails.project_name}</span>
                      </p>
                    )}
                    {selectedTaskDetails.due_date && (
                      <p className="text-[11px] text-slate-500">
                        Due: <span className={`font-medium ${isOverdue(selectedTaskDetails) ? "text-red-600" : "text-slate-700"}`}>
                          {new Date(selectedTaskDetails.due_date).toLocaleDateString()}
                        </span>
                      </p>
                    )}
                    {selectedTaskDetails.assigned_to && (
                      <p className="text-[11px] text-slate-500">
                        Assigned: <span className="font-medium text-slate-700">{getAssigneeLabel(selectedTaskDetails.assigned_to)}</span>
                      </p>
                    )}
                    {selectedTaskDetails.sprint_name && (
                      <p className="text-[11px] text-slate-500">
                        Sprint: <span className="font-medium text-indigo-600">{selectedTaskDetails.sprint_name}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canAdminEdit && (
                    <button
                      title={isEditing ? "Cancel edit" : "Edit task"}
                      onClick={() => setIsEditing((v) => !v)}
                      className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${isEditing ? "text-slate-500" : "text-blue-600"}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canAdminEdit && (
                    <button
                      title="Delete task"
                      onClick={handleDeleteTask}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    title="Copy link"
                    onClick={handleCopyTaskLink}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors"
                  >
                    <LinkIcon className="w-4 h-4" />
                  </button>
                  <button
                    title="Close"
                    onClick={() => {
                      setSelectedTaskDetails(null);
                      setAttachments([]);
                      setIsEditing(false);
                    }}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Read-only description */}
              {!isEditing && (
                <div className="mt-3">
                  <h3 className="text-xs font-semibold mb-1">Description</h3>
                  {selectedTaskDetails.description ? (
                    <div
                      className="prose prose-sm max-w-none text-xs"
                      dangerouslySetInnerHTML={{ __html: selectedTaskDetails.description }}
                    />
                  ) : (
                    <p className="text-[11px] text-slate-500">No description provided.</p>
                  )}
                </div>
              )}

              {/* Edit form */}
              {isEditing && editTask && (
                <div className="mt-3 border-t pt-3">
                  <h3 className="text-xs font-semibold mb-2">Edit task</h3>
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
                          <option key={col.key} value={col.key}>{col.label}</option>
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

                      <label className="block mt-2">Type</label>
                      <select
                        name="task_type"
                        value={editTask.task_type || "task"}
                        onChange={handleEditFieldChange}
                        className="w-full border rounded px-2 py-1"
                      >
                        {TASK_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>

                      <label className="block mt-2">Story Points</label>
                      <select
                        name="story_points"
                        value={editTask.story_points || ""}
                        onChange={handleEditFieldChange}
                        className="w-full border rounded px-2 py-1"
                      >
                        <option value="">No estimate</option>
                        {STORY_POINTS.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="is_blocked_mytasks"
                          checked={editTask.is_blocked || false}
                          onChange={e => setEditTask(prev => ({ ...prev, is_blocked: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300 text-red-600"
                        />
                        <label htmlFor="is_blocked_mytasks" className="text-xs text-gray-700 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-red-500" /> Mark as blocked
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block">Assign to</label>
                      <select
                        name="assigned_to"
                        value={editTask.assigned_to || ""}
                        onChange={handleEditFieldChange}
                        className="w-full border rounded px-2 py-1"
                      >
                        <option value="">Unassigned</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
                        ))}
                      </select>

                      <label className="block mt-2">Description</label>
                      <div className="quill-editor">
                        <ReactQuill
                          ref={editEditorRef}
                          theme="snow"
                          value={editTask.description || ""}
                          onChange={handleEditDescriptionChange}
                          className="text-xs min-h-[160px]"
                          modules={quillModules}
                          formats={quillFormats}
                        />
                      </div>
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

              {/* Subtasks */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <Subtasks taskId={selectedTaskDetails.id} />
              </div>

              {/* Comments */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <CommentsSection taskId={selectedTaskDetails.id} />
              </div>

              {/* Attachments */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <h3 className="text-xs font-semibold mb-2">Attachments</h3>
                {loadingAttachments ? (
                  <p className="text-[11px] text-slate-400">Loading attachments...</p>
                ) : attachments.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No attachments yet.</p>
                ) : (
                  <ul className="space-y-1.5 mb-3">
                    {attachments.map((att) => (
                      <li key={att.id} className="flex items-center gap-2 text-[11px] text-gray-700 bg-gray-50 rounded px-2 py-1.5">
                        <Upload className="w-3.5 h-3.5 text-gray-400" />
                        {att.original_name}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    className="text-[11px] flex-1"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={handleUploadAttachment}
                    className="bg-slate-700 text-white text-[11px] rounded px-3 py-1 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <h3 className="text-xs font-semibold mb-2">Activity Timeline</h3>
                {loadingLogs ? (
                  <p className="text-[11px] text-slate-400">Loading activity...</p>
                ) : activityLogs.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No activity recorded.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                        <div className="text-[11px] font-medium text-gray-700">{formatLogMessage(log)}</div>
                        <div className="text-[10px] text-gray-400 mt-1">{new Date(log.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="mt-3 border-t pt-3">
                <h3 className="text-xs font-semibold mb-2">Tags</h3>
                <TagPicker taskId={selectedTaskDetails.id} readOnly={!canAdminEdit} />
              </div>

              {/* Issue Links */}
              <IssueLinkPanel taskId={selectedTaskDetails.id} canEdit={canAdminEdit} />

              {/* Time Tracking */}
              <TimeTrackingPanel taskId={selectedTaskDetails.id} canEdit={canAdminEdit} />

              {/* Watchers + Votes */}
              <WatchersVotesBar taskId={selectedTaskDetails.id} />

            </section>
          </div>
        </div>
      )}

      {/* Keyboard shortcut hint */}
      <div className="fixed bottom-4 right-4 z-10 text-[10px] text-slate-400 bg-white/80 backdrop-blur border border-slate-200 rounded-lg px-2 py-1 shadow hidden md:block">
        <span className="mr-2"><kbd className="bg-slate-100 px-1 rounded">Esc</kbd> Close</span>
        <span><kbd className="bg-slate-100 px-1 rounded">f</kbd> Filter</span>
      </div>
    </div>
  );
}
