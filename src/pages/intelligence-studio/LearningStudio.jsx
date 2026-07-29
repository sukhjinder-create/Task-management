// src/pages/intelligence-studio/LearningStudio.jsx
import { useState } from "react";
import { Button, Badge } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, JsonView, AsyncState, useAsync, statusTone } from "./_shared";

export default function LearningStudio() {
  const query = useAsync(() => eiApi.learning(), []);
  const [sel, setSel] = useState(null);
  return (
    <div>
      <PageHeader title="Learning Studio" subtitle="Learning proposals derived only from verified outcomes — admissibility, confounding, and the review queue. Nothing auto-publishes." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Proposal queue">
          <AsyncState query={query} empty="No learning proposals yet.">
            {(d) => (
              <div className="space-y-1.5">
                {(d.proposals || []).map((p) => (
                  <button key={p.proposalId} onClick={() => setSel(p)} className="w-full text-left rounded-[8px] border border-[color:var(--border)] px-3 py-2.5 hover:bg-[var(--surface-soft)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-[color:var(--text)] truncate">{p.kind} → {p.target}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={statusTone(p.status)}>{p.status}</Badge>
                        {p.admissible === false && <Badge variant="danger">confounded</Badge>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </AsyncState>
        </Panel>
        <Panel title={sel ? "Proposal detail" : "Review history"}>
          {sel ? <JsonView data={sel} /> : (
            <AsyncState query={query} empty="No reviews.">
              {(d) => (d.reviews || []).length ? (
                <div className="space-y-1.5">
                  {(d.reviews || []).map((r) => (
                    <div key={r.decision_id} className="flex items-center justify-between rounded-[8px] border border-[color:var(--border)] px-3 py-2">
                      <span className="text-[12px] text-[color:var(--text-muted)] truncate">{r.proposal_id}</span>
                      <Badge variant={statusTone(r.decision)}>{r.decision}</Badge>
                    </div>
                  ))}
                </div>
              ) : <p className="text-[13px] text-[color:var(--text-soft)]">Select a proposal, or no reviews recorded yet.</p>}
            </AsyncState>
          )}
        </Panel>
      </div>
    </div>
  );
}
