// src/pages/AIFeatures.jsx
// Phase 3 AI Features: Meeting Notes→Tasks, Risk Heatmap, Digest, NL Reports, Smart Task Parse
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  Sparkles, FileText, AlertTriangle, Bell, BarChart2,
  Wand2, Plus, Check, ChevronDown, ChevronUp, RefreshCw,
  TrendingUp, AlertCircle, CheckCircle, Clock,
} from "lucide-react";

const TABS = [
  { id: "notes",  label: "Meeting → Tasks",  icon: FileText },
  { id: "risk",   label: "Risk Heatmap",     icon: AlertTriangle },
  { id: "digest", label: "Smart Digest",     icon: Bell },
  { id: "report", label: "AI Report",        icon: BarChart2 },
  { id: "parse",  label: "Smart Task Parse", icon: Wand2 },
];

export default function AIFeatures() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = TABS.some((item) => item.id === searchParams.get("tab")) ? searchParams.get("tab") : "notes";
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (!TABS.some((item) => item.id === tab)) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    }, { replace: true });
  }, [tab, setSearchParams]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[color:var(--text)] flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-[color:var(--primary)]" /> AI Features
        </h1>
        <p className="text-[color:var(--text-muted)] text-sm mt-1">AI-powered tools to supercharge your workflow</p>
      </div>

      <div className="flex gap-1 border-b border-[color:var(--border)] mb-6 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${tab === id ? "border-b-2 border-[color:var(--primary)] text-[color:var(--primary)] -mb-px" : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "notes"  && <MeetingNotesTab />}
      {tab === "risk"   && <RiskHeatmapTab />}
      {tab === "digest" && <DigestTab />}
      {tab === "report" && <ReportTab />}
      {tab === "parse"  && <SmartParseTab />}
    </div>
  );
}

