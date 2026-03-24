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
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
      <div className="theme-dialog-panel w-full max-w-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold">Burndown Chart — {sprintName}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px]">
              <button
                className={`px-2 py-1 ${mode === "points" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setMode("points")}
              >
                Story Points
              </button>
              <button
                className={`px-2 py-1 ${mode === "tasks" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setMode("tasks")}
              >
                Tasks
              </button>
            </div>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-12">Loading burndown…</p>
        ) : !data || data.days.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">No data yet. Start the sprint with tasks to see the burndown.</p>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Total Points", value: data.totalPoints },
                { label: "Total Tasks", value: data.totalTasks },
                { label: "Days Remaining", value: Math.max(0, data.days.length > 0 ? Math.ceil((new Date(data.sprint.end_date) - new Date()) / 86400000) : 0) },
              ].map(s => (
                <div key={s.label} className="text-center bg-slate-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-slate-800">{s.value}</p>
                  <p className="text-[10px] text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Remaining" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Ideal" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="Completed" stroke="#22c55e" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>

            <p className="text-[10px] text-slate-400 text-center mt-2">
              Solid indigo = actual remaining · Dashed = ideal burndown · Green = completed
            </p>
          </>
        )}
      </div>
    </div>
  );
}
