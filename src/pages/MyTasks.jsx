// src/pages/MyTasks.jsx
import { useEffect, useMemo, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const STATUS_COLUMNS = ["pending", "in-progress", "completed"];

function statusLabel(status) {
  if (status === "pending") return "Pending";
  if (status === "in-progress") return "In Progress";
  if (status === "completed") return "Completed";
  return status;
}

export default function MyTasks() {
  const api = useApi();
  const { auth } = useAuth();
  const user = auth.user;
  const role = user?.role;

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
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);

  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

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

  const loadAttachmentsForTask = async (taskId) => {
    setLoadingAttachments(true);
    setAttachments([]);
    try {
      const res = await api.get(`/tasks/${taskId}/attachments`);
      setAttachments(res.data || []);
    } catch (err) {
      console.error("Failed to load attachments:", err);
      toast.error("Failed to load attachments");
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleCardClick = (task) => {
    setSelectedTaskDetails(task);
    loadAttachmentsForTask(task.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-xs text-slate-500">{subtitle}</p>
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
                      onClick={() => handleCardClick(t)}
                      className={
                        "border border-slate-200 rounded-lg px-2 py-2 bg-white text-xs " +
                        (canDrag
                          ? "cursor-grab active:cursor-grabbing"
                          : "cursor-pointer")
                      }
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
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Task details panel */}
      {selectedTaskDetails && (
        <section className="bg-white rounded-xl shadow p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="text-sm font-semibold">
                Task Details: {selectedTaskDetails.task}
              </h2>
              <p className="text-[11px] text-slate-500">
                Status: {statusLabel(selectedTaskDetails.status)} • Project:{" "}
                {selectedTaskDetails.project_name}
                {selectedTaskDetails.due_date &&
                  ` • Due: ${new Date(
                    selectedTaskDetails.due_date
                  ).toLocaleDateString()}`}
              </p>
            </div>
            <button
              className="text-[11px] text-slate-500 underline"
              onClick={() => {
                setSelectedTaskDetails(null);
                setAttachments([]);
              }}
            >
              Close
            </button>
          </div>

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

          <div className="mt-3">
            <h3 className="text-xs font-semibold mb-1">Attachments</h3>
            {loadingAttachments ? (
              <p className="text-[11px] text-slate-400">
                Loading attachments...
              </p>
            ) : attachments.length === 0 ? (
              <p className="text-[11px] text-slate-400">No attachments.</p>
            ) : (
              <ul className="text-[11px] text-slate-600 list-disc ml-4">
                {attachments.map((att) => (
                  <li key={att.id}>{att.original_name}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
