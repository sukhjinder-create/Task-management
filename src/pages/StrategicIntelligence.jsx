// src/pages/StrategicIntelligence.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Brain, Sparkles, TrendingUp, AlertCircle, ArrowRight,
  Users, FolderOpen, LayoutDashboard, RefreshCw,
  CheckCircle2, Clock, AlertTriangle, Zap, Activity,
} from 'lucide-react';
import { useApi, API_BASE_URL } from '../api';
import toast from 'react-hot-toast';
import { Card, Button, Badge } from '../components/ui';

const BACKEND_URL = API_BASE_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function avatarSrc(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${BACKEND_URL}${url}`;
}

function ScoreBadge({ score }) {
  const color =
    score >= 80 ? 'text-[color:var(--primary)]' :
    score >= 50 ? 'text-[color:var(--primary)]' :
    'text-[color:var(--score-danger)]';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border border-[color:var(--border)] text-xs font-semibold ${color}`}>
      {score ?? '—'}
    </span>
  );
}

function RiskBadge({ level }) {
  const styles = {
    low:      'text-[color:var(--primary)]',
    medium:   'text-[color:var(--primary)]',
    high:     'text-[color:var(--score-danger)]',
    critical: 'text-[color:var(--score-danger)]',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border border-[color:var(--border)] text-xs font-semibold capitalize ${styles[level] || styles.medium}`}>
      {level}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
  const iconColor = {
    indigo: 'text-[color:var(--primary)]',
    green:  'text-[color:var(--primary)]',
    yellow: 'text-[color:var(--primary)]',
    red:    'text-[color:var(--score-danger)]',
    blue:   'text-[color:var(--primary)]',
  };
  return (
    <div className="border border-[color:var(--border)] rounded-lg p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg shrink-0 bg-[var(--surface-soft)] ${iconColor[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-[color:var(--text)]">{value ?? '—'}</p>
        <p className="text-xs font-medium text-[color:var(--text-muted)]">{label}</p>
        {sub && <p className="text-xs text-[color:var(--text-soft)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[color:var(--primary)] border-t-transparent" />
    </div>
  );
}

/* ─── Tabs config ───────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'team',      label: 'Team',      icon: Users },
  { id: 'projects',  label: 'Projects',  icon: FolderOpen },
  { id: 'ask',       label: 'Ask AI',    icon: Brain },
];

/* ─── Dashboard Tab ─────────────────────────────────────────────────────────── */
function DashboardTab() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/intelligence/workspace/dashboard');
      setData(res.data);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (!data) return null;

  const { tasks, performance, autopilot, healthScore, month } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${healthScore >= 50 ? 'bg-[var(--primary)]' : 'bg-[var(--score-danger)]'}`} />
          <span className="text-sm font-medium text-[color:var(--text-muted)]">
            Workspace Health: <strong className="text-[color:var(--text)]">{healthScore}</strong>/100
          </span>
        </div>
        <button onClick={load} className="text-xs text-[color:var(--text-muted)] flex items-center gap-1 hover:text-[color:var(--text)] transition-colors">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[color:var(--text-muted)] mb-3">Tasks</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon={Activity}      label="Total"       value={tasks.total}         color="indigo" />
          <StatCard icon={CheckCircle2}  label="Completed"   value={tasks.completed}     color="green"  sub={`${tasks.completionRate}% rate`} />
          <StatCard icon={Zap}           label="In Progress" value={tasks.inProgress}    color="blue"   />
          <StatCard icon={Clock}         label="Pending"     value={tasks.pending}       color="yellow" />
          <StatCard icon={AlertTriangle} label="Overdue"     value={tasks.overdue}       color="red"    />
        </div>
      </div>

      {(performance.avgScore !== null || performance.highPerformers > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--text-muted)] mb-3">Team Performance — {month}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={TrendingUp}   label="Avg Score"      value={performance.avgScore ?? '—'} color="indigo" />
            <StatCard icon={CheckCircle2} label="High Performers" value={performance.highPerformers} color="green"  sub="score ≥ 80" />
            <StatCard icon={AlertCircle}  label="At Risk"         value={performance.atRisk}         color="red"    sub="score < 50" />
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-[color:var(--text-muted)] mb-3">Autopilot</h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Clock}         label="Pending Actions" value={autopilot.pendingActions}   color="yellow" />
          <StatCard icon={AlertTriangle} label="Overdue Actions" value={autopilot.overdueActions}   color="red"    />
          <StatCard icon={AlertCircle}   label="Escalations"     value={autopilot.escalatedActions} color="indigo" />
        </div>
      </div>
    </div>
  );
}

