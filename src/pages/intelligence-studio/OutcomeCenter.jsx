// src/pages/intelligence-studio/OutcomeCenter.jsx
import { Button, Badge } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, AsyncState, useAsync, statusTone } from "./_shared";

export default function OutcomeCenter() {
  const query = useAsync(() => eiApi.outcomes(), []);
  return (
    <div>
      <PageHeader title="Outcome Center" subtitle="What actually happened — recommendation and prediction outcomes, with measured impact. The ground truth that closes the loop." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <Panel title="Outcomes timeline">
        <AsyncState query={query} empty="No outcomes recorded yet.">
          {(d) => (
            <div className="space-y-1.5">
              {(d.outcomes || []).map((o) => (
                <div key={o.outcomeId} className="flex items-center justify-between rounded-[8px] border border-[color:var(--border)] px-3 py-2">
                  <span className="text-[12px] text-[color:var(--text-muted)] truncate">{o.kind} · {o.subjectId}{o.impact ? ` · impact ${o.impact.actual}/${o.impact.expected}` : ""}</span>
                  <div className="flex items-center gap-2 shrink-0"><Badge variant={statusTone(o.status)}>{o.status}</Badge><span className="text-[11px] text-[color:var(--text-soft)]">{o.observedAt ? new Date(o.observedAt).toLocaleDateString() : ""}</span></div>
                </div>
              ))}
            </div>
          )}
        </AsyncState>
      </Panel>
    </div>
  );
}
