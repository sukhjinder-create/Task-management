// src/pages/MyTasks.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import CommentsSection from "../components/CommentsSection.jsx";

const STATUS_COLUMNS = ["pending", "in-progress", "completed"];

function statusLabel(status) {
  if (status === "pending") return "Pending";
  if (status === "in-progress") return "In Progress";
  if (status === "completed") return "Completed";
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

export default function MyTasks() {
  const api = useApi();
  const { auth } = useAuth();
  const user = auth.user;
  const role = user?.role;
  const location = useLocation();

  // Admin, manager, user → all can drag
  const canDrag =
    role === "admin" || role === "manager" || role === "user";

  const title = role === "user" ? "My Tasks" : "Tasks";
  const subtitle =
    role === "user"
      ? "You only see tasks assigned to you. Drag cards between columns to update status."
      : "You can see tasks across your visible projects. Drag cards between columns to update status.";

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragTaskId, setDragTaskId] = useState(null);

  // Modal state
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const canAdminEdit = role === "admin" || role === "manager";

  const [initialTaskOpened, setInitialTaskOpened] = useState(false);

  // Load tasks for projects visible to this role (backend handles visibility)
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const projectsRes = await api.get("/projects");
        const projects = projectsRes.data || [];
        const allTasks = [];

        for (const p of projects) {
          try {
            const res = await api.get(`/tasks/${p.id}`);
            const projectTasks = (res.data || []).map((t) => ({
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

  const grouped = useMemo(() => {
    const result = {
      pending: [],
      "in-progress": [],
      completed: [],
    };
    for (const t of tasks) {
      if (!result[t.status]) result[t.status] = [];
      result[t.status].push(t);
    }
    return result;
  }, [tasks]);

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
        prev.map((t) =>
          t.id === task.id ? { ...t, status: newStatus } : t
        )
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
      status: task.status || "pending",
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

  // ===== Admin edit handlers (in modal) =====
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
        status: editTask.status,
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

  // ===== Copy deep link for this task =====
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

  // ===== Deep-link: auto-open when ?task=<id> is present (for /my-tasks) =====
  useEffect(() => {
    if (initialTaskOpened) return;
    if (!tasks || tasks.length === 0) return;

    const params = new URLSearchParams(location.search);
    const taskId = params.get("task");
    if (!taskId) return;

    const found = tasks.find((t) => t.id === taskId);
    if (!found) {
      setInitialTaskOpened(true);
      return;
    }

    handleCardClick(found);
    setInitialTaskOpened(true);
  }, [tasks, location.search, initialTaskOpened]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-xs text-slate-500">{subtitle}</p>
          {tasks.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              Total: <b>{stats.total}</b> • Pending: {stats.pending} • In
              progress: {stats.inProgress} • Completed: {stats.completed} •{" "}
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
      </section>

      {/* Board */}
      <section className="bg-white rounded-xl shadow p-4">
        {loading ? (
          <div className="text-sm text-slate-500">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-sm text-slate-500">
            No tasks found for your projects.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {STATUS_COLUMNS.map((status) => (
              <div
                key={status}
                className="border border-slate-200 rounded-lg min-h-[200px] p-2 bg-slate-50"
                onDragOver={onDragOver}
                onDrop={() => onDrop(status)}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold">
                    {statusLabel(status)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {grouped[status]?.length || 0} tasks
                  </span>
                </div>

                <div className="space-y-2">
                  {grouped[status]?.map((t) => (
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
            ))}
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
                  {selectedTaskDetails.assigned_to && (
                    <p className="text-[11px] text-slate-500">
                      Assigned to: {selectedTaskDetails.assigned_to}
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
                  <h3 className="text-xs font-semibold mb-1">
                    Description
                  </h3>
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
                        value={editTask.status}
                        onChange={handleEditFieldChange}
                        className="w-full border rounded px-2 py-1"
                      >
                        <option value="pending">Pending</option>
                        <option value="in-progress">In progress</option>
                        <option value="completed">Completed</option>
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

              {/* Comments for this task */}
              <div className="mt-3 border-t pt-3">
                <h3 className="text-xs font-semibold mb-1">Comments</h3>
                <CommentsSection taskId={selectedTaskDetails.id} />
              </div>

              {/* Attachments panel */}
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
