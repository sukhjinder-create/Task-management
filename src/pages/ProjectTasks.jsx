// src/pages/ProjectTasks.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Calendar, User as UserIcon, AlertCircle, CheckCircle2, Plus, X, Edit2, Trash2, LinkIcon, Mic, MicOff, Sparkles, Layers, Play, Flag, Hash, Bug, Zap, Star, Wrench, ShieldAlert, BarChart2, TrendingDown, Keyboard, Filter, EyeOff, Target } from "lucide-react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import CommentsSection from "../components/CommentsSection.jsx";
import Subtasks from "../components/Subtasks.jsx";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Card, Badge, Button, Modal, Input, Select as SelectUI, Avatar } from "../components/ui";
import TagPicker from "../components/TagPicker.jsx";
import IssueLinkPanel from "../components/IssueLinkPanel.jsx";
import TimeTrackingPanel from "../components/TimeTrackingPanel.jsx";
import WatchersVotesBar from "../components/WatchersVotesBar.jsx";
import BurndownModal from "../components/BurndownModal.jsx";
import SavedFiltersPanel from "../components/SavedFiltersPanel.jsx";

function statusLabel(status) {
  if (status === "backlog") return "Backlog";
  if (status === "pending") return "Pending";
  if (status === "in-progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (!status) return "No status";
  return status;
}

const FIXED_STATUS_KEYS = new Set(["backlog", "pending", "in-progress", "completed"]);
const LOCKED_EDGE_KEYS = new Set(["backlog", "completed"]);

function normalizeStatusLabel(value = "") {
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
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

function historyActorLabel(log) {
  return log?.username || log?.email || "Someone";
}

function formatProjectHistoryMessage(log) {
  const actor = historyActorLabel(log);
  const taskTitle = log?.metadata?.taskTitle || log?.old_value?.task || log?.new_value?.task || "task";
  const sprintName = log?.metadata?.sprintName || log?.new_value?.name || log?.old_value?.name || "sprint";
  const columnLabel = log?.new_value?.label || log?.old_value?.label || "column";

  switch (log?.action) {
    case "project.history.project.created":
      return `${actor} created this project`;
    case "project.history.project.updated":
      return `${actor} updated the project details`;
    case "project.history.project.deleted":
      return `${actor} deleted this project`;
    case "project.history.task.created":
      return `${actor} created "${taskTitle}"`;
    case "project.history.task.deleted":
      return `${actor} deleted "${taskTitle}"`;
    case "project.history.task.status_changed":
      return `${actor} changed "${taskTitle}" status`;
    case "project.history.task.assignee_changed":
      return `${actor} reassigned "${taskTitle}"`;
    case "project.history.task.priority_changed":
      return `${actor} changed "${taskTitle}" priority`;
    case "project.history.task.title_changed":
      return `${actor} renamed a task`;
    case "project.history.task.description_updated":
      return `${actor} updated "${taskTitle}" description`;
    case "project.history.task.due_date_changed":
      return `${actor} changed "${taskTitle}" due date`;
    case "project.history.task.sprint_changed":
      return `${actor} moved "${taskTitle}" between sprint and backlog`;
    case "project.history.task.type_changed":
      return `${actor} changed "${taskTitle}" type`;
    case "project.history.task.story_points_changed":
      return `${actor} changed "${taskTitle}" story points`;
    case "project.history.task.blocked_changed":
      return `${actor} changed "${taskTitle}" blocked state`;
    case "project.history.comment.added":
      return `${actor} commented on "${taskTitle}"`;
    case "project.history.sprint.created":
      return `${actor} created sprint "${sprintName}"`;
    case "project.history.sprint.updated":
      return `${actor} updated sprint "${sprintName}"`;
    case "project.history.sprint.deleted":
      return `${actor} deleted sprint "${sprintName}"`;
    case "project.history.sprint.started":
      return `${actor} started sprint "${sprintName}"`;
    case "project.history.sprint.completed":
      return `${actor} completed sprint "${sprintName}"`;
    case "project.history.sprint.visibility_changed":
      return `${actor} changed sprint visibility`;
    case "project.history.status_column.created":
      return `${actor} created column "${columnLabel}"`;
    case "project.history.status_column.updated":
      return `${actor} updated column "${columnLabel}"`;
    case "project.history.status_column.deleted":
      return `${actor} deleted column "${columnLabel}"`;
    default:
      return `${actor} performed ${String(log?.action || "an update").replace(/^project\.history\./, "")}`;
  }
}

function formatHistoryChange(log) {
  const oldValue = log?.old_value || {};
  const newValue = log?.new_value || {};
  const key = Object.keys({ ...oldValue, ...newValue })[0];
  if (!key) return null;

  const oldLabel = oldValue[key] ?? "empty";
  const newLabel = newValue[key] ?? "empty";

  if (log?.action?.endsWith(".created")) {
    return null;
  }
  if (log?.action?.endsWith(".deleted")) {
    return null;
  }
  if (oldLabel === newLabel) {
    return null;
  }

  return `${key.replace(/_/g, " ")}: ${oldLabel} -> ${newLabel}`;
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
  "header",
  "bold",
  "italic",
  "underline",
  "list",
  "bullet",
  "link",
  "image",
];

const TODAY = new Date().toISOString().slice(0, 10);

const TASK_TYPES = [
  { value: "task",        label: "Task",        color: "text-slate-500",  bg: "bg-slate-100"  },
  { value: "bug",         label: "Bug",         color: "text-red-600",    bg: "bg-red-50"     },
  { value: "feature",     label: "Feature",     color: "text-indigo-600", bg: "bg-indigo-50"  },
  { value: "improvement", label: "Improvement", color: "text-emerald-600",bg: "bg-emerald-50" },
  { value: "chore",       label: "Chore",       color: "text-amber-600",  bg: "bg-amber-50"   },
];

const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21];

function TaskTypeIcon({ type, className = "w-3 h-3" }) {
  if (type === "bug")         return <Bug         className={className} />;
  if (type === "feature")     return <Zap         className={className} />;
  if (type === "improvement") return <Star        className={className} />;
  if (type === "chore")       return <Wrench      className={className} />;
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

export default function ProjectTasks() {
  const { projectId } = useParams();
  const location = useLocation();
  const api = useApi();
  const { auth } = useAuth();
  const user = auth.user;
  const role = user?.role;

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // 🔹 Helper: map assigned_to ID to username (email)
  const getAssigneeLabel = (id) => {
    if (!id) return null;
    const u = users.find((user) => user.id === id);
    return u ? `${u.username} (${u.email})` : id;
  };

  // Main task create form
  const [newTask, setNewTask] = useState({
    task: "",
    description: "",
    due_date: "",
    assigned_to: "",
    priority: "medium",
    task_type: "task",
    story_points: "",
    is_blocked: false,
  });

  // Subtasks created at the time of creating the task
  // Each row: { title: "", assigned_to: "" }
  const [newSubtasks, setNewSubtasks] = useState([]);
  const [nlCommand, setNlCommand] = useState("");
  const [creatingFromNL, setCreatingFromNL] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const speechRecognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const latestTranscriptRef = useRef("");
  const autoCreateTriggeredRef = useRef(false);
  const creatingFromNLRef = useRef(false);
  const [speechLang, setSpeechLang] = useState(
    localStorage.getItem("nlSpeechLang") || "auto"
  );
  const [speechLangCustom, setSpeechLangCustom] = useState(
    localStorage.getItem("nlSpeechLangCustom") || ""
  );

  const [selectedTaskForComments, setSelectedTaskForComments] =
    useState(null);

  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);

  // attachments for selected task
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  // 🔹 Activity logs
const [activityLogs, setActivityLogs] = useState([]);
const [loadingLogs, setLoadingLogs] = useState(false);

  // admin edit
  const [isEditing, setIsEditing] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // refs for editors
  const createEditorRef = useRef(null);
  const editEditorRef = useRef(null);

  const canEdit = role === "admin" || role === "manager";
  const canDragTasks = canEdit || role === "user";
  const canMoveTask = (task) => canEdit || (role === "user" && task?.assigned_to === user?.id);

  // Deep-link guard
  const [initialTaskOpened, setInitialTaskOpened] = useState(false);

  // 🔹 Project-level status columns (customizable)
  // Raw config from backend
  const [statusColumnsConfig, setStatusColumnsConfig] = useState([]);
  const [showStatusEditor, setShowStatusEditor] = useState(false);
  const [newStatusKey, setNewStatusKey] = useState("");
  const [newStatusLabel, setNewStatusLabel] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [showProjectHistory, setShowProjectHistory] = useState(false);
  const [projectHistory, setProjectHistory] = useState([]);
  const [loadingProjectHistory, setLoadingProjectHistory] = useState(false);
  const [projectHistoryPage, setProjectHistoryPage] = useState(1);
  const [projectHistoryMeta, setProjectHistoryMeta] = useState({
    total: 0,
    totalPages: 1,
  });
  const projectHistoryRefreshTimerRef = useRef(null);

  // 🔹 edit / delete state for an existing column
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [editStatusLabel, setEditStatusLabel] = useState("");
  const [draggingStatusId, setDraggingStatusId] = useState(null);

  // 🔹 Quick-add task per column
  const [quickNewTitles, setQuickNewTitles] = useState({}); // { [statusKey]: "title" }
  const [quickCreating, setQuickCreating] = useState({}); // { [statusKey]: boolean }

  // ─── SPRINT STATE ────────────────────────────────────────
  const [sprints, setSprints] = useState([]);
  const [loadingSprints, setLoadingSprints] = useState(false);
  const [activeSprint, setActiveSprint] = useState(null);
  const [sprintView, setSprintView] = useState("board"); // "board" | "backlog"
  const [taskViewMode, setTaskViewMode] = useState("board"); // "board" | "list"
  const [listSort, setListSort] = useState({ col: "created_at", dir: "desc" });
  const [showPlanningPanel, setShowPlanningPanel] = useState(false);
  const [planningSprintId, setPlanningSprintId] = useState(null);
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null); // null = create
  const [sprintForm, setSprintForm] = useState({ name: "", goal: "", start_date: "", end_date: "", is_hidden: false });
  const [savingSprint, setSavingSprint] = useState(false);
  const [showSprintPanel, setShowSprintPanel] = useState(false);

  // ─── NEW FEATURE STATE ────────────────────────────────────
  const [burndownSprint, setBurndownSprint] = useState(null); // sprint for burndown modal
  const [swimlaneMode, setSwimlaneMode] = useState("none"); // "none" | "assignee" | "type"
  const [wipLimits, setWipLimits] = useState({}); // { [statusKey]: number }
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSprint, setFilterSprint] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [templateList, setTemplateList] = useState([]);
  const [dupeSuggestions, setDupeSuggestions] = useState([]);
  const [dragTaskId, setDragTaskId] = useState(null);

  useEffect(() => {
    creatingFromNLRef.current = creatingFromNL;
  }, [creatingFromNL]);

  useEffect(() => {
    return () => {
      try {
        speechRecognitionRef.current?.stop();
      } catch {
        // ignore cleanup errors
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  // ===== Load project + tasks =====
  useEffect(() => {
    async function loadProject() {
      setLoadingProject(true);
      try {
        const res = await api.get(`/projects/${projectId}`);
        setProject(res.data);
      } catch (err) {
        console.error("Error fetching project:", err);
        toast.error("Failed to load project");
      } finally {
        setLoadingProject(false);
      }
    }

    async function loadTasks() {
      setLoadingTasks(true);
      try {
        const res = await api.get(`/tasks/${projectId}`);
        setTasks(res.data || []);
      } catch (err) {
        console.error("Error fetching tasks:", err);
        toast.error("Failed to load tasks");
      } finally {
        setLoadingTasks(false);
      }
    }

    if (projectId) {
      loadProject();
      loadTasks();
      setInitialTaskOpened(false); // reset when project changes
    }
  }, [projectId, api]);

  // ===== Load per-project status columns (no defaults here) =====
  useEffect(() => {
    async function loadStatuses() {
      try {
        const res = await api.get(`/project-statuses/${projectId}`);
        setStatusColumnsConfig(res.data || []);
      } catch (err) {
        console.error("Failed to load project statuses:", err);
        // do NOT create defaults here, keep it fully customizable
        setStatusColumnsConfig([]);
      }
    }

    if (projectId) {
      loadStatuses();
    }
  }, [projectId, api]);

  const refreshStatusColumns = async () => {
    if (!projectId) return;
    const res = await api.get(`/project-statuses/${projectId}`);
    setStatusColumnsConfig(res.data || []);
  };

  const refreshProjectHistory = async ({
    silent = false,
    page = projectHistoryPage,
  } = {}) => {
    if (!canEdit || !showProjectHistory || !projectId) return;

    if (!silent) {
      setLoadingProjectHistory(true);
    }

    try {
      const res = await api.get(`/projects/${projectId}/history`, {
        params: {
          page,
          pageSize: 10,
        },
      });

      setProjectHistory(res.data?.logs || []);
      setProjectHistoryMeta({
        total: res.data?.total || 0,
        totalPages: res.data?.totalPages || 1,
      });
    } catch (err) {
      console.error("Failed to load project history:", err);
      if (!silent) {
        toast.error("Failed to load project history");
      }
    } finally {
      if (!silent) {
        setLoadingProjectHistory(false);
      }
    }
  };

  const refreshProjectHistoryToLatest = async () => {
    if (!canEdit || !showProjectHistory) return;
    if (projectHistoryPage !== 1) {
      setProjectHistoryPage(1);
      return;
    }
    await refreshProjectHistory({ page: 1 });
  };

  useEffect(() => {
    if (!canEdit || !showProjectHistory || !projectId) return;

    refreshProjectHistory();
    projectHistoryRefreshTimerRef.current = window.setInterval(() => {
      refreshProjectHistory({ silent: true });
    }, 8000);

    return () => {
      if (projectHistoryRefreshTimerRef.current) {
        window.clearInterval(projectHistoryRefreshTimerRef.current);
        projectHistoryRefreshTimerRef.current = null;
      }
    };
  }, [canEdit, projectHistoryPage, projectId, showProjectHistory]);

  useEffect(() => {
    setProjectHistoryPage(1);
  }, [projectId, showProjectHistory]);

  // ===== Load sprints for project =====
  useEffect(() => {
    if (!projectId) return;
    async function loadSprints() {
      setLoadingSprints(true);
      try {
        const res = await api.get(`/projects/${projectId}/sprints`);
        const list = res.data || [];
        setSprints(list);
        setActiveSprint(list.find(s => s.status === "active") || null);
      } catch (err) {
        console.warn("Failed to load sprints:", err);
      } finally {
        setLoadingSprints(false);
      }
    }
    loadSprints();
  }, [projectId, api]);

  // Load WIP limits from project
  useEffect(() => {
    if (project?.wip_limits) setWipLimits(project.wip_limits || {});
  }, [project]);

  // Load issue templates
  useEffect(() => {
    if (!projectId) return;
    api.get(`/issue-templates?project_id=${projectId}`).then(r => setTemplateList(r.data || [])).catch(() => {});
  }, [projectId, api]);

  // ===== Load users for assignment (admin/manager only) =====
  useEffect(() => {
    if (!canEdit) return;

    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const res = await api.get("/users");
        setUsers(res.data || []);
      } catch (err) {
        console.error("Error fetching users:", err);
        toast.error("Failed to load users for assignment");
      } finally {
        setLoadingUsers(false);
      }
    }

    loadUsers();
  }, [canEdit, api]);

  // 🔹 Final columns = config ∪ statuses actually present on tasks
  const statusColumns = useMemo(() => {
    const map = new Map();

    // from config
    statusColumnsConfig.forEach((col) => {
      if (!col || !col.key) return;
      map.set(col.key, {
        key: col.key,
        label: col.label || statusLabel(col.key),
      });
    });

    // ensure any existing task status is also visible
    tasks.forEach((t) => {
      if (!t.status) return;
      if (!map.has(t.status)) {
        map.set(t.status, {
          key: t.status,
          label: statusLabel(t.status),
        });
      }
    });

    const ordered = Array.from(map.values());
    const backlog = ordered.find((col) => col.key === "backlog");
    const completed = ordered.find((col) => col.key === "completed");
    const middle = ordered.filter(
      (col) => col.key !== "backlog" && col.key !== "completed"
    );
    return [backlog, ...middle, completed].filter(Boolean);
  }, [statusColumnsConfig, tasks]);

  // Tasks filtered by sprint/backlog view (must be before grouped)
  const boardTasks = useMemo(() => {
    let list = sprintView === "backlog"
      ? tasks.filter(t => !t.sprint_id)
      : activeSprint
        ? tasks.filter(t => t.sprint_id === activeSprint.id)
        : tasks;
    if (filterAssignee) list = list.filter(t => t.assigned_to === filterAssignee);
    if (filterType)     list = list.filter(t => (t.task_type || "task") === filterType);
    if (filterSprint)   list = list.filter(t => t.sprint_id === filterSprint);
    return list;
  }, [tasks, sprintView, activeSprint, filterAssignee, filterType, filterSprint]);

  // Group tasks by status (respects sprint/backlog view filter)
  const grouped = useMemo(() => {
    const result = {};
    statusColumns.forEach((col) => {
      result[col.key] = [];
    });

    for (const t of boardTasks) {
      const key = t.status;
      if (!key) continue;
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(t);
    }
    return result;
  }, [boardTasks, statusColumns]);

  const stats = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
      };
    }

    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const t of tasks) {
      if (t.status === "pending") pending++;
      else if (t.status === "in-progress") inProgress++;
      else if (t.status === "completed") completed++;

      if (t.due_date && t.status !== "completed") {
        const due = new Date(t.due_date);
        due.setHours(0, 0, 0, 0);
        if (due < today) overdue++;
      }
    }

    return {
      total: tasks.length,
      pending,
      inProgress,
      completed,
      overdue,
    };
  }, [tasks]);

  // ===== Create task form handlers =====
  const handleNewTaskChange = (e) => {
    const { name, value } = e.target;
    setNewTask((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateDescriptionChange = (value) => {
    setNewTask((prev) => ({
      ...prev,
      description: value,
    }));
  };

  // Subtask form handlers (inside Create Task)
  const handleNewSubtaskChange = (index, field, value) => {
    setNewSubtasks((prev) =>
      prev.map((st, i) =>
        i === index ? { ...st, [field]: value } : st
      )
    );
  };

  const handleAddSubtaskRow = () => {
    setNewSubtasks((prev) => [
      ...prev,
      { title: "", assigned_to: "" },
    ]);
  };

  const handleRemoveSubtaskRow = (index) => {
    setNewSubtasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.task.trim()) {
      toast.error("Task title is required");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        task: newTask.task.trim(),
        description: newTask.description,
        due_date: newTask.due_date || null,
        assigned_to: newTask.assigned_to || null,
        priority: newTask.priority || "medium",
        task_type: newTask.task_type || "task",
        story_points: newTask.story_points ? parseInt(newTask.story_points) : null,
        is_blocked: newTask.is_blocked || false,
      };

      // 1) Create main task
      const res = await api.post(`/tasks/${projectId}`, payload);
      const created = res.data;

      // 2) Create subtasks, if any
      const validSubtasks = (newSubtasks || []).filter(
        (st) => st.title && st.title.trim()
      );

      if (validSubtasks.length > 0) {
        await Promise.all(
          validSubtasks.map((st) =>
            api.post("/subtasks", {
              task_id: created.id,
              subtask: st.title.trim(),
              assigned_to: st.assigned_to || null,
            })
          )
        );
      }

      const createdWithCounts = {
        ...created,
        subtasks_total: validSubtasks.length,
        subtasks_completed: 0,
      };

      setTasks((prev) => [createdWithCounts, ...prev]);

      setNewTask({
        task: "",
        description: "",
        due_date: "",
        assigned_to: "",
        priority: "medium",
      });
      setNewSubtasks([]);
      setShowCreateModal(false);
      await refreshProjectHistoryToLatest();

      toast.success("Task created");
    } catch (err) {
      console.error("Error creating task:", err);
      const msg =
        err.response?.data?.error || "Failed to create task";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFromNaturalLanguage = async (commandOverride = null) => {
    const command = (commandOverride ?? nlCommand).trim();
    if (!command) {
      toast.error("Type or speak a natural language command first");
      return;
    }

    setCreatingFromNL(true);
    try {
      const res = await api.post("/tasks/nl/create", {
        command,
        project_id: projectId,
        include_subtasks: true,
        auto_assign_by_workload: true,
        auto_set_dependencies: true,
      });

      const createdTasks = Array.isArray(res.data?.created)
        ? res.data.created
        : [];

      if (createdTasks.length > 0) {
        setTasks((prev) => [...createdTasks, ...prev]);
      }

      setNlCommand("");
      await refreshProjectHistoryToLatest();
      toast.success(res.data?.summary || "Tasks created from natural language");
      setShowCreateModal(false);
    } catch (err) {
      console.error("Error creating tasks from NL:", err);
      toast.error(
        err.response?.data?.error || "Failed to create tasks from command"
      );
    } finally {
      setCreatingFromNL(false);
      stopVoiceInput();
    }
  };

  const startVoiceInput = () => {
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("Voice input is not supported in this browser");
      return;
    }

    const resolvedLang =
      speechLang === "custom"
        ? (speechLangCustom.trim() || navigator.language || "en-US")
        : speechLang === "auto"
          ? (navigator.language || "en-US")
          : speechLang;

    if (!speechRecognitionRef.current) {
      const recognition = new Recognition();
      recognition.lang = resolvedLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0]?.transcript || "";
        }
        const normalized = transcript.trim();
        latestTranscriptRef.current = normalized;
        setNlCommand(normalized);

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        silenceTimerRef.current = setTimeout(async () => {
          if (
            autoCreateTriggeredRef.current ||
            creatingFromNLRef.current ||
            !latestTranscriptRef.current
          ) {
            return;
          }

          autoCreateTriggeredRef.current = true;
          stopVoiceInput();
          await handleCreateFromNaturalLanguage(latestTranscriptRef.current);
        }, 2000);
      };

      recognition.onerror = () => {
        setIsListening(false);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      speechRecognitionRef.current = recognition;
    }

    try {
      speechRecognitionRef.current.lang = resolvedLang;
      autoCreateTriggeredRef.current = false;
      latestTranscriptRef.current = "";
      speechRecognitionRef.current.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  };

  const stopVoiceInput = () => {
    try {
      speechRecognitionRef.current?.stop();
    } catch {
      // ignore stop failures from stale sessions
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    setIsListening(false);
  };

  // ===== Status change from board =====
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await api.put(`/tasks/${taskId}`, {
        status: newStatus || null,
      });
      const updated = res.data;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? updated : t))
      );
      setSelectedTaskDetails((prev) =>
        prev && prev.id === taskId
          ? { ...prev, status: updated.status }
          : prev
      );
      await refreshProjectHistoryToLatest();
    } catch (err) {
      console.error("Failed to update status:", err);
      const msg =
        err.response?.data?.error || "Failed to update status";
      toast.error(msg);
    }
  };

  const onDragStart = (taskId) => {
    if (!canDragTasks) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!canMoveTask(task)) return;
    setDragTaskId(taskId);
  };

  const onDragOver = (e) => {
    if (!canDragTasks) return;
    e.preventDefault();
  };

  const onDragEnd = () => {
    setDragTaskId(null);
  };

  const onDrop = async (newStatus) => {
    if (!canDragTasks || !dragTaskId) return;

    const task = tasks.find((t) => t.id === dragTaskId);
    if (!task) {
      setDragTaskId(null);
      return;
    }

    if (!canMoveTask(task)) {
      setDragTaskId(null);
      return;
    }

    if ((task.status || "") === (newStatus || "")) {
      setDragTaskId(null);
      return;
    }

    try {
      await handleStatusChange(task.id, newStatus);
    } finally {
      setDragTaskId(null);
    }
  };

  // ===== Quick add task directly in a column =====
  const handleQuickTitleChange = (statusKey, value) => {
    setQuickNewTitles((prev) => ({
      ...prev,
      [statusKey]: value,
    }));
  };

  const handleQuickCreateTask = async (statusKey) => {
    const title = (quickNewTitles[statusKey] || "").trim();
    if (!title) {
      toast.error("Task title is required");
      return;
    }

    setQuickCreating((prev) => ({ ...prev, [statusKey]: true }));

    try {
      const payload = {
        task: title,
        description: "",
        status: statusKey,
        due_date: null,
        assigned_to: null,
        priority: "medium",
      };

      const res = await api.post(`/tasks/${projectId}`, payload);
      const created = res.data;

      setTasks((prev) => [created, ...prev]);

      setQuickNewTitles((prev) => ({ ...prev, [statusKey]: "" }));
      await refreshProjectHistoryToLatest();
    } catch (err) {
      console.error("Error creating task (quick add):", err);
      const msg =
        err.response?.data?.error ||
        "Failed to create task in this column";
      toast.error(msg);
    } finally {
      setQuickCreating((prev) => ({
        ...prev,
        [statusKey]: false,
      }));
    }
  };

  // ===== Attachments for selected task =====
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

  // ===== Admin edit handlers (full CRUD in UI) =====
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
      const res = await api.put(
        `/tasks/${selectedTaskDetails.id}`,
        payload
      );
      const updated = res.data;

      setTasks((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
      setSelectedTaskDetails(updated);
      setIsEditing(false);
      await refreshProjectHistoryToLatest();
      toast.success("Task updated");
    } catch (err) {
      console.error("Failed to save task:", err);
      const msg =
        err.response?.data?.error || "Failed to save task";
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  // Duplicate detection: check on task title input
  const checkDuplicates = async (title) => {
    if (title.length < 5) { setDupeSuggestions([]); return; }
    try {
      const res = await api.get(`/task-links/search/tasks?q=${encodeURIComponent(title)}&exclude=00000000-0000-0000-0000-000000000000`);
      setDupeSuggestions(res.data.slice(0, 3));
    } catch { setDupeSuggestions([]); }
  };

  const handleDeleteTask = async () => {
    if (!selectedTaskDetails) return;
    if (
      !window.confirm("Are you sure you want to delete this task?")
    )
      return;

    try {
      await api.delete(`/tasks/${selectedTaskDetails.id}`);
      setTasks((prev) =>
        prev.filter((t) => t.id !== selectedTaskDetails.id)
      );
      setSelectedTaskDetails(null);
      setAttachments([]);
      await refreshProjectHistoryToLatest();
      toast.success("Task deleted");
    } catch (err) {
      console.error("Failed to delete task:", err);
      const msg =
        err.response?.data?.error || "Failed to delete task";
      toast.error(msg);
    }
  };

  // ===== Copy deep link for this task =====
  const handleCopyTaskLink = async () => {
    if (!selectedTaskDetails) return;
    try {
      const url = `${window.location.origin}/projects/${projectId}?task=${selectedTaskDetails.id}`;
      const id = selectedTaskDetails.display_id;
      const title = selectedTaskDetails.task;
      const label = id ? `${id} ${title}` : title;

      // HTML: only the ticket number is the hyperlink, title is plain text beside it
      const htmlContent = id
        ? `<a href="${url}">${id}</a> ${title}`
        : `<a href="${url}">${title}</a>`;
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

  // ===== Deep-link: auto-open task when ?task=<id> is present =====
  useEffect(() => {
    if (initialTaskOpened) return;
    if (!tasks || tasks.length === 0) return;

    const params = new URLSearchParams(location.search);
    const taskId = params.get("task");
    if (!taskId) return;

    const found = tasks.find((t) => t.id === taskId);

    if (!found) {
      if (role === "user") {
        toast.error(
          "Task not found or not assigned to you anymore."
        );
      }
      setInitialTaskOpened(true);
      return;
    }

    if (role === "user" && found.assigned_to !== user?.id) {
      toast.error("You don't have access to this task.");
      setInitialTaskOpened(true);
      return;
    }

    handleCardClick(found);
    setInitialTaskOpened(true);
  }, [tasks, location.search, role, user?.id, initialTaskOpened]);

  // ─── KEYBOARD SHORTCUTS ───────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      // Don't fire if typing in an input/textarea/select
      if (["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && canEdit) {
        e.preventDefault();
        setShowCreateModal(true);
      }
      if (e.key === "b") {
        e.preventDefault();
        setTaskViewMode("board");
      }
      if (e.key === "l") {
        e.preventDefault();
        setTaskViewMode("list");
      }
      if (e.key === "Escape") {
        if (selectedTaskDetails) {
          setSelectedTaskDetails(null);
          setAttachments([]);
          setIsEditing(false);
        } else if (showCreateModal) {
          setShowCreateModal(false);
        }
      }
      if (e.key === "f") {
        e.preventDefault();
        setShowFilters(v => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [canEdit, selectedTaskDetails, showCreateModal]);

  // ===== Column customization handlers (no redirect) =====
  const handleAddStatusColumn = async (e) => {
    e.preventDefault();
    const key = newStatusKey.trim();
    const label = newStatusLabel.trim();

    if (!key) {
      toast.error("Internal key is required (e.g. in-review)");
      return;
    }

    if (
      statusColumnsConfig.some(
        (col) =>
          col.key === key ||
          normalizeStatusLabel(col.label || statusLabel(col.key)) ===
            normalizeStatusLabel(label || statusLabel(key))
      )
    ) {
      toast.error("A column with the same name already exists");
      return;
    }

    setSavingStatus(true);
    try {
      const payload = {
        key,
        label: label || statusLabel(key),
      };
      const res = await api.post(
        `/project-statuses/${projectId}`,
        payload
      );
      const created = res.data;
      if (created) {
        await refreshStatusColumns();
        await refreshProjectHistoryToLatest();
      }
      setNewStatusKey("");
      setNewStatusLabel("");
      toast.success("Column added");
    } catch (err) {
      console.error("Failed to add column:", err);
      const msg =
        err.response?.data?.error || "Failed to add column";
      toast.error(msg);
    } finally {
      setSavingStatus(false);
    }
  };

  // 🔹 start editing an existing column (only label is editable – key stays stable)
  const handleStartEditStatusColumn = (col) => {
    const id = col.id || col.key;
    setEditingStatusId(id);
    setEditStatusLabel(col.label || statusLabel(col.key));
  };

  const handleCancelEditStatusColumn = () => {
    setEditingStatusId(null);
    setEditStatusLabel("");
  };

  const handleSaveEditStatusColumn = async (col) => {
    if (!editStatusLabel.trim()) {
      toast.error("Column name is required");
      return;
    }
    const id = col.id;
    if (!id) {
      toast.error("Column id missing");
      return;
    }

    if (FIXED_STATUS_KEYS.has(col.key)) {
      toast.error("Default columns cannot be renamed");
      return;
    }

    const normalizedLabel = normalizeStatusLabel(editStatusLabel);
    if (
      statusColumnsConfig.some(
        (status) =>
          status.id !== id &&
          normalizeStatusLabel(status.label || statusLabel(status.key)) ===
            normalizedLabel
      )
    ) {
      toast.error("A column with the same name already exists");
      return;
    }

    try {
      const payload = {
        label: editStatusLabel.trim(),
      };
      const res = await api.put(`/project-statuses/${id}`, payload);
      if (res.data) {
        await refreshStatusColumns();
        await refreshProjectHistoryToLatest();
      }
      toast.success("Column updated");
      setEditingStatusId(null);
      setEditStatusLabel("");
    } catch (err) {
      console.error("Failed to update column:", err);
      const msg =
        err.response?.data?.error || "Failed to update column";
      toast.error(msg);
    }
  };

  const handleDeleteStatusColumn = async (col) => {
    const id = col.id;
    if (!id) {
      toast.error("Column id missing");
      return;
    }

    if (FIXED_STATUS_KEYS.has(col.key)) {
      toast.error("Default columns cannot be deleted");
      return;
    }

    if (
      !window.confirm(
        `Delete column "${col.label || col.key}"? Tasks with this status will no longer appear in any column.`
      )
    ) {
      return;
    }

  try {
      await api.delete(`/project-statuses/${id}`);
      await refreshStatusColumns();
      await refreshProjectHistoryToLatest();
      toast.success("Column deleted");

      if (editingStatusId === id) {
        setEditingStatusId(null);
        setEditStatusLabel("");
      }
    } catch (err) {
      console.error("Failed to delete column:", err);
      const msg =
        err.response?.data?.error || "Failed to delete column";
      toast.error(msg);
    }
  };

  const handleStatusOrderChange = async (col, targetSortOrder) => {
    if (!col?.id || LOCKED_EDGE_KEYS.has(col.key)) return;

    try {
      const res = await api.put(`/project-statuses/${col.id}`, {
        sort_order: targetSortOrder,
      });
      if (res.data) {
        await refreshStatusColumns();
        await refreshProjectHistoryToLatest();
      }
    } catch (err) {
      console.error("Failed to reorder column:", err);
      const msg = err.response?.data?.error || "Failed to reorder column";
      toast.error(msg);
    }
  };

  const handleStatusDragStart = (statusId) => {
    setDraggingStatusId(statusId);
  };

  const handleStatusDragEnd = () => {
    setDraggingStatusId(null);
  };

  const handleStatusDragOver = (e, col) => {
    if (!draggingStatusId || LOCKED_EDGE_KEYS.has(col.key)) return;
    e.preventDefault();
  };

  const handleStatusDrop = async (targetCol) => {
    if (!draggingStatusId || !targetCol || LOCKED_EDGE_KEYS.has(targetCol.key)) {
      setDraggingStatusId(null);
      return;
    }

    const source = statusColumnsConfig.find((col) => col.id === draggingStatusId);
    if (!source || LOCKED_EDGE_KEYS.has(source.key) || source.id === targetCol.id) {
      setDraggingStatusId(null);
      return;
    }

    const middle = statusColumnsConfig.filter(
      (col) => !LOCKED_EDGE_KEYS.has(col.key)
    );
    const sourceIndex = middle.findIndex((col) => col.id === source.id);
    const targetIndex = middle.findIndex((col) => col.id === targetCol.id);
    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggingStatusId(null);
      return;
    }

    const reordered = [...middle];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const newIndex = reordered.findIndex((col) => col.id === source.id);
    await handleStatusOrderChange(source, newIndex + 2);
    setDraggingStatusId(null);
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

  // ─── SPRINT HANDLERS ──────────────────────────────────────
  const handleOpenCreateSprint = () => {
    setEditingSprint(null);
    setSprintForm({ name: "", goal: "", start_date: "", end_date: "", is_hidden: false });
    setShowSprintModal(true);
  };

  const handleOpenEditSprint = (sprint) => {
    setEditingSprint(sprint);
    setSprintForm({
      name: sprint.name,
      goal: sprint.goal || "",
      start_date: sprint.start_date ? sprint.start_date.slice(0, 10) : "",
      end_date: sprint.end_date ? sprint.end_date.slice(0, 10) : "",
      is_hidden: sprint.is_hidden || false,
    });
    setShowSprintModal(true);
  };

  const handleSaveSprint = async (e) => {
    e.preventDefault();
    if (!sprintForm.name.trim()) { toast.error("Sprint name is required"); return; }
    setSavingSprint(true);
    try {
      if (editingSprint) {
        const res = await api.put(`/sprints/${editingSprint.id}`, sprintForm);
        setSprints(prev => prev.map(s => s.id === editingSprint.id ? res.data : s));
        await refreshProjectHistoryToLatest();
        toast.success("Sprint updated");
      } else {
        const res = await api.post(`/projects/${projectId}/sprints`, sprintForm);
        setSprints(prev => [res.data, ...prev]);
        await refreshProjectHistoryToLatest();
        toast.success("Sprint created");
      }
      setShowSprintModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save sprint");
    } finally {
      setSavingSprint(false);
    }
  };

  const handleStartSprint = async (sprint) => {
    try {
      const res = await api.post(`/sprints/${sprint.id}/start`);
      setSprints(prev => prev.map(s => s.id === sprint.id ? res.data : s));
      setActiveSprint(res.data);
      await refreshProjectHistoryToLatest();
      toast.success(`Sprint "${sprint.name}" started!`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to start sprint");
    }
  };

  const handleCompleteSprint = async (sprint) => {
    if (!window.confirm(`Complete sprint "${sprint.name}"? Incomplete tasks will move to backlog.`)) return;
    try {
      const res = await api.post(`/sprints/${sprint.id}/complete`);
      setSprints(prev => prev.map(s => s.id === sprint.id ? res.data.sprint : s));
      setActiveSprint(null);
      // Reload tasks since incomplete ones moved to backlog
      const tasksRes = await api.get(`/tasks/${projectId}`);
      setTasks(tasksRes.data || []);
      await refreshProjectHistoryToLatest();
      toast.success(`Sprint completed. ${res.data.movedToBacklog} task(s) moved to backlog.`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to complete sprint");
    }
  };

  const handleDeleteSprint = async (sprint) => {
    if (!window.confirm(`Delete sprint "${sprint.name}"? Tasks will move to backlog.`)) return;
    try {
      await api.delete(`/sprints/${sprint.id}`);
      setSprints(prev => prev.filter(s => s.id !== sprint.id));
      if (activeSprint?.id === sprint.id) setActiveSprint(null);
      const tasksRes = await api.get(`/tasks/${projectId}`);
      setTasks(tasksRes.data || []);
      await refreshProjectHistoryToLatest();
      toast.success("Sprint deleted");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete sprint");
    }
  };

  const handleAssignTaskToSprint = async (taskId, sprintId) => {
    try {
      await api.patch(`/tasks/${taskId}/sprint`, { sprint_id: sprintId });
      const tasksRes = await api.get(`/tasks/${projectId}`);
      setTasks(tasksRes.data || []);
      await refreshProjectHistoryToLatest();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update sprint");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <Card.Content className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {loadingProject
                  ? "Loading project..."
                  : project?.name || "Project"}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage tasks for this project and collaborate with your team
              </p>
              {tasks.length > 0 && (
                <div className="flex items-center gap-3 mt-3">
                  <Badge color="neutral" size="sm" variant="subtle">
                    Total: {stats.total}
                  </Badge>
                  <Badge color="warning" size="sm" variant="subtle">
                    Pending: {stats.pending}
                  </Badge>
                  <Badge color="primary" size="sm" variant="subtle">
                    In Progress: {stats.inProgress}
                  </Badge>
                  <Badge color="success" size="sm" variant="subtle">
                    Completed: {stats.completed}
                  </Badge>
                  {stats.overdue > 0 && (
                    <Badge color="danger" size="sm" variant="solid">
                      Overdue: {stats.overdue}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            {canEdit && (
              <Button
                onClick={() => setShowCreateModal(true)}
                variant="primary"
                size="md"
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                New Task
              </Button>
            )}
          </div>
        </Card.Content>
      </Card>

      {canEdit && (
        <Card>
          <Card.Content className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Project History
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Admin and manager activity for this project, including tasks, columns, sprints, and durable delete records.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowProjectHistory((value) => !value)}
              >
                {showProjectHistory ? "Hide History" : "Show History"}
              </Button>
            </div>

            {showProjectHistory && (
              <div className="mt-4 space-y-3">
                {loadingProjectHistory ? (
                  <div className="text-sm text-gray-500">Loading history...</div>
                ) : projectHistory.length === 0 ? (
                  <div className="text-sm text-gray-500">No project history recorded yet.</div>
                ) : (
                  <div className="space-y-2">
                    {projectHistory.map((log) => {
                      const changeText = formatHistoryChange(log);
                      return (
                        <div
                          key={log.id}
                          className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {formatProjectHistoryMessage(log)}
                          </div>
                          {changeText && (
                            <div className="mt-1 text-xs text-gray-600">{changeText}</div>
                          )}
                          <div className="mt-1 text-[11px] text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="text-xs text-gray-500">
                    {projectHistoryMeta.total} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={projectHistoryPage <= 1 || loadingProjectHistory}
                      onClick={() =>
                        setProjectHistoryPage((page) => Math.max(1, page - 1))
                      }
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-gray-500">
                      Page {projectHistoryPage} of {projectHistoryMeta.totalPages}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={
                        loadingProjectHistory ||
                        projectHistoryPage >= projectHistoryMeta.totalPages
                      }
                      onClick={() =>
                        setProjectHistoryPage((page) =>
                          Math.min(projectHistoryMeta.totalPages, page + 1)
                        )
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card.Content>
        </Card>
      )}


      {/* ─── SPRINT PANEL ─────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold">Sprints</h2>
            {project?.project_code && (
              <span className="text-[10px] bg-indigo-50 text-indigo-600 font-mono px-1.5 py-0.5 rounded border border-indigo-200">
                {project.project_code}
              </span>
            )}
            {activeSprint && (
              <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                Active: {activeSprint.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px]">
              <button
                className={`px-2 py-1 ${sprintView === "board" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setSprintView("board")}
              >
                {activeSprint ? activeSprint.name : "All Tasks"}
              </button>
              <button
                className={`px-2 py-1 ${sprintView === "backlog" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setSprintView("backlog")}
              >
                Backlog ({tasks.filter(t => !t.sprint_id).length})
              </button>
            </div>
            {/* Board / List view toggle */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px]">
              <button
                className={`px-2 py-1 flex items-center gap-1 ${taskViewMode === "board" ? "bg-slate-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setTaskViewMode("board")}
                title="Board view"
              >
                <Layers className="w-3 h-3" /> Board
              </button>
              <button
                className={`px-2 py-1 flex items-center gap-1 ${taskViewMode === "list" ? "bg-slate-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setTaskViewMode("list")}
                title="List view"
              >
                <Flag className="w-3 h-3" /> List
              </button>
            </div>
            {/* Swimlane toggle */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px]">
              <button
                className={`px-2 py-1 ${swimlaneMode === "none" ? "bg-slate-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setSwimlaneMode("none")} title="No swimlanes"
              >
                Flat
              </button>
              <button
                className={`px-2 py-1 ${swimlaneMode === "assignee" ? "bg-slate-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setSwimlaneMode("assignee")} title="Group by assignee"
              >
                By Person
              </button>
              <button
                className={`px-2 py-1 ${swimlaneMode === "type" ? "bg-slate-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setSwimlaneMode("type")} title="Group by type"
              >
                By Type
              </button>
            </div>
            {/* Filter button */}
            <button
              className={`text-[11px] border rounded-lg px-2 py-1 flex items-center gap-1 ${showFilters || filterAssignee || filterType ? "bg-indigo-600 text-white border-indigo-600" : "text-slate-600 border-slate-200 hover:bg-slate-50"}`}
              onClick={() => setShowFilters(v => !v)}
              title="Filter tasks (F)"
            >
              <Filter className="w-3 h-3" /> Filter
              {(filterAssignee || filterType) && <span className="bg-white text-indigo-600 rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center font-bold">{[filterAssignee, filterType].filter(Boolean).length}</span>}
            </button>
            {/* Saved filters */}
            <SavedFiltersPanel
              projectId={projectId}
              currentFilters={{ assignee: filterAssignee, type: filterType, sprint: filterSprint }}
              onApply={(cfg) => {
                if (cfg.assignee !== undefined) setFilterAssignee(cfg.assignee);
                if (cfg.type !== undefined) setFilterType(cfg.type);
                if (cfg.sprint !== undefined) setFilterSprint(cfg.sprint);
              }}
            />
            {canEdit && sprints.filter(s => s.status !== "completed").length > 0 && (
              <button
                className={`text-[11px] border rounded-lg px-2 py-1 flex items-center gap-1 ${showPlanningPanel ? "bg-emerald-600 text-white border-emerald-600" : "text-emerald-700 border-emerald-300 hover:bg-emerald-50"}`}
                onClick={() => {
                  setShowPlanningPanel(v => !v);
                  if (!planningSprintId && sprints.find(s => s.status !== "completed")) {
                    setPlanningSprintId(sprints.find(s => s.status === "active")?.id || sprints.find(s => s.status !== "completed")?.id || null);
                  }
                }}
              >
                <Sparkles className="w-3 h-3" /> {showPlanningPanel ? "Close Planning" : "Plan Sprint"}
              </button>
            )}
            <button
              className="text-[11px] text-slate-600 border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-50"
              onClick={() => setShowSprintPanel(v => !v)}
            >
              {showSprintPanel ? "Hide sprints" : "Manage sprints"}
            </button>
            {canEdit && (
              <button
                className="text-[11px] text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-2 py-1 flex items-center gap-1"
                onClick={handleOpenCreateSprint}
              >
                <Plus className="w-3 h-3" /> New Sprint
              </button>
            )}
          </div>
        </div>

        {/* Sprint list */}
        {showSprintPanel && (
          <div className="space-y-2 mt-2">
            {loadingSprints ? (
              <p className="text-xs text-slate-400">Loading sprints…</p>
            ) : sprints.length === 0 ? (
              <p className="text-xs text-slate-400">No sprints yet. Create your first sprint to start planning.</p>
            ) : (
              sprints.map(sprint => {
                const total = sprint.total_tasks || 0;
                const done  = sprint.completed_tasks || 0;
                const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
                const statusColor =
                  sprint.status === "active"    ? "bg-green-100 text-green-700" :
                  sprint.status === "completed" ? "bg-gray-100 text-gray-500"  :
                  "bg-yellow-50 text-yellow-700";

                return (
                  <div key={sprint.id} className="border border-slate-200 rounded-lg p-3 flex items-start gap-3 hover:border-indigo-200 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800">{sprint.name}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusColor}`}>
                          {sprint.status}
                        </span>
                        {sprint.is_hidden && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 flex items-center gap-1">
                            <EyeOff className="w-2.5 h-2.5" /> Hidden
                          </span>
                        )}
                        {sprint.start_date && (
                          <span className="text-[10px] text-slate-400">
                            {new Date(sprint.start_date).toLocaleDateString()} – {sprint.end_date ? new Date(sprint.end_date).toLocaleDateString() : "no end"}
                          </span>
                        )}
                      </div>
                      {sprint.goal && <p className="text-xs text-slate-500 mt-0.5 truncate">{sprint.goal}</p>}
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                            <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">{done}/{total} tasks</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {sprint.total_points > 0 && (
                            <span className="text-[10px] flex items-center gap-1 text-indigo-600 font-semibold">
                              <BarChart2 className="w-3 h-3" />
                              {sprint.completed_points}/{sprint.total_points} pts
                            </span>
                          )}
                          {sprint.blocked_tasks > 0 && (
                            <span className="text-[10px] flex items-center gap-1 text-red-500 font-semibold">
                              <ShieldAlert className="w-3 h-3" /> {sprint.blocked_tasks} blocked
                            </span>
                          )}
                          {sprint.bug_count > 0 && (
                            <span className="text-[10px] flex items-center gap-1 text-orange-500 font-semibold">
                              <Bug className="w-3 h-3" /> {sprint.bug_count} bug{sprint.bug_count > 1 ? "s" : ""}
                            </span>
                          )}
                          {sprint.overdue_tasks > 0 && (
                            <span className="text-[10px] text-red-500 shrink-0">{sprint.overdue_tasks} overdue</span>
                          )}
                        </div>

                        {/* Linked Goals — visible to all, clickable for admin/manager */}
                        {(sprint.linked_goals || []).length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            <Target className="w-3 h-3 text-indigo-400 shrink-0" />
                            {(sprint.linked_goals).map(g => {
                              const goalStatusColor =
                                g.goal_status === "done"      ? "bg-indigo-50 text-indigo-600 border-indigo-200" :
                                g.goal_status === "at_risk"   ? "bg-amber-50  text-amber-700  border-amber-200"  :
                                g.goal_status === "off_track" ? "bg-red-50    text-red-600    border-red-200"    :
                                                                "bg-green-50  text-green-700  border-green-200";
                              const pill = (
                                <span
                                  key={g.goal_id}
                                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${goalStatusColor}`}
                                  title={`Goal: ${g.goal_title} · ${g.goal_progress ?? 0}% complete`}
                                >
                                  {g.goal_title}
                                  <span className="opacity-60">· {g.goal_progress ?? 0}%</span>
                                </span>
                              );
                              // Admin and manager can click to go to Goals page
                              return canEdit ? (
                                <a key={g.goal_id} href="/okr" title="Go to Goals page">
                                  {pill}
                                </a>
                              ) : pill;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        {sprint.status === "planning" && (
                          <button
                            title="Start sprint"
                            className="text-[10px] bg-green-600 text-white rounded px-2 py-0.5 hover:bg-green-700 flex items-center gap-1"
                            onClick={() => handleStartSprint(sprint)}
                          >
                            <Play className="w-3 h-3" /> Start
                          </button>
                        )}
                        {sprint.status === "active" && (
                          <button
                            title="Complete sprint"
                            className="text-[10px] bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700 flex items-center gap-1"
                            onClick={() => handleCompleteSprint(sprint)}
                          >
                            <Flag className="w-3 h-3" /> Complete
                          </button>
                        )}
                        {sprint.status !== "planning" && sprint.start_date && (
                          <button
                            title="View burndown chart"
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                            onClick={() => setBurndownSprint(sprint)}
                          >
                            <TrendingDown className="w-3 h-3" />
                          </button>
                        )}
                        {sprint.status !== "completed" && (
                          <button
                            title="Edit sprint"
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                            onClick={() => handleOpenEditSprint(sprint)}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        {role === "admin" && sprint.status !== "active" && (
                          <button
                            title="Delete sprint"
                            className="p-1 text-slate-400 hover:text-red-500 rounded"
                            onClick={() => handleDeleteSprint(sprint)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Sprint create/edit modal */}
      {showSprintModal && (
        <Modal isOpen={showSprintModal} onClose={() => setShowSprintModal(false)}>
          <Modal.Header>{editingSprint ? "Edit Sprint" : "New Sprint"}</Modal.Header>
          <Modal.Body>
            <form onSubmit={handleSaveSprint} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sprint Name *</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                  value={sprintForm.name}
                  onChange={e => setSprintForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sprint 1"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sprint Goal</label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none resize-none"
                  rows={2}
                  value={sprintForm.goal}
                  onChange={e => setSprintForm(f => ({ ...f, goal: e.target.value }))}
                  placeholder="What do you want to achieve?"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                    value={sprintForm.start_date}
                    max={sprintForm.end_date || undefined}
                    onChange={e => setSprintForm(f => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                    value={sprintForm.end_date}
                    min={sprintForm.start_date || undefined}
                    onChange={e => setSprintForm(f => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>
              {/* Hidden sprint toggle — admin only */}
              {role === "admin" && (
                <label className="flex items-center gap-3 cursor-pointer select-none py-1">
                  <div className={`relative w-10 h-5 rounded-full transition-colors ${sprintForm.is_hidden ? "bg-amber-400" : "bg-slate-200"}`}
                    onClick={() => setSprintForm(f => ({ ...f, is_hidden: !f.is_hidden }))}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${sprintForm.is_hidden ? "translate-x-5" : ""}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Hidden Sprint (Planning)</p>
                    <p className="text-xs text-slate-500">Only admins can see this sprint — use for advance planning</p>
                  </div>
                </label>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50" onClick={() => setShowSprintModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={savingSprint} className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-4 py-1.5 disabled:opacity-50">
                  {savingSprint ? "Saving…" : editingSprint ? "Save Changes" : "Create Sprint"}
                </button>
              </div>
            </form>
          </Modal.Body>
        </Modal>
      )}

      {/* ── SPRINT PLANNING PANEL ── */}
      {showPlanningPanel && canEdit && (
        <section className="bg-white rounded-xl shadow p-4 border-2 border-emerald-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-emerald-800">Sprint Planning</h2>
              <span className="text-[10px] text-slate-500">Click a task to move it between backlog and sprint</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-600">Planning for:</label>
              <select
                className="text-[11px] border border-slate-200 rounded px-2 py-1"
                value={planningSprintId || ""}
                onChange={e => setPlanningSprintId(e.target.value || null)}
              >
                {sprints.filter(s => s.status !== "completed").map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                ))}
              </select>
            </div>
          </div>
          {planningSprintId && (() => {
            const sprintTasks = tasks.filter(t => t.sprint_id === planningSprintId);
            const backlogTasks = tasks.filter(t => !t.sprint_id);
            const sprintPoints = sprintTasks.reduce((s, t) => s + (t.story_points || 0), 0);
            const selectedSprint = sprints.find(s => s.id === planningSprintId);
            return (
              <div className="grid grid-cols-2 gap-4">
                {/* Backlog column */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-slate-700">Backlog <span className="text-slate-400 font-normal">({backlogTasks.length})</span></h3>
                    <span className="text-[10px] text-slate-400">{backlogTasks.reduce((s,t) => s + (t.story_points||0), 0)} pts</span>
                  </div>
                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                    {backlogTasks.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-4">All tasks are in sprints</p>
                    ) : backlogTasks.map(t => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50 cursor-pointer group transition-colors"
                        onClick={() => handleAssignTaskToSprint(t.id, planningSprintId)}
                        title="Click to add to sprint"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-500 opacity-0 group-hover:opacity-100 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {t.display_id && <span className="font-mono text-[10px] text-indigo-400">{t.display_id}</span>}
                            <TaskTypeBadge type={t.task_type || "task"} />
                          </div>
                          <p className="text-xs text-slate-700 truncate mt-0.5">{t.task}</p>
                        </div>
                        {t.story_points != null && (
                          <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full shrink-0">{t.story_points}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Sprint column */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-emerald-700">
                      {selectedSprint?.name} <span className="text-slate-400 font-normal">({sprintTasks.length})</span>
                    </h3>
                    <span className="text-[10px] font-semibold text-emerald-600">{sprintPoints} pts</span>
                  </div>
                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                    {sprintTasks.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-4">No tasks in this sprint yet</p>
                    ) : sprintTasks.map(t => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 p-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:border-red-300 hover:bg-red-50 cursor-pointer group transition-colors"
                        onClick={() => handleAssignTaskToSprint(t.id, null)}
                        title="Click to remove from sprint (back to backlog)"
                      >
                        <X className="w-3.5 h-3.5 text-red-400 opacity-0 group-hover:opacity-100 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {t.display_id && <span className="font-mono text-[10px] text-indigo-400">{t.display_id}</span>}
                            <TaskTypeBadge type={t.task_type || "task"} />
                            {t.is_blocked && <ShieldAlert className="w-3 h-3 text-red-500" />}
                          </div>
                          <p className="text-xs text-slate-700 truncate mt-0.5">{t.task}</p>
                        </div>
                        {t.story_points != null && (
                          <span className="text-[10px] font-bold bg-white border border-emerald-300 text-emerald-700 px-1.5 py-0.5 rounded-full shrink-0">{t.story_points}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* Tasks Board */}
      <section className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Tasks</h2>
            {sprintView === "backlog" ? (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">Backlog</span>
            ) : activeSprint ? (
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{activeSprint.name}</span>
            ) : null}
            <span className="text-[10px] text-slate-400">{boardTasks.length} task{boardTasks.length !== 1 ? "s" : ""}</span>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowStatusEditor((v) => !v)}
              className="text-[11px] text-blue-600 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50"
            >
              {showStatusEditor
                ? "Close column settings"
                : "Customize columns"}
            </button>
          )}
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="mb-3 flex items-center flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-600">Filters:</span>
            <select
              className="text-[11px] border rounded px-2 py-1"
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
            >
              <option value="">All assignees</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <select
              className="text-[11px] border rounded px-2 py-1"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="">All types</option>
              {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select
              className="text-[11px] border rounded px-2 py-1"
              value={filterSprint}
              onChange={e => setFilterSprint(e.target.value)}
            >
              <option value="">All sprints</option>
              {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {(filterAssignee || filterType || filterSprint) && (
              <button
                className="text-[11px] text-red-500 hover:underline"
                onClick={() => { setFilterAssignee(""); setFilterType(""); setFilterSprint(""); }}
              >
                Clear
              </button>
            )}
            <span className="text-[11px] text-slate-400 ml-auto">{boardTasks.length} tasks shown</span>
          </div>
        )}

        {/* Inline column customization panel */}
        {showStatusEditor && canEdit && (
          <div className="mb-4 border border-slate-200 rounded-lg p-3 bg-slate-50">
            <h3 className="text-xs font-semibold mb-2">
              Columns for this project
            </h3>
            {statusColumnsConfig.length === 0 ? (
              <p className="text-[11px] text-slate-500 mb-2">
                Default columns are created automatically for every project.
              </p>
            ) : (
              <ul className="mb-2 flex flex-col gap-1 text-[11px]">
                {statusColumnsConfig.map((col) => {
                  const id = col.id || col.key;
                  const isEditingThis = editingStatusId === id;
                  const isFixed = FIXED_STATUS_KEYS.has(col.key);
                  const isEdgeLocked = LOCKED_EDGE_KEYS.has(col.key);
                  const taskCount = (grouped[col.key] || []).length;

                  return (
                    <li
                      key={id}
                      draggable={!isEdgeLocked}
                      onDragStart={() => handleStatusDragStart(id)}
                      onDragEnd={handleStatusDragEnd}
                      onDragOver={(e) => handleStatusDragOver(e, col)}
                      onDrop={() => handleStatusDrop(col)}
                      className={`flex items-center justify-between gap-2 border border-slate-200 rounded-md bg-white px-2 py-1 ${
                        !isEdgeLocked ? "cursor-grab active:cursor-grabbing" : ""
                      } ${
                        draggingStatusId === id ? "opacity-70" : ""
                      }`}
                    >
                      {isEditingThis ? (
                        <>
                          <div className="flex-1 flex flex-col md:flex-row md:items-center gap-1">
                            <span className="text-[10px] text-slate-400">
                              Key: {col.key}
                            </span>
                            <input
                              type="text"
                              value={editStatusLabel}
                              onChange={(e) =>
                                setEditStatusLabel(e.target.value)
                              }
                              className="border rounded px-2 py-1 text-[11px] flex-1"
                              placeholder="Column label"
                            />
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleSaveEditStatusColumn(col)
                              }
                              className="text-[11px] text-green-700 border border-green-200 rounded px-2 py-[2px] hover:bg-green-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={
                                handleCancelEditStatusColumn
                              }
                              className="text-[11px] text-slate-600 border border-slate-200 rounded px-2 py-[2px] hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex-1">
                            <span className="font-medium">
                              {col.label || statusLabel(col.key)}
                            </span>
                            <span className="ml-1 text-slate-500">
                              ({taskCount})
                            </span>{" "}
                            <span className="text-slate-400">
                              ({col.key})
                            </span>
                            {isEdgeLocked && (
                              <span className="ml-2 text-[10px] text-slate-400">
                                locked
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {!isEdgeLocked && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusOrderChange(col, Math.max(2, (col.sort_order || 2) - 1))
                                }
                                className="text-[11px] text-slate-600 border border-slate-200 rounded px-2 py-[2px] hover:bg-slate-50"
                              >
                                ↑
                              </button>
                            )}
                            {!isEdgeLocked && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusOrderChange(col, Math.min(statusColumnsConfig.length - 1, (col.sort_order || 2) + 1))
                                }
                                className="text-[11px] text-slate-600 border border-slate-200 rounded px-2 py-[2px] hover:bg-slate-50"
                              >
                                ↓
                              </button>
                            )}
                            {!isFixed && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleStartEditStatusColumn(col)
                                }
                                className="text-[11px] text-blue-600 border border-blue-200 rounded px-2 py-[2px] hover:bg-blue-50"
                              >
                                Edit
                              </button>
                            )}
                            {!isFixed && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteStatusColumn(col)
                                }
                                className="text-[11px] text-red-600 border border-red-200 rounded px-2 py-[2px] hover:bg-red-50"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <form
              className="flex flex-col md:flex-row gap-2 text-xs"
              onSubmit={handleAddStatusColumn}
            >
              <input
                type="text"
                value={newStatusKey}
                onChange={(e) => setNewStatusKey(e.target.value)}
                placeholder="Internal key (e.g. in-review)"
                className="border rounded px-2 py-1 flex-1"
              />
              <input
                type="text"
                value={newStatusLabel}
                onChange={(e) => setNewStatusLabel(e.target.value)}
                placeholder="Label (e.g. In review)"
                className="border rounded px-2 py-1 flex-1"
              />
              <button
                type="submit"
                disabled={savingStatus}
                className="bg-slate-800 text-white rounded px-3 py-1 disabled:opacity-50"
              >
                {savingStatus ? "Adding..." : "Add column"}
              </button>
            </form>

            <p className="mt-1 text-[10px] text-slate-400">
              Backlog stays first, Completed stays last, and only middle
              columns can be reordered. Completed remains the scoring
              completion state.
            </p>
          </div>
        )}

        {loadingTasks ? (
          <div className="text-sm text-slate-500">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-sm text-slate-500">No tasks for this project yet.</div>
        ) : taskViewMode === "list" ? (
          /* ── LIST VIEW ── */
          (() => {
            const sortedList = [...boardTasks].sort((a, b) => {
              const dir = listSort.dir === "asc" ? 1 : -1;
              const va = a[listSort.col] ?? "";
              const vb = b[listSort.col] ?? "";
              if (listSort.col === "story_points") return dir * ((a.story_points ?? -1) - (b.story_points ?? -1));
              return dir * String(va).localeCompare(String(vb));
            });
            const SortBtn = ({ col, label }) => (
              <button
                className="flex items-center gap-0.5 hover:text-indigo-600"
                onClick={() => setListSort(s => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }))}
              >
                {label}
                {listSort.col === col ? (listSort.dir === "asc" ? " ↑" : " ↓") : ""}
              </button>
            );
            return (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left w-24">ID</th>
                      <th className="px-3 py-2 text-left"><SortBtn col="task" label="Title" /></th>
                      <th className="px-3 py-2 text-left w-24"><SortBtn col="task_type" label="Type" /></th>
                      <th className="px-3 py-2 text-left w-24"><SortBtn col="status" label="Status" /></th>
                      <th className="px-3 py-2 text-left w-24"><SortBtn col="priority" label="Priority" /></th>
                      <th className="px-3 py-2 text-left w-16"><SortBtn col="story_points" label="Pts" /></th>
                      <th className="px-3 py-2 text-left w-32"><SortBtn col="due_date" label="Due" /></th>
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
                        <td className="px-3 py-2 font-mono text-indigo-500 font-semibold text-[10px]">
                          {t.display_id || "—"}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800 max-w-xs truncate">
                          {t.task}
                          {t.subtasks_total > 0 && (
                            <span className="ml-1.5 text-[10px] text-slate-400">{t.subtasks_completed}/{t.subtasks_total} st</span>
                          )}
                        </td>
                        <td className="px-3 py-2"><TaskTypeBadge type={t.task_type || "task"} /></td>
                        <td className="px-3 py-2 capitalize text-slate-600">{statusLabel(t.status)}</td>
                        <td className="px-3 py-2">
                          <Badge color={priorityBadgeColor(t.priority)} size="sm" variant="subtle">
                            {priorityLabel(t.priority)}
                          </Badge>
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
            No status columns defined yet. Use &quot;Customize columns&quot; to add some.
          </div>
        ) : (
          <>
          {/* Swimlane label */}
          {swimlaneMode !== "none" && (
            <div className="mb-2 flex flex-wrap gap-2">
              {swimlaneMode === "assignee" && (
                [...new Set(boardTasks.map(t => t.assigned_to || "unassigned"))].map(assigneeId => {
                  const u = users.find(u => u.id === assigneeId);
                  const label = u ? u.username : "Unassigned";
                  const count = boardTasks.filter(t => (t.assigned_to || "unassigned") === assigneeId).length;
                  return (
                    <button
                      key={assigneeId}
                      className={`text-[11px] px-2 py-1 rounded-full border ${filterAssignee === assigneeId ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}
                      onClick={() => setFilterAssignee(filterAssignee === assigneeId ? "" : assigneeId)}
                    >
                      {label} ({count})
                    </button>
                  );
                })
              )}
              {swimlaneMode === "type" && (
                TASK_TYPES.map(tt => {
                  const count = boardTasks.filter(t => (t.task_type || "task") === tt.value).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={tt.value}
                      className={`text-[11px] px-2 py-1 rounded-full border ${filterType === tt.value ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}
                      onClick={() => setFilterType(filterType === tt.value ? "" : tt.value)}
                    >
                      {tt.label} ({count})
                    </button>
                  );
                })
              )}
            </div>
          )}
          <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 overflow-x-auto pb-2">
            {statusColumns.map((col) => (
              <div
                key={col.key}
                className={`border rounded-lg min-h-[200px] p-2 transition-colors ${
                  wipLimits[col.key] && (grouped[col.key]?.length || 0) >= wipLimits[col.key]
                    ? "border-red-300 bg-red-50"
                    : "border-slate-200 bg-slate-50"
                }`}
                onDragOver={onDragOver}
                onDrop={() => onDrop(col.key)}
              >
                {/* Column header with + button */}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold">
                    {col.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">
                      {grouped[col.key]?.length || 0} tasks
                    </span>
                    {wipLimits[col.key] && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${(grouped[col.key]?.length || 0) >= wipLimits[col.key] ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"}`}
                        title="WIP Limit">
                        WIP {wipLimits[col.key]}
                      </span>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        title="Add task in this column"
                        className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-700 text-xs"
                        onClick={() => {
                          const input =
                            document.getElementById(
                              `quick-input-${col.key}`
                            );
                          if (input) input.focus();
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>

                {/* Task cards */}
                <div className="space-y-2">
                  {grouped[col.key]?.map((t) => (
                    <Card
                      key={t.id}
                      draggable={canMoveTask(t)}
                      onDragStart={() => onDragStart(t.id)}
                      onDragEnd={onDragEnd}
                      className={
                        "transition-all hover:shadow-md hover:-translate-y-0.5 " +
                        (canMoveTask(t)
                          ? "cursor-grab active:cursor-grabbing "
                          : "cursor-pointer ") +
                        (isOverdue(t)
                          ? "border-danger-300 bg-danger-50"
                          : "border-gray-200 hover:border-primary-200")
                      }
                      onClick={() => handleCardClick(t)}
                    >
                      <Card.Content className="p-3 space-y-2">
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
                        <div className="font-medium text-sm text-gray-900">
                          {t.task}
                        </div>

                        {t.subtasks_total > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <CheckCircle2 className="w-3 h-3" />
                            {t.subtasks_completed}/{t.subtasks_total} subtasks
                          </div>
                        )}

                        {t.due_date && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            {new Date(t.due_date).toLocaleDateString()}
                          </div>
                        )}

                        {t.assigned_to && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <UserIcon className="w-3 h-3" />
                            {getAssigneeLabel(t.assigned_to)}
                          </div>
                        )}

                        <div className="mt-2 flex items-center justify-between flex-wrap gap-1">
                          <Badge
                            color={priorityBadgeColor(t.priority)}
                            size="sm"
                            variant="subtle"
                          >
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
                              <AlertCircle className="w-3 h-3" />
                              Overdue
                            </Badge>
                          )}
                        </div>

                        {/* Sprint assign (admin/manager only) */}
                        {canEdit && sprints.filter(s => s.status !== "completed").length > 0 && (
                          <div className="mt-1" onClick={e => e.stopPropagation()}>
                            <select
                              className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-600 bg-white focus:border-indigo-400 outline-none"
                              value={t.sprint_id || ""}
                              onChange={e => handleAssignTaskToSprint(t.id, e.target.value || null)}
                            >
                              <option value="">Backlog</option>
                              {sprints.filter(s => s.status !== "completed").map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200">
                          {canEdit && (
                            <select
                              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:border-primary-500 focus:ring-primary-500/20"
                              value={t.status || ""}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleStatusChange(
                                  t.id,
                                  e.target.value
                                );
                              }}
                            >
                              <option value="">No status</option>
                              {statusColumns.map((sc) => (
                                <option key={sc.key} value={sc.key}>
                                  {sc.label}
                                </option>
                              ))}
                            </select>
                          )}
                          <Button
                            variant="ghost"
                            size="xs"
                            className="text-primary-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTaskForComments(
                                selectedTaskForComments === t.id
                                  ? null
                                  : t.id
                              );
                            }}
                          >
                            {selectedTaskForComments === t.id
                              ? "Hide comments"
                              : "Comments"}
                          </Button>
                        </div>

                        {selectedTaskForComments === t.id && (
                          <div className="mt-2 border-t pt-2">
                            <CommentsSection taskId={t.id} />
                          </div>
                        )}
                      </Card.Content>
                    </Card>
                  ))}
                </div>

                {/* Quick-add section at bottom of column */}
                {canEdit && (
                  <div className="mt-3 pt-2 border-t border-dashed border-slate-200">
                    <input
                      id={`quick-input-${col.key}`}
                      type="text"
                      className="w-full border rounded px-2 py-1 text-[11px] mb-1"
                      placeholder={`Add task in "${col.label}"...`}
                      value={quickNewTitles[col.key] || ""}
                      onChange={(e) =>
                        handleQuickTitleChange(
                          col.key,
                          e.target.value
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleQuickCreateTask(col.key);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="w-full bg-blue-50 hover:bg-blue-100 text-[11px] text-blue-700 py-1 rounded disabled:opacity-50"
                      disabled={!!quickCreating[col.key]}
                      onClick={() => handleQuickCreateTask(col.key)}
                    >
                      {quickCreating[col.key]
                        ? "Adding..."
                        : "Add"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          </>
        )}
      </section>

      {/* Task details MODAL + admin CRUD */}
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
                    {selectedTaskDetails.subtasks_total > 0 && (
                      <span className="ml-1 text-[11px] font-normal text-slate-500">
                        ({selectedTaskDetails.subtasks_completed}/{selectedTaskDetails.subtasks_total} subtasks)
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
                    {selectedTaskDetails.due_date && (
                      <p className="text-[11px] text-slate-500">
                        Due: <span className="font-medium text-slate-700">{new Date(selectedTaskDetails.due_date).toLocaleDateString()}</span>
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
                  {canEdit && (
                    <button
                      title={isEditing ? "Cancel edit" : "Edit task"}
                      onClick={() => setIsEditing((v) => !v)}
                      className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${isEditing ? "text-slate-500" : "text-blue-600"}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canEdit && (
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
                  <h3 className="text-xs font-semibold mb-1">
                    Description
                  </h3>
                  {selectedTaskDetails.description ? (
                    <div
                      className="prose prose-sm max-w-none text-xs"
                      dangerouslySetInnerHTML={{
                        __html:
                          selectedTaskDetails.description,
                      }}
                    />
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      No description provided.
                    </p>
                  )}
                </div>
              )}

              {/* Edit form with status dropdown bound to custom columns */}
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

                      <label className="block mt-2">
                        Status
                      </label>
                      <select
                        name="status"
                        value={editTask.status || ""}
                        onChange={handleEditFieldChange}
                        className="w-full border rounded px-2 py-1"
                      >
                        <option value="">No status</option>
                        {statusColumns.map((col) => (
                          <option
                            key={col.key}
                            value={col.key}
                          >
                            {col.label}
                          </option>
                        ))}
                      </select>

                      <label className="block mt-2">
                        Priority
                      </label>
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
                          id="is_blocked_edit"
                          name="is_blocked"
                          checked={editTask.is_blocked || false}
                          onChange={e => setEditTask(prev => ({ ...prev, is_blocked: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300 text-red-600"
                        />
                        <label htmlFor="is_blocked_edit" className="text-xs text-gray-700 flex items-center gap-1">
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
                          <option key={u.id} value={u.id}>
                            {u.username} ({u.email})
                          </option>
                        ))}
                      </select>

                      <label className="block mt-2">
                        Description
                      </label>
                      {/* unified quill editor wrapper */}
                      <div className="quill-editor">
                        <ReactQuill
                          ref={editEditorRef}
                          theme="snow"
                          value={editTask.description}
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

              {/* Subtasks panel */}
              <Subtasks taskId={selectedTaskDetails.id} />

              {/* Comments for this task */}
              <div className="mt-3 border-t pt-3">
                <h3 className="text-xs font-semibold mb-1">
                  Comments
                </h3>
                <CommentsSection
                  taskId={selectedTaskDetails.id}
                />
              </div>

              {/* Attachments panel */}
              <div className="mt-3 border-t pt-3">
                <h3 className="text-xs font-semibold mb-1">
                  Attachments
                </h3>

                {loadingAttachments ? (
                  <p className="text-[11px] text-slate-400">
                    Loading attachments...
                  </p>
                ) : attachments.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    No attachments.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {attachments.map((att) => {
                      const fullUrl = att.url?.startsWith("http")
                        ? att.url
                        : `http://localhost:3000${att.url}`;
                      const isImage = att.mime_type?.startsWith("image/");
                      return (
                        <div key={att.id} className="flex items-center gap-2 text-[11px]">
                          {isImage && (
                            <a href={fullUrl} target="_blank" rel="noreferrer">
                              <img
                                src={fullUrl}
                                alt={att.original_name}
                                className="h-10 w-14 object-cover rounded border border-slate-200"
                              />
                            </a>
                          )}
                          <a
                            href={fullUrl}
                            download={att.original_name}
                            className="text-blue-600 hover:underline truncate max-w-[200px]"
                            target="_blank"
                            rel="noreferrer"
                          >
                            📎 {att.original_name}
                          </a>
                          {att.file_size && (
                            <span className="text-slate-400">
                              ({(att.file_size / 1024).toFixed(1)} KB)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedTaskDetails && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="file"
                      className="text-[11px]"
                      onChange={(e) =>
                        setUploadFile(
                          e.target.files?.[0] || null
                        )
                      }
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={handleUploadAttachment}
                      className="bg-slate-800 text-white text-[11px] rounded px-3 py-1 disabled:opacity-50"
                    >
                      {uploading
                        ? "Uploading..."
                        : "Upload"}
                    </button>
                  </div>
                )}
              </div>
              {/* Activity Timeline */}
<div className="mt-4 border-t pt-3">
  <h3 className="text-xs font-semibold mb-2">
    Activity Timeline
  </h3>

  {loadingLogs ? (
    <p className="text-[11px] text-slate-400">
      Loading activity...
    </p>
  ) : activityLogs.length === 0 ? (
    <p className="text-[11px] text-slate-400">
      No activity recorded.
    </p>
  ) : (
    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
      {activityLogs.map((log) => (
        <div
          key={log.id}
          className="border border-slate-200 rounded-lg px-2 py-2 text-[11px] bg-slate-50"
        >
          <div className="font-medium text-slate-700">
  {formatLogMessage(log)}
</div>

<div className="text-[10px] text-slate-400 mt-1">
  {new Date(log.created_at).toLocaleString()}
</div>
        </div>
      ))}
    </div>
  )}
</div>
              {/* Tags */}
              <div className="mt-3 border-t pt-3">
                <h3 className="text-xs font-semibold mb-2">Tags</h3>
                <TagPicker taskId={selectedTaskDetails.id} readOnly={!canEdit} />
              </div>

              {/* Issue Links */}
              <IssueLinkPanel taskId={selectedTaskDetails.id} canEdit={canEdit} />

              {/* Time Tracking */}
              <TimeTrackingPanel taskId={selectedTaskDetails.id} canEdit={canEdit} />

              {/* Watchers + Votes */}
              <WatchersVotesBar taskId={selectedTaskDetails.id} />

            </section>
          </div>
        </div>
      )}

      {/* Burndown modal */}
      {burndownSprint && (
        <BurndownModal
          sprintId={burndownSprint.id}
          sprintName={burndownSprint.name}
          onClose={() => setBurndownSprint(null)}
        />
      )}

      {/* Keyboard shortcut hint */}
      <div className="fixed bottom-4 right-4 z-10 text-[10px] text-slate-400 bg-white/80 backdrop-blur border border-slate-200 rounded-lg px-2 py-1 shadow hidden md:block">
        <span className="mr-2"><kbd className="bg-slate-100 px-1 rounded">n</kbd> New</span>
        <span className="mr-2"><kbd className="bg-slate-100 px-1 rounded">b</kbd> Board</span>
        <span className="mr-2"><kbd className="bg-slate-100 px-1 rounded">l</kbd> List</span>
        <span><kbd className="bg-slate-100 px-1 rounded">f</kbd> Filter</span>
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <Modal isOpen={true} onClose={() => !creating && setShowCreateModal(false)} size="xl">
          <form onSubmit={handleCreateTask}>
            <Modal.Header>
              <Modal.Title>Create New Task</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="mb-5 p-3 rounded-lg border border-primary-200 bg-primary-50">
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  Natural Language Task Creation
                </label>
                <div className="flex flex-col md:flex-row gap-2">
                  <input
                    type="text"
                    value={nlCommand}
                    onChange={(e) => setNlCommand(e.target.value)}
                    placeholder='Type or speak: "Create 5 frontend tasks for login redesign, assign to Sarah, high priority, due Friday"'
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500/20"
                    disabled={creating || creatingFromNL}
                  />
                  <Button
                    type="button"
                    variant={isListening ? "danger" : "secondary"}
                    onClick={isListening ? stopVoiceInput : startVoiceInput}
                    disabled={creating || creatingFromNL}
                    className="gap-2"
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-4 h-4" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        Speak
                      </>
                    )}
                  </Button>
                  <select
                    value={speechLang}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSpeechLang(v);
                      localStorage.setItem("nlSpeechLang", v);
                      if (speechRecognitionRef.current) {
                        speechRecognitionRef.current.lang =
                          v === "custom"
                            ? (speechLangCustom.trim() || navigator.language || "en-US")
                            : v === "auto"
                              ? (navigator.language || "en-US")
                              : v;
                      }
                    }}
                    className="border border-gray-300 rounded-lg px-2 py-2 text-sm min-w-[150px] focus:border-primary-500 focus:ring-primary-500/20"
                    disabled={creating || creatingFromNL || isListening}
                  >
                    <option value="auto">Auto language</option>
                    <option value="en-US">English</option>
                    <option value="hi-IN">Hindi</option>
                    <option value="pa-IN">Punjabi</option>
                    <option value="es-ES">Spanish</option>
                    <option value="fr-FR">French</option>
                    <option value="de-DE">German</option>
                    <option value="ar-SA">Arabic</option>
                    <option value="ja-JP">Japanese</option>
                    <option value="custom">Custom code</option>
                  </select>
                  {speechLang === "custom" && (
                    <input
                      type="text"
                      value={speechLangCustom}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSpeechLangCustom(v);
                        localStorage.setItem("nlSpeechLangCustom", v);
                      }}
                      placeholder="BCP-47: ta-IN, bn-IN, ru-RU, etc."
                      className="border border-gray-300 rounded-lg px-2 py-2 text-sm min-w-[220px] focus:border-primary-500 focus:ring-primary-500/20"
                      disabled={creating || creatingFromNL || isListening}
                    />
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleCreateFromNaturalLanguage}
                    loading={creatingFromNL}
                    disabled={creating || creatingFromNL}
                    className="gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Create With AI
                  </Button>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Voice mode listens continuously and auto-creates after 2 seconds of silence.
                </p>
              </div>
              {/* Template picker */}
              {templateList.length > 0 && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Use Template</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    onChange={e => {
                      const tpl = templateList.find(t => t.id === e.target.value);
                      if (tpl?.default_fields) setNewTask(prev => ({ ...prev, ...tpl.default_fields }));
                    }}
                  >
                    <option value="">Select template…</option>
                    {templateList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                  <Input
                    label="Task Title"
                    type="text"
                    name="task"
                    value={newTask.task}
                    onChange={e => { handleNewTaskChange(e); checkDuplicates(e.target.value); }}
                    placeholder="Enter task title"
                    required
                    autoFocus
                  />
                  {dupeSuggestions.length > 0 && (
                    <div className="mt-1 bg-amber-50 border border-amber-200 rounded p-2">
                      <p className="text-[10px] text-amber-700 font-semibold mb-1">⚠ Similar tasks found:</p>
                      {dupeSuggestions.map(d => (
                        <p key={d.id} className="text-[11px] text-amber-600 truncate">
                          {d.display_id && <span className="font-mono mr-1">{d.display_id}</span>}
                          {d.task}
                        </p>
                      ))}
                    </div>
                  )}
                  </div>

                  <Input
                    label="Due Date"
                    type="date"
                    name="due_date"
                    value={newTask.due_date}
                    min={TODAY}
                    onChange={handleNewTaskChange}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assign To
                    </label>
                    <select
                      name="assigned_to"
                      value={newTask.assigned_to}
                      onChange={handleNewTaskChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500/20"
                    >
                      <option value="">Unassigned</option>
                      {loadingUsers ? (
                        <option disabled>Loading users...</option>
                      ) : (
                        users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username} ({u.email})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      name="priority"
                      value={newTask.priority}
                      onChange={handleNewTaskChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500/20"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type
                    </label>
                    <select
                      name="task_type"
                      value={newTask.task_type}
                      onChange={handleNewTaskChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500/20"
                    >
                      {TASK_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Story Points
                    </label>
                    <select
                      name="story_points"
                      value={newTask.story_points}
                      onChange={handleNewTaskChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500/20"
                    >
                      <option value="">No estimate</option>
                      {STORY_POINTS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="is_blocked_create"
                      name="is_blocked"
                      checked={newTask.is_blocked}
                      onChange={e => setNewTask(prev => ({ ...prev, is_blocked: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300 text-red-600"
                    />
                    <label htmlFor="is_blocked_create" className="text-sm text-gray-700 flex items-center gap-1">
                      <ShieldAlert className="w-4 h-4 text-red-500" /> Mark as blocked
                    </label>
                  </div>
                </div>

                {/* Right Column - Description */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <div className="quill-editor-wrapper">
                      <ReactQuill
                        ref={createEditorRef}
                        theme="snow"
                        value={newTask.description}
                        onChange={handleCreateDescriptionChange}
                        className="rounded-lg"
                        style={{ height: "245px" }}
                        placeholder="Describe the task in detail..."
                        modules={quillModules}
                        formats={quillFormats}
                      />
                    </div>
                  </div>
                </div>

                {/* Subtasks Section - Full Width */}
                <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Subtasks (Optional)
                    </label>
                    <Button
                      type="button"
                      onClick={handleAddSubtaskRow}
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Add Subtask
                    </Button>
                  </div>

                  {newSubtasks.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      No subtasks added. Click &quot;Add Subtask&quot; to break this task into smaller pieces.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {newSubtasks.map((st, index) => (
                        <div
                          key={index}
                          className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-gray-50 border border-gray-200 rounded-lg p-3"
                        >
                          <input
                            type="text"
                            value={st.title}
                            onChange={(e) =>
                              handleNewSubtaskChange(
                                index,
                                "title",
                                e.target.value
                              )
                            }
                            placeholder="Subtask title"
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500/20"
                          />
                          <select
                            value={st.assigned_to || ""}
                            onChange={(e) =>
                              handleNewSubtaskChange(
                                index,
                                "assigned_to",
                                e.target.value
                              )
                            }
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px] focus:border-primary-500 focus:ring-primary-500/20"
                          >
                            <option value="">Unassigned</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.username} ({u.email})
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            onClick={() => handleRemoveSubtaskRow(index)}
                            variant="ghost"
                            size="sm"
                            className="text-danger-600 hover:bg-danger-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                type="button"
                onClick={() => setShowCreateModal(false)}
                variant="secondary"
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={creating}
                disabled={creating}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Task
              </Button>
            </Modal.Footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
