import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Archive,
  Bot,
  Check,
  ClipboardCopy,
  Clock3,
  FileDown,
  FileText,
  Gavel,
  Database,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Radio,
  RotateCcw,
  Search,
  ScrollText,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { useApi } from "../api";

const TABS = [
  { id: "summary", label: "Summary", icon: Sparkles },
  { id: "timeline", label: "Timeline", icon: Clock3 },
  { id: "transcript", label: "Transcript", icon: ScrollText },
  { id: "decisions", label: "Decisions", icon: Gavel },
  { id: "actions", label: "Action items", icon: ListChecks },
  { id: "ownership", label: "Ownership", icon: UserCheck },
  { id: "memory", label: "Memory", icon: Database },
  { id: "copilot", label: "Copilot", icon: Bot },
  { id: "quality", label: "Quality", icon: Radio },
];

function TabIcon({ id }) {
  if (id === "summary") return <Sparkles size={15} />;
  if (id === "timeline") return <Clock3 size={15} />;
  if (id === "transcript") return <ScrollText size={15} />;
  if (id === "decisions") return <Gavel size={15} />;
  if (id === "actions") return <ListChecks size={15} />;
  if (id === "ownership") return <UserCheck size={15} />;
  if (id === "copilot") return <Bot size={15} />;
  if (id === "quality") return <Radio size={15} />;
  return <Database size={15} />;
}

function dateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function timeOnly(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function confidenceLabel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `${Math.round(number * 100)}% confidence`;
}

function artifactContentText(artifactType, content) {
  if (artifactType === "summary") {
    return [
      content.title,
      "Executive Summary",
      content.overview,
      "Discussion Highlights",
      ...(content.discussionHighlights || []).map(
        (item) => `- ${item.speaker || "Participant"}: ${item.text}`
      ),
      "Important Points",
      ...(content.keyPoints || []).map((item) => `- ${item.text}`),
      "Open Questions",
      ...(content.openQuestions || []).map((item) => `- ${item.question}`),
    ].filter(Boolean).join("\n\n");
  }
  if (artifactType === "decision") {
    return (content.decisions || [])
      .map((item) => [item.title, item.decision, item.rationale].filter(Boolean).join("\n"))
      .join("\n\n");
  }
  return (content.actionItems || [])
    .map((item) => [item.title, item.description, item.dueDate && `Due: ${item.dueDate}`].filter(Boolean).join("\n"))
    .join("\n\n");
}

