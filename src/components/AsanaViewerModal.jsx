import { useEffect, useState } from "react";
import { useApi } from "../api";

export default function AsanaViewerModal({ open, onClose }) {
  const api = useApi();

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [tasks, setTasks] = useState([]);

  // load projects
  useEffect(() => {
    if (!open) return;

    api.get("/integrations/asana/projects")
      .then(res => setProjects(res.data))
      .catch(() => {});
  }, [open]);

  // load tasks
  useEffect(() => {
    if (!selectedProject) return;

    api.get(`/integrations/asana/projects/${selectedProject}/tasks`)
      .then(res => setTasks(res.data));
  }, [selectedProject]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex">

      {/* LEFT — PROJECTS */}
      <div className="w-72 bg-white border-r overflow-y-auto">
        <div className="p-4 font-semibold">Asana Projects</div>

        {projects.map(p => (
          <div
            key={p.gid}
            onClick={() => setSelectedProject(p.gid)}
            className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm"
          >
            {p.name}
          </div>
        ))}
      </div>

      {/* CENTER — TASKS */}
      <div className="flex-1 bg-slate-50 overflow-y-auto">
        <div className="p-4 flex justify-between">
          <h2 className="font-semibold">
            Tasks ({tasks.length})
          </h2>

          <button onClick={onClose}>✕</button>
        </div>

        <div className="space-y-2 p-4">
          {tasks.map(t => (
            <div
              key={t.gid}
              className="bg-white border rounded p-3 text-sm"
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-slate-500">
                {t.completed ? "✅ Completed" : "⏳ Active"}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
