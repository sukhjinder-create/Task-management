// src/components/BurndownModal.jsx
import { useEffect, useState } from "react";
import { X, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { useApi } from "../api";

export default function BurndownModal({ sprintId, sprintName, onClose }) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("points"); // "points" | "tasks"

  useEffect(() => {
    api.get(`/sprints/${sprintId}/burndown`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sprintId]);

  const chartData = data
    ? data.days.map((d, i) => ({
        date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        Remaining: mode === "points" ? d.remaining_points : d.remaining_tasks,
        Ideal: mode === "points" ? (data.ideal[i]?.ideal_points ?? 0) : (data.ideal[i]?.ideal_tasks ?? 0),
        Completed: mode === "points" ? d.completed_points : d.completed_tasks,
      }))
    : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[var(--surface)] border border-[color:var(--border)] rounded-xl p-6 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[color:var(--primary)]" />
            <h2 className="text-sm font-semibold text-[color:var(--text)]">Burndown Chart — {sprintName}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-[color:var(--border)] overflow-hidden text-[11px]">
              <button
                className={`px-2 py-1 transition-colors ${mode === "points" ? "bg-[color:var(--primary)] text-[color:var(--primary-contrast)]" : "text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)]"}`}
                onClick={() => setMode("points")}
              >
                Story Points
              </button>
              <button
                className={`px-2 py-1 transition-colors ${mode === "tasks" ? "bg-[color:var(--primary)] text-[color:var(--primary-contrast)]" : "text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)]"}`}
                onClick={() => setMode("tasks")}
              >
                Tasks
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[var(--surface-soft)] text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[color:var(--text-muted)] text-center py-12">Loading burndown…</p>
        ) : !data || data.days.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)] text-center py-12">No data yet. Start the sprint with tasks to see the burndown.</p>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Total Points", value: data.totalPoints },
                { label: "Total Tasks", value: data.totalTasks },
                { label: "Days Remaining", value: Math.max(0, data.days.length > 0 ? Math.ceil((new Date(data.sprint.end_date) - new Date()) / 86400000) : 0) },
              ].map(s => (
                <div key={s.label} className="text-center border border-[color:var(--border)] rounded-lg p-2">
                  <p className="text-lg font-bold text-[color:var(--text)]">{s.value}</p>
                  <p className="text-[10px] text-[color:var(--text-muted)]">{s.label}</p>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 8,
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                  labelStyle={{ fontWeight: 600, color: "var(--text)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />
                <Line type="monotone" dataKey="Remaining" stroke="var(--primary)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Ideal" stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="Completed" stroke="var(--text-muted)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>

            <p className="text-[10px] text-[color:var(--text-muted)] text-center mt-2">
              Solid orange = actual remaining · Dashed = ideal burndown · Muted = completed
            </p>
          </>
        )}
      </div>
    </div>
  );
}
