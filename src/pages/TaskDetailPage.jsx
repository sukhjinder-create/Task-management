// src/pages/TaskDetailPage.jsx
//
// Full-page task detail view. Previously task details opened as a modal
// overlay inside ProjectTasks.jsx / MyTasks.jsx; this page gives the same
// content its own URL (/tasks/:taskId) instead. The content, handlers and
// API calls here intentionally mirror those two files' (now-unused) modal
// implementation so behavior is unchanged — only the presentation (page vs.
// overlay) and navigation (URL vs. local state) differ.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Edit2, Trash2, LinkIcon, Share2, ShieldAlert, BarChart2,
  Bug, Zap, Star, Wrench, CheckCircle2,
} from "lucide-react";
import { useApi, API_BASE_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import CommentsSection from "../components/CommentsSection.jsx";
import Subtasks from "../components/Subtasks.jsx";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import TagPicker from "../components/TagPicker.jsx";
import IssueLinkPanel from "../components/IssueLinkPanel.jsx";
import TimeTrackingPanel from "../components/TimeTrackingPanel.jsx";
import WatchersVotesBar from "../components/WatchersVotesBar.jsx";
import ShareToChat from "../components/ShareToChat.jsx";

function statusLabel(status) {
  if (status === "backlog") return "Backlog";
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

const TASK_TYPES = [
  { value: "task",        label: "Task",        color: "text-[color:var(--text-soft)]" },
  { value: "bug",         label: "Bug",         color: "text-[color:var(--score-danger)]" },
  { value: "feature",     label: "Feature",     color: "text-[color:var(--primary)]" },
  { value: "improvement", label: "Improvement", color: "text-[color:var(--score-good)]" },
  { value: "chore",       label: "Chore",       color: "text-[color:var(--score-warning)]" },
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
  const t = TASK_TYPES.find((x) => x.value === type) || TASK_TYPES[0];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[color:var(--border)] ${t.color}`}>
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
  "header", "bold", "italic", "underline", "list", "bullet", "link", "image",
];

function formatLogMessage(log) {
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
    case "STATUS_CHANGED":
      return `Status changed from "${oldVal?.status || oldVal}" to "${newVal?.status || newVal}" by ${user}`;
    case "PRIORITY_CHANGED":
      return `Priority changed from "${oldVal?.priority || oldVal}" to "${newVal?.priority || newVal}" by ${user}`;
    case "ASSIGNEE_CHANGED":
      return `Assignee changed from "${log.old_assignee_username || "Unassigned"}" to "${log.new_assignee_username || "Unassigned"}" by ${log.actor_username || "Someone"}`;
    case "DESCRIPTION_UPDATED":
      return `Description updated by ${user}`;
    case "TITLE_CHANGED":
      return `Title changed from "${oldVal?.task || oldVal}" to "${newVal?.task || newVal}" by ${user}`;
    case "COMMENT_ADDED":
      return `Comment added by ${user}`;
    case "TASK_CREATED":
      return `Task created by ${user}`;
    case "TASK_DELETED":
      return `Task deleted by ${user}`;
    default:
      return `${log.action_type} by ${user}`;
  }
}

export default function TaskDetailPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const { auth } = useAuth();
  const user = auth.user;
  const role = user?.role;
  const canEdit = role === "admin" || role === "manager";

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const editEditorRef = useRef(null);

  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [users, setUsers] = useState([]);
  const [statusColumnsRaw, setStatusColumnsRaw] = useState([]);

  const getAssigneeLabel = (id) => {
    if (!id) return null;
    if (user && id === user.id) return `${user.username} (${user.email})`;
    const u = users.find((usr) => usr.id === id);
    return u ? `${u.username} (${u.email})` : id;
  };

  // Union of workspace-wide status config + the task's own current status,
  // same approach MyTasks.jsx uses since this page isn't scoped to one project.
  const statusColumns = useMemo(() => {
    const map = new Map();
    statusColumnsRaw.forEach((col) => {
      if (!col?.key) return;
      map.set(col.key, { key: col.key, label: col.label || statusLabel(col.key) });
    });
    if (task?.status && !map.has(task.status)) {
      map.set(task.status, { key: task.status, label: statusLabel(task.status) });
    }
    return Array.from(map.values());
  }, [statusColumnsRaw, task?.status]);

  const loadAttachments = async (id) => {
    setLoadingAttachments(true);
    try {
      const res = await api.get(`/tasks/${id}/attachments`);
      setAttachments(res.data || []);
    } catch (err) {
      console.error("Failed to load attachments:", err);
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const loadLogs = async (id) => {
    setLoadingLogs(true);
    try {
      const res = await api.get(`/tasks/${id}/logs`);
      setActivityLogs(res.data || []);
    } catch (err) {
      console.error("Failed to load activity logs:", err);
      setActivityLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setIsEditing(false);

    api.get(`/tasks/detail/${taskId}`)
      .then((res) => {
        if (cancelled) return;
        const t = res.data;
        setTask(t);
        setEditTask({
          task: t.task || "",
          status: t.status || "",
          assigned_to: t.assigned_to || "",
          due_date: t.due_date ? t.due_date.slice(0, 10) : "",
          description: t.description || "",
          priority: t.priority || "medium",
          task_type: t.task_type || "task",
          story_points: t.story_points != null ? String(t.story_points) : "",
          is_blocked: t.is_blocked || false,
        });
        loadAttachments(taskId);
        loadLogs(taskId);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load task:", err);
        setTask(null);
        setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Users for the assignee dropdown — admin/manager only, matching ProjectTasks/MyTasks.
  useEffect(() => {
    if (!canEdit) return;
    api.get("/users")
      .then((res) => setUsers(res.data || []))
      .catch((err) => console.error("Error fetching users:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  // Workspace-wide status options (project-agnostic, unlike ProjectTasks' per-project config).
  useEffect(() => {
    api.get("/project-statuses/global")
      .then((res) => setStatusColumnsRaw(res.data || []))
      .catch(() => setStatusColumnsRaw([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditFieldChange = (e) => {
    const { name, value } = e.target;
    setEditTask((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditDescriptionChange = (value) => {
    setEditTask((prev) => ({ ...prev, description: value }));
  };

  const handleSaveEdit = async () => {
    if (!task || !editTask) return;
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
        story_points: editTask.story_points ? parseInt(editTask.story_points, 10) : null,
        is_blocked: editTask.is_blocked || false,
      };
      const res = await api.put(`/tasks/${task.id}`, payload);
      setTask(res.data);
      setIsEditing(false);
      toast.success("Task updated");
    } catch (err) {
      console.error("Failed to save task:", err);
      toast.error(err.response?.data?.error || "Failed to save task");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await api.delete(`/tasks/${task.id}`);
      toast.success("Task deleted");
      navigate(task.project_id ? `/projects/${task.project_id}` : "/my-tasks");
    } catch (err) {
      console.error("Failed to delete task:", err);
      toast.error(err.response?.data?.error || "Failed to delete task");
    }
  };

  const handleUploadAttachment = async () => {
    if (!task) return;
    if (!uploadFile) {
      toast.error("Please select a file first");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      await api.post(`/tasks/${task.id}/attachments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadFile(null);
      await loadAttachments(task.id);
      toast.success("Attachment uploaded");
    } catch (err) {
      console.error("Failed to upload attachment:", err);
      toast.error(err.response?.data?.error || "Failed to upload attachment");
    } finally {
      setUploading(false);
    }
  };

  const handleCopyTaskLink = async () => {
    if (!task) return;
    try {
      const url = `${window.location.origin}/tasks/${task.id}`;
      const idLabel = task.display_id;
      const title = task.task;
      const label = idLabel ? `${idLabel} ${title}` : title;
      const htmlContent = idLabel ? `<a href="${url}">${idLabel}</a> ${title}` : `<a href="${url}">${title}</a>`;
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

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(task?.project_id ? `/projects/${task.project_id}` : "/my-tasks");
  };

  // Escape returns to the previous screen, mirroring the modal's old Escape-to-close.
  useEffect(() => {
    const handler = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.key === "Escape") handleBack();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-sm text-[color:var(--text-muted)]">Loading task…</p>
      </div>
    );
  }

  if (notFound || !task) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <p className="text-sm text-[color:var(--text-muted)]">
          Task not found, or you don't have access to it.
        </p>
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-sm text-[color:var(--primary)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-6 -my-5">
      <header className="flex items-center gap-3 px-4 py-2 border-b border-[color:var(--border)] shrink-0">
        <button
          onClick={handleBack}
          title="Back"
          className="p-1.5 rounded hover:bg-[var(--surface-soft)] text-[color:var(--text-muted)] transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        {task.project_id && task.project_name && (
          <Link
            to={`/projects/${task.project_id}`}
            className="text-[11px] text-[color:var(--text-muted)] hover:text-[color:var(--primary)] hover:underline truncate"
          >
            {task.project_name}
          </Link>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="max-w-5xl mx-auto">
          <section className="bg-[var(--surface)] border border-[color:var(--border)] rounded-xl p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {task.display_id && (
                    <span className="font-mono text-[11px] text-[color:var(--primary)] font-bold border border-[color:var(--border)] px-1.5 py-0.5 rounded">
                      {task.display_id}
                    </span>
                  )}
                  <TaskTypeBadge type={task.task_type || "task"} />
                  {task.is_blocked && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[color:var(--border)] text-[color:var(--score-danger)]">
                      <ShieldAlert className="w-3 h-3" /> Blocked
                    </span>
                  )}
                  {task.story_points != null && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold border border-[color:var(--border)] text-[color:var(--text-soft)] px-1.5 py-0.5 rounded-full">
                      <BarChart2 className="w-3 h-3" /> {task.story_points} pts
                    </span>
                  )}
                </div>
                <h2 className="text-sm font-semibold text-[color:var(--text)]">
                  {task.task}{" "}
                  {task.subtasks_total > 0 && (
                    <span className="ml-1 text-[11px] font-normal text-[color:var(--text-muted)]">
                      ({task.subtasks_completed}/{task.subtasks_total} subtasks)
                    </span>
                  )}
                </h2>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  <p className="text-[11px] text-[color:var(--text-muted)]">
                    Status: <span className="font-medium text-[color:var(--text)]">{statusLabel(task.status)}</span>
                  </p>
                  <p className="text-[11px] text-[color:var(--text-muted)]">
                    Priority: <span className="font-medium text-[color:var(--text)]">{priorityLabel(task.priority || "medium")}</span>
                  </p>
                  {task.due_date && (
                    <p className="text-[11px] text-[color:var(--text-muted)]">
                      Due: <span className="font-medium text-[color:var(--text)]">{new Date(task.due_date).toLocaleDateString()}</span>
                    </p>
                  )}
                  {task.assigned_to && (
                    <p className="text-[11px] text-[color:var(--text-muted)]">
                      Assigned: <span className="font-medium text-[color:var(--text)]">{getAssigneeLabel(task.assigned_to)}</span>
                    </p>
                  )}
                  {task.sprint_name && (
                    <p className="text-[11px] text-[color:var(--text-muted)]">
                      Sprint: <span className="font-medium text-[color:var(--primary)]">{task.sprint_name}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canEdit && (
                  <button
                    title={isEditing ? "Cancel edit" : "Edit task"}
                    onClick={() => setIsEditing((v) => !v)}
                    className={`p-1.5 rounded hover:bg-[var(--surface-soft)] transition-colors ${isEditing ? "text-[color:var(--text-muted)]" : "text-[color:var(--primary)]"}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                {canEdit && (
                  <button
                    title="Delete task"
                    onClick={handleDeleteTask}
                    className="p-1.5 rounded hover:bg-[var(--surface-soft)] text-[color:var(--score-danger)] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <ShareToChat
                  item={{
                    kind: "task",
                    title: task.task,
                    linkLabel: task.display_id || undefined,
                    url: `/tasks/${task.id}`,
                  }}
                  trigger={(open) => (
                    <button
                      title="Share to chat"
                      onClick={open}
                      className="p-1.5 rounded hover:bg-[var(--surface-soft)] text-[color:var(--text-muted)] transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  )}
                />
                <button
                  title="Copy link"
                  onClick={handleCopyTaskLink}
                  className="p-1.5 rounded hover:bg-[var(--surface-soft)] text-[color:var(--text-muted)] transition-colors"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isEditing && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold mb-1 text-[color:var(--text)]">Description</h3>
                {task.description ? (
                  <div
                    className="prose prose-sm max-w-none text-xs text-[color:var(--text-muted)]"
                    dangerouslySetInnerHTML={{ __html: task.description }}
                  />
                ) : (
                  <p className="text-[11px] text-[color:var(--text-soft)]">No description provided.</p>
                )}
              </div>
            )}

            {task.source_type === "huddle_action_item" && task.source_metadata?.sessionId && (
              <div className="mt-3 border-l-2 border-[color:var(--primary)] bg-[var(--surface-soft)] px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-[color:var(--text)]">Created from Huddle</h3>
                    <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                      Approved action item with {(task.source_metadata.evidenceSegmentIds || []).length} transcript source{(task.source_metadata.evidenceSegmentIds || []).length === 1 ? "" : "s"}.
                    </p>
                    <p className="mt-1 text-[10px] text-[color:var(--text-soft)]">
                      Created {task.source_metadata.createdAt ? new Date(task.source_metadata.createdAt).toLocaleString() : "from meeting review"}
                    </p>
                  </div>
                  <Link
                    to={`/huddles/${task.source_metadata.sessionId}/intelligence`}
                    className="inline-flex items-center gap-1 rounded border border-[color:var(--border)] px-2.5 py-1.5 text-[11px] font-medium text-[color:var(--primary)] hover:bg-[var(--surface)]"
                  >
                    <LinkIcon className="h-3 w-3" /> View evidence
                  </Link>
                </div>
              </div>
            )}

            {isEditing && editTask && (
              <div className="mt-3 border-t border-[color:var(--border)] pt-3">
                <h3 className="text-xs font-semibold mb-2 text-[color:var(--text)]">Edit task (admin / manager)</h3>
                <div className="grid md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-2">
                    <label className="block text-[color:var(--text-muted)]">Title</label>
                    <input
                      type="text"
                      name="task"
                      value={editTask.task}
                      onChange={handleEditFieldChange}
                      className="w-full border border-[color:var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] outline-none"
                    />

                    <label className="block mt-2 text-[color:var(--text-muted)]">Status</label>
                    <select
                      name="status"
                      value={editTask.status || ""}
                      onChange={handleEditFieldChange}
                      className="w-full border border-[color:var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] outline-none"
                    >
                      <option value="">No status</option>
                      {statusColumns.map((col) => (
                        <option key={col.key} value={col.key}>{col.label}</option>
                      ))}
                    </select>

                    <label className="block mt-2 text-[color:var(--text-muted)]">Priority</label>
                    <select
                      name="priority"
                      value={editTask.priority || "medium"}
                      onChange={handleEditFieldChange}
                      className="w-full border border-[color:var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] outline-none"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>

                    <label className="block mt-2 text-[color:var(--text-muted)]">Due date</label>
                    <input
                      type="date"
                      name="due_date"
                      value={editTask.due_date || ""}
                      onChange={handleEditFieldChange}
                      className="w-full border border-[color:var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] outline-none"
                    />

                    <label className="block mt-2 text-[color:var(--text-muted)]">Type</label>
                    <select
                      name="task_type"
                      value={editTask.task_type || "task"}
                      onChange={handleEditFieldChange}
                      className="w-full border border-[color:var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] outline-none"
                    >
                      {TASK_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>

                    <label className="block mt-2 text-[color:var(--text-muted)]">Story Points</label>
                    <select
                      name="story_points"
                      value={editTask.story_points || ""}
                      onChange={handleEditFieldChange}
                      className="w-full border border-[color:var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] outline-none"
                    >
                      <option value="">No estimate</option>
                      {STORY_POINTS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="is_blocked_edit"
                        name="is_blocked"
                        checked={editTask.is_blocked || false}
                        onChange={(e) => setEditTask((prev) => ({ ...prev, is_blocked: e.target.checked }))}
                        className="w-4 h-4 rounded border-[color:var(--border)] text-[color:var(--score-danger)]"
                      />
                      <label htmlFor="is_blocked_edit" className="text-xs text-[color:var(--text-muted)] flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-[color:var(--score-danger)]" /> Mark as blocked
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[color:var(--text-muted)]">Assign to</label>
                    <select
                      name="assigned_to"
                      value={editTask.assigned_to || ""}
                      onChange={handleEditFieldChange}
                      className="w-full border border-[color:var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] outline-none"
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
                    className="bg-[color:var(--primary)] text-white text-[11px] rounded px-3 py-1 disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {savingEdit ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            )}

            <Subtasks taskId={task.id} />

            <div className="mt-3 border-t border-[color:var(--border)] pt-3">
              <h3 className="text-xs font-semibold mb-1 text-[color:var(--text)]">Comments</h3>
              <CommentsSection taskId={task.id} />
            </div>

            <div className="mt-3 border-t border-[color:var(--border)] pt-3">
              <h3 className="text-xs font-semibold mb-1 text-[color:var(--text)]">Attachments</h3>
              {loadingAttachments ? (
                <p className="text-[11px] text-[color:var(--text-soft)]">Loading attachments...</p>
              ) : attachments.length === 0 ? (
                <p className="text-[11px] text-[color:var(--text-soft)]">No attachments.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {attachments.map((att) => {
                    const fullUrl = att.url?.startsWith("http") ? att.url : `${API_BASE_URL}${att.url}`;
                    const isImage = att.mime_type?.startsWith("image/");
                    return (
                      <div key={att.id} className="flex items-center gap-2 text-[11px]">
                        {isImage && (
                          <a href={fullUrl} target="_blank" rel="noreferrer">
                            <img
                              src={fullUrl}
                              alt={att.original_name}
                              className="h-10 w-14 object-cover rounded border border-[color:var(--border)]"
                            />
                          </a>
                        )}
                        <a
                          href={fullUrl}
                          download={att.original_name}
                          className="text-[color:var(--primary)] hover:underline truncate max-w-[200px]"
                          target="_blank"
                          rel="noreferrer"
                        >
                          📎 {att.original_name}
                        </a>
                        {att.file_size && (
                          <span className="text-[color:var(--text-soft)]">({(att.file_size / 1024).toFixed(1)} KB)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="file"
                  className="text-[11px]"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleUploadAttachment}
                  className="bg-[color:var(--primary)] text-white text-[11px] rounded px-3 py-1 disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>

            <div className="mt-4 border-t border-[color:var(--border)] pt-3">
              <h3 className="text-xs font-semibold mb-2 text-[color:var(--text)]">Activity Timeline</h3>
              {loadingLogs ? (
                <p className="text-[11px] text-[color:var(--text-soft)]">Loading activity...</p>
              ) : activityLogs.length === 0 ? (
                <p className="text-[11px] text-[color:var(--text-soft)]">No activity recorded.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="border border-[color:var(--border)] rounded-lg px-2 py-2 text-[11px]">
                      <div className="font-medium text-[color:var(--text)]">{formatLogMessage(log)}</div>
                      <div className="text-[10px] text-[color:var(--text-soft)] mt-1">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 border-t border-[color:var(--border)] pt-3">
              <h3 className="text-xs font-semibold mb-2 text-[color:var(--text)]">Tags</h3>
              <TagPicker taskId={task.id} readOnly={!canEdit} />
            </div>

            <IssueLinkPanel taskId={task.id} canEdit={canEdit} />
            <TimeTrackingPanel taskId={task.id} canEdit={canEdit} />
            <WatchersVotesBar taskId={task.id} />
          </section>
        </div>
      </div>
    </div>
  );
}
