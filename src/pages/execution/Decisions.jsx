// src/pages/execution/Decisions.jsx
import { useState } from "react";
import { Button, Badge } from "../../components/ui";
import { executionApi, execError } from "../../services/execution.api";
import { PageHeader, Panel, AsyncState, JsonView, useAsync, statusTone } from "./_shared";

export default function Decisions() {
  const query = useAsync(() => executionApi.decisions(), []);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const open = async (id) => {
    setErr(null);
    try { setDetail(await executionApi.decision(id)); } catch (e) { setErr(execError(e)); }
  };
  const run = async (id) => {
    setBusy(true); setErr(null);
    try { await executionApi.runDecision(id, { mode: "manager" }); await open(id); query.reload(); }
    catch (e) { setErr(execError(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Decisions" subtitle="Every recommendation that becomes an action is a first-class Decision, carried through approval → execution → verification with full history." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Decisions">
          <AsyncState query={query} empty="No decisions yet. They are created from Enterprise Intelligence recommendations.">
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
