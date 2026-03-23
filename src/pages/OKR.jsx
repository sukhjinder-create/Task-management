// src/pages/OKR.jsx
// OKR / Goals — Objectives and Key Results
import { useState, useEffect } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  Target, Plus, ChevronDown, ChevronRight, Pencil,
  Trash2, TrendingUp, AlertCircle, CheckCircle, Clock,
} from "lucide-react";

const STATUS_COLOR = {
  on_track:  { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500" },
  at_risk:   { bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500" },
  off_track: { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500" },
  done:      { bg: "bg-indigo-100", text: "text-indigo-700", dot: "bg-indigo-500" },
};

const PERIODS = ["Q1 2026","Q2 2026","Q3 2026","Q4 2026","2026","2027"];

export default function OKR() {
  const api = useApi();
  const { auth } = useAuth();
  const [objectives, setObjectives] = useState([]);
  const [period, setPeriod] = useState("Q2 2026");
  const [showNewObj, setShowNewObj] = useState(false);
  const [objForm, setObjForm] = useState({ title: "", description: "", time_period: "Q2 2026" });
  const [expanded, setExpanded] = useState({});
  const [editingKR, setEditingKR] = useState(null);  // { objectiveId, form }

  const load = () => {
    api.get(`/okr/objectives?timePeriod=${encodeURIComponent(period)}`).then(r => setObjectives(r.data || [])).catch(() => {});
  };

  useEffect(() => { load(); }, [period]);

  const createObjective = async () => {
    if (!objForm.title) return toast.error("Title required");
    try {
      await api.post("/okr/objectives", { ...objForm, time_period: period });
      setShowNewObj(false);
      setObjForm({ title: "", description: "", time_period: period });
      load();
      toast.success("Objective created");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  const deleteObjective = async (id) => {
    if (!confirm("Delete this objective and all its key results?")) return;
    await api.delete(`/okr/objectives/${id}`).catch(() => {});
    load();
  };

  const addKR = async (objectiveId, form) => {
    try {
      await api.post(`/okr/objectives/${objectiveId}/key-results`, form);
      setEditingKR(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  const updateKR = async (id, patch) => {
    await api.put(`/okr/key-results/${id}`, patch).catch(() => {});
    load();
  };

  const deleteKR = async (id) => {
    await api.delete(`/okr/key-results/${id}`).catch(() => {});
    load();
  };

  const overallProgress = objectives.length > 0
    ? Math.round(objectives.reduce((s, o) => s + (o.progress || 0), 0) / objectives.length)
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold theme-text flex items-center gap-2">
            <Target className="w-6 h-6 text-indigo-500" /> Goals & OKRs
          </h1>
          <p className="theme-text-muted text-sm mt-1">Track objectives and key results across your team</p>
        </div>

        <div className="flex gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text">
            {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={() => setShowNewObj(true)} className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Add Objective
          </button>
        </div>
      </div>

      {/* Overall progress */}
      {objectives.length > 0 && (
        <div className="theme-surface-card rounded-xl p-5 border theme-border mb-6 flex items-center gap-6">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="3"
                strokeDasharray={`${overallProgress} ${100 - overallProgress}`}
                strokeDashoffset="0" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-indigo-600">{overallProgress}%</div>
          </div>
          <div>
            <p className="font-semibold theme-text">Overall Progress — {period}</p>
            <p className="text-sm theme-text-muted">{objectives.length} objective{objectives.length !== 1 ? "s" : ""} · {objectives.filter(o => o.status === "done").length} completed</p>
          </div>
        </div>
      )}

      {/* New objective form */}
      {showNewObj && (
        <div className="theme-surface-card rounded-xl p-5 border theme-border mb-4 space-y-3">
          <h3 className="font-medium theme-text">New Objective</h3>
          <input value={objForm.title} onChange={e => setObjForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Objective title…" className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
          <textarea value={objForm.description} onChange={e => setObjForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)" rows={2} className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
          <div className="flex gap-2">
            <button onClick={createObjective} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Create</button>
            <button onClick={() => setShowNewObj(false)} className="px-4 py-2 border theme-border rounded-lg text-sm theme-text">Cancel</button>
          </div>
        </div>
      )}

      {/* Objectives */}
      <div className="space-y-4">
        {objectives.map(obj => (
          <ObjectiveCard
            key={obj.id} obj={obj}
            expanded={expanded[obj.id]}
            onToggle={() => setExpanded(e => ({ ...e, [obj.id]: !e[obj.id] }))}
            onDelete={() => deleteObjective(obj.id)}
            onUpdateKR={updateKR}
            onDeleteKR={deleteKR}
            onAddKR={form => addKR(obj.id, form)}
          />
        ))}
        {objectives.length === 0 && (
          <div className="text-center py-16">
            <Target className="w-14 h-14 mx-auto mb-4 text-indigo-200" />
            <h3 className="font-medium theme-text mb-1">No objectives for {period}</h3>
            <p className="theme-text-muted text-sm">Set your team's objectives to track progress toward key goals.</p>
            <button onClick={() => setShowNewObj(true)} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Add First Objective</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ObjectiveCard({ obj, expanded, onToggle, onDelete, onUpdateKR, onDeleteKR, onAddKR }) {
  const [showKRForm, setShowKRForm] = useState(false);
  const [krForm, setKRForm] = useState({ title: "", type: "percentage", start_value: 0, target_value: 100, current_value: 0, unit: "" });
  const sc = STATUS_COLOR[obj.status] || STATUS_COLOR.on_track;

  return (
    <div className="theme-surface-card rounded-xl border theme-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={onToggle}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2.5 h-2.5 rounded-full ${sc.dot}`} />
            <h3 className="font-semibold theme-text">{obj.title}</h3>
          </div>
          {obj.description && <p className="text-sm theme-text-muted">{obj.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg} ${sc.text}`}>{obj.status.replace("_", " ")}</span>
          {/* Mini progress bar */}
          <div className="w-24 hidden sm:flex items-center gap-2">
            <div className="flex-1 h-2 bg-[var(--border)] rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${obj.progress || 0}%` }} />
            </div>
            <span className="text-xs theme-text-muted w-8">{Math.round(obj.progress || 0)}%</span>
          </div>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
            <Trash2 className="w-4 h-4" />
          </button>
          {expanded ? <ChevronDown className="w-4 h-4 theme-text-muted" /> : <ChevronRight className="w-4 h-4 theme-text-muted" />}
        </div>
      </div>

      {/* Key Results */}
      {expanded && (
        <div className="border-t theme-border px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold theme-text-muted uppercase tracking-wider">Key Results</h4>
            <button onClick={() => setShowKRForm(s => !s)} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add KR
            </button>
          </div>

          {(obj.key_results || []).map(kr => (
            <KeyResultRow key={kr.id} kr={kr} onUpdate={patch => onUpdateKR(kr.id, patch)} onDelete={() => onDeleteKR(kr.id)} />
          ))}

          {(!obj.key_results || obj.key_results.length === 0) && !showKRForm && (
            <p className="text-sm theme-text-muted">No key results yet. Add one to measure progress.</p>
          )}

          {showKRForm && (
            <div className="bg-[var(--surface-soft)] rounded-xl p-4 space-y-3">
              <input value={krForm.title} onChange={e => setKRForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Key result title…" className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <select value={krForm.type} onChange={e => setKRForm(f => ({ ...f, type: e.target.value }))}
                  className="px-2 py-1.5 rounded-lg border theme-border theme-surface text-sm theme-text">
                  {["number","percentage","currency","boolean"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="number" value={krForm.start_value} onChange={e => setKRForm(f => ({ ...f, start_value: e.target.value }))}
                  placeholder="Start" className="px-2 py-1.5 rounded-lg border theme-border theme-surface text-sm theme-text" />
                <input type="number" value={krForm.target_value} onChange={e => setKRForm(f => ({ ...f, target_value: e.target.value }))}
                  placeholder="Target *" className="px-2 py-1.5 rounded-lg border theme-border theme-surface text-sm theme-text" />
                <input value={krForm.unit} onChange={e => setKRForm(f => ({ ...f, unit: e.target.value }))}
                  placeholder="Unit (€, users…)" className="px-2 py-1.5 rounded-lg border theme-border theme-surface text-sm theme-text" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { onAddKR(krForm); setShowKRForm(false); }} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs">Add KR</button>
                <button onClick={() => setShowKRForm(false)} className="px-3 py-1.5 border theme-border rounded-lg text-xs theme-text">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KeyResultRow({ kr, onUpdate, onDelete }) {
  const range = Number(kr.target_value) - Number(kr.start_value);
  const pct = range > 0
    ? Math.min(100, ((Number(kr.current_value) - Number(kr.start_value)) / range) * 100)
    : (Number(kr.current_value) > 0 ? 100 : 0);
  const sc = STATUS_COLOR[kr.status] || STATUS_COLOR.on_track;

  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(kr.current_value);

  const save = () => {
    onUpdate({ current_value: val });
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 bg-[var(--surface-soft)] rounded-xl px-4 py-3">
      <div className="flex-1">
        <p className="text-sm font-medium theme-text mb-1">{kr.title}</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs theme-text-muted whitespace-nowrap">
            {editing ? (
              <input type="number" value={val} onChange={e => setVal(e.target.value)} onBlur={save} onKeyDown={e => e.key === "Enter" && save()}
                className="w-20 px-1 py-0.5 rounded border theme-border text-xs theme-text" autoFocus />
            ) : (
              <button onClick={() => setEditing(true)} className="hover:underline">
                {kr.current_value}{kr.unit ? ` ${kr.unit}` : ""} / {kr.target_value}{kr.unit ? ` ${kr.unit}` : ""}
              </button>
            )}
          </span>
        </div>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{kr.status.replace("_"," ")}</span>
      <button onClick={onDelete} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}
