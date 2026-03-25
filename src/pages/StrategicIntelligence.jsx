// src/pages/StrategicIntelligence.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
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
    score >= 80 ? 'bg-green-100 text-green-700' :
    score >= 50 ? 'bg-yellow-100 text-yellow-700' :
    'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      {score ?? '—'}
    </span>
  );
}

function RiskBadge({ level }) {
  const styles = {
    low:      'bg-green-100 text-green-700',
    medium:   'bg-yellow-100 text-yellow-700',
    high:     'bg-red-100 text-red-700',
    critical: 'bg-red-200 text-red-900',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${styles[level] || styles.medium}`}>
      {level}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red:    'bg-red-50 text-red-600',
    blue:   'bg-blue-50 text-blue-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg shrink-0 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
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
          <div className={`w-3 h-3 rounded-full ${healthScore >= 75 ? 'bg-green-500' : healthScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium text-gray-700">
            Workspace Health: <strong>{healthScore}</strong>/100
          </span>
        </div>
        <button onClick={load} className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-700 transition-colors">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Tasks</h3>
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
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Team Performance — {month}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={TrendingUp}   label="Avg Score"      value={performance.avgScore ?? '—'} color="indigo" />
            <StatCard icon={CheckCircle2} label="High Performers" value={performance.highPerformers} color="green"  sub="score ≥ 80" />
            <StatCard icon={AlertCircle}  label="At Risk"         value={performance.atRisk}         color="red"    sub="score < 50" />
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Autopilot</h3>
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
        <label className="text-sm font-medium text-gray-600">Month:</label>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm focus:border-primary-500"
        />
      </div>

      {loading ? <Spinner /> : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Completed</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Overdue</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {team.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">
                    No data for {month}
                  </td>
                </tr>
              ) : team.map((u, i) => (
                <tr key={u.userId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.avatarUrl ? (
                        <img src={avatarSrc(u.avatarUrl)} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600">
                          {u.username?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <span className="font-medium text-gray-800">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center"><ScoreBadge score={u.score} /></td>
                  <td className="px-4 py-3 text-center text-gray-700">{u.completedTasks}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{u.overdueTasks}</td>
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
        <p className="text-center text-gray-400 py-8">No projects found.</p>
      ) : projects.map(p => {
        const statusStyle =
          p.status === 'healthy'  ? 'bg-green-100 text-green-700' :
          p.status === 'at_risk'  ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700';

        return (
          <div key={p.projectId} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FolderOpen className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="font-medium text-gray-900 truncate">{p.projectName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold capitalize shrink-0 ${statusStyle}`}>
                    {p.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>Total: {p.totalTasks}</span>
                  <span className="text-green-600">Done: {p.completedTasks}</span>
                  <span className="text-blue-600">Active: {p.activeTasks}</span>
                  {p.overdueTasks > 0 && (
                    <span className="text-red-600 font-medium">Overdue: {p.overdueTasks}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold text-gray-900">{p.healthScore}</div>
                <div className="text-xs text-gray-400">health</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Completion</span>
                <span>{p.completionRate}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    p.completionRate >= 75 ? 'bg-green-500' :
                    p.completionRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
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
              className={`p-4 border-2 rounded-lg transition-all text-center ${
                scope === id
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <Icon className="w-5 h-5 mx-auto mb-1" />
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
            </button>
          ))}
        </div>

        {/* Entity selectors */}
        {scope === 'project' && (
          <select
            value={entityId}
            onChange={e => setEntityId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-primary-500"
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
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-primary-500"
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
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-primary-500"
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
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm resize-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          required
        />

        {/* Quick questions */}
        <div className="flex flex-wrap gap-2">
          {QUICK_QUESTIONS[scope].map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setQuestion(q)}
              className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
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
        <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-xl border border-primary-200">
          <div className="animate-spin"><Brain className="w-5 h-5 text-primary-600" /></div>
          <p className="text-sm font-medium text-primary-800">AI is analyzing your workspace data…</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {response && (
        <div className="bg-white rounded-xl border border-primary-200 p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Badge color="primary" size="sm" variant="solid" className="gap-1">
                <Sparkles className="w-3 h-3" /> AI Response
              </Badge>
              <span className="text-xs text-gray-400">by {response.aiUser?.username || 'AI Assistant'}</span>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(response.answer); toast.success('Copied!'); }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Copy
            </button>
          </div>
          <div className="text-sm text-gray-800 leading-relaxed space-y-1">
            {formatAnswer(response.answer)}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-400">
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

  // Managers only access Ask AI
  const visibleTabs = useMemo(
    () => isManager ? TABS.filter(t => t.id === 'ask') : TABS,
    [isManager]
  );
  const [activeTab, setActiveTab] = useState(isManager ? 'ask' : 'dashboard');

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card>
        <Card.Content className="p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-gray-900">Strategic Intelligence</h1>
              <p className="text-sm text-gray-500 mt-0.5">AI-powered operational analytics and decision support</p>
            </div>
            <Badge color="primary" size="lg" variant="subtle" className="gap-1.5">
              <Sparkles className="w-4 h-4" /> AI-Powered
            </Badge>
          </div>
        </Card.Content>
      </Card>

      {/* Tab bar */}
      <div className="flex bg-white rounded-xl border border-gray-200 p-1 gap-1">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <Card>
        <Card.Content className="p-5">
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'team'      && <TeamTab />}
          {activeTab === 'projects'  && <ProjectsTab />}
          {activeTab === 'ask'       && <AskTab />}
        </Card.Content>
      </Card>
    </div>
  );
}