function reportMarkdown(review) {
  const report = review?.report || {};
  const evidence = (ids) =>
    Array.isArray(ids) && ids.length
      ? ` _(Evidence: ${ids.map((id) => `T:${id}`).join(", ")})_`
      : "";
  const lines = [
    `# ${review?.session?.title || "Huddle"}`,
    "",
    `Held ${dateTime(review?.session?.startedAt)}`,
    "",
    "## Participants",
    "",
    ...(review?.participants || []).map(
      (participant) => `- ${participant.displayName}`
    ),
    "",
    "## Executive Summary",
    "",
    report.executiveSummary?.outcome || "No executive summary is available.",
    "",
    "## Discussion Highlights",
    "",
    ...(report.discussionHighlights || []).map(
      (item) =>
        `- **${item.speaker || "Participants"}:** ${item.text}${evidence(item.evidenceSegmentIds)}`
    ),
    "",
    "## Chronological Conversation",
    "",
    ...(report.chronologicalConversation || []).map(
      (item) =>
        `- ${item.occurredAt ? `${timeOnly(item.occurredAt)} - ` : ""}**${item.title || "Discussion"}:** ${item.description || ""}${evidence(item.evidenceSegmentIds)}`
    ),
    "",
    "## Decisions",
    "",
    ...(report.decisions || []).map(
      (item) =>
        `- **${item.title || "Decision"}:** ${item.decision || ""}${item.rationale ? `\n  - Rationale: ${item.rationale}` : ""}${evidence(item.evidenceSegmentIds)}`
    ),
    "",
    "## Action Items",
    "",
    ...(report.actionItems || []).map(
      (item) =>
        `- [ ] **${item.title}**${item.owner?.label ? ` - ${item.owner.label}` : ""}${item.dueDate ? ` - due ${item.dueDate}` : ""}${item.description ? `\n  - ${item.description}` : ""}${evidence(item.evidenceSegmentIds)}`
    ),
    "",
    "## Open Questions",
    "",
    ...(report.openQuestions || []).map(
      (item) => `- ${item.question}${evidence(item.evidenceSegmentIds)}`
    ),
    "",
    "## Risks",
    "",
    ...(report.risks || []).map(
      (item) =>
        `- ${item.text || item.question || item}${evidence(item.evidenceSegmentIds)}`
    ),
    "",
    "## Transcript",
    "",
    ...(review?.transcript || []).map(
      (segment) =>
        `- **${segment.speaker?.label || "Participant"}** (${timeOnly(segment.startedAt)}): ${segment.text} _(T:${segment.id})_`
    ),
  ];
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function ReviewStatus({ artifact }) {
  if (!artifact) return null;
  const approved = artifact.approvalStatus === "approved";
  const rejected = artifact.approvalStatus === "rejected";
  const revoked = artifact.approvalStatus === "revoked";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
      approved
        ? "bg-emerald-500/10 text-emerald-600"
        : rejected || revoked
          ? "bg-red-500/10 text-red-600"
          : "bg-amber-500/10 text-amber-700"
    }`}>
      {approved ? <Check size={13} /> : rejected || revoked ? <X size={13} /> : <Clock3 size={13} />}
      {approved ? "Approved" : revoked ? "Revoked" : rejected ? "Rejected" : "Review required"}
    </span>
  );
}

function Provenance({ artifact }) {
  if (!artifact) return null;
  const provenance = artifact.provenance || {};
  return (
    <details className="mt-5 border-t border-[color:var(--border)] pt-3 text-xs text-[color:var(--text-muted)]">
      <summary className="cursor-pointer font-medium text-[color:var(--text)]">Provenance</summary>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        <div><dt className="font-medium">Provider</dt><dd>{provenance.provider || "Canonical Huddle pipeline"}</dd></div>
        <div><dt className="font-medium">Model</dt><dd>{provenance.model || "Not recorded"}</dd></div>
        <div><dt className="font-medium">Revision</dt><dd>{artifact.currentRevision || 1}</dd></div>
        <div><dt className="font-medium">Generated</dt><dd>{dateTime(provenance.generatedAt || artifact.updatedAt)}</dd></div>
      </dl>
    </details>
  );
}

function EvidenceButton({ ids, onOpen }) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => onOpen(ids)}
      className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--primary)] hover:underline"
    >
      <FileText size={13} />
      {ids.length} source{ids.length === 1 ? "" : "s"}
    </button>
  );
}

function ArtifactActions({ artifact, canReview, canEdit, onEdit, onDecision, busy }) {
  if (!artifact || !canReview) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <button
          type="button"
          onClick={() => onEdit(artifact)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded border border-[color:var(--border)] px-3 py-1.5 text-xs font-medium text-[color:var(--text)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
        >
          <Pencil size={13} /> Edit
        </button>
      )}
      {artifact.approvalStatus !== "approved" && (
        <button
          type="button"
          onClick={() => onDecision(artifact, "approved")}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check size={13} /> Approve
        </button>
      )}
      {artifact.approvalStatus === "approved" ? (
        <button
          type="button"
          onClick={() => onDecision(artifact, "revoked")}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <Archive size={13} /> Revoke
        </button>
      ) : artifact.approvalStatus !== "rejected" && (
        <button
          type="button"
          onClick={() => onDecision(artifact, "rejected")}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <X size={13} /> Reject
        </button>
      )}
    </div>
  );
}

function ArtifactEditor({ artifact, onClose, onSave, saving }) {
  const [content, setContent] = useState(() => structuredClone(artifact.contentJson || {}));
  const updateListItem = (listName, index, field, value) => {
    setContent((current) => ({
      ...current,
      [listName]: (current[listName] || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  return (
    <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/55 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-[var(--surface)] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--text)]">Edit {artifact.artifactType.replace("_", " ")}</h2>
            <p className="text-xs text-[color:var(--text-muted)]">Saving creates a new artifact revision and returns it to review.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-[color:var(--text-muted)]" title="Close">
            <X size={18} />
          </button>
        </div>

        {artifact.artifactType === "summary" && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-[color:var(--text)]">
              Title
              <input
                value={content.title || ""}
                onChange={(event) => setContent({ ...content, title: event.target.value })}
                className="mt-1 w-full rounded border border-[color:var(--border)] bg-transparent px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-[color:var(--text)]">
              Executive summary
              <textarea
                value={content.overview || ""}
                onChange={(event) => setContent({ ...content, overview: event.target.value })}
                rows={7}
                className="mt-1 w-full rounded border border-[color:var(--border)] bg-transparent px-3 py-2"
              />
            </label>
            {(content.keyPoints || []).map((item, index) => (
              <label key={item.id || index} className="block text-sm font-medium text-[color:var(--text)]">
                Key point {index + 1}
                <textarea
                  value={item.text || ""}
                  onChange={(event) => updateListItem("keyPoints", index, "text", event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-[color:var(--border)] bg-transparent px-3 py-2"
                />
              </label>
            ))}
            {(content.discussionHighlights || []).map((item, index) => (
              <div key={item.id || index} className="grid gap-3 border-t border-[color:var(--border)] pt-4 sm:grid-cols-[160px_1fr]">
                <label className="block text-sm font-medium text-[color:var(--text)]">
                  Speaker
                  <input
                    value={item.speaker || ""}
                    onChange={(event) => updateListItem("discussionHighlights", index, "speaker", event.target.value)}
                    className="mt-1 w-full rounded border border-[color:var(--border)] bg-transparent px-3 py-2"
                  />
                </label>
                <label className="block text-sm font-medium text-[color:var(--text)]">
                  Discussion highlight
                  <textarea
                    value={item.text || ""}
                    onChange={(event) => updateListItem("discussionHighlights", index, "text", event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded border border-[color:var(--border)] bg-transparent px-3 py-2"
                  />
                </label>
              </div>
            ))}
            {(content.openQuestions || []).map((item, index) => (
              <label key={item.id || index} className="block text-sm font-medium text-[color:var(--text)]">
                Open question {index + 1}
                <textarea
                  value={item.question || ""}
                  onChange={(event) => updateListItem("openQuestions", index, "question", event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-[color:var(--border)] bg-transparent px-3 py-2"
                />
              </label>
            ))}
          </div>
        )}

        {artifact.artifactType === "decision" && (
          <div className="space-y-5">
            {(content.decisions || []).map((item, index) => (
              <div key={item.id || index} className="border-b border-[color:var(--border)] pb-5 last:border-0">
                {["title", "decision", "rationale"].map((field) => (
                  <label key={field} className="mb-3 block text-sm font-medium capitalize text-[color:var(--text)]">
                    {field}
                    <textarea
                      value={item[field] || ""}
                      onChange={(event) => updateListItem("decisions", index, field, event.target.value)}
                      rows={field === "decision" ? 3 : 2}
                      className="mt-1 w-full rounded border border-[color:var(--border)] bg-transparent px-3 py-2"
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}

        {artifact.artifactType === "action_item" && (
          <div className="space-y-5">
            {(content.actionItems || []).map((item, index) => (
              <div key={item.id || index} className="border-b border-[color:var(--border)] pb-5 last:border-0">
                {["title", "description", "dueDate"].map((field) => (
                  <label key={field} className="mb-3 block text-sm font-medium text-[color:var(--text)]">
                    {field === "dueDate" ? "Due date" : field[0].toUpperCase() + field.slice(1)}
                    {field === "dueDate" ? (
                      <input
                        type="date"
                        value={item[field] || ""}
                        onChange={(event) => updateListItem("actionItems", index, field, event.target.value || null)}
                        className="mt-1 block rounded border border-[color:var(--border)] bg-transparent px-3 py-2"
                      />
                    ) : (
                      <textarea
                        value={item[field] || ""}
                        onChange={(event) => updateListItem("actionItems", index, field, event.target.value)}
                        rows={field === "description" ? 3 : 2}
                        className="mt-1 w-full rounded border border-[color:var(--border)] bg-transparent px-3 py-2"
                      />
                    )}
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-[color:var(--border)] pt-4">
          <button type="button" onClick={onClose} className="rounded border border-[color:var(--border)] px-4 py-2 text-sm">Cancel</button>
          <button
            type="button"
            onClick={() => onSave(content)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[color:var(--primary-contrast)] disabled:opacity-50"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Save revision
          </button>
        </div>
      </section>
    </div>
  );
}

export default function HuddleMeetingIntelligence() {
  const { sessionId } = useParams();
  const api = useApi();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("summary");
  const [evidenceIds, setEvidenceIds] = useState([]);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [taskProjects, setTaskProjects] = useState({});
  const [memoryEditor, setMemoryEditor] = useState(null);
  const [memoryHistory, setMemoryHistory] = useState({});
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotQueries, setCopilotQueries] = useState([]);
  const [quality, setQuality] = useState(null);
  const transcriptRefs = useRef(new Map());

  const load = async () => {
    try {
      const [reviewResponse, projectsResponse, copilotResponse, qualityResponse] =
        await Promise.allSettled([
          api.get(`/huddle/intelligence/sessions/${sessionId}/review`),
          api.get("/projects"),
          api.get(`/huddle/intelligence/sessions/${sessionId}/copilot`),
          api.get(`/huddle/media/livekit/quality/sessions/${sessionId}/summary`),
        ]);
      if (reviewResponse.status !== "fulfilled") throw reviewResponse.reason;
      setReview(reviewResponse.value.data.review);
      if (projectsResponse.status === "fulfilled") {
        const list =
          projectsResponse.value.data?.projects ||
          projectsResponse.value.data ||
          [];
        setProjects(Array.isArray(list) ? list : []);
      }
      if (copilotResponse.status === "fulfilled") {
        setCopilotQueries(copilotResponse.value.data?.queries || []);
      }
      if (qualityResponse.status === "fulfilled") {
        setQuality(qualityResponse.value.data?.quality || null);
      }
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.reason || "Meeting intelligence could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const segmentById = useMemo(
    () => new Map((review?.transcript || []).map((segment) => [segment.id, segment])),
    [review?.transcript]
  );

  const showEvidence = (ids) => {
    setEvidenceIds(ids);
    setActiveTab("transcript");
    window.setTimeout(() => transcriptRefs.current.get(ids[0])?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    }), 80);
  };

  const copyText = async (text, label) => {
    await navigator.clipboard.writeText(text || "");
    toast.success(`${label} copied`);
  };

  const decideArtifact = async (artifact, decision) => {
    setBusyId(artifact.id);
    try {
      const endpoint =
        decision === "approved"
          ? "approve"
          : decision === "revoked"
            ? "revoke"
            : "reject";
      const response = await api.post(`/huddle/artifacts/${artifact.id}/${endpoint}`, {
        approvalNote:
          decision === "approved"
            ? "Approved in Meeting Intelligence"
            : decision === "revoked"
              ? "Approval revoked in Meeting Intelligence"
              : "Rejected in Meeting Intelligence",
        expectedRevision: artifact.currentRevision,
      });
      const updatedArtifact = response.data.artifact;
      setReview((current) => {
        if (!current || !updatedArtifact) return current;
        const artifactKey = {
          summary: "summary",
          decision: "decisions",
          action_item: "actions",
        }[updatedArtifact.artifactType];
        if (!artifactKey) return current;
        const previous = current.artifacts[artifactKey];
        const wasPending = previous?.approvalStatus === "pending";
        const isPending = updatedArtifact.approvalStatus === "pending";
        return {
          ...current,
          artifacts: {
            ...current.artifacts,
            [artifactKey]: updatedArtifact,
          },
          status: {
            ...current.status,
            pendingReviewCount: Math.max(
              0,
              current.status.pendingReviewCount + (isPending ? 1 : 0) - (wasPending ? 1 : 0)
            ),
          },
        };
      });
      toast.success(
        decision === "approved"
          ? "Artifact approved"
          : decision === "revoked"
            ? "Artifact approval revoked"
            : "Artifact rejected"
      );
    } catch (requestError) {
      if (requestError.response?.status === 409) await load();
      toast.error(requestError.response?.data?.reason || "Review could not be saved");
    } finally {
      setBusyId(null);
    }
  };

  const saveArtifact = async (content) => {
    setBusyId(editing.id);
    try {
      await api.patch(`/huddle/artifacts/${editing.id}`, {
        contentJson: content,
        contentText: artifactContentText(editing.artifactType, content),
        approvalStatus: "pending",
        metadata: { editedInMeetingIntelligence: true },
      });
      toast.success("New revision saved");
      setEditing(null);
      await load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.reason || "Revision could not be saved");
    } finally {
      setBusyId(null);
    }
  };

  const decideOwnership = async (item, status, resolvedOwnerUserId = null) => {
    setBusyId(item.id);
    try {
      const response = await api.patch(`/huddle/intelligence/sessions/${sessionId}/ownership/${item.id}`, {
        status,
        resolvedOwnerUserId,
        expectedStatus: item.status,
        resolutionNote: status === "rejected" ? "Rejected in Meeting Intelligence" : "Approved in Meeting Intelligence",
      });
      const updated = response.data.ownershipResolution;
      setReview((current) => {
        if (!current || !updated) return current;
        return {
          ...current,
          ownership: current.ownership.map((entry) =>
            entry.id === updated.id ? updated : entry
          ),
          status: {
            ...current.status,
            pendingReviewCount: Math.max(
              0,
              current.status.pendingReviewCount -
                (item.status === "pending_approval" ? 1 : 0)
            ),
          },
        };
      });
      toast.success(status === "rejected" ? "Ownership suggestion rejected" : "Ownership confirmed");
    } catch (requestError) {
      if (requestError.response?.status === 409) await load();
      toast.error(requestError.response?.data?.reason || "Ownership review could not be saved");
    } finally {
      setBusyId(null);
    }
  };

  const createMemoryCandidate = async (artifact) => {
    setBusyId(`memory:${artifact.id}`);
    try {
      await api.post(
        `/huddle/intelligence/sessions/${sessionId}/memory-candidates/from-artifact/${artifact.id}`
      );
      toast.success("Memory candidate created for review");
      setActiveTab("memory");
      await load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.reason || "Memory candidate could not be created");
    } finally {
      setBusyId(null);
    }
  };

  const reviewMemoryCandidate = async (candidate, status) => {
    setBusyId(candidate.id);
    try {
      await api.patch(
        `/huddle/intelligence/sessions/${sessionId}/memory-candidates/${candidate.id}`,
        {
          status,
          expectedStatus: candidate.status,
          metadata: { reviewedInMeetingIntelligence: true },
        }
      );
      toast.success(status === "approved" ? "Memory approved" : "Memory rejected");
      await load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.reason || "Memory review could not be saved");
    } finally {
      setBusyId(null);
    }
  };

  const promoteMemoryCandidate = async (candidate) => {
    setBusyId(candidate.id);
    try {
      await api.post(
        `/huddle/intelligence/sessions/${sessionId}/memory-candidates/${candidate.id}/promote`
      );
      toast.success("Meeting knowledge added to workspace memory");
      await load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.reason || "Memory promotion failed");
    } finally {
      setBusyId(null);
    }
  };

  const saveMemoryCandidate = async () => {
    if (!memoryEditor) return;
    setBusyId(memoryEditor.id);
    try {
      await api.patch(
        `/huddle/intelligence/sessions/${sessionId}/memory-candidates/${memoryEditor.id}`,
        {
          status:
            memoryEditor.status === "promoted"
              ? "approved"
              : memoryEditor.status,
          expectedStatus: memoryEditor.status,
          title: memoryEditor.title,
          candidateText: memoryEditor.candidateText,
          metadata: { editedInMeetingIntelligence: true },
        }
      );
      toast.success("Memory revision saved");
      setMemoryEditor(null);
      await load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.reason || "Memory could not be updated");
    } finally {
      setBusyId(null);
    }
  };

  const revokeMemoryCandidate = async (candidate) => {
    setBusyId(candidate.id);
    try {
      await api.post(
        `/huddle/intelligence/sessions/${sessionId}/memory-candidates/${candidate.id}/revoke`,
        { reason: "Revoked in Meeting Intelligence" }
      );
      toast.success("Workspace memory archived");
      await load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.reason || "Memory could not be revoked");
    } finally {
      setBusyId(null);
    }
  };

  const loadMemoryHistory = async (candidate) => {
    try {
      const response = await api.get(
        `/huddle/intelligence/sessions/${sessionId}/memory-candidates/${candidate.id}/history`
      );
      setMemoryHistory((current) => ({
        ...current,
        [candidate.id]: response.data?.history || [],
      }));
    } catch (requestError) {
      toast.error(requestError.response?.data?.reason || "Memory history could not be loaded");
    }
  };

  const createTaskFromAction = async (item) => {
    const projectId = taskProjects[item.id];
    if (!projectId) {
      toast.error("Choose a project first");
      return;
    }
    setBusyId(`task:${item.id}`);
    try {
      await api.post(
        `/huddle/intelligence/sessions/${sessionId}/actions/${item.id}/tasks`,
        {
          artifactId: review.artifacts.actions.id,
          projectId,
        }
      );
      toast.success("Task created with Huddle evidence");
      await load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.reason || "Task could not be created");
    } finally {
      setBusyId(null);
    }
  };

  const askCopilot = async (event) => {
    event.preventDefault();
    if (!copilotQuestion.trim()) return;
    setBusyId("copilot");
    try {
      const response = await api.post(
        `/huddle/intelligence/sessions/${sessionId}/copilot`,
        { question: copilotQuestion }
      );
      setCopilotQueries((current) => [response.data.result, ...current]);
      setCopilotQuestion("");
    } catch (requestError) {
      toast.error(requestError.response?.data?.reason || "Copilot could not answer");
    } finally {
      setBusyId(null);
    }
  };

  const downloadMarkdownExport = () => {
    const url = URL.createObjectURL(
      new Blob([reportMarkdown(review)], { type: "text/markdown;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `huddle-intelligence-${sessionId}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdfExport = async () => {
    const { jsPDF } = await import("jspdf");
    const document = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = document.internal.pageSize.getWidth();
    const pageHeight = document.internal.pageSize.getHeight();
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;
    const ensureSpace = (height = 24) => {
      if (y + height > pageHeight - margin) {
        document.addPage();
        y = margin;
      }
    };
    const write = (text, { size = 10, bold = false, gap = 8 } = {}) => {
      if (!text) return;
      document.setFont("helvetica", bold ? "bold" : "normal");
      document.setFontSize(size);
      const lines = document.splitTextToSize(String(text), contentWidth);
      ensureSpace(lines.length * (size + 3) + gap);
      document.text(lines, margin, y);
      y += lines.length * (size + 3) + gap;
    };
    const heading = (text) => {
      ensureSpace(34);
      y += 8;
      write(text, { size: 14, bold: true, gap: 8 });
    };
    const bullet = (text) => write(`- ${text}`, { size: 10, gap: 5 });
    const evidence = (ids) =>
      Array.isArray(ids) && ids.length
        ? ` [${ids.map((id) => `T:${id}`).join(", ")}]`
        : "";

    write(review.session.title, { size: 20, bold: true, gap: 10 });
    write(
      `${dateTime(review.session.startedAt)} | ${review.participants.length} participants`,
      { size: 10, gap: 4 }
    );
    write(
      review.participants
        .map((participant) => participant.displayName)
        .join(", "),
      { size: 10, gap: 12 }
    );
    heading("Executive Summary");
    write(review.report?.executiveSummary?.outcome || summaryText);
    heading("Discussion Highlights");
    (review.report?.discussionHighlights || []).forEach((item) =>
      bullet(
        `${item.speaker}: ${item.text}${evidence(item.evidenceSegmentIds)}`
      )
    );
    heading("Decisions");
    (review.report?.decisions || []).forEach((item) =>
      bullet(
        `${item.title || "Decision"}: ${item.decision || ""}${item.rationale ? ` Rationale: ${item.rationale}` : ""}${evidence(item.evidenceSegmentIds)}`
      )
    );
    heading("Action Items");
    (review.report?.actionItems || []).forEach((item) =>
      bullet(
        `${item.title}${item.owner?.label ? ` | Owner: ${item.owner.label}` : ""}${item.dueDate ? ` | Due: ${item.dueDate}` : ""}${evidence(item.evidenceSegmentIds)}`
      )
    );
    heading("Timeline");
    (review.report?.chronologicalConversation || []).forEach((item) =>
      bullet(
        `${item.occurredAt ? `${timeOnly(item.occurredAt)} | ` : ""}${item.title || "Discussion"}: ${item.description || ""}${evidence(item.evidenceSegmentIds)}`
      )
    );
    heading("Transcript");
    review.transcript.forEach((segment) =>
      write(
        `${timeOnly(segment.startedAt)} | ${segment.speaker?.label || "Participant"}: ${segment.text} [T:${segment.id}]`,
        { size: 9, gap: 5 }
      )
    );
    const pageCount = document.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      document.setPage(page);
      document.setFont("helvetica", "normal");
      document.setFontSize(8);
      document.setTextColor(100);
      document.text(
        `Asystence Huddle | Page ${page} of ${pageCount}`,
        margin,
        pageHeight - 24
      );
    }
    document.save(`huddle-intelligence-${sessionId}.pdf`);
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-[color:var(--primary)]" /></div>;
  }
  if (error || !review) {
    return (
      <div className="mx-auto flex max-w-xl items-start gap-3 p-8 text-red-600">
        <AlertCircle className="mt-0.5 shrink-0" />
        <div><h1 className="font-semibold">Meeting intelligence unavailable</h1><p className="mt-1 text-sm">{error}</p></div>
      </div>
    );
  }

  const summary = review.artifacts.summary;
  const decisions = review.artifacts.decisions;
  const actions = review.artifacts.actions;
  const transcriptText = review.transcript
    .map((segment) => `${segment.speaker?.label || "Participant"}: ${segment.text}`)
    .join("\n");
  const summaryText = summary?.contentText || artifactContentText("summary", summary?.contentJson || {});

  return (
    <main className="min-h-full bg-[var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] px-4 py-5 sm:px-7">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-[color:var(--primary)]">Meeting Intelligence</p>
              <h1 className="mt-1 text-2xl font-semibold">{review.session.title}</h1>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                {dateTime(review.session.startedAt)} · {review.participants.length} participant{review.participants.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => copyText(summaryText, "Summary")} className="inline-flex items-center gap-2 rounded border border-[color:var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-soft)]">
                <ClipboardCopy size={15} /> Copy summary
              </button>
              <button type="button" onClick={() => copyText(transcriptText, "Transcript")} className="inline-flex items-center gap-2 rounded border border-[color:var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-soft)]">
                <ClipboardCopy size={15} /> Copy transcript
              </button>
              <button type="button" onClick={() => copyText(reportMarkdown(review), "Meeting report")} className="inline-flex items-center gap-2 rounded border border-[color:var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-soft)]">
                <ClipboardCopy size={15} /> Copy report
              </button>
              <button type="button" onClick={downloadMarkdownExport} title="Export Markdown" className="inline-flex items-center gap-2 rounded border border-[color:var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-soft)]">
                <FileDown size={15} /> Markdown
              </button>
              <button type="button" onClick={downloadPdfExport} title="Export PDF" className="inline-flex items-center gap-2 rounded border border-[color:var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-soft)]">
                <FileText size={15} /> PDF
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Meeting participants">
            {review.participants.map((participant) => (
              <span
                key={participant.id || participant.userId || participant.displayName}
                className="inline-flex items-center rounded border border-[color:var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium"
              >
                {participant.displayName}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[color:var(--text-muted)]">
            <span>{review.status.summaryAvailable ? "Summary ready" : "Summary unavailable"}</span>
            <span>{review.status.decisionCount} decisions</span>
            <span>{review.status.actionItemCount} action items</span>
            <span>{review.status.pendingReviewCount} awaiting review</span>
          </div>
        </div>
      </header>

      <nav className="border-b border-[color:var(--border)] px-4 sm:px-7" aria-label="Meeting intelligence sections">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto py-2">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded px-3 py-2 text-sm font-medium ${
                activeTab === id
                  ? "bg-[var(--surface-soft)] text-[color:var(--primary)]"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
              }`}
            >
              <TabIcon id={id} /> {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7">
        {activeTab === "summary" && (
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-xl font-semibold">Executive summary</h2><p className="text-sm text-[color:var(--text-muted)]">Evidence-grounded and pending human approval.</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <ReviewStatus artifact={summary} />
                <ArtifactActions artifact={summary} canReview={review.permissions.canReviewArtifacts} canEdit={summary?.approvalStatus !== "approved" || review.permissions.canEditApprovedArtifacts} onEdit={setEditing} onDecision={decideArtifact} busy={busyId === summary?.id} />
              </div>
            </div>
            {summary ? (
              <>
                <div className="mb-5 grid gap-4 border-y border-[color:var(--border)] py-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Purpose</div>
                    <p className="mt-1 text-sm leading-6">{review.report?.executiveSummary?.purpose}</p>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Overall outcome</div>
                    <p className="mt-1 text-sm leading-6">{review.report?.executiveSummary?.outcome}</p>
                  </div>
                </div>
                <p className="max-w-4xl whitespace-pre-wrap text-[15px] leading-7">{summary.contentJson?.overview}</p>
                <EvidenceButton ids={summary.contentJson?.overviewEvidenceSegmentIds} onOpen={showEvidence} />
                {(review.report?.executiveSummary?.conclusions || []).length > 0 && (
                  <>
                    <h3 className="mb-3 mt-7 font-semibold">Major conclusions</h3>
                    <div className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
                      {review.report.executiveSummary.conclusions.map((item, index) => (
                        <div key={item.id || index} className="py-3">
                          <p className="text-sm leading-6">{item.text || item}</p>
                          <EvidenceButton ids={item.evidenceSegmentIds} onOpen={showEvidence} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <h3 className="mb-3 mt-7 font-semibold">Discussion highlights</h3>
                <div className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
                  {(summary.contentJson?.discussionHighlights || []).map((point) => (
                    <div key={point.id} className="py-4">
                      <div className="text-xs font-semibold text-[color:var(--primary)]">{point.speaker}</div>
                      <p className="mt-1 text-sm leading-6">{point.text}</p>
                      <div className="mt-2"><EvidenceButton ids={point.evidenceSegmentIds} onOpen={showEvidence} /></div>
                    </div>
                  ))}
                  {(summary.contentJson?.keyPoints || []).map((point) => (
                    <div key={point.id} className="py-4">
                      <p className="text-sm leading-6">{point.text}</p>
                      <div className="mt-2"><EvidenceButton ids={point.evidenceSegmentIds} onOpen={showEvidence} /></div>
                    </div>
                  ))}
                </div>
                {(review.report?.speakerHighlights || []).length > 0 && (
                  <>
                    <h3 className="mb-3 mt-7 font-semibold">Speaker highlights</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {review.report.speakerHighlights.map((speaker) => (
                        <article key={speaker.speaker} className="border-l-2 border-[color:var(--primary)] pl-4">
                          <h4 className="font-semibold">{speaker.speaker}</h4>
                          <dl className="mt-2 space-y-2 text-sm">
                            {speaker.keyPointsRaised.length > 0 && <div><dt className="text-xs font-medium text-[color:var(--text-muted)]">Key points</dt><dd>{speaker.keyPointsRaised.map((item) => item.text).join(" ")}</dd></div>}
                            {speaker.commitments.length > 0 && <div><dt className="text-xs font-medium text-[color:var(--text-muted)]">Commitments</dt><dd>{speaker.commitments.map((item) => item.title).join(", ")}</dd></div>}
                            {speaker.concernsRaised.length > 0 && <div><dt className="text-xs font-medium text-[color:var(--text-muted)]">Concerns</dt><dd>{speaker.concernsRaised.map((item) => item.text || item.question).join(" ")}</dd></div>}
                            {speaker.decisionsInfluenced.length > 0 && <div><dt className="text-xs font-medium text-[color:var(--text-muted)]">Decisions influenced</dt><dd>{speaker.decisionsInfluenced.map((item) => item.title).join(", ")}</dd></div>}
                          </dl>
                        </article>
                      ))}
                    </div>
                  </>
                )}
                {(review.report?.chronologicalConversation || []).length > 0 && (
                  <>
                    <h3 className="mb-3 mt-7 font-semibold">Chronological conversation</h3>
                    <div className="border-l border-[color:var(--border)] pl-5">
                      {review.report.chronologicalConversation.map((entry, index) => (
                        <div key={entry.id || index} className="relative pb-5">
                          <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
                          <div className="text-xs text-[color:var(--text-muted)]">{timeOnly(entry.occurredAt)}</div>
                          <div className="text-sm font-medium">{entry.title}</div>
                          <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{entry.description}</p>
                          <EvidenceButton ids={entry.evidenceSegmentIds} onOpen={showEvidence} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <h3 className="mb-3 mt-7 font-semibold">Open questions</h3>
                {(summary.contentJson?.openQuestions || []).length > 0 ? (
                  <div className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
                    {summary.contentJson.openQuestions.map((item) => (
                      <div key={item.id} className="py-4">
                        <p className="text-sm leading-6">{item.question}</p>
                        {item.raisedBy && <p className="mt-1 text-xs text-[color:var(--text-muted)]">Raised by {item.raisedBy}</p>}
                        <div className="mt-2"><EvidenceButton ids={item.evidenceSegmentIds} onOpen={showEvidence} /></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[color:var(--text-muted)]">No unresolved question was identified in the transcript.</p>
                )}
                {(review.report?.risks || []).length > 0 && (
                  <>
                    <h3 className="mb-3 mt-7 font-semibold">Risks and blockers</h3>
                    <div className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
                      {review.report.risks.map((item, index) => (
                        <div key={item.id || index} className="py-4">
                          <p className="text-sm leading-6">{item.text || item.question || item}</p>
                          <div className="mt-2">
                            <EvidenceButton ids={item.evidenceSegmentIds} onOpen={showEvidence} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {(review.report?.outcomes || []).length > 0 && (
                  <>
                    <h3 className="mb-3 mt-7 font-semibold">Meeting outcomes</h3>
                    <ul className="space-y-2 text-sm leading-6">
                      {review.report.outcomes.map((item, index) => (
                        <li key={`${item.type || "outcome"}-${index}`} className="flex gap-2">
                          <Check size={15} className="mt-1 shrink-0 text-emerald-600" />
                          <span>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {summary.approvalStatus === "approved" && (
                  <button type="button" disabled={busyId === `memory:${summary.id}`} onClick={() => createMemoryCandidate(summary)} className="mt-5 inline-flex items-center gap-2 rounded border border-[color:var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-soft)] disabled:opacity-50">
                    <Database size={15} /> Add approved summary to memory
                  </button>
                )}
                <Provenance artifact={summary} />
              </>
            ) : <p className="text-sm text-[color:var(--text-muted)]">No summary artifact is available for this meeting.</p>}
          </section>
        )}

        {activeTab === "timeline" && (
          <section>
            <h2 className="text-xl font-semibold">Timeline</h2>
            <div className="mt-5 border-l border-[color:var(--border)] pl-5">
              {review.timeline.map((entry) => (
                <div key={`${entry.id}:${entry.occurredAt}`} className="relative pb-6">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
                  <div className="text-xs text-[color:var(--text-muted)]">{timeOnly(entry.occurredAt)}</div>
                  <div className="font-medium">{entry.title || entry.entryType}</div>
                  {entry.description && <p className="mt-1 text-sm text-[color:var(--text-muted)]">{entry.description}</p>}
                  {entry.transcriptSegmentId && <EvidenceButton ids={[entry.transcriptSegmentId]} onOpen={showEvidence} />}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "transcript" && (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-xl font-semibold">Speaker-attributed transcript</h2><p className="text-sm text-[color:var(--text-muted)]">{review.transcript.length} finalized segments</p></div>
              {evidenceIds.length > 0 && <button type="button" onClick={() => setEvidenceIds([])} className="text-xs text-[color:var(--primary)] hover:underline">Clear evidence highlight</button>}
            </div>
            <div className="mt-5 divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
              {review.transcript.map((segment) => {
                const highlighted = evidenceIds.includes(segment.id);
                return (
                  <article
                    key={segment.id}
                    ref={(element) => element ? transcriptRefs.current.set(segment.id, element) : transcriptRefs.current.delete(segment.id)}
                    className={`grid gap-2 py-4 sm:grid-cols-[140px_1fr] ${highlighted ? "bg-[var(--primary)]/8 px-3" : ""}`}
                  >
                    <div>
                      <div className="text-sm font-semibold">{segment.speaker?.label || "Participant"}</div>
                      <div className="text-xs text-[color:var(--text-muted)]">{timeOnly(segment.startedAt)}</div>
                    </div>
                    <div>
                      <p className="text-sm leading-6">{segment.text}</p>
                      <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                        {[segment.language, confidenceLabel(segment.confidence)].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "decisions" && (
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-xl font-semibold">Decisions</h2><p className="text-sm text-[color:var(--text-muted)]">Confirm what the team actually decided.</p></div>
              <div className="flex flex-wrap items-center gap-2"><ReviewStatus artifact={decisions} /><ArtifactActions artifact={decisions} canReview={review.permissions.canReviewArtifacts} canEdit={decisions?.approvalStatus !== "approved" || review.permissions.canEditApprovedArtifacts} onEdit={setEditing} onDecision={decideArtifact} busy={busyId === decisions?.id} /></div>
            </div>
            <div className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
              {(review.report?.decisions || decisions?.contentJson?.decisions || []).map((item) => (
                <article key={item.id} className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold">{item.title}</h3><span className="text-xs text-[color:var(--text-muted)]">{confidenceLabel(item.confidence)}</span></div>
                  <p className="mt-2 text-sm leading-6">{item.decision}</p>
                  {item.rationale && <p className="mt-2 text-sm text-[color:var(--text-muted)]">{item.rationale}</p>}
                  {(item.participants || []).length > 0 && (
                    <p className="mt-2 text-xs text-[color:var(--text-muted)]">
                      Participants: {item.participants.join(", ")}
                    </p>
                  )}
                  <div className="mt-3"><EvidenceButton ids={item.evidenceSegmentIds} onOpen={showEvidence} /></div>
                </article>
              ))}
            </div>
            <Provenance artifact={decisions} />
            {decisions?.approvalStatus === "approved" && (
              <button type="button" disabled={busyId === `memory:${decisions.id}`} onClick={() => createMemoryCandidate(decisions)} className="mt-5 inline-flex items-center gap-2 rounded border border-[color:var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-soft)] disabled:opacity-50">
                <Database size={15} /> Add approved decisions to memory
              </button>
            )}
          </section>
        )}

        {activeTab === "actions" && (
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-xl font-semibold">Action items</h2><p className="text-sm text-[color:var(--text-muted)]">Approved actions become tasks only after ownership is confirmed and you choose a project.</p></div>
              <div className="flex flex-wrap items-center gap-2"><ReviewStatus artifact={actions} /><ArtifactActions artifact={actions} canReview={review.permissions.canReviewArtifacts} canEdit={actions?.approvalStatus !== "approved" || review.permissions.canEditApprovedArtifacts} onEdit={setEditing} onDecision={decideArtifact} busy={busyId === actions?.id} /></div>
            </div>
            <div className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
              {(review.report?.actionItems || actions?.contentJson?.actionItems || []).map((item) => {
                const linkedTask = (review.actionTasks || []).find(
                  (task) => String(task.source?.actionItemId) === String(item.id)
                );
                const ownership = (review.ownership || []).find(
                  (entry) => String(entry.metadata?.actionItemId) === String(item.id)
                );
                const ownershipApproved = ["approved", "reassigned"].includes(ownership?.status);
                return (
                <article key={item.id} className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold">{item.title}</h3><span className="text-xs text-[color:var(--text-muted)]">{confidenceLabel(item.confidence)}</span></div>
                  {item.description && <p className="mt-2 text-sm leading-6">{item.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-[color:var(--text-muted)]">
                    {(item.owner?.label || item.suggestedOwner?.label) && <span>Owner: {item.owner?.label || item.suggestedOwner.label}</span>}
                    {item.dueDate && <span>Due: {item.dueDate}</span>}
                  </div>
                  <div className="mt-3"><EvidenceButton ids={item.evidenceSegmentIds} onOpen={showEvidence} /></div>
                  {linkedTask ? (
                    <div className="mt-4 inline-flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                      <Check size={13} />
                      Task {linkedTask.displayId || linkedTask.title} in {linkedTask.projectName || "project"}
                    </div>
                  ) : actions?.approvalStatus === "approved" &&
                    review.permissions.canCreateTasks ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <select
                        value={taskProjects[item.id] || ""}
                        onChange={(event) =>
                          setTaskProjects((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        className="min-w-48 rounded border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
                      >
                        <option value="">Choose project</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!ownershipApproved || busyId === `task:${item.id}`}
                        onClick={() => createTaskFromAction(item)}
                        title={ownershipApproved ? "Create task" : "Approve ownership first"}
                        className="inline-flex items-center gap-1 rounded bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[color:var(--primary-contrast)] disabled:opacity-50"
                      >
                        {busyId === `task:${item.id}` ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        Create task
                      </button>
                    </div>
                  ) : null}
                </article>
                );
              })}
            </div>
            <Provenance artifact={actions} />
            {actions?.approvalStatus === "approved" && (
              <button type="button" disabled={busyId === `memory:${actions.id}`} onClick={() => createMemoryCandidate(actions)} className="mt-5 inline-flex items-center gap-2 rounded border border-[color:var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-soft)] disabled:opacity-50">
                <Database size={15} /> Add approved actions to memory
              </button>
            )}
          </section>
        )}

        {activeTab === "ownership" && (
          <section>
            <h2 className="text-xl font-semibold">Ownership suggestions</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Suggested owners remain proposals until a person confirms them.</p>
            <div className="mt-5 divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
              {review.ownership.map((item) => {
                const selectedUserId = item.resolvedOwnerUserId || item.suggestedOwnerUserId || "";
                const evidence = item.transcriptSegmentId ? segmentById.get(item.transcriptSegmentId) : null;
                return (
                  <article key={item.id} className="py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h3 className="font-semibold">{item.metadata?.actionTitle || "Action item ownership"}</h3><p className="mt-1 text-sm text-[color:var(--text-muted)]">Suggested: {item.metadata?.ownerLabel || "Unassigned"} · {confidenceLabel(item.confidence)}</p></div>
                      <ReviewStatus artifact={{ approvalStatus: item.status === "approved" || item.status === "reassigned" ? "approved" : item.status === "rejected" ? "rejected" : "pending" }} />
                    </div>
                    {evidence && <div className="mt-3"><EvidenceButton ids={[evidence.id]} onOpen={showEvidence} /></div>}
                    {review.permissions.canReviewOwnership && item.status === "pending_approval" && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <select
                          defaultValue={selectedUserId}
                          id={`owner-${item.id}`}
                          className="rounded border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm"
                        >
                          <option value="">Choose owner</option>
                          {review.participants.filter((participant) => participant.userId).map((participant) => (
                            <option key={participant.participantId} value={participant.userId}>{participant.displayName}</option>
                          ))}
                        </select>
                        <button type="button" disabled={busyId === item.id} onClick={() => decideOwnership(item, "approved", document.getElementById(`owner-${item.id}`)?.value || null)} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"><Check size={13} /> Confirm</button>
                        <button type="button" disabled={busyId === item.id} onClick={() => decideOwnership(item, "rejected")} className="inline-flex items-center gap-1 rounded border border-red-300 px-3 py-2 text-xs font-medium text-red-600 disabled:opacity-50"><X size={13} /> Reject</button>
                      </div>
                    )}
                  </article>
                );
              })}
              {review.ownership.length === 0 && <p className="py-6 text-sm text-[color:var(--text-muted)]">No ownership suggestions were generated.</p>}
            </div>
          </section>
        )}

        {activeTab === "memory" && (
          <section>
            <h2 className="text-xl font-semibold">Meeting memory</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Only approved meeting artifacts can become searchable workspace knowledge. Promotion always requires a separate human confirmation.</p>
            <div className="mt-5 divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
              {(review.memoryCandidates || []).map((candidate) => (
                <article key={candidate.id} className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{candidate.title || "Meeting memory"}</h3>
                      <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[color:var(--text-muted)]">{candidate.candidateText}</p>
                    </div>
                    <span className="rounded bg-[var(--surface-soft)] px-2 py-1 text-xs font-medium">{candidate.status.replace("_", " ")}</span>
                  </div>
                  {review.permissions.canReviewMemory && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {!["promoted", "cancelled"].includes(candidate.status) && (
                        <button type="button" onClick={() => setMemoryEditor({ ...candidate })} className="inline-flex items-center gap-1 rounded border border-[color:var(--border)] px-3 py-2 text-xs font-medium hover:bg-[var(--surface-soft)]">
                          <Pencil size={13} /> Edit
                        </button>
                      )}
                      {candidate.status === "pending_approval" && (
                        <>
                          <button type="button" disabled={busyId === candidate.id} onClick={() => reviewMemoryCandidate(candidate, "approved")} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"><Check size={13} /> Approve memory</button>
                          <button type="button" disabled={busyId === candidate.id} onClick={() => reviewMemoryCandidate(candidate, "rejected")} className="inline-flex items-center gap-1 rounded border border-red-300 px-3 py-2 text-xs font-medium text-red-600 disabled:opacity-50"><X size={13} /> Reject</button>
                        </>
                      )}
                      {candidate.status === "approved" && (
                        <button type="button" disabled={busyId === candidate.id} onClick={() => promoteMemoryCandidate(candidate)} className="inline-flex items-center gap-1 rounded bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[color:var(--primary-contrast)] disabled:opacity-50"><Database size={13} /> Promote to workspace memory</button>
                      )}
                      {candidate.status === "promoted" && (
                        <button type="button" disabled={busyId === candidate.id} onClick={() => revokeMemoryCandidate(candidate)} className="inline-flex items-center gap-1 rounded border border-red-300 px-3 py-2 text-xs font-medium text-red-600 disabled:opacity-50">
                          <Archive size={13} /> Revoke and archive
                        </button>
                      )}
                      <button type="button" onClick={() => loadMemoryHistory(candidate)} className="inline-flex items-center gap-1 rounded border border-[color:var(--border)] px-3 py-2 text-xs font-medium hover:bg-[var(--surface-soft)]">
                        <RotateCcw size={13} /> History
                      </button>
                    </div>
                  )}
                  {(memoryHistory[candidate.id] || []).length > 0 && (
                    <div className="mt-4 border-l-2 border-[color:var(--border)] pl-3 text-xs text-[color:var(--text-muted)]">
                      {memoryHistory[candidate.id].map((revision) => (
                        <div key={revision.id} className="mb-2">
                          Revision {revision.revisionNumber}: {revision.changeReason?.replaceAll("_", " ")} by {revision.changedByName || "reviewer"} on {dateTime(revision.createdAt)}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
              {(review.memoryCandidates || []).length === 0 && <p className="py-6 text-sm text-[color:var(--text-muted)]">Approve a summary, decision set, or action list to create a memory candidate.</p>}
            </div>
          </section>
        )}

        {activeTab === "copilot" && (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Meeting Copilot</h2>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  Answers are restricted to transcript evidence, approved artifacts, and approved workspace memory.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700">
                <Check size={13} /> Evidence required
              </span>
            </div>
            <form onSubmit={askCopilot} className="mt-5 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search size={16} className="absolute left-3 top-3 text-[color:var(--text-muted)]" />
                <input
                  value={copilotQuestion}
                  onChange={(event) => setCopilotQuestion(event.target.value)}
                  placeholder="Ask what was decided, who owns an action, or what evidence supports a conclusion"
                  className="w-full rounded border border-[color:var(--border)] bg-transparent py-2.5 pl-10 pr-3 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={!copilotQuestion.trim() || busyId === "copilot"}
                className="inline-flex items-center gap-2 rounded bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[color:var(--primary-contrast)] disabled:opacity-50"
              >
                {busyId === "copilot" ? <Loader2 size={15} className="animate-spin" /> : <Bot size={15} />}
                Ask
              </button>
            </form>
            <div className="mt-6 divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
              {copilotQueries.map((query) => (
                <article key={query.id} className="py-5">
                  <p className="text-sm font-semibold">{query.question}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{query.answer}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(query.evidence || []).map((evidence) => (
                      <button
                        key={evidence.ref}
                        type="button"
                        onClick={() =>
                          evidence.type === "transcript"
                            ? showEvidence([evidence.id])
                            : null
                        }
                        className="inline-flex items-center gap-1 rounded border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--primary)] hover:bg-[var(--surface-soft)]"
                      >
                        <FileText size={12} /> {evidence.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-[color:var(--text-muted)]">
                    {query.provider} {query.model ? `- ${query.model}` : ""} - {dateTime(query.createdAt)}
                  </p>
                </article>
              ))}
              {copilotQueries.length === 0 && (
                <p className="py-7 text-sm text-[color:var(--text-muted)]">
                  No questions have been asked about this meeting yet.
                </p>
              )}
            </div>
          </section>
        )}

        {activeTab === "quality" && (
          <section>
            <h2 className="text-xl font-semibold">Media quality</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Production telemetry from this Huddle, separated from synthetic certification traffic.
            </p>
            {quality ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Quality score", `${quality.score}/100`],
                    ["Round-trip time", quality.metrics?.averageRttMs == null ? "No data" : `${quality.metrics.averageRttMs} ms`],
                    ["Packet loss", quality.metrics?.averagePacketLoss == null ? "No data" : `${(quality.metrics.averagePacketLoss * 100).toFixed(2)}%`],
                    ["Receive resolution", quality.metrics?.maxReceiveResolution || "No data"],
                    ["Send resolution", quality.metrics?.maxSendResolution || "No data"],
                    ["Bitrate", quality.metrics?.averageBitrateKbps == null ? "No data" : `${quality.metrics.averageBitrateKbps} kbps`],
                    ["Estimated data", quality.metrics?.estimatedMegabytesPerHour == null ? "No data" : `${quality.metrics.estimatedMegabytesPerHour} MB/hour`],
                    ["Real-device samples", quality.realDeviceSampleCount],
                    ["Screen-share tracks", quality.metrics?.screenShareTrackCount || 0],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b border-[color:var(--border)] py-3">
                      <div className="text-xs text-[color:var(--text-muted)]">{label}</div>
                      <div className="mt-1 text-lg font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
                <h3 className="mt-7 font-semibold">Adaptive stream layers</h3>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-[color:var(--text-muted)]">
                  <span>Low: {quality.metrics?.lowLayerSamples || 0}</span>
                  <span>Medium: {quality.metrics?.mediumLayerSamples || 0}</span>
                  <span>High: {quality.metrics?.highLayerSamples || 0}</span>
                </div>
                {(quality.observations || []).length > 0 && (
                  <div className="mt-6 border-l-2 border-amber-500 pl-4">
                    <h3 className="font-semibold">Observations</h3>
                    <ul className="mt-2 space-y-2 text-sm text-[color:var(--text-muted)]">
                      {quality.observations.map((observation) => (
                        <li key={observation}>{observation}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-5 text-sm text-[color:var(--text-muted)]">
                No LiveKit quality telemetry is available for this meeting.
              </p>
            )}
          </section>
        )}
      </div>

      {editing && <ArtifactEditor artifact={editing} onClose={() => setEditing(null)} onSave={saveArtifact} saving={busyId === editing.id} />}
      {memoryEditor && (
        <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/55 p-4">
          <section className="w-full max-w-xl rounded-lg bg-[var(--surface)] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit meeting memory</h2>
              <button type="button" onClick={() => setMemoryEditor(null)} title="Close"><X size={18} /></button>
            </div>
            <label className="mt-4 block text-sm font-medium">
              Title
              <input
                value={memoryEditor.title || ""}
                onChange={(event) => setMemoryEditor((current) => ({ ...current, title: event.target.value }))}
                className="mt-1 w-full rounded border border-[color:var(--border)] bg-transparent px-3 py-2"
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Memory
              <textarea
                value={memoryEditor.candidateText || ""}
                onChange={(event) => setMemoryEditor((current) => ({ ...current, candidateText: event.target.value }))}
                rows={10}
                className="mt-1 w-full rounded border border-[color:var(--border)] bg-transparent px-3 py-2"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setMemoryEditor(null)} className="rounded border border-[color:var(--border)] px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={saveMemoryCandidate} disabled={busyId === memoryEditor.id} className="inline-flex items-center gap-2 rounded bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[color:var(--primary-contrast)] disabled:opacity-50">
                {busyId === memoryEditor.id && <Loader2 size={14} className="animate-spin" />}
                Save revision
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
