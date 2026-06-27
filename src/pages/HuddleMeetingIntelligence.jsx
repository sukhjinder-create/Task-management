import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertCircle,
  AlertTriangle,
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
  Share2,
  ScrollText,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { useApi } from "../api";

const TABS = [
  { id: "summary", label: "Overview", icon: Sparkles, group: "primary" },
  { id: "timeline", label: "Timeline", icon: Clock3, group: "primary" },
  { id: "transcript", label: "Transcript", icon: ScrollText, group: "primary" },
  { id: "decisions", label: "Decisions", icon: Gavel, group: "primary" },
  { id: "actions", label: "Actions", icon: ListChecks, group: "primary" },
  { id: "risks", label: "Risks & Blockers", icon: AlertTriangle, group: "primary" },
  { id: "ownership", label: "Ownership", icon: UserCheck, group: "review" },
  { id: "memory", label: "Memory", icon: Database, group: "review" },
  { id: "copilot", label: "Copilot", icon: Bot, group: "review" },
  { id: "quality", label: "Call quality", icon: Radio, group: "review" },
];

const COPILOT_PROMPTS = {
  meeting: [
    "What decisions were made?",
    "Who owns the next actions?",
    "What remains unresolved?",
  ],
  workspace: [
    "What did the team commit to last month?",
    "What decisions were made about Huddles?",
    "What changed across recent meetings?",
  ],
};

