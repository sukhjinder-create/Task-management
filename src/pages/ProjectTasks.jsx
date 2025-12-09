// src/pages/ProjectTasks.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import CommentsSection from "../components/CommentsSection.jsx";
import Subtasks from "../components/Subtasks.jsx";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

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

  const [selectedTaskForComments, setSelectedTaskForComments] =
    useState(null);

  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);

  // attachments for selected task
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">
            {loadingProject
              ? "Loading project..."
              : project?.name || "Project"}
          </h1>
          <p className="text-xs text-slate-500">
            Manage tasks for this project. New tasks are created in
            &quot;pending&quot; status by default (until you
            customize).
          </p>
          {tasks.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              Total: <b>{stats.total}</b> • Pending: {stats.pending} •
              In progress: {stats.inProgress} • Completed:{" "}
              {stats.completed} • Overdue:{" "}
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
      </section>

      {/* Create Task Form (admins + managers only) */}
      {canEdit && (
        <section className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-semibold mb-3">
            Create Task
          </h2>
          <form
            onSubmit={handleCreateTask}
            className="grid md:grid-cols-2 gap-4 text-sm"
          >
            <div className="space-y-2">
              <label className="block text-xs">Task title</label>
              <input
                type="text"
                name="task"
                value={newTask.task}
                onChange={handleNewTaskChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Enter task title"
              />

              <label className="block text-xs mt-3">Due date</label>
              <input
                type="date"
                name="due_date"
                value={newTask.due_date}
                onChange={handleNewTaskChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />

              <label className="block text-xs mt-3">Assign to</label>
              <select
                name="assigned_to"
                value={newTask.assigned_to}
                onChange={handleNewTaskChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
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

              <label className="block text-xs mt-3">Priority</label>
              <select
                name="priority"
                value={newTask.priority}
                onChange={handleNewTaskChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* RIGHT: big description box */}
            <div className="space-y-2 md:col-span-1">
  <label className="block text-xs mb-1">
    Description
  </label>
  <div className="quill-editor">
    <ReactQuill
      ref={createEditorRef}
      theme="snow"
      value={newTask.description}
      onChange={handleCreateDescriptionChange}
      className="text-sm"
      // big but not insane – adjust if you want
      style={{ minHeight: "240px" }}
      placeholder="Describe the task..."
      modules={quillModules}
      formats={quillFormats}
    />
  </div>
</div>


            {/* Subtasks create section */}
            <div className="md:col-span-2 mt-4">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold">
                  Subtasks (optional)
                </label>
                <button
                  type="button"
                  onClick={handleAddSubtaskRow}
                  className="text-[11px] text-blue-600 underline"
                >
                  + Add subtask
                </button>
              </div>
              {newSubtasks.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  No subtasks added. Click &quot;Add subtask&quot; to
                  define smaller pieces of work.
                </p>
              ) : (
                <div className="space-y-2">
                  {newSubtasks.map((st, index) => (
                    <div
                      key={index}
                      className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-2"
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
                        className="flex-1 border rounded px-2 py-1 text-xs"
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
                        className="border rounded px-2 py-1 text-xs min-w-[150px]"
                      >
                        <option value="">Unassigned</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username} ({u.email})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveSubtaskRow(index)
                        }
                        className="text-[11px] text-red-600 underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 text-white text-xs rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Task"}
              </button>
            </div>
          </form>
        </section>
      )}

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
                    <div
                      key={t.id}
                      className={
                        "border rounded-lg px-2 py-2 bg-white text-xs cursor-pointer hover:bg-slate-50 " +
                        (isOverdue(t)
                          ? "border-red-300 bg-red-50"
                          : "border-slate-200")
                      }
                      onClick={() => handleCardClick(t)}
                    >
                      <div className="font-medium text-[11px]">
                        {t.task}{" "}
                        {t.subtasks_total > 0 && (
                          <span className="ml-1 text-[10px] text-slate-500">
                            ({t.subtasks_completed}/
                            {t.subtasks_total} subtasks completed)
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Status: {statusLabel(t.status)}
                      </div>
                      {t.due_date && (
                        <div className="text-[10px] text-slate-400">
                          Due:{" "}
                          {new Date(
                            t.due_date
                          ).toLocaleDateString()}
                        </div>
                      )}
                      {t.assigned_to && (
                        <div className="text-[10px] text-slate-400">
                          Assigned to:{" "}
                          {getAssigneeLabel(t.assigned_to)}
                        </div>
                      )}

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

                      <div className="flex justify-between items-center mt-2">
                        {canEdit && (
                          <select
                            className="border rounded px-2 py-1 text-[10px]"
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
                        <button
                          className="text-[10px] text-blue-600 underline"
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
                        </button>
                      </div>

                      {selectedTaskForComments === t.id && (
                        <div className="mt-2 border-t pt-2">
                          <CommentsSection taskId={t.id} />
                        </div>
                      )}
                    </div>
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
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
