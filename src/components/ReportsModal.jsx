// src/reports/ReportsModal.jsx
import { useEffect, useState } from "react";
import { useApi } from "../api";
import toast from "react-hot-toast";

export default function ReportsModal({ open, onClose, context }) {
  const api = useApi();

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  useEffect(() => {
    if (!open || !context) return;

    const { workspaceId, projectName, fromDate, toDate } = context;

    if (!workspaceId || !projectName || !fromDate || !toDate) {
      toast.error("Invalid report context");
      return;
    }

    async function loadReport() {
      try {
        setLoading(true);

        const res = await api.get("/internal/reports/project", {
          params: {
            workspaceId,
            projectName,
            fromDate,
            toDate,
          },
        });

        setReport(res.data);
      } catch (err) {
        console.error("❌ Failed to load report", err);
        toast.error("Failed to load reports");
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [open, context, api]);

  if (!open) return null;

  const { projectName, fromDate, toDate } = context || {};
  const tasks = report?.tasks || [];
  const summary = report?.summary;
const empty = report?.empty;
const reason = report?.reason;

  function downloadCSV() {
    if (!tasks.length) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Task", "Status", "Assignee", "Created At"];
    const rows = tasks.map(t => [
      t.task,
      t.status,
      t.assignee || "Unassigned",
      new Date(t.created_at).toLocaleDateString(),
    ]);

    const csv =
      [headers, ...rows].map(r => r.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}-report.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999]">
      <div className="bg-white rounded-lg shadow-xl w-[800px] p-5 text-sm">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-semibold">
            Reports — {projectName}
          </h2>

          <button
            onClick={onClose}
            className="text-xs px-2 py-1 border rounded hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        {/* Meta */}
        <div className="text-xs text-slate-500 mb-4">
          Date range: <strong>{fromDate}</strong> →{" "}
          <strong>{toDate}</strong>
        </div>

        {/* Summary */}
        {summary && (
          <div className="flex gap-6 mb-4 text-xs">
            <div>Total: <strong>{summary.totalTasks}</strong></div>
            <div>Completed: <strong>{summary.completed}</strong></div>
            <div>Pending: <strong>{summary.pending}</strong></div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-xs text-slate-500">Loading reports…</div>
        ) : empty ? (
  <div className="text-xs text-slate-500">
    {reason === "project_not_found" && (
      <>Project <strong>{projectName}</strong> was not found.</>
    )}

    {reason === "no_tasks_in_range" && (
      <>No tasks found for this date range.</>
    )}
  </div>
) : tasks.length === 0 ? (
  <div className="text-xs text-slate-500">
    No tasks found.
  </div>
) : (
          <div className="max-h-[400px] overflow-auto border rounded">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="border px-2 py-1 text-left">Task</th>
                  <th className="border px-2 py-1 text-left">Status</th>
                  <th className="border px-2 py-1 text-left">Assignee</th>
                  <th className="border px-2 py-1 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, idx) => (
                  <tr key={idx}>
                    <td className="border px-2 py-1">{t.task}</td>
                    <td className="border px-2 py-1">{t.status}</td>
                    <td className="border px-2 py-1">
                      {t.assignee || "Unassigned"}
                    </td>
                    <td className="border px-2 py-1">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={downloadCSV}
            className="px-3 py-1 text-xs bg-slate-100 rounded border hover:bg-slate-200"
          >
            Download CSV
          </button>

          <div className="text-xs text-slate-400">
            Powered by AI reports
          </div>
        </div>
      </div>
    </div>
  );
}
