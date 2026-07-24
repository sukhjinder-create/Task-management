// src/reports/ReportsModal.jsx
import { useEffect, useState } from "react";
import { useApi } from "../api";
import toast from "react-hot-toast";
import ShareToChat from "./ShareToChat";

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
        console.error("Failed to load report", err);
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999] p-4">
      <div className="bg-[var(--surface)] border border-[color:var(--border)] rounded-xl p-6 w-full max-w-[800px] text-sm">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-semibold text-[color:var(--text)]">
            Reports — {projectName}
          </h2>

          <button
            onClick={onClose}
            className="text-xs px-2 py-1 border border-[color:var(--border)] rounded text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:border-[color:var(--text-muted)]"
          >
            Close
          </button>
        </div>

        {/* Meta */}
        <div className="text-xs text-[color:var(--text-muted)] mb-4">
          Date range: <strong className="text-[color:var(--text)]">{fromDate}</strong>{" "}
          →{" "}
          <strong className="text-[color:var(--text)]">{toDate}</strong>
        </div>

        {/* Summary */}
        {summary && (
          <div className="flex gap-6 mb-4 text-xs text-[color:var(--text-muted)]">
            <div>Total: <strong className="text-[color:var(--text)]">{summary.totalTasks}</strong></div>
            <div>Completed: <strong className="text-[color:var(--text)]">{summary.completed}</strong></div>
            <div>Pending: <strong className="text-[color:var(--text)]">{summary.pending}</strong></div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-xs text-[color:var(--text-muted)]">Loading reports…</div>
        ) : empty ? (
          <div className="text-xs text-[color:var(--text-muted)]">
            {reason === "project_not_found" && (
              <>Project <strong className="text-[color:var(--text)]">{projectName}</strong> was not found.</>
            )}

            {reason === "no_tasks_in_range" && (
              <>No tasks found for this date range.</>
            )}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-xs text-[color:var(--text-muted)]">
            No tasks found.
          </div>
        ) : (
          <div className="max-h-[400px] overflow-auto border border-[color:var(--border)] rounded-lg">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-[var(--surface-soft)] sticky top-0">
                <tr>
                  <th className="border-b border-[color:var(--border)] px-3 py-2 text-left text-[color:var(--text-muted)] font-semibold">Task</th>
                  <th className="border-b border-[color:var(--border)] px-3 py-2 text-left text-[color:var(--text-muted)] font-semibold">Status</th>
                  <th className="border-b border-[color:var(--border)] px-3 py-2 text-left text-[color:var(--text-muted)] font-semibold">Assignee</th>
                  <th className="border-b border-[color:var(--border)] px-3 py-2 text-left text-[color:var(--text-muted)] font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, idx) => (
                  <tr key={idx} className="border-b border-[color:var(--border)] last:border-0 hover:bg-[var(--surface-soft)] transition-colors">
                    <td className="px-3 py-2 text-[color:var(--text)]">{t.task}</td>
                    <td className="px-3 py-2 text-[color:var(--text-soft)]">{t.status}</td>
                    <td className="px-3 py-2 text-[color:var(--text-soft)]">
                      {t.assignee || "Unassigned"}
                    </td>
                    <td className="px-3 py-2 text-[color:var(--text-muted)]">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCSV}
              className="px-3 py-1 text-xs border border-[color:var(--border)] rounded text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:border-[color:var(--text-muted)] transition-colors"
            >
              Download CSV
            </button>

            {!loading && report && !empty && (
              <ShareToChat
                size="sm"
                variant="secondary"
                item={{
                  kind: "report",
                  title: `Report — ${projectName}`,
                  subtitle: summary
                    ? `${fromDate} → ${toDate} · ${summary.completed}/${summary.totalTasks} completed`
                    : `${fromDate} → ${toDate}`,
                }}
              />
            )}
          </div>

          <div className="text-xs text-[color:var(--text-muted)]">
            Powered by AI reports
          </div>
        </div>
      </div>
    </div>
  );
}
