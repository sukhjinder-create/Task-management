import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Check,
  ClipboardCopy,
  Clock3,
  Download,
  FileText,
  Gavel,
  ListChecks,
  Loader2,
  Pencil,
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
];

function TabIcon({ id }) {
  if (id === "summary") return <Sparkles size={15} />;
  if (id === "timeline") return <Clock3 size={15} />;
  if (id === "transcript") return <ScrollText size={15} />;
  if (id === "decisions") return <Gavel size={15} />;
  if (id === "actions") return <ListChecks size={15} />;
  return <UserCheck size={15} />;
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
      content.overview,
      ...(content.keyPoints || []).map((item) => `- ${item.text}`),
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

function ReviewStatus({ artifact }) {
  if (!artifact) return null;
  const approved = artifact.approvalStatus === "approved";
  const rejected = artifact.approvalStatus === "rejected";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
      approved
        ? "bg-emerald-500/10 text-emerald-600"
        : rejected
          ? "bg-red-500/10 text-red-600"
          : "bg-amber-500/10 text-amber-700"
    }`}>
      {approved ? <Check size={13} /> : rejected ? <X size={13} /> : <Clock3 size={13} />}
      {approved ? "Approved" : rejected ? "Rejected" : "Review required"}
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
      <button
        type="button"
        onClick={() => onDecision(artifact, "approved")}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <Check size={13} /> Approve
      </button>
      <button
        type="button"
        onClick={() => onDecision(artifact, "rejected")}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <X size={13} /> Reject
      </button>
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
  const transcriptRefs = useRef(new Map());

  const load = async () => {
    try {
      const response = await api.get(`/huddle/intelligence/sessions/${sessionId}/review`);
      setReview(response.data.review);
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
      await api.post(`/huddle/artifacts/${artifact.id}/${decision === "approved" ? "approve" : "reject"}`, {
        approvalNote: decision === "approved" ? "Approved in Meeting Intelligence" : "Rejected in Meeting Intelligence",
      });
      toast.success(decision === "approved" ? "Artifact approved" : "Artifact rejected");
      await load();
    } catch (requestError) {
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
        resolutionNote: status === "rejected" ? "Rejected in Meeting Intelligence" : "Approved in Meeting Intelligence",
      });
      toast.success(status === "rejected" ? "Ownership suggestion rejected" : "Ownership confirmed");
      await load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.reason || "Ownership review could not be saved");
    } finally {
      setBusyId(null);
    }
  };

  const downloadExport = () => {
    const payload = {
      ...review.export,
      session: review.session,
      participants: review.participants,
      summary: review.artifacts.summary,
      decisions: review.artifacts.decisions,
      actions: review.artifacts.actions,
      ownership: review.ownership,
      timeline: review.timeline,
      transcript: review.transcript,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `huddle-intelligence-${sessionId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
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
              <button type="button" onClick={downloadExport} title="Export meeting intelligence" className="inline-flex items-center gap-2 rounded bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[color:var(--primary-contrast)]">
                <Download size={15} /> Export
              </button>
            </div>
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
                <p className="max-w-4xl whitespace-pre-wrap text-[15px] leading-7">{summary.contentJson?.overview}</p>
                <EvidenceButton ids={summary.contentJson?.overviewEvidenceSegmentIds} onOpen={showEvidence} />
                <h3 className="mb-3 mt-7 font-semibold">Key points</h3>
                <div className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
                  {(summary.contentJson?.keyPoints || []).map((point) => (
                    <div key={point.id} className="py-4">
                      <p className="text-sm leading-6">{point.text}</p>
                      <div className="mt-2"><EvidenceButton ids={point.evidenceSegmentIds} onOpen={showEvidence} /></div>
                    </div>
                  ))}
                </div>
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
              {(decisions?.contentJson?.decisions || []).map((item) => (
                <article key={item.id} className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold">{item.title}</h3><span className="text-xs text-[color:var(--text-muted)]">{confidenceLabel(item.confidence)}</span></div>
                  <p className="mt-2 text-sm leading-6">{item.decision}</p>
                  {item.rationale && <p className="mt-2 text-sm text-[color:var(--text-muted)]">{item.rationale}</p>}
                  <div className="mt-3"><EvidenceButton ids={item.evidenceSegmentIds} onOpen={showEvidence} /></div>
                </article>
              ))}
            </div>
            <Provenance artifact={decisions} />
          </section>
        )}

        {activeTab === "actions" && (
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-xl font-semibold">Action items</h2><p className="text-sm text-[color:var(--text-muted)]">No task is created until a future explicit workflow is approved.</p></div>
              <div className="flex flex-wrap items-center gap-2"><ReviewStatus artifact={actions} /><ArtifactActions artifact={actions} canReview={review.permissions.canReviewArtifacts} canEdit={actions?.approvalStatus !== "approved" || review.permissions.canEditApprovedArtifacts} onEdit={setEditing} onDecision={decideArtifact} busy={busyId === actions?.id} /></div>
            </div>
            <div className="divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
              {(actions?.contentJson?.actionItems || []).map((item) => (
                <article key={item.id} className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold">{item.title}</h3><span className="text-xs text-[color:var(--text-muted)]">{confidenceLabel(item.confidence)}</span></div>
                  {item.description && <p className="mt-2 text-sm leading-6">{item.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-[color:var(--text-muted)]">
                    {item.suggestedOwner?.label && <span>Suggested owner: {item.suggestedOwner.label}</span>}
                    {item.dueDate && <span>Due: {item.dueDate}</span>}
                  </div>
                  <div className="mt-3"><EvidenceButton ids={item.evidenceSegmentIds} onOpen={showEvidence} /></div>
                </article>
              ))}
            </div>
            <Provenance artifact={actions} />
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
      </div>

      {editing && <ArtifactEditor artifact={editing} onClose={() => setEditing(null)} onSave={saveArtifact} saving={busyId === editing.id} />}
    </main>
  );
}
