// src/components/TimeTrackingPanel.jsx
import { useEffect, useState } from "react";
import { Clock, Plus, Trash2, BarChart2 } from "lucide-react";
import { useApi } from "../api";
import toast from "react-hot-toast";

export default function TimeTrackingPanel({ taskId, canEdit }) {
  const api = useApi();
  const [data, setData] = useState({ logs: [], summary: { total_logged: 0, entry_count: 0, estimation_hours: null } });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ hours: "", log_date: new Date().toISOString().slice(0, 10), description: "" });
  const [saving, setSaving] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState(false);
  const [estimateVal, setEstimateVal] = useState("");

  useEffect(() => { load(); }, [taskId]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/time-tracking/tasks/${taskId}`);
      setData(res.data);
      setEstimateVal(res.data.summary.estimation_hours ?? "");
    } catch { /* ignore */ }
    setLoading(false);
  }

  const handleLog = async (e) => {
    e.preventDefault();
    if (!form.hours || parseFloat(form.hours) <= 0) { toast.error("Enter valid hours"); return; }
    setSaving(true);
    try {
      await api.post(`/time-tracking/tasks/${taskId}`, { hours: parseFloat(form.hours), log_date: form.log_date, description: form.description });
      await load();
      setForm({ hours: "", log_date: new Date().toISOString().slice(0, 10), description: "" });
      setShowForm(false);
      toast.success("Time logged");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to log time");
    }
    setSaving(false);
  };

  const handleDelete = async (logId) => {
    try {
      await api.delete(`/time-tracking/${logId}`);
      await load();
      toast.success("Log removed");
    } catch {
      toast.error("Failed to remove log");
    }
  };

  const handleSaveEstimate = async () => {
    try {
      await api.patch(`/time-tracking/tasks/${taskId}/estimation`, { estimation_hours: estimateVal ? parseFloat(estimateVal) : null });
      await load();
      setEditingEstimate(false);
      toast.success("Estimate updated");
    } catch {
      toast.error("Failed to update estimate");
    }
  };

  const { summary, logs } = data;
  const pct = summary.estimation_hours && summary.total_logged
    ? Math.min(100, Math.round((summary.total_logged / summary.estimation_hours) * 100))
    : null;

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          Time Tracking
        </h3>
        {canEdit && (
          <button
            className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5"
            onClick={() => setShowForm(v => !v)}
          >
            <Plus className="w-3 h-3" /> Log time
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-0.5 text-[11px]">
            <span className="text-slate-500">Logged: <strong>{summary.total_logged}h</strong></span>
            <div className="flex items-center gap-1">
              {editingEstimate ? (
                <>
                  <input
                    type="number"
                    className="border rounded px-1 py-0.5 w-14 text-[11px]"
                    value={estimateVal}
                    min="0"
                    step="0.5"
                    onChange={e => setEstimateVal(e.target.value)}
                    placeholder="Est."
                  />
                  <button className="text-[10px] text-green-600 hover:underline" onClick={handleSaveEstimate}>Save</button>
                  <button className="text-[10px] text-slate-400 hover:underline" onClick={() => setEditingEstimate(false)}>Cancel</button>
                </>
              ) : (
                <span
                  className={`text-slate-500 ${canEdit ? "cursor-pointer hover:text-indigo-600" : ""}`}
                  onClick={() => canEdit && setEditingEstimate(true)}
                  title={canEdit ? "Click to set estimate" : ""}
                >
                  Est: <strong>{summary.estimation_hours != null ? `${summary.estimation_hours}h` : "—"}</strong>
                </span>
              )}
            </div>
          </div>
          {pct !== null && (
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${pct > 100 ? "bg-red-500" : pct > 75 ? "bg-orange-400" : "bg-indigo-500"}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          )}
          {pct !== null && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              {pct}% of estimate {pct > 100 && <span className="text-red-500 font-semibold">over budget!</span>}
            </p>
          )}
        </div>
      </div>

      {/* Log form */}
      {showForm && canEdit && (
        <form onSubmit={handleLog} className="bg-slate-50 rounded-lg p-2 border border-slate-200 space-y-1.5 mb-2">
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Hours *</label>
              <input
                type="number"
                min="0.25" step="0.25"
                className="w-full border rounded px-2 py-1 text-[11px]"
                value={form.hours}
                onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                placeholder="0.5"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Date</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1 text-[11px]"
                value={form.log_date}
                onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))}
              />
            </div>
          </div>
          <input
            className="w-full border rounded px-2 py-1 text-[11px]"
            placeholder="What did you work on? (optional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" className="text-[11px] text-slate-500 px-2 py-1 border rounded" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" disabled={saving} className="text-[11px] bg-indigo-600 text-white px-3 py-1 rounded disabled:opacity-50">
              {saving ? "Saving…" : "Log"}
            </button>
          </div>
        </form>
      )}

      {/* Log list */}
      {loading ? (
        <p className="text-[11px] text-slate-400">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-[11px] text-slate-400">No time logged yet.</p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-2 text-[11px] p-1.5 rounded hover:bg-slate-50 group">
              <Clock className="w-3 h-3 text-slate-300 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <strong className="text-indigo-600">{log.hours}h</strong>
                  <span className="text-slate-400">{log.user_name}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">{new Date(log.log_date).toLocaleDateString()}</span>
                </div>
                {log.description && <p className="text-slate-500 truncate">{log.description}</p>}
              </div>
              {canEdit && (
                <button
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"
                  onClick={() => handleDelete(log.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
