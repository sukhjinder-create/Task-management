import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Check,
  Clock3,
  Command,
  Compass,
  FileSearch,
  Loader2,
  MemoryStick,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from "../components/ui";

const DIGEST_SECTIONS = [
  { key: "priorities", label: "Priorities" },
  { key: "people", label: "People" },
  { key: "approvals", label: "Approvals" },
  { key: "risks", label: "Risks" },
];

const EMPTY_MEMORY_FORM = {
  title: "",
  content: "",
  tags: "",
  visibility: "workspace",
  isPinned: false,
};

function formatDateTime(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString();
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString();
}

function statusColor(value) {
  const v = String(value || "").toLowerCase();
  if (["executed", "approved", "success"].includes(v)) return "success";
  if (["rejected", "high", "critical", "danger", "error"].includes(v)) return "danger";
  if (["pending", "warning", "medium", "in_progress"].includes(v)) return "warning";
  return "neutral";
}

function parseTags(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--primary)] border-[var(--primary)] text-white"
          : "theme-surface theme-border theme-text-muted hover:bg-[var(--surface-soft)]",
      ].join(" ")}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

function MetricCard({ label, value, note, color = "neutral" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-text-muted">
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold theme-text">{value}</p>
            {note ? <p className="mt-2 text-sm theme-text-muted">{note}</p> : null}
          </div>
          <Badge color={color} size="md" variant="subtle">
            Live
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OperationsOS() {
  const api = useApi();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const role = auth?.user?.role;
  const isPrivileged = role === "admin" || role === "owner" || role === "manager";

  const [activeTab, setActiveTab] = useState("command");
  const [bootLoading, setBootLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [commandCenter, setCommandCenter] = useState(null);
  const [dailyOs, setDailyOs] = useState(null);
  const [actions, setActions] = useState([]);
  const [actionStatus, setActionStatus] = useState("pending");
  const [rules, setRules] = useState([]);
  const [automationPreview, setAutomationPreview] = useState(null);
  const [digests, setDigests] = useState(null);
  const [digestPreview, setDigestPreview] = useState(null);
  const [digestHistory, setDigestHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState({ loading: false, results: [], counts: {} });
  const [memoryEntries, setMemoryEntries] = useState([]);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryForm, setMemoryForm] = useState(EMPTY_MEMORY_FORM);
  const [memoryEditId, setMemoryEditId] = useState(null);

  const [busyActionId, setBusyActionId] = useState(null);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [savingDigest, setSavingDigest] = useState(false);
  const [generatingDigest, setGeneratingDigest] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);

  const digestSections = useMemo(
    () => new Set(digests?.include_sections || []),
    [digests]
  );

  async function loadActions(status = actionStatus) {
    const res = await api.get("/operations/actions", { params: { status, limit: 50 } });
    setActions(res.data?.actions || []);
  }

  async function loadMemory(q = memoryQuery) {
    const res = await api.get("/operations/memory", { params: { q, limit: 25 } });
    setMemoryEntries(res.data?.entries || []);
  }

  async function loadPage({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setBootLoading(true);

    try {
      const requests = [
        api.get("/operations/command-center"),
        api.get("/operations/daily-os"),
        api.get("/operations/actions", { params: { status: actionStatus, limit: 50 } }),
        api.get("/operations/digests/preferences"),
        api.get("/operations/digests/history", { params: { limit: 12 } }),
        api.get("/operations/memory", { params: { limit: 25 } }),
      ];
      if (isPrivileged) requests.push(api.get("/operations/automations/rules"));

      const [
        commandRes,
        dailyRes,
        actionsRes,
        digestPrefRes,
        digestHistoryRes,
        memoryRes,
        rulesRes,
      ] = await Promise.all(requests);

      setCommandCenter(commandRes.data);
      setDailyOs(dailyRes.data);
      setActions(actionsRes.data?.actions || []);
      setDigests(digestPrefRes.data);
      setDigestHistory(digestHistoryRes.data?.history || []);
      setMemoryEntries(memoryRes.data?.entries || []);
      if (rulesRes) setRules(rulesRes.data?.rules || []);
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to load operations workspace");
    } finally {
      setBootLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (bootLoading) return;
    loadActions(actionStatus).catch((error) => {
      toast.error(error?.response?.data?.error || "Failed to refresh actions");
    });
  }, [actionStatus]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadMemory(memoryQuery).catch((error) => {
        toast.error(error?.response?.data?.error || "Failed to load memory");
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [memoryQuery]);

  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) {
      setSearchState({ loading: false, results: [], counts: {} });
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setSearchState((prev) => ({ ...prev, loading: true }));
        const res = await api.get("/operations/search", { params: { q: term } });
        setSearchState({
          loading: false,
          results: res.data?.results || [],
          counts: res.data?.counts || {},
        });
      } catch (error) {
        setSearchState((prev) => ({ ...prev, loading: false }));
        toast.error(error?.response?.data?.error || "Search failed");
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  async function refreshCoreData() {
    await loadPage({ silent: true });
  }

  async function handleActionDecision(actionId, decision, extra = {}) {
    try {
      setBusyActionId(actionId);
      if (decision === "approve") {
        await api.post(`/operations/actions/${actionId}/approve`, extra);
      } else if (decision === "reject") {
        await api.post(`/operations/actions/${actionId}/reject`, extra);
      } else if (decision === "execute") {
        await api.post(`/operations/actions/${actionId}/execute`);
      }
      toast.success("Action updated");
      await refreshCoreData();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Action update failed");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleRulePatch(ruleKey, patch) {
    try {
      const current = rules.find((item) => item.key === ruleKey);
      await api.put(`/operations/automations/rules/${ruleKey}`, {
        enabled: patch.enabled ?? current?.enabled ?? true,
        mode: patch.mode ?? current?.mode ?? "assist",
        config: current?.config || {},
      });
      const res = await api.get("/operations/automations/rules");
      setRules(res.data?.rules || []);
      toast.success("Automation rule updated");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to update automation rule");
    }
  }

  async function handleAutomationRun(mode) {
    try {
      setRunningAutomation(true);
      const endpoint = mode === "preview" ? "/operations/automations/preview" : "/operations/automations/run";
      const res = await api.post(endpoint);
      setAutomationPreview(res.data);
      toast.success(mode === "preview" ? "Preview refreshed" : "Automation run completed");
      if (mode !== "preview") await refreshCoreData();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Automation request failed");
    } finally {
      setRunningAutomation(false);
    }
  }

  async function handleDigestSave(event) {
    event.preventDefault();
    try {
      setSavingDigest(true);
      const res = await api.put("/operations/digests/preferences", {
        enabled: Boolean(digests?.enabled),
        frequency: digests?.frequency || "daily",
        deliveryHour: Number(digests?.delivery_hour ?? 8),
        channel: digests?.channel || "in_app",
        includeSections: Array.from(digestSections),
      });
      setDigests(res.data?.preferences || res.data);
      toast.success("Digest preferences saved");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to save digest preferences");
    } finally {
      setSavingDigest(false);
    }
  }

  async function handleDigestGenerate(mode) {
    try {
      setGeneratingDigest(true);
      const endpoint = mode === "preview" ? "/operations/digests/preview" : "/operations/digests/generate";
      const res = await api.post(endpoint);
      setDigestPreview(res.data);
      if (mode !== "preview") {
        const historyRes = await api.get("/operations/digests/history", { params: { limit: 12 } });
        setDigestHistory(historyRes.data?.history || []);
      }
      toast.success(mode === "preview" ? "Digest preview generated" : "Digest generated");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Digest request failed");
    } finally {
      setGeneratingDigest(false);
    }
  }

  function beginEditMemory(entry) {
    setMemoryEditId(entry.id);
    setMemoryForm({
      title: entry.title || "",
      content: entry.content || "",
      tags: Array.isArray(entry.tags) ? entry.tags.join(", ") : "",
      visibility: entry.visibility || "workspace",
      isPinned: Boolean(entry.is_pinned),
    });
    setActiveTab("memory");
  }

  async function handleMemorySubmit(event) {
    event.preventDefault();
    try {
      setSavingMemory(true);
      const payload = {
        title: memoryForm.title.trim(),
        content: memoryForm.content.trim(),
        tags: parseTags(memoryForm.tags),
        visibility: memoryForm.visibility,
        isPinned: Boolean(memoryForm.isPinned),
      };
      if (!payload.title || !payload.content) {
        toast.error("Title and content are required");
        return;
      }

      if (memoryEditId) {
        await api.put(`/operations/memory/${memoryEditId}`, payload);
      } else {
        await api.post("/operations/memory", payload);
      }
      toast.success(memoryEditId ? "Memory entry updated" : "Memory entry created");
      setMemoryEditId(null);
      setMemoryForm(EMPTY_MEMORY_FORM);
      await loadMemory(memoryQuery);
      await refreshCoreData();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to save memory entry");
    } finally {
      setSavingMemory(false);
    }
  }

  async function handleMemoryDelete(id) {
    try {
      setSavingMemory(true);
      await api.delete(`/operations/memory/${id}`);
      toast.success("Memory entry deleted");
      if (memoryEditId === id) {
        setMemoryEditId(null);
        setMemoryForm(EMPTY_MEMORY_FORM);
      }
      await loadMemory(memoryQuery);
      await refreshCoreData();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to delete memory entry");
    } finally {
      setSavingMemory(false);
    }
  }

  async function handleMemoryPatch(entry, patch) {
    try {
      setSavingMemory(true);
      await api.put(`/operations/memory/${entry.id}`, patch);
      toast.success("Memory entry updated");
      await loadMemory(memoryQuery);
      await refreshCoreData();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to update memory entry");
    } finally {
      setSavingMemory(false);
    }
  }

  function openSearchResult(result) {
    switch (result.type) {
      case "task":
      case "project":
        navigate(result.meta?.projectId ? `/projects/${result.meta.projectId}` : "/projects");
        break;
      case "wiki":
        navigate("/wiki");
        break;
      case "goal":
        navigate("/okr");
        break;
      case "chat":
        navigate("/chat");
        break;
      case "memory": {
        const entry = memoryEntries.find((item) => String(item.id) === String(result.id));
        if (entry) beginEditMemory(entry);
        else setActiveTab("memory");
        break;
      }
      default:
        navigate("/dashboard");
    }
  }

  if (bootLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex min-h-[320px] items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm theme-text-muted">Loading operations workspace...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const posture = commandCenter?.posture || {};
  const scoreCard = posture.scoreCard || {};
  const peopleSignals = commandCenter?.peopleSignals || {};
  const approvals = commandCenter?.approvals || {};

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="overflow-hidden rounded-[28px] border theme-border bg-[linear-gradient(135deg,rgba(14,116,144,0.12),rgba(8,47,73,0.04),rgba(245,158,11,0.08))]">
        <div className="flex flex-col gap-6 px-6 py-8 md:flex-row md:items-end md:justify-between md:px-8">
          <div className="max-w-3xl">
            <Badge color="primary" size="md" variant="subtle">
              <Activity size={14} />
              Operations OS
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight theme-text md:text-4xl">
              One place for command center, approvals, automation, digests, search, and memory.
            </h1>
            <p className="mt-3 text-sm leading-6 theme-text-muted">
              {dailyOs?.narrative || commandCenter?.narrative || "Operations view unavailable."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs theme-text-muted">
              <span>Role: {role}</span>
              <span>Generated: {formatDateTime(commandCenter?.generatedAt)}</span>
              <span>Month: {commandCenter?.month || "Current"}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              leftIcon={<RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />}
              onClick={refreshCoreData}
              disabled={refreshing}
            >
              Refresh
            </Button>
            <Button leftIcon={<ShieldCheck size={16} />} onClick={() => setActiveTab("actions")}>
              Review Actions
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Health Score"
          value={Number.isFinite(posture.healthScore) ? posture.healthScore : "--"}
          note={scoreCard.band ? `Band: ${scoreCard.band}` : "No band"}
          color={statusColor(scoreCard.band)}
        />
        <MetricCard
          label="Priority Queue"
          value={commandCenter?.priorities?.length || 0}
          note={`${posture.counts?.overdueTasks || 0} overdue task(s)`}
          color="warning"
        />
        <MetricCard
          label="Pending Approvals"
          value={(approvals.pendingOperationsActions || 0) + (approvals.pendingAutopilotActions || 0)}
          note={`${approvals.pendingOperationsActions || 0} ops, ${approvals.pendingAutopilotActions || 0} autopilot`}
          color="warning"
        />
        <MetricCard
          label="People Signals"
          value={(peopleSignals.absentToday?.length || 0) + (peopleSignals.onLeaveToday?.length || 0)}
          note={`${peopleSignals.absentToday?.length || 0} absent, ${peopleSignals.onLeaveToday?.length || 0} on leave`}
          color={(peopleSignals.absentToday?.length || 0) > 0 ? "danger" : "neutral"}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={activeTab === "command"} onClick={() => setActiveTab("command")} icon={Command} label="Command Center" />
        <TabButton active={activeTab === "daily"} onClick={() => setActiveTab("daily")} icon={Compass} label="Daily OS" />
        <TabButton active={activeTab === "actions"} onClick={() => setActiveTab("actions")} icon={ShieldCheck} label="AI Actions" />
        {isPrivileged ? (
          <TabButton active={activeTab === "automations"} onClick={() => setActiveTab("automations")} icon={Sparkles} label="Automations" />
        ) : null}
        <TabButton active={activeTab === "digests"} onClick={() => setActiveTab("digests")} icon={CalendarClock} label="Digests" />
        <TabButton active={activeTab === "search"} onClick={() => setActiveTab("search")} icon={FileSearch} label="Search" />
        <TabButton active={activeTab === "memory"} onClick={() => setActiveTab("memory")} icon={MemoryStick} label="Memory" />
      </div>

      {activeTab === "command" ? (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Execution Overview</CardTitle>
              <CardDescription>
                Priority queue, people signals, and explainable automation findings in current scope.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-semibold theme-text">
                  {commandCenter?.executiveSummary?.headline || "Command center overview"}
                </p>
                <p className="mt-2 text-sm leading-6 theme-text-muted">
                  {commandCenter?.executiveSummary?.narrative || commandCenter?.narrative}
                </p>
              </div>

              {(commandCenter?.priorities || []).map((item) => (
                <div key={item.id} className="rounded-xl border theme-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold theme-text">{item.task}</p>
                      <p className="mt-1 text-xs theme-text-muted">
                        {item.project_name || "Project"} • Due {item.due_date ? formatDate(item.due_date) : "No date"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge color={statusColor(item.status)}>{item.status}</Badge>
                      <Badge color={statusColor(item.priority)}>{item.priority || "normal"}</Badge>
                    </div>
                  </div>
                </div>
              ))}

              {!commandCenter?.priorities?.length ? (
                <p className="text-sm theme-text-muted">No priority items in scope right now.</p>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>People and Approvals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[var(--surface-soft)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-text-muted">Absent</p>
                    <p className="mt-2 text-2xl font-semibold theme-text">{peopleSignals.absentToday?.length || 0}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-soft)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-text-muted">On Leave</p>
                    <p className="mt-2 text-2xl font-semibold theme-text">{peopleSignals.onLeaveToday?.length || 0}</p>
                  </div>
                </div>
                <div className="rounded-xl border theme-border p-4">
                  <p className="text-sm font-semibold theme-text">Pending AI suggestions</p>
                  <p className="mt-2 text-sm theme-text-muted">
                    {approvals.pendingOperationsActions || 0} operations actions and {approvals.pendingAutopilotActions || 0} autopilot actions are waiting for review.
                  </p>
                </div>
                {(commandCenter?.automationPreview?.findings || []).slice(0, 3).map((item, index) => (
                  <div key={`${item.ruleKey}-${index}`} className="rounded-xl border theme-border p-4">
                    <p className="text-sm font-semibold theme-text">{item.title}</p>
                    <p className="mt-1 text-xs theme-text-muted">{item.summary}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Memory Highlights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(commandCenter?.memoryHighlights || []).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => beginEditMemory(entry)}
                    className="block w-full rounded-xl border theme-border p-4 text-left transition-colors hover:bg-[var(--surface-soft)]"
                  >
                    <p className="text-sm font-semibold theme-text">{entry.title}</p>
                    <p className="mt-1 text-xs theme-text-muted line-clamp-3">{entry.content}</p>
                  </button>
                ))}
                {!commandCenter?.memoryHighlights?.length ? (
                  <p className="text-sm theme-text-muted">No memory highlights available yet.</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "daily" ? (
        <Card>
          <CardHeader>
            <CardTitle>Daily Operating System</CardTitle>
            <CardDescription>
              What matters now, what needs watching next, and which shared context should shape today.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl bg-[var(--surface-soft)] p-5 xl:col-span-3">
              <p className="text-lg font-semibold theme-text">{dailyOs?.headline || "Daily OS"}</p>
              <p className="mt-3 text-sm leading-6 theme-text-muted">{dailyOs?.narrative}</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold theme-text">Now</p>
              {(dailyOs?.now?.priorities || []).map((item) => (
                <div key={item.id} className="rounded-xl border theme-border p-4">
                  <p className="text-sm font-semibold theme-text">{item.task}</p>
                  <p className="mt-1 text-xs theme-text-muted">{item.project_name || "Project"}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold theme-text">Watchlist</p>
              {(dailyOs?.watchlist?.automation || []).map((item, index) => (
                <div key={`${item.ruleKey}-${index}`} className="rounded-xl border theme-border p-4">
                  <p className="text-sm font-semibold theme-text">{item.title}</p>
                  <p className="mt-1 text-xs theme-text-muted">{item.summary}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold theme-text">Memory</p>
              {(dailyOs?.memory || []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => beginEditMemory(item)}
                  className="block w-full rounded-xl border theme-border p-4 text-left"
                >
                  <p className="text-sm font-semibold theme-text">{item.title}</p>
                  <p className="mt-1 text-xs theme-text-muted line-clamp-3">{item.content}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "actions" ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>AI Trust and Approval Queue</CardTitle>
                <CardDescription>Review, approve, reject, and execute operations suggestions with full visibility.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {["pending", "approved", "executed", "rejected", "all"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setActionStatus(status)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                      actionStatus === status
                        ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                        : "theme-border theme-text-muted hover:bg-[var(--surface-soft)]",
                    ].join(" ")}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {actions.map((action) => (
              <div key={action.id} className="rounded-2xl border theme-border p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge color={statusColor(action.status)}>{action.status}</Badge>
                      <Badge color={statusColor(action.risk_level)}>{action.risk_level || "medium"} risk</Badge>
                      {action.confidence ? (
                        <Badge color="primary">{Math.round(Number(action.confidence) * 100)}% confidence</Badge>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-base font-semibold theme-text">{action.title}</p>
                      <p className="mt-2 text-sm leading-6 theme-text-muted">{action.summary}</p>
                    </div>
                    {action.explanation ? (
                      <p className="text-sm leading-6 theme-text">{action.explanation}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-3 text-xs theme-text-muted">
                      <span>{formatDateTime(action.created_at)}</span>
                      <span>{action.action_type}</span>
                      {action.target_user_name ? <span>{action.target_user_name}</span> : null}
                      {action.project_name ? <span>{action.project_name}</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {isPrivileged && action.status === "pending" ? (
                      <>
                        <Button size="sm" variant="secondary" loading={busyActionId === action.id} leftIcon={<Check size={14} />} onClick={() => handleActionDecision(action.id, "approve", { execute: false })}>
                          Approve
                        </Button>
                        <Button size="sm" loading={busyActionId === action.id} leftIcon={<ArrowRight size={14} />} onClick={() => handleActionDecision(action.id, "approve", { execute: true })}>
                          Approve & Execute
                        </Button>
                        <Button size="sm" variant="danger" loading={busyActionId === action.id} leftIcon={<X size={14} />} onClick={() => handleActionDecision(action.id, "reject")}>
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {isPrivileged && action.status === "approved" ? (
                      <Button size="sm" loading={busyActionId === action.id} leftIcon={<ArrowRight size={14} />} onClick={() => handleActionDecision(action.id, "execute")}>
                        Execute
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {!actions.length ? <p className="text-sm theme-text-muted">No actions in this queue.</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "automations" && isPrivileged ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Cross-Feature Automations</CardTitle>
                  <CardDescription>Rules that coordinate attendance, leave, task risk, and review signals safely.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" loading={runningAutomation} onClick={() => handleAutomationRun("preview")}>Preview</Button>
                  <Button loading={runningAutomation} onClick={() => handleAutomationRun("run")}>Run</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {rules.map((rule) => (
                <div key={rule.key} className="rounded-2xl border theme-border p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-base font-semibold theme-text">{rule.name}</p>
                      <p className="mt-1 text-xs theme-text-muted">{rule.key}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-sm theme-text">
                        <input type="checkbox" checked={Boolean(rule.enabled)} onChange={(event) => handleRulePatch(rule.key, { enabled: event.target.checked })} />
                        Enabled
                      </label>
                      <select value={rule.mode || "assist"} onChange={(event) => handleRulePatch(rule.key, { mode: event.target.value })} className="rounded-lg border theme-border bg-transparent px-3 py-2 text-sm theme-text">
                        <option value="assist">assist</option>
                        <option value="auto">auto</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {Object.entries(rule.config || {}).map(([key, value]) => (
                      <Badge key={key} color="neutral" variant="subtle">{key}: {String(value)}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview Output</CardTitle>
              <CardDescription>Inspect findings before or after a run so the rule outcomes stay understandable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {automationPreview ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <MetricCard label="Findings" value={automationPreview.findings?.length || 0} color="neutral" />
                    <MetricCard label="Generated" value={automationPreview.generated || 0} color="neutral" />
                    <MetricCard label="Created" value={automationPreview.created || 0} color="neutral" />
                  </div>
                  {(automationPreview.findings || []).map((item, index) => (
                    <div key={`${item.ruleKey}-${index}`} className="rounded-xl border theme-border p-4">
                      <p className="text-sm font-semibold theme-text">{item.title}</p>
                      <p className="mt-1 text-xs theme-text-muted">{item.summary}</p>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm theme-text-muted">Run a preview to inspect automation output.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "digests" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Smart Digests</CardTitle>
              <CardDescription>Turn many notifications into one dependable role-aware digest.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleDigestSave}>
                <label className="flex items-center gap-2 text-sm theme-text">
                  <input type="checkbox" checked={Boolean(digests?.enabled)} onChange={(event) => setDigests((prev) => ({ ...prev, enabled: event.target.checked }))} />
                  Enable digest delivery
                </label>
                <div className="grid gap-4 md:grid-cols-3">
                  <select value={digests?.frequency || "daily"} onChange={(event) => setDigests((prev) => ({ ...prev, frequency: event.target.value }))} className="rounded-lg border theme-border bg-transparent px-3 py-2 text-sm theme-text">
                    <option value="daily">daily</option>
                  </select>
                  <Input type="number" min="0" max="23" value={digests?.delivery_hour ?? 8} onChange={(event) => setDigests((prev) => ({ ...prev, delivery_hour: event.target.value }))} />
                  <select value={digests?.channel || "in_app"} onChange={(event) => setDigests((prev) => ({ ...prev, channel: event.target.value }))} className="rounded-lg border theme-border bg-transparent px-3 py-2 text-sm theme-text">
                    <option value="in_app">in_app</option>
                    <option value="email">email</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-3">
                  {DIGEST_SECTIONS.map((section) => (
                    <label key={section.key} className="inline-flex items-center gap-2 text-sm theme-text">
                      <input
                        type="checkbox"
                        checked={digestSections.has(section.key)}
                        onChange={(event) => {
                          const next = new Set(digests?.include_sections || []);
                          if (event.target.checked) next.add(section.key);
                          else next.delete(section.key);
                          setDigests((prev) => ({ ...prev, include_sections: Array.from(next) }));
                        }}
                      />
                      {section.label}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={savingDigest}>Save Preferences</Button>
                  <Button type="button" variant="secondary" loading={generatingDigest} onClick={() => handleDigestGenerate("preview")}>Preview</Button>
                  <Button type="button" loading={generatingDigest} leftIcon={<Clock3 size={16} />} onClick={() => handleDigestGenerate("manual")}>Generate Now</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Digest Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {digestPreview?.digest ? (
                  <>
                    <div className="rounded-xl bg-[var(--surface-soft)] p-4">
                      <p className="text-sm leading-6 theme-text">{digestPreview.digest.summary}</p>
                    </div>
                    <div className="rounded-xl border theme-border p-4">
                      <p className="text-sm font-semibold theme-text">{digestPreview.dailyOs?.headline}</p>
                      <p className="mt-2 text-xs theme-text-muted">{digestPreview.dailyOs?.narrative}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm theme-text-muted">No digest preview generated yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {digestHistory.map((item) => (
                  <div key={item.id} className="rounded-xl border theme-border p-4">
                    <p className="text-sm font-semibold theme-text">{item.digest_type}</p>
                    <p className="mt-1 text-xs theme-text-muted">{item.summary}</p>
                    <p className="mt-2 text-xs theme-text-muted">{item.delivery_mode} • {formatDateTime(item.created_at)}</p>
                  </div>
                ))}
                {!digestHistory.length ? <p className="text-sm theme-text-muted">No digest history yet.</p> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "search" ? (
        <Card>
          <CardHeader>
            <CardTitle>Unified Search</CardTitle>
            <CardDescription>Search tasks, projects, wiki, goals, chat, and memory from a single surface.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search the workspace..." leftIcon={<Search size={16} />} />
            <div className="flex flex-wrap gap-2">
              {Object.entries(searchState.counts || {}).map(([key, value]) => (
                <Badge key={key} color="neutral" variant="subtle">{key}: {value}</Badge>
              ))}
            </div>
            {searchState.loading ? (
              <div className="flex items-center gap-2 text-sm theme-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            ) : null}
            {(searchState.results || []).map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                type="button"
                onClick={() => openSearchResult(result)}
                className="block w-full rounded-2xl border theme-border p-4 text-left transition-colors hover:bg-[var(--surface-soft)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color="primary" variant="subtle">{result.type}</Badge>
                      <p className="text-sm font-semibold theme-text">{result.title}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 theme-text-muted">{result.snippet}</p>
                  </div>
                  <ArrowRight size={16} className="shrink-0 theme-text-muted" />
                </div>
              </button>
            ))}
            {!searchState.loading && searchQuery.trim().length >= 2 && !searchState.results.length ? (
              <p className="text-sm theme-text-muted">No matching records found.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "memory" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>{memoryEditId ? "Edit Memory Entry" : "Create Memory Entry"}</CardTitle>
              <CardDescription>Capture durable context that should shape future work, decisions, and search results.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleMemorySubmit}>
                <Input label="Title" value={memoryForm.title} onChange={(event) => setMemoryForm((prev) => ({ ...prev, title: event.target.value }))} />
                <Textarea label="Content" rows={7} value={memoryForm.content} onChange={(event) => setMemoryForm((prev) => ({ ...prev, content: event.target.value }))} />
                <Input label="Tags" value={memoryForm.tags} onChange={(event) => setMemoryForm((prev) => ({ ...prev, tags: event.target.value }))} helperText="Comma-separated tags" />
                <div className="grid gap-4 md:grid-cols-2">
                  <select value={memoryForm.visibility} onChange={(event) => setMemoryForm((prev) => ({ ...prev, visibility: event.target.value }))} className="rounded-lg border theme-border bg-transparent px-3 py-2 text-sm theme-text">
                    <option value="workspace">workspace</option>
                    <option value="private">private</option>
                  </select>
                  <label className="inline-flex items-center gap-2 text-sm theme-text md:mt-2">
                    <input type="checkbox" checked={Boolean(memoryForm.isPinned)} onChange={(event) => setMemoryForm((prev) => ({ ...prev, isPinned: event.target.checked }))} />
                    Pin this entry
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={savingMemory}>{memoryEditId ? "Update Entry" : "Create Entry"}</Button>
                  {memoryEditId ? (
                    <Button type="button" variant="secondary" onClick={() => { setMemoryEditId(null); setMemoryForm(EMPTY_MEMORY_FORM); }}>
                      Cancel Edit
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Workspace Memory</CardTitle>
                  <CardDescription>Searchable shared memory that feeds the command center and unified search.</CardDescription>
                </div>
                <div className="w-full md:w-72">
                  <Input value={memoryQuery} onChange={(event) => setMemoryQuery(event.target.value)} placeholder="Filter memory..." leftIcon={<Search size={16} />} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {memoryEntries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border theme-border p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {entry.is_pinned ? <Badge color="primary">Pinned</Badge> : null}
                        <Badge color="neutral">{entry.visibility}</Badge>
                        {entry.is_archived ? <Badge color="warning">Archived</Badge> : null}
                      </div>
                      <div>
                        <p className="text-base font-semibold theme-text">{entry.title}</p>
                        <p className="mt-2 text-sm leading-6 theme-text-muted">{entry.content}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(entry.tags || []).map((tag) => (
                          <Badge key={tag} color="neutral" variant="subtle">{tag}</Badge>
                        ))}
                      </div>
                      <p className="text-xs theme-text-muted">
                        {entry.created_by_name || "Unknown"} • Updated {formatDateTime(entry.updated_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => beginEditMemory(entry)}>Edit</Button>
                      <Button size="sm" variant="secondary" loading={savingMemory} onClick={() => handleMemoryPatch(entry, { isPinned: !entry.is_pinned })}>
                        {entry.is_pinned ? "Unpin" : "Pin"}
                      </Button>
                      <Button size="sm" variant="secondary" loading={savingMemory} onClick={() => handleMemoryPatch(entry, { isArchived: !entry.is_archived })}>
                        {entry.is_archived ? "Restore" : "Archive"}
                      </Button>
                      <Button size="sm" variant="danger" loading={savingMemory} onClick={() => handleMemoryDelete(entry.id)}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
              {!memoryEntries.length ? <p className="text-sm theme-text-muted">No memory entries yet.</p> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
