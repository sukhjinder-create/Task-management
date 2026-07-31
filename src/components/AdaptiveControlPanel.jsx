import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Activity, Archive, Pause, Play, Plus, RefreshCw, Settings2 } from "lucide-react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { Badge, Button, Card } from "./ui";

const ADMIN_ROLES = new Set(["admin", "owner"]);
const FALLBACK_EVENTS = [
  { value: "TASK_CREATED", label: "Task created" },
  { value: "TASK_UPDATED", label: "Task updated" },
  { value: "TASK_STATUS_CHANGED", label: "Task status changed" },
  { value: "TASK_ASSIGNED", label: "Task assigned" },
  { value: "TASK_DELETED", label: "Task deleted" },
  { value: "PROJECT_CREATED", label: "Project created" },
  { value: "PROJECT_UPDATED", label: "Project updated" },
  { value: "MEETING_ENDED", label: "Meeting ended" },
  { value: "MEETING_INTELLIGENCE_UPDATED", label: "Meeting intelligence ready" },
  { value: "LEAVE_APPROVED", label: "Leave approved" },
  { value: "WORKSPACE_SCORE_CHANGED", label: "Workspace score changed" },
];
const FALLBACK_CAPABILITIES = [
  { value: "notification.send", label: "Notify accountable people" },
  { value: "task.create", label: "Create follow-up work" },
  { value: "workspace_memory.create", label: "Save operating memory" },
  { value: "autopilot.analyze", label: "Analyze delivery risk" },
  { value: "testing_agent.run_task", label: "Validate with Testing Agent" },
  { value: "executive_summary.generate", label: "Refresh executive context" },
];
const FALLBACK_OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "exists", label: "exists" },
];

function capabilityInput(capabilityKey, name) {
  const title = name || "Smart automation action";
  if (capabilityKey === "notification.send") return { userId: "{{event.actorUserId}}", message: `Workflow: ${title}` };
  if (capabilityKey === "task.create") return { title, projectId: "{{context.data.operationalGraph.relevance.projectId}}", addedBy: "{{event.actorUserId}}" };
  if (capabilityKey === "workspace_memory.create") return { title, content: "{{context.data.operationalGraph.meetings.0.digest_json.summary}}", userId: "{{event.actorUserId}}" };
  if (capabilityKey === "autopilot.analyze") return { projectId: "{{context.data.operationalGraph.relevance.projectId}}" };
  if (capabilityKey === "testing_agent.run_task") return { taskId: "{{context.data.task.id}}" };
  if (capabilityKey === "executive_summary.generate") return { range: "30d" };
  return {};
}

function conditionValue(form, conditionFields) {
  if (form.operator === "exists") return form.value !== "false";
  if (["in", "not_in"].includes(form.operator)) {
    return String(form.value || "").split(",").map((value) => value.trim()).filter(Boolean);
  }
  const field = conditionFields.find((item) => item.path === form.path);
  if (field?.type === "number") {
    const value = Number(form.value);
    return Number.isFinite(value) ? value : form.value;
  }
  return form.value;
}

function modeLabel(mode) {
  return ({ off: "Off", shadow: "Observe only", assist: "Suggest + approve", auto: "Safe automatic" })[mode] || mode;
}

function reasonLabel(reason) {
  return ({
    worker_disabled: "Background worker is not running",
    queue_lag_slo_exceeded: "Event queue is behind",
    dead_letters_present: "Some events need retry",
    context_providers_degraded: "Business context is incomplete",
  })[reason] || String(reason || "").replace(/_/g, " ");
}

