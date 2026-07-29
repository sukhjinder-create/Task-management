// src/pages/execution/Decisions.jsx
import { useState } from "react";
import { Button, Badge, Input, Select, Textarea } from "../../components/ui";
import { executionApi, execError } from "../../services/execution.api";
import { PageHeader, Panel, AsyncState, JsonView, useAsync, statusTone } from "./_shared";

const EMPTY = { recommendationId: "", reasoningTraceId: "", entityType: "Task", entityId: "", capabilityKey: "", inputText: "{\n  \n}" };

export default function Decisions() {
  const query = useAsync(() => executionApi.decisions(), []);
  const caps = useAsync(() => executionApi.capabilities(), []);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [createMsg, setCreateMsg] = useState(null);

  const open = async (id) => {
    setErr(null);
    try { setDetail(await executionApi.decision(id)); } catch (e) { setErr(execError(e)); }
  };
  const run = async (id) => {
    setBusy(true); setErr(null);
    try { await executionApi.runDecision(id, { mode: "manager" }); await open(id); query.reload(); }
    catch (e) { setErr(execError(e)); } finally { setBusy(false); }
  };
  const create = async () => {
    setBusy(true); setCreateMsg(null);
    try {
      const input = JSON.parse(form.inputText || "{}");
      const recommendation = {
        recommendationId: form.recommendationId,
        entity: { type: form.entityType, id: form.entityId },
        status: "recommended", requiresApproval: true, manualOnly: false,
        rationaleRefs: { reasoningTraceId: form.reasoningTraceId, predictionId: null, evidenceIds: [], attributionIds: [] },
      };
      const proposedAction = form.capabilityKey ? { capabilityKey: form.capabilityKey, input } : null;
      const { decision } = await executionApi.createDecision(recommendation, proposedAction);
      setCreateMsg({ ok: true, text: `Created ${decision.decisionId}.` });
      setForm(EMPTY); setShowCreate(false); query.reload(); open(decision.decisionId);
    } catch (e) {
      setCreateMsg({ ok: false, text: e instanceof SyntaxError ? "Action input is not valid JSON." : execError(e).message });
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader
        title="Decisions"
        subtitle="Every recommendation that becomes an action is a first-class Decision, carried through approval → execution → verification with full history."
        actions={<>
          <Button size="sm" onClick={() => setShowCreate((s) => !s)}>{showCreate ? "Close" : "New decision"}</Button>
          <Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>
        </>}
      />

      {showCreate && (
        <Panel title="Create decision" className="mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Recommendation ID" value={form.recommendationId} onChange={(e) => setForm({ ...form, recommendationId: e.target.value })} />
            <Input placeholder="Reasoning trace ID (required)" value={form.reasoningTraceId} onChange={(e) => setForm({ ...form, reasoningTraceId: e.target.value })} />
            <Input placeholder="Entity type (e.g. Task)" value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })} />
            <Input placeholder="Entity ID" value={form.entityId} onChange={(e) => setForm({ ...form, entityId: e.target.value })} />
            <Select value={form.capabilityKey} onChange={(e) => setForm({ ...form, capabilityKey: e.target.value })}>
              <option value="">No action (decision only)</option>
              {(caps.data?.capabilities || []).map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
            </Select>
            <div className="md:col-span-1" />
            <div className="md:col-span-2">
              <label className="text-[11px] text-[color:var(--text-soft)]">Action input (JSON)</label>
              <Textarea rows={4} value={form.inputText} onChange={(e) => setForm({ ...form, inputText: e.target.value })} className="font-mono text-[12px]" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" onClick={create} loading={busy} disabled={!form.recommendationId || !form.reasoningTraceId}>Create decision</Button>
            {createMsg && <span className={`text-[12px] ${createMsg.ok ? "text-[color:var(--score-good)]" : "text-[color:var(--score-danger)]"}`}>{createMsg.text}</span>}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Decisions">
          <AsyncState query={query} empty="No decisions yet. Create one above, or they arrive from Enterprise Intelligence recommendations.">
            {(data) => (
              <div className="space-y-1.5">
                {(data.decisions || []).map((d) => (
                  <button key={d.decision_id} onClick={() => open(d.decision_id)} className="w-full text-left rounded-[8px] border border-[color:var(--border)] px-3 py-2.5 hover:bg-[var(--surface-soft)] transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-[color:var(--text)] truncate">{d.decision_id}</span>
                      <Badge variant={statusTone(d.state)}>{d.state}</Badge>
                    </div>
                    <div className="text-[11px] text-[color:var(--text-soft)] mt-0.5">from {d.source_recommendation_id}</div>
                  </button>
                ))}
              </div>
            )}
          </AsyncState>
        </Panel>
        <Panel title="Detail" actions={detail && <Button size="sm" onClick={() => run(detail.decision.decision_id)} loading={busy}>Run pipeline</Button>}>
          {err && <p className="text-[12px] text-[color:var(--score-danger)] mb-2">{err.message}</p>}
          {detail ? (
            <div className="space-y-2">
              <Badge variant={statusTone(detail.state?.status)}>{detail.state?.status}</Badge>
              <JsonView data={detail} />
            </div>
          ) : <p className="text-[13px] text-[color:var(--text-soft)]">Select a decision to inspect its lifecycle, reasoning refs and events.</p>}
        </Panel>
      </div>
    </div>
  );
}
