// src/pages/intelligence-studio/ExperimentCenter.jsx
import { useState } from "react";
import { Button, Badge } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, JsonView, AsyncState, useAsync } from "./_shared";

export default function ExperimentCenter() {
  const query = useAsync(() => eiApi.experiments(), []);
  const [sel, setSel] = useState(null);
  return (
    <div>
      <PageHeader title="Experiment Center" subtitle="A/B, holdout, randomized and policy experiments — declared arms, control/treatment groups, uplift and history." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Experiments">
          <AsyncState query={query} empty="No experiments yet.">
            {(d) => (
              <div className="space-y-1.5">
                {(d.experiments || []).map((x) => (
                  <button key={x.experimentId} onClick={() => setSel(x)} className="w-full text-left rounded-[8px] border border-[color:var(--border)] px-3 py-2.5 hover:bg-[var(--surface-soft)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-[color:var(--text)]">{x.key}</span>
                      <Badge variant="neutral">{x.design}</Badge>
                    </div>
                    <div className="text-[11px] text-[color:var(--text-soft)] mt-0.5">{(x.arms || []).map((a) => a.key).join(" / ")}</div>
                  </button>
                ))}
              </div>
            )}
          </AsyncState>
        </Panel>
        <Panel title="Detail">{sel ? <JsonView data={sel} /> : <p className="text-[13px] text-[color:var(--text-soft)]">Select an experiment.</p>}</Panel>
      </div>
    </div>
  );
}