export default function AdaptiveControlPanel() {
  const api = useApi();
  const { auth } = useAuth();
  const canAdminister = ADMIN_ROLES.has(auth?.user?.role);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [runs, setRuns] = useState([]);
  const [plans, setPlans] = useState([]);
  const [workflowRuns, setWorkflowRuns] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [settings, setSettings] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [form, setForm] = useState({
    name: "",
    eventType: "TASK_UPDATED",
    path: "",
    operator: "equals",
    value: "",
    capabilityKey: "notification.send",
    approvalMode: "approval_required",
  });

  const load = useCallback(async () => {
    if (!canAdminister) return;
    const [statusResponse, workflowResponse, workflowRunResponse, runResponse, planResponse, catalogResponse, settingsResponse] = await Promise.all([
      api.get("/adaptive/status"),
      api.get("/adaptive/workflows"),
      api.get("/adaptive/workflows/runs", { params: { limit: 12 } }),
      api.get("/adaptive/observability/runs", { params: { limit: 5 } }),
      api.get("/adaptive/observability/plans", { params: { limit: 5 } }),
      api.get("/adaptive/workflow-catalog"),
      api.get("/adaptive/settings"),
    ]);
    setStatus(statusResponse.data);
    setWorkflows(workflowResponse.data?.workflows || []);
    setWorkflowRuns(workflowRunResponse.data?.runs || []);
    setRuns(runResponse.data?.runs || []);
    setPlans(planResponse.data?.plans || []);
    setCatalog(catalogResponse.data || null);
    setSettings(settingsResponse.data || null);
  }, [api, canAdminister]);

  useEffect(() => {
    if (open) load().catch(() => toast.error("Could not load smart automation controls"));
  }, [open, load]);

  const healthColor = status?.status === "available" ? "success" : status?.status === "degraded" ? "warning" : "danger";
  const queueLag = Number(status?.eventQueue?.oldestLagSeconds || 0);
  const eventOptions = catalog?.events?.length ? catalog.events : FALLBACK_EVENTS;
  const capabilityOptions = catalog?.capabilities?.length
    ? catalog.capabilities.map((item) => ({ value: item.value, label: item.label }))
    : FALLBACK_CAPABILITIES;
  const operators = catalog?.operators?.length ? catalog.operators : FALLBACK_OPERATORS;
  const conditionFields = catalog?.conditionFields || [];
  const capabilityLabel = (key) => capabilityOptions.find((item) => item.value === key)?.label || key;
  const latestWorkflows = useMemo(() => {
    const latest = new Map();
    for (const workflow of workflows) {
      if (!latest.has(workflow.workflow_key)) latest.set(workflow.workflow_key, workflow);
    }
    return Array.from(latest.values()).sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at));
  }, [workflows]);
  const latestRunByWorkflow = useMemo(() => {
    const latest = new Map();
    for (const run of workflowRuns) {
      if (!latest.has(run.workflow_definition_id)) latest.set(run.workflow_definition_id, run);
    }
    return latest;
  }, [workflowRuns]);

  const updateForm = (patch) => {
    setSelectedTemplate(null);
    setForm((current) => ({ ...current, ...patch }));
  };

  const steps = useMemo(() => {
    if (selectedTemplate?.definition?.steps?.length) return selectedTemplate.definition.steps;
    const result = [{ type: "WHEN", eventTypes: [form.eventType] }];
    if (form.path.trim()) result.push({ type: "IF", path: form.path.trim(), operator: form.operator, value: conditionValue(form, conditionFields) });
    result.push({ type: "APPROVAL", mode: form.approvalMode });
    result.push({
      type: "THEN",
      capabilityKey: form.capabilityKey,
      title: form.name || "Smart automation action",
      input: capabilityInput(form.capabilityKey, form.name),
    });
    result.push({ type: "END" });
    return result;
  }, [conditionFields, form, selectedTemplate]);

  const ensureRuntimeReady = async () => {
    if (settings?.workflow_enabled && settings?.mode !== "off") return settings;
    const response = await api.put("/adaptive/settings", {
      workflowEnabled: true,
      ...(settings?.mode === "off" ? { mode: "assist" } : {}),
    });
    setSettings(response.data);
    return response.data;
  };

  const save = async (targetStatus = "draft") => {
    if (!form.name.trim()) return toast.error("Workflow name is required");
    setSaving(true);
    try {
      if (targetStatus === "active") await ensureRuntimeReady();
      const workflowKey = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      await api.post("/adaptive/workflows", { workflowKey, name: form.name.trim(), definition: { steps }, status: targetStatus });
      toast.success(targetStatus === "active" ? "Rule activated" : "Rule saved as draft");
      setForm((current) => ({ ...current, name: "" }));
      setSelectedTemplate(null);
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Could not save workflow");
    } finally {
      setSaving(false);
    }
  };

  const changeWorkflowStatus = async (workflow, nextStatus) => {
    setBusyAction(`${workflow.id}:${nextStatus}`);
    try {
      if (nextStatus === "active") await ensureRuntimeReady();
      await api.patch(`/adaptive/workflows/${workflow.id}/status`, { status: nextStatus });
      toast.success(nextStatus === "active" ? "Rule activated" : nextStatus === "paused" ? "Rule paused" : "Rule archived");
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Could not update rule");
    } finally {
      setBusyAction(null);
    }
  };

  const updateRuntime = async (patch) => {
    setBusyAction("runtime");
    try {
      const response = await api.put("/adaptive/settings", patch);
      setSettings(response.data);
      toast.success("Automation controls updated");
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Could not update automation controls");
    } finally {
      setBusyAction(null);
    }
  };

  const processQueue = async () => {
    setBusyAction("queue");
    try {
      const response = await api.post("/adaptive/worker/run-once", { limit: 25 });
      const processed = (response.data?.events || []).filter((item) => item.status === "completed").length;
      toast.success(processed ? `Processed ${processed} queued event${processed === 1 ? "" : "s"}` : "Queue is already caught up");
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Could not process the queue");
    } finally {
      setBusyAction(null);
    }
  };

  const retryDeadLetters = async () => {
    setBusyAction("retry");
    try {
      const response = await api.post("/adaptive/events/dead-letters/retry", { limit: 100 });
      toast.success(`${response.data?.retried || 0} event${response.data?.retried === 1 ? "" : "s"} queued for retry`);
      await processQueue();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Could not retry failed events");
      setBusyAction(null);
    }
  };

  if (!canAdminister) return null;
  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[color:var(--primary)]" />
          <span className="text-sm font-semibold text-[color:var(--text)]">Smart automations</span>
          {status && <Badge color={healthColor} variant="subtle">{status.status}</Badge>}
          {status && (
            <span className="text-[11px] text-[color:var(--text-muted)]">
              {status.eventQueue?.pending || 0} waiting · Queue lag {queueLag}s · {status.eventQueue?.deadLetters || 0} failed
            </span>
          )}
        </div>
        <Button size="xs" variant="ghost" onClick={() => setOpen((value) => !value)} leftIcon={<Settings2 className="h-3 w-3" />}>
          {open ? "Close" : "Rules"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 border-t border-[color:var(--border)] pt-3">
          <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[color:var(--text)]">Automation controls</p>
                <p className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">
                  {settings?.workflow_enabled ? `${modeLabel(settings?.mode)} mode is enabled.` : "Rules are currently disabled."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  aria-label="Automation mode"
                  className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px]"
                  value={settings?.mode || "off"}
                  disabled={busyAction === "runtime"}
                  onChange={(event) => updateRuntime({ mode: event.target.value })}
                >
                  <option value="shadow">Observe only</option>
                  <option value="assist">Suggest + approve</option>
                  <option value="auto">Safe automatic</option>
                  <option value="off">Off</option>
                </select>
                <Button size="xs" variant="secondary" loading={busyAction === "runtime"} onClick={() => updateRuntime({ workflowEnabled: !settings?.workflow_enabled })}>
                  {settings?.workflow_enabled ? "Disable rules" : "Enable rules"}
                </Button>
                <Button size="xs" variant="secondary" loading={busyAction === "queue"} onClick={processQueue} leftIcon={<Play className="h-3 w-3" />}>
                  Process queue
                </Button>
                {(status?.eventQueue?.deadLetters || 0) > 0 && (
                  <Button size="xs" variant="secondary" loading={busyAction === "retry"} onClick={retryDeadLetters} leftIcon={<RefreshCw className="h-3 w-3" />}>
                    Retry failed
                  </Button>
                )}
                <Button size="xs" variant="ghost" disabled={Boolean(busyAction)} onClick={() => load()} leftIcon={<RefreshCw className="h-3 w-3" />}>Refresh</Button>
              </div>
            </div>
            {status?.degradedReasons?.length > 0 && (
              <p className="mt-2 text-[11px] text-amber-600">Needs attention: {status.degradedReasons.map(reasonLabel).join("; ")}.</p>
            )}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-[color:var(--text)]">When · Only if · Ask approval · Take action · Finish</p>
              <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Build simple operating rules from business events and registered platform capabilities.</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs" placeholder="Rule name" value={form.name} onChange={(event) => updateForm({ name: event.target.value })} />
                <select className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs" value={form.eventType} onChange={(event) => updateForm({ eventType: event.target.value })}>
                  {eventOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <select
                  className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
                  value={form.path}
                  onChange={(event) => {
                    const field = conditionFields.find((item) => item.path === event.target.value);
                    updateForm({ path: event.target.value, ...(field?.type === "exists" ? { operator: "exists", value: "true" } : {}) });
                  }}
                >
                  <option value="">No condition</option>
                  {conditionFields.map((item) => <option key={item.path} value={item.path}>{item.label}</option>)}
                </select>
                <select className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs" value={form.operator} disabled={!form.path} onChange={(event) => updateForm({ operator: event.target.value })}>
                  {operators.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {form.operator === "exists" ? (
                  <select className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs" value={form.value || "true"} disabled={!form.path} onChange={(event) => updateForm({ value: event.target.value })}>
                    <option value="true">Value exists</option>
                    <option value="false">Value is missing</option>
                  </select>
                ) : (
                  <input
                    className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
                    placeholder={["in", "not_in"].includes(form.operator) ? "Values separated by commas" : "Condition value"}
                    value={form.value}
                    disabled={!form.path}
                    onChange={(event) => updateForm({ value: event.target.value })}
                  />
                )}
                <select className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs" value={form.capabilityKey} onChange={(event) => updateForm({ capabilityKey: event.target.value })}>
                  {capabilityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <select className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs" value={form.approvalMode} onChange={(event) => updateForm({ approvalMode: event.target.value })}>
                  <option value="approval_required">Approval required</option>
                  <option value="manual_only">Manual only</option>
                  <option value="automatic">Automatic when policy allows</option>
                </select>
              </div>
              {catalog?.templates?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {catalog.templates.slice(0, 3).map((template) => (
                    <button
                      key={template.key}
                      type="button"
                      className={`rounded-full border px-2 py-1 text-[11px] ${selectedTemplate?.key === template.key ? "border-[color:var(--primary)] text-[color:var(--primary)]" : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]"}`}
                      onClick={() => {
                        const templateSteps = template.definition?.steps || [];
                        const when = templateSteps.find((step) => step.type === "WHEN");
                        const condition = templateSteps.find((step) => step.type === "IF");
                        const approval = templateSteps.find((step) => step.type === "APPROVAL");
                        const then = templateSteps.find((step) => step.type === "THEN");
                        setSelectedTemplate(template);
                        setForm((current) => ({
                          ...current,
                          name: template.name,
                          eventType: when?.eventTypes?.[0] || current.eventType,
                          path: condition?.path || "",
                          operator: condition?.operator || "equals",
                          value: Array.isArray(condition?.value) ? condition.value.join(", ") : String(condition?.value ?? ""),
                          approvalMode: approval?.mode || "approval_required",
                          capabilityKey: then?.capabilityKey || current.capabilityKey,
                        }));
                      }}
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="xs" variant="secondary" onClick={() => save("draft")} loading={saving} leftIcon={<Plus className="h-3 w-3" />}>Save draft</Button>
                <Button size="xs" onClick={() => save("active")} loading={saving} leftIcon={<Play className="h-3 w-3" />}>Save &amp; activate</Button>
              </div>
              <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                Selected action: {capabilityLabel(form.capabilityKey)}{selectedTemplate ? " · The complete template will be saved." : ""}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-[color:var(--text)]">Rules</p>
              <div className="mt-2 space-y-2">
                {latestWorkflows.slice(0, 6).map((workflow) => {
                  const lastRun = latestRunByWorkflow.get(workflow.id);
                  return (
                    <div key={workflow.id} className="rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-[color:var(--text)]">{workflow.name}</span>
                          {lastRun && <p className="mt-0.5 text-[10px] text-[color:var(--text-muted)]">Last run: {lastRun.status.replace(/_/g, " ")}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge color={workflow.status === "active" ? "success" : workflow.status === "paused" ? "warning" : "neutral"} variant="subtle">{workflow.status}</Badge>
                          {workflow.status !== "active" && workflow.status !== "archived" && (
                            <Button size="xs" variant="ghost" loading={busyAction === `${workflow.id}:active`} onClick={() => changeWorkflowStatus(workflow, "active")} leftIcon={<Play className="h-3 w-3" />}>Activate</Button>
                          )}
                          {workflow.status === "active" && (
                            <Button size="xs" variant="ghost" loading={busyAction === `${workflow.id}:paused`} onClick={() => changeWorkflowStatus(workflow, "paused")} leftIcon={<Pause className="h-3 w-3" />}>Pause</Button>
                          )}
                          {workflow.status !== "archived" && (
                            <Button size="xs" variant="ghost" loading={busyAction === `${workflow.id}:archived`} onClick={() => changeWorkflowStatus(workflow, "archived")} leftIcon={<Archive className="h-3 w-3" />}>Archive</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!latestWorkflows.length && <p className="text-xs text-[color:var(--text-muted)]">No rules yet. Start with one clear operational rule.</p>}
              </div>
              <p className="mt-3 text-xs font-semibold text-[color:var(--text)]">Recent background analysis</p>
              <div className="mt-2 space-y-2">
                {runs.slice(0, 3).map((run) => (
                  <div key={run.id} className="rounded-lg border border-[color:var(--border)] px-3 py-2 text-[11px]">
                    <div className="flex justify-between gap-2">
                      <span>{run.reasoning_summary || run.trigger_type}</span>
                      <Badge color={run.status === "completed" ? "success" : "warning"} variant="subtle">{run.status}</Badge>
                    </div>
                    <span className="text-[color:var(--text-muted)]">{run.recommendation_count || 0} recommendations · {run.timings?.totalMs || 0}ms</span>
                  </div>
                ))}
                {plans.length > 0 && <p className="text-[11px] text-[color:var(--text-muted)]">{plans.length} recent coordinated execution plan(s) are fully auditable.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
