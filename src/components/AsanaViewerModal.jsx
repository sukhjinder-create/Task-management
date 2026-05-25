import { useEffect, useState } from "react";
import { useApi } from "../api";

export default function AsanaViewerModal({ open, onClose }) {
  const api = useApi();

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [migrating, setMigrating] = useState(false);
  const [migrationDone, setMigrationDone] = useState(false);

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
      .then(res => setTasks(res.data.data || []));
  }, [selectedProject]);

  async function migrateProject() {
  if (!selectedProject) return;

  try {
    setMigrating(true);
    setMigrationDone(false);

    await api.post(
      `/integrations/asana/projects/${selectedProject}/migrate`
    );

    setMigrationDone(true);

    alert("✅ Project imported successfully!");

  } catch (err) {
    console.error(err);
    alert("Migration failed");
  } finally {
    setMigrating(false);
  }
}

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex">

      {/* LEFT — PROJECTS */}
      <div className="w-72 bg-[var(--surface)] border-r border-[color:var(--border)] overflow-y-auto">
        <div className="p-4 font-semibold text-[color:var(--text)]">Asana Projects</div>

        {projects.map(p => (
          <div
            key={p.gid}
            onClick={() => setSelectedProject(p.gid)}
            className={`px-4 py-2 cursor-pointer text-sm transition-colors ${
              selectedProject === p.gid
                ? "text-[color:var(--primary)] bg-[var(--surface-soft)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:bg-[var(--surface-soft)]"
            }`}
          >
            {p.name}
          </div>
        ))}
      </div>

      {/* CENTER — TASKS */}
      <div className="flex-1 bg-[#0a0a0b] overflow-y-auto">
        <div className="p-4 flex justify-between items-center border-b border-[color:var(--border)]">

  <h2 className="font-semibold text-[color:var(--text)]">
    Tasks ({tasks.length})
  </h2>

  <div className="text-xs text-[color:var(--text-muted)]">
  Selected: {selectedProject || "NONE"}
</div>

  <div className="flex gap-3 items-center">

    {selectedProject && (
      <button
        onClick={migrateProject}
        disabled={migrating}
        className="bg-[color:var(--primary)] text-[color:var(--primary-contrast)] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[color:var(--primary-hover)] transition-colors disabled:opacity-50"
      >
        {migrating
          ? "Importing..."
          : migrationDone
          ? "Imported ✓"
          : "Import"}
      </button>
    )}

    <button onClick={onClose} className="text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors">✕</button>

  </div>
</div>

        <div className="space-y-2 p-4">
          {tasks.map(t => (
            <div
              key={t.gid}
              className="border border-[color:var(--border)] rounded-lg p-3 text-sm"
            >
              <div className="font-medium text-[color:var(--text)]">{t.name}</div>
              <div className="text-xs text-[color:var(--text-muted)]">
                {t.completed ? "✅ Completed" : "⏳ Active"}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
