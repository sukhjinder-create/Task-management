import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Activity, Plus, Settings2 } from "lucide-react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { Badge, Button, Card } from "./ui";

const ADMIN_ROLES = new Set(["admin", "owner"]);
const FALLBACK_EVENTS = [
  { value: "TASK_UPDATED", label: "Task updated" },
  { value: "TASK_BLOCKED", label: "Task blocked" },
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
  if (capabilityKey === "workspace_memory.create") return { title, content: "{{event.metadata.summary}}", userId: "{{event.actorUserId}}" };
  if (capabilityKey === "autopilot.analyze") return { projectId: "{{context.data.operationalGraph.relevance.projectId}}" };
  if (capabilityKey === "testing_agent.run_task") return { taskId: "{{context.data.task.id}}" };
  if (capabilityKey === "executive_summary.generate") return { range: "30d" };
  return {};
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
  const [catalog, setCatalog] = useState(null);
  const [saving, setSaving] = useState(false);
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
    const [statusResponse, workflowResponse, runResponse, planResponse, catalogResponse] = await Promise.all([
      api.get("/adaptive/status"),
      api.get("/adaptive/workflows"),
      api.get("/adaptive/observability/runs", { params: { limit: 5 } }),
      api.get("/adaptive/observability/plans", { params: { limit: 5 } }),
      api.get("/adaptive/workflow-catalog"),
    ]);
    setStatus(statusResponse.data);
    setWorkflows(workflowResponse.data?.workflows || []);
    setRuns(runResponse.data?.runs || []);
    setPlans(planResponse.data?.plans || []);
    setCatalog(catalogResponse.data || null);
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

  const steps = useMemo(() => {
    const result = [{ type: "WHEN", eventTypes: [form.eventType] }];
    if (form.path.trim()) result.push({ type: "IF", path: form.path.trim(), operator: form.operator, value: form.value });
    result.push({ type: "APPROVAL", mode: form.approvalMode });
    result.push({
      type: "THEN",
      capabilityKey: form.capabilityKey,
      title: form.name || "Smart automation action",
      input: capabilityInput(form.capabilityKey, form.name),
    });
    result.push({ type: "END" });
    return result;
  }, [form]);

  const save = async () => {
    if (!form.name.trim()) return toast.error("Workflow name is required");
    setSaving(true);
    try {
      const workflowKey = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      await api.post("/adaptive/workflows", { workflowKey, name: form.name.trim(), definition: { steps }, status: "draft" });
      toast.success("Rule saved as draft");
      setForm((current) => ({ ...current, name: "" }));
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Could not save workflow");
    } finally {
      setSaving(false);
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
          {status && <span className="text-[11px] text-[color:var(--text-muted)]">Queue lag {queueLag}s · {status.eventQueue?.deadLetters || 0} dead letters</span>}
        </div>
        <Button size="xs" variant="ghost" onClick={() => setOpen((value) => !value)} leftIcon={<Settings2 className="h-3 w-3" />}>
          {open ? "Close" : "Rules"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 grid gap-3 border-t border-[color:var(--border)] pt-3 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-[color:var(--text)]">When · Only if · Ask approval · Take action · Finish</p>
            <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Build simple operating rules from business events and registered platform capabilities.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs" placeholder="Rule name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <select className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs" value={form.eventType} onChange={(event) => setForm({ ...form, eventType: event.target.value })}>
                {eventOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs" value={form.path} onChange={(event) => setForm({ ...form, path: event.target.value })}>
                <option value="">No condition</option>
                {conditionFields.map((item) => <option key={item.path} value={item.path}>{item.label}</option>)}
              </select>
              <select className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs" value={form.operator} onChange={(event) => setForm({ ...form, operator: event.target.value })}>
                {operators.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <input className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs" placeholder="Condition value" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
              <select className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs" value={form.capabilityKey} onChange={(event) => setForm({ ...form, capabilityKey: event.target.value })}>
                {capabilityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs" value={form.approvalMode} onChange={(event) => setForm({ ...form, approvalMode: event.target.value })}>
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
                    className="rounded-full border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
                    onClick={() => {
                      const when = template.definition?.steps?.find((step) => step.type === "WHEN");
                      const then = template.definition?.steps?.find((step) => step.type === "THEN");
                      setForm((current) => ({
                        ...current,
                        name: template.name,
                        eventType: when?.eventTypes?.[0] || current.eventType,
                        capabilityKey: then?.capabilityKey || current.capabilityKey,
                      }));
                    }}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            )}
            <Button className="mt-2" size="xs" onClick={save} loading={saving} leftIcon={<Plus className="h-3 w-3" />}>Save draft</Button>
            <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Selected action: {capabilityLabel(form.capabilityKey)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[color:var(--text)]">Rule history</p>
            <div className="mt-2 space-y-2">
              {workflows.slice(0, 6).map((workflow) => (
                <div key={workflow.id} className="flex items-center justify-between rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs">
                  <span>{workflow.name}</span>
                  <Badge color={workflow.status === "active" ? "success" : "neutral"} variant="subtle">{workflow.status}</Badge>
                </div>
              ))}
              {!workflows.length && <p className="text-xs text-[color:var(--text-muted)]">No rules yet. Start with one clear operational rule.</p>}
            </div>
            <p className="mt-3 text-xs font-semibold text-[color:var(--text)]">Recent decisions</p>
            <div className="mt-2 space-y-2">
              {runs.slice(0, 3).map((run) => (
                <div key={run.id} className="rounded-lg border border-[color:var(--border)] px-3 py-2 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <span>{run.reasoning_summary || run.trigger_type}</span>
                    <Badge color={run.status === "completed" ? "success" : "warning"} variant="subtle">{run.status}</Badge>
                  </div>
                  <span className="text-[color:var(--text-muted)]">{run.recommendation_count || 0} actions · {run.timings?.totalMs || 0}ms</span>
                </div>
              ))}
              {plans.length > 0 && <p className="text-[11px] text-[color:var(--text-muted)]">{plans.length} recent coordinated execution plan(s) are fully auditable.</p>}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
