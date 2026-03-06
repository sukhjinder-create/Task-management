// src/pages/StrategicIntelligence.jsx
import { useState, useEffect } from 'react';
import { Brain, Sparkles, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';
import { useApi } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Card, Button, Badge } from '../components/ui';

const QUICK_QUESTIONS = {
  workspace: [
    "What are the operational risks this month?",
    "How is workspace performance trending?",
    "What is the forecast for next month?",
    "Which areas need immediate attention?",
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

export default function StrategicIntelligence() {
  const api = useApi();
  const { auth } = useAuth();

  const [scope, setScope] = useState('workspace');
  const [entityId, setEntityId] = useState('');
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  // Entity lists for dropdowns
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedProjectForTask, setSelectedProjectForTask] = useState('');
  const [loadingEntities, setLoadingEntities] = useState(false);

  // Load projects when scope changes to project or task
  useEffect(() => {
    if (scope === 'project' || scope === 'task') {
      loadProjects();
    }
  }, [scope]);

  // Load tasks when a project is selected (for task scope)
  useEffect(() => {
    if (scope === 'task' && selectedProjectForTask) {
      loadTasksFromProject(selectedProjectForTask);
    } else {
      setTasks([]);
    }
  }, [selectedProjectForTask, scope]);

  const loadProjects = async () => {
    try {
      setLoadingEntities(true);
      const res = await api.get('/projects');
      setProjects(res.data || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoadingEntities(false);
    }
  };

  const loadTasksFromProject = async (projectId) => {
    try {
      setLoadingEntities(true);
      const res = await api.get(`/tasks/${projectId}`);
      setTasks(res.data || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      toast.error('Failed to load tasks from project');
    } finally {
      setLoadingEntities(false);
    }
  };

  const handleScopeChange = (newScope) => {
    setScope(newScope);
    setEntityId('');
    setSelectedProjectForTask(''); // Reset project selection for task scope
    setQuestion('');
    setResponse(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    if ((scope === 'project' || scope === 'task') && !entityId) {
      toast.error(`Please select a ${scope}`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const payload = {
        scope,
        question: question.trim(),
      };

      if (scope !== 'workspace') {
        payload.entityId = entityId;
      }

      const result = await api.post('/ai/intelligence-query', payload);
      setResponse(result.data);
      toast.success('Analysis complete!');
    } catch (err) {
      console.error('Intelligence query failed:', err);
      console.error('Error response:', err.response?.data);
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to get AI response. Please check server logs for details.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (q) => {
    setQuestion(q);
  };

  const formatAnswer = (answer) => {
    if (!answer) return null;

    // Simple markdown-like formatting
    return answer.split('\n').map((line, idx) => {
      // Bold text (**text**)
      const boldFormatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // Bullet points
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        return (
          <li key={idx} className="ml-4 mb-1" dangerouslySetInnerHTML={{ __html: boldFormatted }} />
        );
      }

      // Regular paragraphs
      if (line.trim()) {
        return (
          <p key={idx} className="mb-2" dangerouslySetInnerHTML={{ __html: boldFormatted }} />
        );
      }

      return <br key={idx} />;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <Card.Content className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-gray-900">Strategic Intelligence</h1>
              <p className="text-sm text-gray-500 mt-1">
                AI-powered operational analytics and decision support
              </p>
            </div>
            <Badge color="primary" size="lg" variant="subtle" className="gap-1.5">
              <Sparkles className="w-4 h-4" />
              AI-Powered
            </Badge>
          </div>
        </Card.Content>
      </Card>

      {/* Query Form */}
      <Card>
        <Card.Content className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Scope Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Analysis Scope
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleScopeChange('workspace')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    scope === 'workspace'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <TrendingUp className="w-5 h-5 mx-auto mb-2" />
                  <div className="text-sm font-medium">Workspace</div>
                  <div className="text-xs text-gray-500 mt-1">Overall insights</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleScopeChange('project')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    scope === 'project'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <Brain className="w-5 h-5 mx-auto mb-2" />
                  <div className="text-sm font-medium">Project</div>
                  <div className="text-xs text-gray-500 mt-1">Project analysis</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleScopeChange('task')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    scope === 'task'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <AlertCircle className="w-5 h-5 mx-auto mb-2" />
                  <div className="text-sm font-medium">Task</div>
                  <div className="text-xs text-gray-500 mt-1">Task details</div>
                </button>
              </div>
            </div>

            {/* Entity Selector */}
            {scope === 'project' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Project
                </label>
                <select
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  required
                  disabled={loadingEntities}
                >
                  <option value="">
                    {loadingEntities ? 'Loading...' : 'Select project...'}
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scope === 'task' && (
              <div className="space-y-4">
                {/* First: Select Project */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Project
                  </label>
                  <select
                    value={selectedProjectForTask}
                    onChange={(e) => {
                      setSelectedProjectForTask(e.target.value);
                      setEntityId(''); // Reset task selection when project changes
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    required
                    disabled={loadingEntities}
                  >
                    <option value="">
                      {loadingEntities ? 'Loading...' : 'Select project...'}
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Second: Select Task (only shown after project is selected) */}
                {selectedProjectForTask && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Task
                    </label>
                    <select
                      value={entityId}
                      onChange={(e) => setEntityId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                      required
                      disabled={loadingEntities}
                    >
                      <option value="">
                        {loadingEntities ? 'Loading tasks...' : 'Select task...'}
                      </option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.task}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Question Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Question
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What would you like to know?"
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 resize-none"
                required
              />
            </div>

            {/* Quick Questions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Questions
              </label>
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS[scope].map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickQuestion(q)}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full gap-2"
              loading={isLoading}
              disabled={isLoading}
            >
              <Brain className="w-5 h-5" />
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </Button>
          </form>
        </Card.Content>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card className="border-primary-200 bg-primary-50">
          <Card.Content className="p-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin">
                <Brain className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-900">
                  AI is analyzing your workspace data...
                </p>
                <p className="text-xs text-primary-600 mt-0.5">
                  This may take a few moments
                </p>
              </div>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-danger-200 bg-danger-50">
          <Card.Content className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-danger-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-danger-900 mb-1">
                  Analysis Failed
                </h3>
                <p className="text-sm text-danger-700">{error}</p>
              </div>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Response Display */}
      {response && (
        <Card className="border-primary-200">
          <Card.Content className="p-6">
            <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Badge color="primary" size="sm" variant="solid" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI Response
                </Badge>
                <span className="text-xs text-gray-500">
                  by {response.aiUser?.username || 'AI Assistant'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(response.answer);
                  toast.success('Response copied to clipboard!');
                }}
                className="gap-1.5"
              >
                Copy
              </Button>
            </div>

            <div className="prose prose-sm max-w-none">
              <div className="text-sm text-gray-800 leading-relaxed space-y-2">
                {formatAnswer(response.answer)}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <ArrowRight className="w-3 h-3" />
                <span>Generated using AI-powered analytics</span>
              </div>
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