// ─── Meeting Notes → Tasks ────────────────────────────────────────────────────
function MeetingNotesTab() {
  const api = useApi();
  const [notes, setNotes] = useState("");
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    api.get("/projects").then(r => {
      const list = r.data?.projects || r.data || [];
      setProjects(list);
      if (list.length > 0) setProjectId(list[0].id);
    }).catch(() => {});
  }, []);

  const extract = async () => {
    if (notes.trim().length < 20) return toast.error("Please enter meeting notes (at least 20 characters)");
    setLoading(true);
    setTasks([]);
    try {
      const r = await api.post("/ai-features/meeting-notes", { notes, projectId: projectId || null });
      setTasks(r.data.tasks || []);
      const sel = {};
      r.data.tasks.forEach((_, i) => { sel[i] = true; });
      setSelected(sel);
      if (r.data.tasks.length === 0) toast("No action items found in these notes", { icon: "🤔" });
    } catch (err) { toast.error(err.response?.data?.error || "Extraction failed"); }
    setLoading(false);
  };

  const createSelected = async () => {
    const toCreate = tasks.filter((_, i) => selected[i]);
    if (!toCreate.length) return toast.error("Select at least one task");
    if (!projectId) return toast.error("Please select a project first");
    setCreating(true);
    try {
      // Pass the already-extracted selected tasks directly — no re-extraction
      const r = await api.post("/ai-features/meeting-notes", {
        notes,
        projectId,
        autoCreate: true,
        tasks: toCreate,
      });
      toast.success(`Created ${r.data.created.length} task${r.data.created.length !== 1 ? "s" : ""}!`);
      setTasks([]);
      setNotes("");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setCreating(false);
  };

  const PRIORITY_COLOR = {
    high: "text-red-500 border border-red-500/40",
    medium: "text-amber-500 border border-amber-500/40",
    low: "text-[color:var(--primary)] border border-[color:var(--primary)]/40",
  };
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="border border-[color:var(--border)] rounded-lg p-4">
        <h2 className="font-semibold text-[color:var(--text)] mb-2">Paste Meeting Notes</h2>
        <p className="text-sm text-[color:var(--text-muted)] mb-3">AI will extract action items and create tasks automatically.</p>

        {/* Project selector */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-[color:var(--text-muted)] mb-1">Target Project *</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)}
            className="bg-[var(--surface)] border border-[color:var(--border)] text-[color:var(--text)] rounded-lg px-3 py-2 w-full focus:outline-none focus:border-[color:var(--primary)] transition-colors text-sm">
            <option value="">— select a project —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Paste your meeting notes, minutes, or transcript here…&#10;&#10;Example: John will set up the CI/CD pipeline by Friday. Sarah to review the design mockups by end of week."
          rows={8}
          className="bg-[var(--surface)] border border-[color:var(--border)] text-[color:var(--text)] rounded-lg px-3 py-2 w-full focus:outline-none focus:border-[color:var(--primary)] transition-colors text-sm"
        />
        <button onClick={extract} disabled={loading || !projectId} className="mt-3 bg-[color:var(--primary)] text-[color:var(--primary-contrast)] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[color:var(--primary-hover)] transition-colors flex items-center gap-2 disabled:opacity-50">
          {loading ? <><RefreshCw className="w-4 h-4 animate-spin" />Extracting…</> : <><Sparkles className="w-4 h-4" />Extract Tasks</>}
        </button>
      </div>

      {tasks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[color:var(--text)]">{tasks.length} action items found</h3>
            <button onClick={createSelected} disabled={creating || selectedCount === 0} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold flex items-center gap-1 hover:bg-emerald-700 transition-colors disabled:opacity-50">
              <Plus className="w-4 h-4" /> {creating ? "Creating…" : `Create ${selectedCount} Task${selectedCount !== 1 ? "s" : ""}`}
            </button>
          </div>
          <div className="space-y-2">
            {tasks.map((task, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-lg px-4 py-3 border transition-colors ${selected[i] ? "border-[color:var(--primary)]/50" : "border-[color:var(--border)]"}`}>
                <input type="checkbox" checked={selected[i] || false} onChange={e => setSelected(s => ({ ...s, [i]: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded accent-[color:var(--primary)]" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[color:var(--text)]">{task.title}</p>
                  {task.description && <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{task.description}</p>}
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.medium}`}>{task.priority}</span>
                    {task.assignee_name && <span className="text-xs px-2 py-0.5 rounded-full border border-[color:var(--border)] text-[color:var(--text-muted)]">👤 {task.assignee_name}</span>}
                    {task.due_date_hint && <span className="text-xs px-2 py-0.5 rounded-full border border-[color:var(--border)] text-[color:var(--text-muted)]">📅 {task.due_date_hint}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Risk Heatmap ─────────────────────────────────────────────────────────────
function RiskHeatmapTab() {
  const api = useApi();
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/ai-features/risks");
      setRisks(r.data || []);
    } catch { toast.error("Failed to load risk data"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const RISK_COLORS = {
    critical: { bar: "bg-red-500",    badge: "text-red-500 border border-red-500/40",    icon: <AlertCircle className="w-4 h-4 text-red-500" /> },
    high:     { bar: "bg-orange-400", badge: "text-orange-400 border border-orange-400/40", icon: <AlertTriangle className="w-4 h-4 text-orange-400" /> },
    medium:   { bar: "bg-amber-400",  badge: "text-amber-400 border border-amber-400/40", icon: <Clock className="w-4 h-4 text-amber-400" /> },
    low:      { bar: "bg-emerald-400",  badge: "text-emerald-400 border border-emerald-400/40", icon: <CheckCircle className="w-4 h-4 text-emerald-400" /> },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[color:var(--text-muted)]">{risks.length} tasks analysed for deadline risk</p>
        <button onClick={load} disabled={loading} className="border border-[color:var(--border)] text-[color:var(--text-muted)] px-4 py-2 rounded-lg text-sm hover:text-[color:var(--text)] hover:border-[color:var(--border-strong)] transition-colors flex items-center gap-1">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {["critical","high","medium","low"].map(level => {
        const group = risks.filter(r => r.riskLevel === level);
        if (!group.length) return null;
        const c = RISK_COLORS[level];
        return (
          <div key={level}>
            <div className="flex items-center gap-2 mb-2">
              {c.icon}
              <h3 className="text-sm font-semibold text-[color:var(--text)] capitalize">{level} Risk ({group.length})</h3>
            </div>
            <div className="space-y-2">
              {group.map((r, i) => (
                <div key={i} className="border border-[color:var(--border)] rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[color:var(--text)]">{r.taskTitle || "Task"}</p>
                      <p className="text-xs text-[color:var(--text-muted)]">
                        {r.daysLeft !== null ? (r.daysLeft < 0 ? `${Math.abs(r.daysLeft)}d overdue` : `${r.daysLeft}d left`) : "No due date"}
                        {r.openSubtasks > 0 ? ` · ${r.openSubtasks} open subtasks` : ""}
                        {r.lateRate > 0 ? ` · ${r.lateRate}% late history` : ""}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.badge}`}>{r.riskScore}/100</span>
                  </div>
                  <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                    <div className={`h-full ${c.bar} rounded-full`} style={{ width: `${r.riskScore}%` }} />
                  </div>
                  {r.suggestions?.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {r.suggestions.map((s, j) => (
                        <li key={j} className="text-xs text-[color:var(--text-muted)] flex items-start gap-1">
                          <span className="mt-0.5">→</span> {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {!loading && risks.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500/40" />
          <h3 className="font-medium text-[color:var(--text)]">All clear!</h3>
          <p className="text-sm text-[color:var(--text-muted)]">No tasks with upcoming due dates found.</p>
        </div>
      )}
    </div>
  );
}

// ─── Smart Digest ─────────────────────────────────────────────────────────────
function DigestTab() {
  const api = useApi();
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/ai-features/digest");
      setDigest(r.data);
    } catch { toast.error("Failed to load digest"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[color:var(--text-muted)]">AI-summarised notifications from the last 24 hours</p>
        <button onClick={load} className="border border-[color:var(--border)] text-[color:var(--text-muted)] px-4 py-2 rounded-lg text-sm hover:text-[color:var(--text)] hover:border-[color:var(--border-strong)] transition-colors flex items-center gap-1">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {digest && (
        <div>
          <div className="border border-[color:var(--primary)]/30 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-[color:var(--primary)] flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
              {digest.summary}
            </p>
          </div>

          {Object.entries(digest.items || {}).map(([type, items]) => (
            <div key={type} className="mb-3">
              <h3 className="text-xs font-semibold text-[color:var(--text-muted)] uppercase tracking-wider mb-2">{type.replace(".", " ").replace("_", " ")}</h3>
              {items.map(n => (
                <div key={n.id} className="flex items-center gap-3 py-2 border-b border-[color:var(--border)] last:border-0">
                  <div className="flex-1">
                    <p className="text-sm text-[color:var(--text)]">{n.task_title || n.message || n.type}</p>
                    <p className="text-xs text-[color:var(--text-muted)]">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {digest.total === 0 && (
            <p className="text-center py-8 text-[color:var(--text-muted)] text-sm">No new notifications in the last 24 hours</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AI Report ────────────────────────────────────────────────────────────────
function ReportTab() {
  const api = useApi();
  const { auth } = useAuth();
  const isManager = auth?.user?.role === "manager";

  // Managers can only generate project reports
  const [type, setType] = useState(isManager ? "project" : "weekly");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    api.get("/projects").then(r => {
      const list = r.data?.projects || r.data || [];
      setProjects(list);
      if (list.length > 0) setProjectId(list[0].id);
    }).catch(() => {});
  }, []);

  const generate = async () => {
    if (type === "project" && !projectId) return toast.error("Please select a project");
    setLoading(true);
    setReport(null);
    try {
      const r = await api.post("/ai-features/report", {
        type,
        projectId: type === "project" ? projectId : undefined,
      });
      setReport(r.data);
    } catch (err) { toast.error(err.response?.data?.error || "Report generation failed"); }
    setLoading(false);
  };

  // Type buttons: managers only see "project"
  const reportTypes = isManager ? ["project"] : ["weekly", "monthly", "project"];

  return (
    <div className="space-y-4">
      <div className="border border-[color:var(--border)] rounded-lg p-4">
        <h2 className="font-semibold text-[color:var(--text)] mb-3">Generate AI Report</h2>
        <div className="flex gap-2 flex-wrap items-center">
          {reportTypes.map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize border transition-colors ${type === t ? "bg-[color:var(--primary)] text-[color:var(--primary-contrast)] border-[color:var(--primary)] hover:bg-[color:var(--primary-hover)]" : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:border-[color:var(--border-strong)]"}`}>
              {t}
            </button>
          ))}
          {type === "project" && (
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="bg-[var(--surface)] border border-[color:var(--border)] text-[color:var(--text)] rounded-lg px-3 py-2 w-full focus:outline-none focus:border-[color:var(--primary)] transition-colors text-sm"
            >
              <option value="">— Select project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button onClick={generate} disabled={loading || (type === "project" && !projectId)} className="ml-auto bg-[color:var(--primary)] text-[color:var(--primary-contrast)] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[color:var(--primary-hover)] transition-colors flex items-center gap-2 disabled:opacity-50">
            {loading ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating…</> : <><Sparkles className="w-4 h-4" />Generate</>}
          </button>
        </div>
      </div>

      {report && (
        <div className="border border-[color:var(--border)] rounded-lg p-4 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-[color:var(--border)]">
            <BarChart2 className="w-5 h-5 text-[color:var(--primary)]" />
            <div>
              <h2 className="font-semibold text-[color:var(--text)] capitalize">
                {report.type === "project" && report.projectName ? report.projectName : report.type} Report
              </h2>
              <p className="text-xs text-[color:var(--text-muted)]">Generated {new Date(report.generatedAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Completed", val: report.stats?.done || 0, color: "text-emerald-400" },
              { label: "In Progress", val: report.stats?.in_progress || 0, color: "text-[color:var(--primary)]" },
              { label: "To Do", val: report.stats?.todo || 0, color: "text-[color:var(--text-soft)]" },
              { label: "Overdue", val: report.stats?.overdue || 0, color: "text-red-500" },
            ].map(s => (
              <div key={s.label} className="border border-[color:var(--border)] rounded-lg p-4 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
                <div className="text-xs text-[color:var(--text-muted)] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* AI narrative */}
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--text)] mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[color:var(--primary)]" /> AI Analysis
            </h3>
            <div className="text-sm text-[color:var(--text)] whitespace-pre-wrap leading-7">{report.report}</div>
          </div>

          {/* Top performers */}
          {report.topPerformers?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--text)] mb-2">Top Contributors</h3>
              {report.topPerformers.map(m => (
                <div key={m.username} className="flex items-center gap-3 py-1.5">
                  <span className="text-sm font-medium text-[color:var(--text)] flex-1">{m.username}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                      <div className="h-full bg-[color:var(--primary)] rounded-full" style={{ width: `${m.total > 0 ? (m.completed / m.total) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-[color:var(--text-muted)]">{m.completed}/{m.total}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Smart Task Parse ─────────────────────────────────────────────────────────
function SmartParseTab() {
  const api = useApi();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  useEffect(() => {
    api.get("/projects").then(r => {
      const list = r.data?.projects || r.data || [];
      setProjects(list);
      if (list.length > 0) setSelectedProjectId(list[0].id);
    }).catch(() => {});
  }, []);

  const parse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const r = await api.post("/ai-features/parse-task", { text });
      setParsed(r.data);
      // If AI detected a project, pre-select it
      if (r.data.project_id) setSelectedProjectId(r.data.project_id);
    } catch { toast.error("Parse failed"); }
    setLoading(false);
  };

  const create = async () => {
    if (!parsed) return;
    if (!selectedProjectId) return toast.error("Please select a project");
    setCreating(true);
    try {
      await api.post("/tasks", {
        task: parsed.title,
        priority: parsed.priority,
        assigned_to: parsed.assignee_id || undefined,
        project_id: selectedProjectId,
      });
      toast.success("Task created!");
      setParsed(null);
      setText("");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setCreating(false);
  };

  const PRIORITY_COLOR = {
    high: "text-red-500 border border-red-500/40",
    medium: "text-amber-500 border border-amber-500/40",
    low: "text-[color:var(--primary)] border border-[color:var(--primary)]/40",
  };

  return (
    <div className="space-y-4">
      <div className="border border-[color:var(--border)] rounded-lg p-4">
        <h2 className="font-semibold text-[color:var(--text)] mb-1">Smart Task Parser</h2>
        <p className="text-sm text-[color:var(--text-muted)] mb-3">Type a task in natural language — AI will structure it for you.</p>
        <div className="flex gap-2">
          <input
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && parse()}
            placeholder="e.g. Assign the dashboard redesign to Sarah, high priority, due next Friday"
            className="bg-[var(--surface)] border border-[color:var(--border)] text-[color:var(--text)] rounded-lg px-3 py-2 w-full focus:outline-none focus:border-[color:var(--primary)] transition-colors flex-1 text-sm"
          />
          <button onClick={parse} disabled={loading} className="bg-[color:var(--primary)] text-[color:var(--primary-contrast)] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[color:var(--primary-hover)] transition-colors flex items-center gap-1 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Parse
          </button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {[
            "Fix the login bug and assign to John",
            "Review Q1 finances — high priority by end of month",
            "Schedule onboarding call with new client next week",
          ].map(ex => (
            <button key={ex} onClick={() => setText(ex)} className="border border-[color:var(--border)] text-[color:var(--text-muted)] px-4 py-2 rounded-lg text-sm hover:text-[color:var(--text)] hover:border-[color:var(--border-strong)] transition-colors text-xs">
              {ex}
            </button>
          ))}
        </div>
      </div>

      {parsed && (
        <div className="border border-[color:var(--border)] rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-[color:var(--text)] flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" />Parsed Result</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="sm:col-span-2">
              <span className="text-xs text-[color:var(--text-muted)]">Title</span>
              <p className="font-medium text-[color:var(--text)] mt-0.5">{parsed.title}</p>
            </div>
            <div>
              <span className="text-xs text-[color:var(--text-muted)]">Priority</span>
              <p className="mt-0.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[parsed.priority]}`}>{parsed.priority}</span></p>
            </div>
            <div>
              <span className="text-xs text-[color:var(--text-muted)]">Assignee</span>
              <p className="font-medium text-[color:var(--text)] mt-0.5">{parsed.assignee_name || "Unassigned"}</p>
            </div>
            <div>
              <span className="text-xs text-[color:var(--text-muted)]">Project <span className="text-red-500">*</span></span>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="mt-0.5 bg-[var(--surface)] border border-[color:var(--border)] text-[color:var(--text)] rounded-lg px-3 py-2 w-full focus:outline-none focus:border-[color:var(--primary)] transition-colors text-sm"
              >
                <option value="">— Select project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <span className="text-xs text-[color:var(--text-muted)]">Due Date Hint</span>
              <p className="font-medium text-[color:var(--text)] mt-0.5">{parsed.due_date_hint || "Not specified"}</p>
            </div>
          </div>
          <button onClick={create} disabled={creating || !selectedProjectId} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold flex items-center gap-1 hover:bg-emerald-700 transition-colors disabled:opacity-50">
            <Plus className="w-4 h-4" /> {creating ? "Creating…" : "Create Task"}
          </button>
        </div>
      )}
    </div>
  );
}
