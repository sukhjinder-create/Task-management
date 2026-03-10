import { useEffect, useMemo, useState } from "react";
import { GitBranch, RefreshCcw, Play, Activity } from "lucide-react";
import { useApi } from "../api";
import toast from "react-hot-toast";
import { Modal, Button, Input, Badge } from "./ui";

const DEFAULT_SEQUENCE = ["dev", "qa", "stage", "uat", "prod"];

function safeJsonParse(v, fallback) {
  try {
    if (v == null) return fallback;
    if (typeof v === "object") return v;
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function normalizeBranchMapText(branchMap) {
  const obj = branchMap && typeof branchMap === "object" ? branchMap : {};
  return JSON.stringify(obj, null, 2);
}

function normalizeSettings(raw) {
  const sequence = Array.isArray(raw?.environment_sequence)
    ? raw.environment_sequence
    : safeJsonParse(raw?.environment_sequence, DEFAULT_SEQUENCE);

  const branchMap =
    typeof raw?.branch_environment_map === "object"
      ? raw.branch_environment_map
      : safeJsonParse(raw?.branch_environment_map, {});

  return {
    enabled: Boolean(raw?.enabled),
    autoStatusEnabled: raw?.auto_status_enabled !== false,
    autoCompleteOnProd: Boolean(raw?.auto_complete_on_prod),
    repoFullName: raw?.repo_full_name || "",
    requireTaskKey: raw?.require_task_key !== false,
    autoInferTasks: raw?.auto_infer_tasks !== false,
    minInferenceConfidence: Number(raw?.min_inference_confidence || 62),
    maxInferredTasks: Number(raw?.max_inferred_tasks || 2),
    environmentSequenceText: (Array.isArray(sequence) ? sequence : DEFAULT_SEQUENCE).join(", "),
    branchMapText: normalizeBranchMapText(branchMap),
  };
}

export default function GitAutomationModal({ isOpen, onClose, project, canManage }) {
  const api = useApi();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(() => normalizeSettings({}));

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [provider, setProvider] = useState("github");
  const [simulateBranch, setSimulateBranch] = useState("develop");
  const [simulateCommitMessage, setSimulateCommitMessage] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [autoConfiguring, setAutoConfiguring] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);

  const projectName = project?.name || "Project";

  const parsedSequence = useMemo(() => {
    const chunks = String(settings.environmentSequenceText || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return chunks.length ? chunks : DEFAULT_SEQUENCE;
  }, [settings.environmentSequenceText]);

  async function loadSettings() {
    if (!project?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/integrations/git/projects/${project.id}/settings`);
      setSettings(normalizeSettings(res.data || {}));
    } catch (err) {
      const msg = err?.response?.data?.error || "Failed to load Git automation settings";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents() {
    setLoadingEvents(true);
    try {
      const res = await api.get("/integrations/git/events", { params: { limit: 25 } });
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      const msg = err?.response?.data?.error || "Failed to load Git automation events";
      toast.error(msg);
    } finally {
      setLoadingEvents(false);
    }
  }

  useEffect(() => {
    if (!isOpen || !project?.id) return;
    setSimulationResult(null);
    loadSettings();
    loadEvents();
  }, [isOpen, project?.id]);

  const handleSave = async () => {
    if (!canManage) {
      toast.error("Only admin/manager can update Git automation settings");
      return;
    }

    let branchMap = {};
    try {
      branchMap = safeJsonParse(settings.branchMapText, null);
      if (!branchMap || typeof branchMap !== "object" || Array.isArray(branchMap)) {
        throw new Error("Invalid branch map JSON");
      }
    } catch {
      toast.error("Branch map must be valid JSON object");
      return;
    }

    setSaving(true);
    try {
      await api.put(`/integrations/git/projects/${project.id}/settings`, {
        enabled: settings.enabled,
        autoStatusEnabled: settings.autoStatusEnabled,
        autoCompleteOnProd: settings.autoCompleteOnProd,
        repoFullName: settings.repoFullName.trim() || null,
        environmentSequence: parsedSequence,
        branchEnvironmentMap: branchMap,
        requireTaskKey: settings.requireTaskKey,
        autoInferTasks: settings.autoInferTasks,
        minInferenceConfidence: Number(settings.minInferenceConfidence || 62),
        maxInferredTasks: Number(settings.maxInferredTasks || 2),
      });
      toast.success("Git automation settings saved");
      await loadSettings();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.details || "Failed to save settings";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoConfigureAll = async () => {
    if (!canManage) {
      toast.error("Only admin/manager can auto-configure");
      return;
    }
    setAutoConfiguring(true);
    try {
      const res = await api.post("/integrations/git/auto-configure", {
        minInferenceConfidence: Number(settings.minInferenceConfidence || 62),
        maxInferredTasks: Number(settings.maxInferredTasks || 2),
        repoFullName: settings.repoFullName?.trim() || null,
      });
      const count = Number(res?.data?.projectsConfigured || 0);
      toast.success(`Auto-configured ${count} project(s)`);
      await loadEvents();
      await loadSettings();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.details || "Auto-configure failed";
      toast.error(msg);
    } finally {
      setAutoConfiguring(false);
    }
  };

  const handleSimulate = async () => {
    if (!project?.id) return;
    if (!simulateBranch.trim()) {
      toast.error("Branch is required for simulation");
      return;
    }

    setSimulating(true);
    setSimulationResult(null);
    try {
      const payload = {
        ref: `refs/heads/${simulateBranch.trim()}`,
        repository: {
          full_name: settings.repoFullName || "local/test-repo",
        },
        commits: [
          {
            id: "local-sim-1",
            message: simulateCommitMessage || `${project.project_code || "TASK"}-1 simulated commit`,
            added: ["src/auth/login.js"],
            modified: ["src/pages/Login.jsx"],
            removed: [],
          },
        ],
      };

      const res = await api.post(`/integrations/git/simulate/${provider}/push`, payload);
      setSimulationResult(res.data || null);
      toast.success("Simulation completed");
      await loadEvents();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.details || "Simulation failed";
      toast.error(msg);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <Modal.Header>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary-600" />
            <Modal.Title>Git Automation - {projectName}</Modal.Title>
          </div>
          <Badge color={settings.enabled ? "success" : "neutral"} size="sm" variant="subtle">
            {settings.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold theme-text">Project Automation Settings</h3>

            {loading ? (
              <p className="text-sm theme-text-muted">Loading settings...</p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm theme-text">
                    <input
                      type="checkbox"
                      checked={settings.enabled}
                      onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
                    />
                    Enable Git automation for this project
                  </label>
                  <label className="flex items-center gap-2 text-sm theme-text">
                    <input
                      type="checkbox"
                      checked={settings.autoStatusEnabled}
                      onChange={(e) => setSettings((s) => ({ ...s, autoStatusEnabled: e.target.checked }))}
                    />
                    Auto-update task status from pushes
                  </label>
                  <label className="flex items-center gap-2 text-sm theme-text">
                    <input
                      type="checkbox"
                      checked={settings.autoInferTasks}
                      onChange={(e) => setSettings((s) => ({ ...s, autoInferTasks: e.target.checked }))}
                    />
                    Auto-infer tasks from code changes (no manual task key required)
                  </label>
                  <label className="flex items-center gap-2 text-sm theme-text">
                    <input
                      type="checkbox"
                      checked={settings.autoCompleteOnProd}
                      onChange={(e) => setSettings((s) => ({ ...s, autoCompleteOnProd: e.target.checked }))}
                    />
                    Mark completed on prod branch transition
                  </label>
                  <label className="flex items-center gap-2 text-sm theme-text">
                    <input
                      type="checkbox"
                      checked={settings.requireTaskKey}
                      onChange={(e) => setSettings((s) => ({ ...s, requireTaskKey: e.target.checked }))}
                    />
                    Require explicit task keys in branch/commits
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Inference confidence (30-95)"
                    type="number"
                    min={30}
                    max={95}
                    value={settings.minInferenceConfidence}
                    onChange={(e) => setSettings((s) => ({ ...s, minInferenceConfidence: e.target.value }))}
                  />
                  <Input
                    label="Max inferred tasks per push"
                    type="number"
                    min={1}
                    max={8}
                    value={settings.maxInferredTasks}
                    onChange={(e) => setSettings((s) => ({ ...s, maxInferredTasks: e.target.value }))}
                  />
                </div>

                <Input
                  label="Repository (org/repo)"
                  value={settings.repoFullName}
                  onChange={(e) => setSettings((s) => ({ ...s, repoFullName: e.target.value }))}
                  placeholder="example-org/platform-web"
                />

                <Input
                  label="Environment sequence (comma-separated)"
                  value={settings.environmentSequenceText}
                  onChange={(e) => setSettings((s) => ({ ...s, environmentSequenceText: e.target.value }))}
                  placeholder="dev, qa, stage, uat, prod"
                  helperText="Statuses are created in this order for non-prod environments"
                />

                <div>
                  <label className="block text-sm font-medium theme-text mb-1.5">Branch to Environment Map (JSON)</label>
                  <textarea
                    rows={7}
                    className="w-full theme-input border theme-border rounded-lg px-3 py-2 text-sm font-mono"
                    value={settings.branchMapText}
                    onChange={(e) => setSettings((s) => ({ ...s, branchMapText: e.target.value }))}
                    placeholder='{"develop":"dev","staging":"stage","main":"prod"}'
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={handleAutoConfigureAll} loading={autoConfiguring} disabled={!canManage} variant="secondary" size="sm">
                    Auto-configure All Projects
                  </Button>
                  <Button onClick={handleSave} loading={saving} disabled={!canManage} variant="primary" size="sm">
                    Save Settings
                  </Button>
                  <Button onClick={loadSettings} variant="secondary" size="sm" leftIcon={<RefreshCcw className="w-4 h-4" />}>
                    Reload
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold theme-text">Simulation & Event History</h3>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs theme-text-muted mb-1">Provider</label>
                  <select
                    className="w-full theme-input border theme-border rounded-lg px-2 py-2 text-sm"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                  >
                    <option value="github">github</option>
                    <option value="gitlab">gitlab</option>
                    <option value="bitbucket">bitbucket</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs theme-text-muted mb-1">Branch</label>
                  <input
                    className="w-full theme-input border theme-border rounded-lg px-2 py-2 text-sm"
                    value={simulateBranch}
                    onChange={(e) => setSimulateBranch(e.target.value)}
                    placeholder="develop"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Commit message</label>
                <input
                  className="w-full theme-input border theme-border rounded-lg px-2 py-2 text-sm"
                  value={simulateCommitMessage}
                  onChange={(e) => setSimulateCommitMessage(e.target.value)}
                  placeholder="Implement login validation and auth retry"
                />
              </div>
              <Button onClick={handleSimulate} loading={simulating} size="sm" variant="secondary" leftIcon={<Play className="w-4 h-4" />}>
                Run Simulation
              </Button>

              {simulationResult && (
                <div className="text-xs rounded-md border theme-border p-2 theme-surface-soft space-y-1 theme-text">
                  <div>Applied: {simulationResult.appliedCount || 0}</div>
                  <div>Linked: {simulationResult.linkedTasks || 0}</div>
                  <div>Skipped: {simulationResult.skippedCount || 0}</div>
                  {Array.isArray(simulationResult.applied) && simulationResult.applied.length > 0 && (
                    <div className="pt-1">
                      <div className="font-medium">Applied tasks:</div>
                      {simulationResult.applied.slice(0, 5).map((a, i) => (
                        <div key={`applied-${i}`}>
                          - {a.taskName} ({a.from} to {a.to}) {a.inferred ? `(inferred${a.confidence ? ` ${a.confidence}%` : ""})` : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium theme-text">
                  <Activity className="w-4 h-4" />
                  Recent Git Automation Events
                </div>
                <Button variant="ghost" size="xs" onClick={loadEvents}>Refresh</Button>
              </div>
              {loadingEvents ? (
                <p className="text-sm theme-text-muted">Loading events...</p>
              ) : events.length === 0 ? (
                <p className="text-sm theme-text-muted">No events yet.</p>
              ) : (
                <div className="max-h-64 overflow-auto space-y-2">
                  {events.map((ev) => (
                    <div key={ev.id || `${ev.provider}-${ev.created_at}`} className="border rounded-md p-2 text-xs">
                      <div className="font-medium">{ev.repo_full_name || "repo"} - {ev.branch_name || "branch"}</div>
                      <div className="theme-text-muted">{new Date(ev.created_at).toLocaleString()}</div>
                      <div>Applied {ev.applied_task_count || 0}, Linked {ev.linked_task_count || 0}, Skipped {ev.skipped_task_count || 0}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}
