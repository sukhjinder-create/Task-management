import { useEffect, useMemo, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

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

export default function Dashboard() {
  const api = useApi();
  const { auth } = useAuth();
  const role = auth.user.role;

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isUser = role === "user";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]); // [{ project, tasks }]

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const projectsRes = await api.get("/projects");
        const proj = projectsRes.data || [];
        setProjects(proj);

        const allProjectTasks = [];

        for (const p of proj) {
          try {
            const tasksRes = await api.get(`/tasks/${p.id}`);
            const tasks = tasksRes.data || [];
            allProjectTasks.push({ project: p, tasks });
          } catch (err) {
            console.error("Failed to load tasks for project", p.id, err);
          }
        }

        setProjectTasks(allProjectTasks);
      } catch (err) {
        console.error(err);
        const msg = err.response?.data?.error || "Failed to load dashboard data";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Flatten tasks with project reference
  const flatTasks = useMemo(() => {
    const list = [];
    projectTasks.forEach(({ project, tasks }) => {
      tasks.forEach((t) => {
        list.push({ ...t, _project: project });
      });
    });
    return list;
  }, [projectTasks]);

  // For admins/managers – global stats; for users – only their tasks
  const tasksForStats = useMemo(() => {
    if (isUser) {
      return flatTasks.filter((t) => t.assigned_to === auth.user.id);
    }
    return flatTasks;
  }, [flatTasks, isUser, auth.user.id]);

  const totalProjects = projects.length;
  const totalTasks = tasksForStats.length;
  const pendingCount = tasksForStats.filter((t) => t.status === "pending").length;
  const inProgressCount = tasksForStats.filter(
    (t) => t.status === "in-progress"
  ).length;
  const completedCount = tasksForStats.filter(
    (t) => t.status === "completed"
  ).length;
  const overdueCount = tasksForStats.filter((t) => isTaskOverdue(t)).length;

  // My tasks subset (for admin/manager too)
  const myTasks = useMemo(
    () => flatTasks.filter((t) => t.assigned_to === auth.user.id),
    [flatTasks, auth.user.id]
  );
  const myOverdueTasks = myTasks.filter((t) => isTaskOverdue(t));

  // Top overdue tasks list (limit 5)
  const topOverdue = useMemo(() => {
    const arr = tasksForStats.filter((t) => isTaskOverdue(t));
    // sort by due_date ascending
    arr.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    return arr.slice(0, 5);
  }, [tasksForStats]);

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-xs text-slate-500">
            Role: {role}. Showing an overview of projects and tasks you are allowed
            to access.
          </p>
        </div>
      </section>

      {/* High-level stats */}
      <section className="bg-white rounded-xl shadow p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <div>
          <div className="text-slate-500">Projects</div>
          <div className="text-lg font-semibold">{totalProjects}</div>
        </div>
        <div>
          <div className="text-slate-500">
            {isUser ? "My tasks" : "Total tasks"}
          </div>
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
          <div className="text-slate-500">Overdue</div>
          <div className="text-lg font-semibold text-red-600">
            {overdueCount}
          </div>
        </div>
      </section>

      {/* My tasks summary (for everyone) */}
      <section className="bg-white rounded-xl shadow p-4 grid md:grid-cols-3 gap-4 text-xs">
        <div>
          <h2 className="font-semibold mb-2">My tasks summary</h2>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Total assigned to me</span>
              <span className="font-semibold">{myTasks.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Overdue</span>
              <span className="font-semibold text-red-600">
                {myOverdueTasks.length}
              </span>
            </div>
          </div>
        </div>

        {/* For admin/manager, extra info */}
        {(isAdmin || isManager) && (
          <>
            <div>
              <h2 className="font-semibold mb-2">Role overview</h2>
              <p className="text-[11px] text-slate-600">
                As {role}, you can manage projects and tasks according to RBAC:
              </p>
              <ul className="mt-1 list-disc list-inside text-[11px] text-slate-600">
                <li>See all projects you&apos;re allowed to access</li>
                <li>Create & manage tasks in those projects</li>
                {isAdmin && <li>Manage users & project assignments</li>}
              </ul>
            </div>

            <div>
              <h2 className="font-semibold mb-2">Projects you own / access</h2>
              <p className="text-[11px] text-slate-600 mb-1">
                You have access to {projects.length} project
                {projects.length === 1 ? "" : "s"}.
              </p>
              <ul className="max-h-32 overflow-y-auto text-[11px] text-slate-700 space-y-1">
                {projects.map((p) => (
                  <li key={p.id}>
                    <span className="font-medium">{p.name}</span>{" "}
                    <span className="text-slate-400">
                      (added by {p.added_by})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* For plain user, explain limitations */}
        {isUser && (
          <div>
            <h2 className="font-semibold mb-2">Access rules</h2>
            <p className="text-[11px] text-slate-600">
              You can:
            </p>
            <ul className="mt-1 list-disc list-inside text-[11px] text-slate-600">
              <li>See only projects assigned to you</li>
              <li>See only tasks within those projects</li>
              <li>Change status of tasks assigned to you</li>
              <li>Add comments to tasks</li>
            </ul>
          </div>
        )}
      </section>

      {/* Top overdue tasks */}
      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-sm font-semibold mb-3">Top overdue tasks</h2>

        {loading && (
          <div className="text-sm text-slate-500">Loading overdue tasks...</div>
        )}

        {!loading && topOverdue.length === 0 && (
          <div className="text-sm text-slate-500">
            No overdue tasks in your scope. 🎉
          </div>
        )}

        <div className="space-y-2">
          {topOverdue.map((t) => (
            <div
              key={t.id}
              className="border border-red-200 bg-red-50 rounded-lg px-3 py-2 text-xs"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-[11px]">
                    {t.task}
                  </div>
                  <div className="text-[10px] text-slate-600">
                    Project:{" "}
                    <span className="font-semibold">
                      {t._project?.name || "Unknown"}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Due:{" "}
                    {t.due_date
                      ? new Date(t.due_date).toLocaleDateString()
                      : "N/A"}
                  </div>
                </div>
                {t.assigned_to && (
                  <div className="text-[10px] text-slate-500">
                    Assigned: {t.assigned_to}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