function TabIcon({ id }) {
  if (id === "summary") return <Sparkles size={15} />;
  if (id === "timeline") return <Clock3 size={15} />;
  if (id === "transcript") return <ScrollText size={15} />;
  if (id === "decisions") return <Gavel size={15} />;
  if (id === "actions") return <ListChecks size={15} />;
  if (id === "risks") return <AlertTriangle size={15} />;
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

function isGenericParticipantLabel(value) {
  return /^participant(?:\s+\d+)?$/i.test(String(value || "").trim());
}

function safeDisplayName(value, fallback = "Speaker") {
  const label = String(value || "").trim();
  if (!label || isGenericParticipantLabel(label)) return fallback;
  return label;
}

function normalizeReportText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function uniqueEvidenceItems(items = [], blockedTexts = []) {
  const seen = new Set(
    blockedTexts.map(normalizeReportText).filter(Boolean)
  );
  return (Array.isArray(items) ? items : []).filter((item) => {
    const text = normalizeReportText(
      item?.text || item?.summary || item?.description || item
    );
    if (!text || seen.has(text)) return false;
    seen.add(text);
    return true;
  });
}

function discussionSummaryForReview(review) {
  const report = review?.report || {};
  const summary = review?.artifacts?.summary?.contentJson || {};
  return uniqueEvidenceItems(report.discussionSummary || [], [
    report.executiveSummary?.outcome,
    summary.overview,
    summary.outcome,
  ]);
}

function speakerNameFromReview(review, segment, fallback = "Speaker") {
  const speaker = segment?.speaker || {};
  const participants = Array.isArray(review?.participants) ? review.participants : [];
  const direct = safeDisplayName(speaker.label, "");
  if (direct) return direct;
  const match = participants.find((participant) =>
    String(participant.participantId || participant.id) === String(speaker.participantId || segment?.participantId) ||
    String(participant.userId) === String(speaker.userId)
  );
  return safeDisplayName(match?.displayName, fallback);
}

function artifactContentText(artifactType, content) {
  if (artifactType === "summary") {
    return [
      content.title,
      "Meeting Purpose",
      content.purpose,
      "Executive Summary",
      content.overview,
      "Discussion Summary",
      ...(content.discussionSummary || []).map((item) => `- ${item.text}`),
      "Discussion Highlights",
      ...(content.discussionHighlights || []).map(
        (item) => `- ${safeDisplayName(item.speaker, "Speaker")}: ${item.text}`
      ),
      "Important Points",
      ...(content.keyPoints || []).map((item) => `- ${item.text}`),
      "Open Questions",
      ...(content.openQuestions || []).map((item) => `- ${item.question}`),
      "Risks and Blockers",
      ...(content.risksRaised || []).map((item) => `- ${item.text}`),
      "Next Steps",
      ...(content.nextSteps || []).map((item) => `- ${item.text}`),
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
    "## Meeting Purpose",
    "",
    report.executiveSummary?.purpose || review?.session?.title || "Huddle",
    "",
    "## Discussion Summary",
    "",
    ...discussionSummaryForReview(review).map(
      (item) => `- ${item.text}${evidence(item.evidenceSegmentIds)}`
    ),
    "",
    "## Discussion Highlights",
    "",
    ...(report.discussionHighlights || []).map(
      (item) =>
        `- **${safeDisplayName(item.speaker, "Speakers")}:** ${item.text}${evidence(item.evidenceSegmentIds)}`
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
    "## Next Steps",
    "",
    ...(report.nextSteps || []).map(
      (item) => `- ${item.text || item}${evidence(item.evidenceSegmentIds)}`
    ),
    "",
    "## Ownership Suggestions",
    "",
    ...(report.ownershipSuggestions || []).map(
      (item) =>
        `- ${item.metadata?.actionTitle || "Action item"}: ${item.metadata?.resolvedOwnerLabel || item.metadata?.ownerLabel || "Unassigned"} (${item.status || "pending review"})`
    ),
    "",
    "## Transcript",
    "",
    ...(review?.transcript || []).map(
      (segment) =>
        `- **${speakerNameFromReview(review, segment)}** (${timeOnly(segment.startedAt)}): ${segment.text} _(T:${segment.id})_`
    ),
  ];
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function installPdfUnicodeFont(document) {
  const response = await fetch("/fonts/NotoSansDevanagari.ttf");
  if (!response.ok) throw new Error("pdf_unicode_font_unavailable");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  const filename = "NotoSansDevanagari.ttf";
  document.addFileToVFS(filename, window.btoa(binary));
  document.addFont(filename, "NotoSansDevanagari", "normal");
  document.addFont(filename, "NotoSansDevanagari", "bold");
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
  const navigate = useNavigate();
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
  const [copilotScope, setCopilotScope] = useState("meeting");
  const [copilotQueries, setCopilotQueries] = useState([]);
  const [quality, setQuality] = useState(null);
  const [riskBlockerItems, setRiskBlockerItems] = useState([]);
  const [supplementLoading, setSupplementLoading] = useState({});
  const transcriptRefs = useRef(new Map());
  const loadedSupplementsRef = useRef(new Set());

  const load = useCallback(async () => {
    try {
      const response = await api.get(
        `/huddle/intelligence/sessions/${sessionId}/review`
      );
      setReview(response.data.review);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.reason || "Meeting intelligence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [api, sessionId]);

  useEffect(() => {
    loadedSupplementsRef.current.clear();
    setProjects([]);
    setCopilotQueries([]);
    setQuality(null);
    setRiskBlockerItems([]);
    setLoading(true);
    load();
  }, [load, sessionId]);

  const loadSupplement = useCallback(async (kind) => {
    if (loadedSupplementsRef.current.has(kind)) return;
    loadedSupplementsRef.current.add(kind);
    setSupplementLoading((current) => ({ ...current, [kind]: true }));
    try {
      if (kind === "projects") {
        const response = await api.get("/projects");
        const list = response.data?.projects || response.data || [];
        setProjects(Array.isArray(list) ? list : []);
      } else if (kind === "copilot") {
        const response = await api.get(
          `/huddle/intelligence/sessions/${sessionId}/copilot`
        );
        setCopilotQueries(response.data?.queries || []);
      } else if (kind === "quality") {
        const response = await api.get(
          `/huddle/media/livekit/quality/sessions/${sessionId}/summary`
        );
        setQuality(response.data?.quality || null);
      } else if (kind === "risks") {
        const response = await api.get(
          `/huddle/intelligence/sessions/${sessionId}/risk-blockers`
        );
        setRiskBlockerItems(response.data?.items || []);
      }
    } catch {
      loadedSupplementsRef.current.delete(kind);
    } finally {
      setSupplementLoading((current) => ({ ...current, [kind]: false }));
    }
  }, [api, sessionId]);

  useEffect(() => {
    if (activeTab === "actions") void loadSupplement("projects");
    if (activeTab === "copilot") void loadSupplement("copilot");
    if (activeTab === "quality") void loadSupplement("quality");
    if (activeTab === "risks") void loadSupplement("risks");
  }, [activeTab, loadSupplement]);

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
      await api.post(`/huddle/artifacts/${artifact.id}/${endpoint}`, {
        approvalNote:
          decision === "approved"
            ? "Approved in Meeting Intelligence"
            : decision === "revoked"
              ? "Approval revoked in Meeting Intelligence"
              : "Rejected in Meeting Intelligence",
        expectedRevision: artifact.currentRevision,
      });
      await load();
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
      await api.patch(`/huddle/intelligence/sessions/${sessionId}/ownership/${item.id}`, {
        status,
        resolvedOwnerUserId,
        expectedStatus: item.status,
        resolutionNote: status === "rejected" ? "Rejected in Meeting Intelligence" : "Approved in Meeting Intelligence",
      });
      await load();
      toast.success(status === "rejected" ? "Ownership suggestion rejected" : "Ownership confirmed");
    } catch (requestError) {
      if (requestError.response?.status === 409) await load();
      toast.error(requestError.response?.data?.reason || "Ownership review could not be saved");
    } finally {
      setBusyId(null);
    }
  };

  const addArtifactToWorkspaceMemory = async (artifact) => {
    setBusyId(`memory:${artifact.id}`);
    try {
      const creation = await api.post(
        `/huddle/intelligence/sessions/${sessionId}/memory-candidates/from-artifact/${artifact.id}`
      );
      let candidate = creation.data?.memoryCandidate;
      if (!candidate?.id) throw new Error("memory_candidate_missing");
      if (candidate.status !== "promoted" && candidate.status !== "approved") {
        const approval = await api.patch(
          `/huddle/intelligence/sessions/${sessionId}/memory-candidates/${candidate.id}`,
          {
            status: "approved",
            expectedStatus: candidate.status,
            metadata: {
              reviewedInMeetingIntelligence: true,
              explicitWorkspacePromotion: true,
            },
          }
        );
        candidate = approval.data?.memoryCandidate || candidate;
      }
      if (candidate.status !== "promoted") {
        await api.post(
          `/huddle/intelligence/sessions/${sessionId}/memory-candidates/${candidate.id}/promote`
        );
      }
      toast.success("Meeting knowledge added to workspace memory");
      setActiveTab("memory");
      await load();
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.reason ||
        "Meeting knowledge could not be added to workspace memory"
      );
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
        { question: copilotQuestion, scope: copilotScope }
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
      new Blob([`\uFEFF${reportMarkdown(review)}`], {
        type: "text/markdown;charset=utf-8",
      })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `huddle-intelligence-${sessionId}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const shareMeetingIntelligence = async () => {
    const title = review?.session?.title || "Huddle Meeting Intelligence";
    const text = summaryText
      ? `${title}\n\n${summaryText}`
      : `${title}\n\nMeeting intelligence is ready.`;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Meeting Intelligence link copied");
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        toast.error("Meeting Intelligence could not be shared");
      }
    }
  };

  const downloadPdfExport = async () => {
    const { jsPDF } = await import("jspdf");
    const document = new jsPDF({ unit: "pt", format: "a4" });
    let pdfFont = "helvetica";
    try {
      await installPdfUnicodeFont(document);
      pdfFont = "NotoSansDevanagari";
    } catch {
      toast.error("Unicode font could not be loaded; PDF text may be limited");
    }
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
      document.setFont(pdfFont, bold ? "bold" : "normal");
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
    heading("Meeting Purpose");
    write(review.report?.executiveSummary?.purpose || review.session.title);
    heading("Discussion Summary");
    discussionSummaryForReview(review).forEach((item) =>
      bullet(`${item.text}${evidence(item.evidenceSegmentIds)}`)
    );
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
    heading("Open Questions");
    (review.report?.openQuestions || []).forEach((item) =>
      bullet(`${item.question}${evidence(item.evidenceSegmentIds)}`)
    );
    heading("Risks and Blockers");
    (review.report?.risks || []).forEach((item) =>
      bullet(`${item.text || item.question || item}${evidence(item.evidenceSegmentIds)}`)
    );
    heading("Next Steps");
    (review.report?.nextSteps || []).forEach((item) =>
      bullet(`${item.text || item}${evidence(item.evidenceSegmentIds)}`)
    );
    heading("Transcript");
    review.transcript.forEach((segment) =>
      write(
        `${timeOnly(segment.startedAt)} | ${speakerNameFromReview(review, segment)}: ${segment.text} [T:${segment.id}]`,
        { size: 9, gap: 5 }
      )
    );
    const pageCount = document.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      document.setPage(page);
      document.setFont(pdfFont, "normal");
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
  const decisionList = review.report?.decisions || decisions?.contentJson?.decisions || [];
  const actionList = review.report?.actionItems || actions?.contentJson?.actionItems || [];
  const pendingReviewCount = Number(review.status.pendingReviewCount || 0);
  const transcriptText = review.transcript
    .map((segment) => `${speakerNameFromReview(review, segment)}: ${segment.text}`)
    .join("\n");
  const summaryText = summary?.contentText || artifactContentText("summary", summary?.contentJson || {});
  const discussionSummaryItems = discussionSummaryForReview(review);
  const headerStats = [
    ["Summary", review.status.summaryAvailable ? "Ready" : "Unavailable"],
    ["Decisions", review.status.decisionCount],
    ["Actions", review.status.actionItemCount],
    ["Review", pendingReviewCount > 0 ? `${pendingReviewCount} pending` : "Clear"],
  ];

  return (
    <main className="min-h-full bg-[var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[var(--surface)] px-4 py-6 sm:px-7">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--primary)]">Meeting Intelligence</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{review.session.title}</h1>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                {dateTime(review.session.startedAt)} · {review.participants.length} participant{review.participants.length === 1 ? "" : "s"}
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-muted)]">
                Evidence-linked summary, decisions, actions, transcript, and review controls for this Huddle.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={shareMeetingIntelligence} className="inline-flex items-center gap-2 rounded border border-[color:var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-soft)]">
                <Share2 size={15} /> Share
              </button>
              <button type="button" onClick={() => copyText(summaryText, "Summary")} className="inline-flex items-center gap-2 rounded border border-[color:var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-soft)]">
                <ClipboardCopy size={15} /> Copy summary
              </button>
              <details className="relative">
                <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded border border-[color:var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-soft)]">
                  <FileDown size={15} /> Export
                </summary>
                <div className="absolute right-0 z-20 mt-2 grid min-w-48 overflow-hidden rounded border border-[color:var(--border)] bg-[var(--surface)] p-1 shadow-xl">
                  <button type="button" onClick={() => copyText(transcriptText, "Transcript")} className="rounded px-3 py-2 text-left text-sm hover:bg-[var(--surface-soft)]">Copy transcript</button>
                  <button type="button" onClick={() => copyText(reportMarkdown(review), "Meeting report")} className="rounded px-3 py-2 text-left text-sm hover:bg-[var(--surface-soft)]">Copy full report</button>
                  <button type="button" onClick={downloadMarkdownExport} className="rounded px-3 py-2 text-left text-sm hover:bg-[var(--surface-soft)]">Download Markdown</button>
                  <button type="button" onClick={downloadPdfExport} className="rounded px-3 py-2 text-left text-sm hover:bg-[var(--surface-soft)]">Download PDF</button>
                </div>
              </details>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {headerStats.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-[color:var(--border)] bg-[var(--background)] px-4 py-3">
                <div className="text-xs font-medium text-[color:var(--text-muted)]">{label}</div>
                <div className="mt-1 text-lg font-semibold">{value}</div>
              </div>
            ))}
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
        </div>
      </header>

      <nav className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[var(--background)]/95 px-4 backdrop-blur sm:px-7" aria-label="Meeting intelligence sections">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto py-2">
          {TABS.map(({ id, label, group }, index) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded px-3 py-2 text-sm font-medium ${
                activeTab === id
                  ? "bg-[var(--surface-soft)] text-[color:var(--primary)]"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
              } ${index > 0 && TABS[index - 1].group !== group ? "ml-2 border-l border-[color:var(--border)] pl-4" : ""}`}
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
                  {review.report?.executiveSummary?.businessContext && (
                    <div>
                      <div className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Business context</div>
                      <p className="mt-1 text-sm leading-6">{review.report.executiveSummary.businessContext}</p>
                    </div>
                  )}
                </div>
                {review.report?.executiveSummary?.narrative && (
                  <>
                    <h3 className="mb-3 mt-7 font-semibold">Executive summary</h3>
                    <div className="space-y-3 border-y border-[color:var(--border)] py-4">
                      {review.report.executiveSummary.narrative.split(/\n{2,}|\n/).filter((p) => p.trim()).map((para, index) => (
                        <p key={index} className="text-sm leading-7">{para.trim()}</p>
                      ))}
                      <EvidenceButton ids={review.report?.executiveSummary?.evidenceSegmentIds} onOpen={showEvidence} />
                    </div>
                  </>
                )}
                {(review.report?.discussionThemes || []).length > 0 && (
                  <>
                    <h3 className="mb-3 mt-7 font-semibold">Discussion themes</h3>
                    <div className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
                      {review.report.discussionThemes.map((item) => (
                        <div key={item.id} className="py-4">
                          <div className="text-sm font-semibold text-[color:var(--primary)]">{item.theme}</div>
                          <p className="mt-1 text-sm leading-6">{item.detail}</p>
                          <div className="mt-2"><EvidenceButton ids={item.evidenceSegmentIds} onOpen={showEvidence} /></div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {(review.report?.recommendations || []).length > 0 && (
                  <>
                    <h3 className="mb-3 mt-7 font-semibold">Recommendations</h3>
                    <ul className="space-y-2 border-y border-[color:var(--border)] py-4 text-sm leading-6">
                      {review.report.recommendations.map((item) => (
                        <li key={item.id} className="flex gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                          <span>{item.text}</span>
                        </li>
                      ))}
                    </ul>
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
                {(review.report?.nextSteps || []).length > 0 && (
                  <>
                    <h3 className="mb-3 mt-7 font-semibold">Next steps</h3>
                    <div className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
                      {review.report.nextSteps.map((item, index) => (
                        <div key={item.id || index} className="py-3">
                          <p className="text-sm leading-6">{item.text || item}</p>
                          <EvidenceButton ids={item.evidenceSegmentIds} onOpen={showEvidence} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {summary.approvalStatus === "approved" && (
                  <button type="button" disabled={busyId === `memory:${summary.id}`} onClick={() => addArtifactToWorkspaceMemory(summary)} className="mt-5 inline-flex items-center gap-2 rounded bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[color:var(--primary-contrast)] disabled:opacity-50">
                    {busyId === `memory:${summary.id}` ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />} Add to workspace memory
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
                      <div className="text-sm font-semibold">{speakerNameFromReview(review, segment)}</div>
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
              {decisionList.map((item) => (
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
              {decisionList.length === 0 && (
                <p className="py-7 text-sm text-[color:var(--text-muted)]">
                  No explicit decision was identified in this meeting.
                </p>
              )}
            </div>
            <Provenance artifact={decisions} />
            {decisions?.approvalStatus === "approved" && (
              <button type="button" disabled={busyId === `memory:${decisions.id}`} onClick={() => addArtifactToWorkspaceMemory(decisions)} className="mt-5 inline-flex items-center gap-2 rounded bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[color:var(--primary-contrast)] disabled:opacity-50">
                {busyId === `memory:${decisions.id}` ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />} Add to workspace memory
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
              {actionList.map((item) => {
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
              {actionList.length === 0 && (
                <p className="py-7 text-sm text-[color:var(--text-muted)]">
                  No explicit action item was identified in this meeting.
                </p>
              )}
            </div>
            <Provenance artifact={actions} />
            {actions?.approvalStatus === "approved" && (
              <button type="button" disabled={busyId === `memory:${actions.id}`} onClick={() => addArtifactToWorkspaceMemory(actions)} className="mt-5 inline-flex items-center gap-2 rounded bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[color:var(--primary-contrast)] disabled:opacity-50">
                {busyId === `memory:${actions.id}` ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />} Add to workspace memory
              </button>
            )}
          </section>
        )}

        {activeTab === "risks" && (
          <section>
            <h2 className="text-xl font-semibold">Risks & Blockers</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Extracted as a dedicated stage, separate from the executive summary — each item is evidence-bound to the moment it was raised.
            </p>
            {supplementLoading.risks ? (
              <div className="mt-6 flex items-center gap-2 text-sm text-[color:var(--text-muted)]">
                <Loader2 size={15} className="animate-spin" /> Loading risk register…
              </div>
            ) : (
              <div className="mt-5 divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
                {riskBlockerItems.map((item) => {
                  const severityColor =
                    item.severity === "high"
                      ? "text-[color:var(--score-danger)] border-[color:var(--score-danger)]"
                      : item.severity === "low"
                        ? "text-[color:var(--text-muted)] border-[color:var(--border)]"
                        : "text-[color:var(--score-warning)] border-[color:var(--score-warning)]";
                  return (
                    <div key={item.id} className="py-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${severityColor}`}>
                          {item.severity}
                        </span>
                        <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--text-muted)]">
                          {item.itemType}
                        </span>
                        {item.status !== "open" && (
                          <span className="text-[10px] font-medium text-[color:var(--text-muted)]">{item.status}</span>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-6">{item.text}</p>
                      <EvidenceButton ids={item.evidenceSegmentIds} onOpen={showEvidence} />
                    </div>
                  );
                })}
                {riskBlockerItems.length === 0 && (
                  <p className="py-7 text-sm text-[color:var(--text-muted)]">
                    No risks or blockers were identified in this meeting.
                  </p>
                )}
              </div>
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
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">Approved meeting artifacts become searchable workspace knowledge only after an explicit reviewer action. Every promotion remains auditable and reversible.</p>
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
                  Ask about this meeting or trace decisions and commitments across your workspace.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700">
                <Check size={13} /> Evidence required
              </span>
            </div>
            <div className="mt-5 inline-flex rounded border border-[color:var(--border)] bg-[var(--surface-soft)] p-1">
              {[
                ["meeting", "This meeting"],
                ["workspace", "Across meetings"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCopilotScope(value)}
                  className={`rounded px-3 py-1.5 text-sm font-medium ${
                    copilotScope === value
                      ? "bg-[var(--surface)] text-[color:var(--text)] shadow-sm"
                      : "text-[color:var(--text-muted)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {COPILOT_PROMPTS[copilotScope].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setCopilotQuestion(prompt)}
                  className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[color:var(--text)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <form onSubmit={askCopilot} className="mt-5 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search size={16} className="absolute left-3 top-3 text-[color:var(--text-muted)]" />
                <input
                  value={copilotQuestion}
                  onChange={(event) => setCopilotQuestion(event.target.value)}
                  placeholder={
                    copilotScope === "workspace"
                      ? "Ask about decisions, commitments, topics, or changes across meetings"
                      : "Ask what was decided, who owns an action, or what remains unresolved"
                  }
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
                        onClick={() => {
                          if (
                            evidence.type === "transcript" &&
                            String(evidence.sessionId || sessionId) === String(sessionId)
                          ) {
                            showEvidence([evidence.id]);
                          } else if (
                            evidence.sessionId &&
                            String(evidence.sessionId) !== String(sessionId)
                          ) {
                            navigate(`/huddles/${evidence.sessionId}/intelligence`);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--primary)] hover:bg-[var(--surface-soft)]"
                      >
                        <FileText size={12} />
                        <span>{evidence.meetingTitle || evidence.label}</span>
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
                  {supplementLoading.copilot
                    ? "Loading Copilot history..."
                    : "No questions have been asked about this meeting yet."}
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
            {supplementLoading.quality ? (
              <div className="flex items-center gap-2 py-8 text-sm text-[color:var(--text-muted)]">
                <Loader2 size={15} className="animate-spin" /> Loading media quality...
              </div>
            ) : quality ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Quality score", `${quality.score}/100`],
                    ["Round-trip time", quality.metrics?.averageRttMs == null ? "No data" : `${quality.metrics.averageRttMs} ms`],
                    ["Packet loss", quality.metrics?.averagePacketLoss == null ? "No data" : `${(quality.metrics.averagePacketLoss * 100).toFixed(2)}%`],
                    ["Receive resolution", quality.metrics?.maxReceiveResolution || "No data"],
                    ["Send resolution", quality.metrics?.maxSendResolution || "No data"],
                    ["Bitrate", quality.metrics?.averageBitrateKbps == null ? "No data" : `${quality.metrics.averageBitrateKbps} kbps`],
                    ["Send frame rate", quality.metrics?.averageSendFps == null ? "No data" : `${quality.metrics.averageSendFps} fps`],
                    ["Receive frame rate", quality.metrics?.averageReceiveFps == null ? "No data" : `${quality.metrics.averageReceiveFps} fps`],
                    ["Video codecs", quality.metrics?.videoCodecs?.join(", ") || "No data"],
                    ["Estimated data", quality.metrics?.estimatedMegabytesPerHour == null ? "No data" : `${quality.metrics.estimatedMegabytesPerHour} MB/hour`],
                    ["Join after click", quality.metrics?.averageIntentToJoinMs == null ? "No data" : `${quality.metrics.averageIntentToJoinMs} ms`],
                    ["First remote audio", quality.metrics?.averageFirstAudioMs == null ? "No data" : `${quality.metrics.averageFirstAudioMs} ms`],
                    ["First remote video", quality.metrics?.averageFirstVideoMs == null ? "No data" : `${quality.metrics.averageFirstVideoMs} ms`],
                    ["Captions active", quality.metrics?.averageCaptionsActiveMs == null ? "No data" : `${quality.metrics.averageCaptionsActiveMs} ms`],
                    ["Real-device samples", quality.realDeviceSampleCount],
                    ["Screen-share tracks", quality.metrics?.screenShareTrackCount || 0],
                    ["Tile target match", quality.metrics?.renderTargetMatchRate == null ? "No data" : `${Math.round(quality.metrics.renderTargetMatchRate * 100)}%`],
                    ["Requested receive size", quality.metrics?.averageRequestedReceiveWidth == null ? "No data" : `${Math.round(quality.metrics.averageRequestedReceiveWidth)}x${Math.round(quality.metrics.averageRequestedReceiveHeight || 0)}`],
                    ["Screen-share send", quality.metrics?.averageScreenShareSendBitrateKbps == null ? "No data" : `${quality.metrics.averageScreenShareSendBitrateKbps} kbps`],
                    ["Screen-share receive", quality.metrics?.averageScreenShareReceiveBitrateKbps == null ? "No data" : `${quality.metrics.averageScreenShareReceiveBitrateKbps} kbps`],
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
                {Object.keys(quality.metrics?.qualityLimitationReasons || {}).length > 0 && (
                  <div className="mt-4 text-sm text-[color:var(--text-muted)]">
                    Quality limitations: {Object.entries(quality.metrics.qualityLimitationReasons)
                      .map(([reason, count]) => `${reason} (${count})`)
                      .join(", ")}
                  </div>
                )}
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