/* ─── Team Tab ──────────────────────────────────────────────────────────────── */
function TeamTab() {
  const api = useApi();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/intelligence/team/comparison?month=${month}`);
      setTeam(res.data.team || []);
    } catch {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, [api, month]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-[color:var(--text-muted)]">Month:</label>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-[color:var(--border)] rounded px-2 py-1 text-sm bg-transparent text-[color:var(--text)] focus:border-[color:var(--primary)] outline-none"
        />
      </div>

      {loading ? <Spinner /> : (
        <div className="overflow-hidden rounded-lg border border-[color:var(--border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[color:var(--border)]">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-[color:var(--text-muted)]">Member</th>
                <th className="text-center px-4 py-3 font-medium text-[color:var(--text-muted)]">Score</th>
                <th className="text-center px-4 py-3 font-medium text-[color:var(--text-muted)]">Completed</th>
                <th className="text-center px-4 py-3 font-medium text-[color:var(--text-muted)]">Overdue</th>
                <th className="text-center px-4 py-3 font-medium text-[color:var(--text-muted)]">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border)]">
              {team.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-[color:var(--text-soft)] text-sm">
                    No data for {month}
                  </td>
                </tr>
              ) : team.map((u) => (
                <tr key={u.userId}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.avatarUrl ? (
                        <img src={avatarSrc(u.avatarUrl)} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[var(--surface-soft)] flex items-center justify-center text-xs font-semibold text-[color:var(--primary)]">
                          {u.username?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <span className="font-medium text-[color:var(--text)]">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center"><ScoreBadge score={u.score} /></td>
                  <td className="px-4 py-3 text-center text-[color:var(--text-muted)]">{u.completedTasks}</td>
                  <td className="px-4 py-3 text-center text-[color:var(--text-muted)]">{u.overdueTasks}</td>
                  <td className="px-4 py-3 text-center"><RiskBadge level={u.riskLevel} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Projects Tab ──────────────────────────────────────────────────────────── */
function ProjectsTab() {
  const api = useApi();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/intelligence/projects/health');
      setProjects(res.data.projects || []);
    } catch {
      toast.error('Failed to load projects health');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      {projects.length === 0 ? (
        <p className="text-center text-[color:var(--text-soft)] py-8">No projects found.</p>
      ) : projects.map(p => {
        const statusColorClass =
          p.status === 'healthy'  ? 'text-[color:var(--primary)]' :
          p.status === 'at_risk'  ? 'text-[color:var(--primary)]' :
          'text-[color:var(--score-danger)]';
        const healthColorClass =
          p.healthScore >= 75 ? 'text-[color:var(--primary)]' :
          p.healthScore >= 50 ? 'text-[color:var(--primary)]' :
          'text-[color:var(--score-danger)]';
        const barColorClass =
          p.completionRate >= 40 ? 'bg-[var(--primary)]' : 'bg-[var(--score-danger)]';

        return (
          <div key={p.projectId} className="border border-[color:var(--border)] rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FolderOpen className="w-4 h-4 text-[color:var(--text-soft)] shrink-0" />
                  <span className="font-medium text-[color:var(--text)] truncate">{p.projectName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border border-[color:var(--border)] font-semibold capitalize shrink-0 ${statusColorClass}`}>
                    {p.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--text-muted)]">
                  <span>Total: {p.totalTasks}</span>
                  <span className="text-[color:var(--primary)]">Done: {p.completedTasks}</span>
                  <span className="text-[color:var(--primary)]">Active: {p.activeTasks}</span>
                  {p.overdueTasks > 0 && (
                    <span className="text-[color:var(--score-danger)] font-medium">Overdue: {p.overdueTasks}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-2xl font-bold ${healthColorClass}`}>{p.healthScore}</div>
                <div className="text-xs text-[color:var(--text-soft)]">health</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-[color:var(--text-muted)] mb-1">
                <span>Completion</span>
                <span>{p.completionRate}%</span>
              </div>
              <div className="w-full bg-[var(--surface-soft)] rounded-full h-1">
                <div
                  className={`h-1 rounded-full transition-all ${barColorClass}`}
                  style={{ width: `${p.completionRate}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Ask AI Tab ─────────────────────────────────────────────────────────────── */
const QUICK_QUESTIONS = {
  workspace: [
    "What are the operational risks this month?",
    "How is workspace performance trending?",
    "Which areas need immediate attention?",
    "What is the forecast for next month?",
  ],
  project: [
    "Why is this project delayed?",
    "What are the project risks?",
    "How many tasks are overdue?",
    "What's blocking completion?",
  ],
  task: [
    "Summarize this task's history",
    "What delays occurred?",
    "Why was this task reassigned?",
    "What are the activity patterns?",
  ],
};

function AskTab() {
  const api = useApi();
  const { auth } = useAuth();
  const isManager = auth?.user?.role === 'manager';
  const [scope, setScope] = useState(isManager ? 'project' : 'workspace');
  const [entityId, setEntityId] = useState('');
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loadingEntities, setLoadingEntities] = useState(false);

  useEffect(() => {
    if (scope === 'project' || scope === 'task') {
      setLoadingEntities(true);
      api.get('/projects')
        .then(r => setProjects(r.data || []))
        .catch(() => {})
        .finally(() => setLoadingEntities(false));
    }
  }, [scope]);

  useEffect(() => {
    if (scope === 'task' && selectedProject) {
      setLoadingEntities(true);
      api.get(`/tasks/${selectedProject}`)
        .then(r => setTasks(r.data || []))
        .catch(() => toast.error('Failed to load tasks'))
        .finally(() => setLoadingEntities(false));
    } else {
      setTasks([]);
    }
  }, [selectedProject, scope]);

  const handleScopeChange = (s) => {
    setScope(s);
    setEntityId('');
    setSelectedProject('');
    setQuestion('');
    setResponse(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return toast.error('Please enter a question');
    if ((scope === 'project' || scope === 'task') && !entityId) return toast.error(`Please select a ${scope}`);

    setIsLoading(true);
    setError(null);
    setResponse(null);
    try {
      const payload = { scope, question: question.trim() };
      if (scope !== 'workspace') payload.entityId = entityId;
      const result = await api.post('/ai/intelligence-query', payload);
      setResponse(result.data);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to get AI response';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAnswer = (answer) => {
    if (!answer) return null;
    return answer.split('\n').map((line, idx) => {
      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (line.trim().startsWith('•') || line.trim().startsWith('-'))
        return <li key={idx} className="ml-4 mb-1" dangerouslySetInnerHTML={{ __html: bold }} />;
      if (line.trim())
        return <p key={idx} className="mb-2" dangerouslySetInnerHTML={{ __html: bold }} />;
      return <br key={idx} />;
    });
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Scope selector */}
        <div className={`grid gap-3 ${isManager ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {[
            { id: 'workspace', label: 'Workspace', sub: 'Overall insights', icon: TrendingUp },
            { id: 'project',   label: 'Project',   sub: 'Project analysis', icon: FolderOpen },
            { id: 'task',      label: 'Task',       sub: 'Task details',    icon: AlertCircle },
          ].filter(s => isManager ? s.id !== 'workspace' : true).map(({ id, label, sub, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleScopeChange(id)}
              className={`p-4 border rounded-lg transition-all text-center ${
                scope === id
                  ? 'border-[color:var(--primary)] text-[color:var(--primary)]'
                  : 'border-[color:var(--border)] text-[color:var(--text-muted)] hover:border-[color:var(--primary)]'
              }`}
            >
              <Icon className="w-5 h-5 mx-auto mb-1" />
              <div className="text-sm font-medium text-[color:var(--text)]">{label}</div>
              <div className="text-xs text-[color:var(--text-soft)] mt-0.5">{sub}</div>
            </button>
          ))}
        </div>

        {/* Entity selectors */}
        {scope === 'project' && (
          <select
            value={entityId}
            onChange={e => setEntityId(e.target.value)}
            className="w-full border border-[color:var(--border)] rounded-lg px-4 py-2.5 text-sm bg-transparent text-[color:var(--text)] focus:border-[color:var(--primary)] outline-none"
            disabled={loadingEntities}
            required
          >
            <option value="">{loadingEntities ? 'Loading...' : 'Select project...'}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {scope === 'task' && (
          <div className="space-y-3">
            <select
              value={selectedProject}
              onChange={e => { setSelectedProject(e.target.value); setEntityId(''); }}
              className="w-full border border-[color:var(--border)] rounded-lg px-4 py-2.5 text-sm bg-transparent text-[color:var(--text)] focus:border-[color:var(--primary)] outline-none"
              disabled={loadingEntities}
              required
            >
              <option value="">{loadingEntities ? 'Loading...' : 'Select project...'}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {selectedProject && (
              <select
                value={entityId}
                onChange={e => setEntityId(e.target.value)}
                className="w-full border border-[color:var(--border)] rounded-lg px-4 py-2.5 text-sm bg-transparent text-[color:var(--text)] focus:border-[color:var(--primary)] outline-none"
                disabled={loadingEntities}
                required
              >
                <option value="">{loadingEntities ? 'Loading tasks...' : 'Select task...'}</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.task}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Question */}
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="What would you like to know?"
          rows={3}
          className="w-full border border-[color:var(--border)] rounded-lg px-4 py-3 text-sm text-[color:var(--text)] bg-transparent resize-none focus:border-[color:var(--primary)] outline-none placeholder:text-[color:var(--text-soft)]"
          required
        />

        {/* Quick questions */}
        <div className="flex flex-wrap gap-2">
          {QUICK_QUESTIONS[scope].map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setQuestion(q)}
              className="text-xs px-3 py-1.5 border border-[color:var(--border)] text-[color:var(--text-muted)] rounded-full hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full gap-2" loading={isLoading} disabled={isLoading}>
          <Brain className="w-5 h-5" />
          {isLoading ? 'Analyzing...' : 'Analyze'}
        </Button>
      </form>

      {isLoading && (
        <div className="flex items-center gap-3 p-4 border border-[color:var(--primary)] rounded-lg">
          <div className="animate-spin"><Brain className="w-5 h-5 text-[color:var(--primary)]" /></div>
          <p className="text-sm font-medium text-[color:var(--primary)]">AI is analyzing your workspace data…</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 border border-[color:var(--score-danger)] rounded-lg">
          <AlertCircle className="w-5 h-5 text-[color:var(--score-danger)] shrink-0 mt-0.5" />
          <p className="text-sm text-[color:var(--score-danger)]">{error}</p>
        </div>
      )}

      {response && (
        <div className="border border-[color:var(--border)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[color:var(--border)]">
            <div className="flex items-center gap-2">
              <Badge color="primary" size="sm" variant="solid" className="gap-1">
                <Sparkles className="w-3 h-3" /> AI Response
              </Badge>
              <span className="text-xs text-[color:var(--text-soft)]">by {response.aiUser?.username || 'AI Assistant'}</span>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(response.answer); toast.success('Copied!'); }}
              className="text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
            >
              Copy
            </button>
          </div>
          <div className="text-sm text-[color:var(--text)] leading-relaxed space-y-1">
            {formatAnswer(response.answer)}
          </div>
          <div className="mt-4 pt-3 border-t border-[color:var(--border)] flex items-center gap-1.5 text-xs text-[color:var(--text-soft)]">
            <ArrowRight className="w-3 h-3" /> Generated using AI-powered analytics
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────────── */
export default function StrategicIntelligence() {
  const { auth } = useAuth();
  const isManager = auth?.user?.role === 'manager';
  const [searchParams, setSearchParams] = useSearchParams();

  // Managers only access Ask AI
  const visibleTabs = useMemo(
    () => isManager ? TABS.filter(t => t.id === 'ask') : TABS,
    [isManager]
  );
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    visibleTabs.some((tab) => tab.id === requestedTab)
      ? requestedTab
      : (isManager ? 'ask' : 'dashboard')
  );

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", activeTab);
      return next;
    }, { replace: true });
  }, [activeTab, visibleTabs, setSearchParams]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">Intelligence</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">Strategic Intelligence</h1>
          <p className="text-[13px] text-[color:var(--text-muted)] mt-1">AI-powered operational analytics and decision support</p>
        </div>
        <Badge color="primary" size="lg" variant="subtle" className="gap-1.5">
          <Sparkles className="w-4 h-4" /> AI-Powered
        </Badge>
      </header>

      {/* Tab bar */}
      <div className="flex border border-[color:var(--border)] rounded-lg p-1 gap-1">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              activeTab === id
                ? 'bg-[var(--primary)] text-[color:var(--primary-contrast)]'
                : 'text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)]'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="border border-[color:var(--border)] rounded-lg p-5">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'team'      && <TeamTab />}
        {activeTab === 'projects'  && <ProjectsTab />}
        {activeTab === 'ask'       && <AskTab />}
      </div>
    </div>
  );
}
