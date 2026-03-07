// src/pages/ProjectTasks.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Calendar, User as UserIcon, AlertCircle, CheckCircle2, Plus, X, Edit2, Trash2, LinkIcon, Mic, MicOff, Sparkles } from "lucide-react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import CommentsSection from "../components/CommentsSection.jsx";
import Subtasks from "../components/Subtasks.jsx";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Card, Badge, Button, Modal, Input, Select as SelectUI, Avatar } from "../components/ui";

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

  // Deep-link guard
  const [initialTaskOpened, setInitialTaskOpened] = useState(false);

  // 🔹 Project-level status columns (customizable)
  // Raw config from backend
  const [statusColumnsConfig, setStatusColumnsConfig] = useState([]);
  const [showStatusEditor, setShowStatusEditor] = useState(false);
  const [newStatusKey, setNewStatusKey] = useState("");
  const [newStatusLabel, setNewStatusLabel] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  // 🔹 edit / delete state for an existing column
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [editStatusLabel, setEditStatusLabel] = useState("");

  // 🔹 Quick-add task per column
  const [quickNewTitles, setQuickNewTitles] = useState({}); // { [statusKey]: "title" }
  const [quickCreating, setQuickCreating] = useState({}); // { [statusKey]: boolean }

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

    return Array.from(map.values());
  }, [statusColumnsConfig, tasks]);

  // Group tasks by status
  const grouped = useMemo(() => {
    const result = {};
    statusColumns.forEach((col) => {
      result[col.key] = [];
    });

    for (const t of tasks) {
      const key = t.status;
      if (!key) continue;
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(t);
    }
    return result;
  }, [tasks, statusColumns]);

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
        // status is left to backend default or can be added later
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
    } catch (err) {
      console.error("Failed to update status:", err);
      const msg =
        err.response?.data?.error || "Failed to update status";
      toast.error(msg);
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
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
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

  // ===== Column customization handlers (no redirect) =====
  const handleAddStatusColumn = async (e) => {
    e.preventDefault();
    const key = newStatusKey.trim();
    const label = newStatusLabel.trim();

    if (!key) {
      toast.error("Internal key is required (e.g. in-review)");
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

      setStatusColumnsConfig((prev) => [...prev, created]);
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

    try {
      const payload = {
        label: editStatusLabel.trim(),
      };
      const res = await api.put(`/project-statuses/${id}`, payload);
      const updated = res.data;

      setStatusColumnsConfig((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
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

    if (
      !window.confirm(
        `Delete column "${col.label || col.key}"? Tasks with this status will no longer appear in any column.`
      )
    ) {
      return;
    }

  try {
      await api.delete(`/project-statuses/${id}`);
      setStatusColumnsConfig((prev) =>
        prev.filter((c) => c.id !== id)
      );
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


      {/* Tasks Board */}
      {/* ... rest of your component stays exactly the same ... */}
      {/* I’ve left everything below unchanged from your version */}
      {/* (status board, modal, comments, attachments, etc.) */}

      {/* Tasks Board */}
      <section className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold">Tasks</h2>
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

        {/* Inline column customization panel */}
        {showStatusEditor && canEdit && (
          <div className="mb-4 border border-slate-200 rounded-lg p-3 bg-slate-50">
            <h3 className="text-xs font-semibold mb-2">
              Columns for this project
            </h3>
            {statusColumnsConfig.length === 0 ? (
              <p className="text-[11px] text-slate-500 mb-2">
                No custom columns yet. Add your first one below.
              </p>
            ) : (
              <ul className="mb-2 flex flex-col gap-1 text-[11px]">
                {statusColumnsConfig.map((col) => {
                  const id = col.id || col.key;
                  const isEditingThis = editingStatusId === id;

                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-2 border border-slate-200 rounded-md bg-white px-2 py-1"
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
                            </span>{" "}
                            <span className="text-slate-400">
                              ({col.key})
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleStartEditStatusColumn(col)
                              }
                              className="text-[11px] text-blue-600 border border-blue-200 rounded px-2 py-[2px] hover:bg-blue-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteStatusColumn(col)
                              }
                              className="text-[11px] text-red-600 border border-red-200 rounded px-2 py-[2px] hover:bg-red-50"
                            >
                              Delete
                            </button>
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
              Columns here affect this project only. Tasks can be
              moved by changing their status or dragging them between
              columns.
            </p>
          </div>
        )}

        {loadingTasks ? (
          <div className="text-sm text-slate-500">
            Loading tasks...
          </div>
        ) : statusColumns.length === 0 ? (
          <div className="text-sm text-slate-500">
            No status columns defined yet. Use &quot;Customize
            columns&quot; to add some.
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-sm text-slate-500">
            No tasks for this project yet.
          </div>
        ) : (
          <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 overflow-x-auto pb-2">
            {statusColumns.map((col) => (
              <div
                key={col.key}
                className="border border-slate-200 rounded-lg min-h-[200px] p-2 bg-slate-50"
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
                      className={
                        "cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 " +
                        (isOverdue(t)
                          ? "border-danger-300 bg-danger-50"
                          : "border-gray-200 hover:border-primary-200")
                      }
                      onClick={() => handleCardClick(t)}
                    >
                      <Card.Content className="p-3 space-y-2">
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

                        <div className="mt-2 flex items-center justify-between">
                          <Badge
                            color={priorityBadgeColor(t.priority)}
                            size="sm"
                            variant="subtle"
                          >
                            {priorityLabel(t.priority)}
                          </Badge>
                          {isOverdue(t) && (
                            <Badge color="danger" size="sm" variant="solid" className="gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Overdue
                            </Badge>
                          )}
                        </div>

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
        )}
      </section>

      {/* Task details MODAL + admin CRUD */}
      {selectedTaskDetails && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto">
          <div className="mt-16 mb-8 w-full max-w-3xl px-4">
            <section className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    Task Details: {selectedTaskDetails.task}{" "}
                    {selectedTaskDetails.subtasks_total > 0 && (
                      <span className="ml-1 text-[11px] font-normal text-slate-500">
                        (
                        {
                          selectedTaskDetails.subtasks_completed
                        }
                        /
                        {
                          selectedTaskDetails.subtasks_total
                        }{" "}
                        subtasks completed)
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Status:{" "}
                    {statusLabel(selectedTaskDetails.status)}{" "}
                    {selectedTaskDetails.due_date &&
                      ` • Due: ${new Date(
                        selectedTaskDetails.due_date
                      ).toLocaleDateString()}`}
                  </p>
                  {selectedTaskDetails.assigned_to && (
                    <p className="text-[11px] text-slate-500">
                      Assigned to:{" "}
                      {getAssigneeLabel(
                        selectedTaskDetails.assigned_to
                      )}
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
                  {canEdit && (
                    <div className="flex gap-2">
                      <button
                        className="text-[11px] text-blue-600 underline"
                        onClick={() =>
                          setIsEditing((v) => !v)
                        }
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

                      <label className="block mt-2">
                        Due date
                      </label>
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
                  <ul className="text-[11px] text-slate-600 list-disc ml-4">
                    {attachments.map((att) => (
                      <li key={att.id}>
                        {att.original_name}
                      </li>
                    ))}
                  </ul>
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
            </section>
          </div>
        </div>
      )}

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
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <Input
                    label="Task Title"
                    type="text"
                    name="task"
                    value={newTask.task}
                    onChange={handleNewTaskChange}
                    placeholder="Enter task title"
                    required
                    autoFocus
                  />

                  <Input
                    label="Due Date"
                    type="date"
                    name="due_date"
                    value={newTask.due_date}
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
