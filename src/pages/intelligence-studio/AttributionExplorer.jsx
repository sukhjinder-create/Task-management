// src/pages/intelligence-studio/AttributionExplorer.jsx
import { useState } from "react";
import { Button, Badge } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, JsonView, AsyncState, useAsync, tierTone } from "./_shared";

const TIER_LABEL = { O: "Observed", A: "Associated", C: "Causal (verified)" };

export default function AttributionExplorer() {
  const query = useAsync(() => eiApi.attributions(), []);
  const [sel, setSel] = useState(null);
  return (
    <div>
      <PageHeader title="Attribution Explorer" subtitle="Observed → Associated → Causal. Confidence, confounders and alternative explanations — never overstating causation." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Attributions">
          <AsyncState query={query} empty="No attributions yet.">
            {(d) => (
              <div className="space-y-1.5">
                {(d.attributions || []).map((a) => (
                  <button key={a.attributionId} onClick={() => setSel(a)} className="w-full text-left rounded-[8px] border border-[color:var(--border)] px-3 py-2.5 hover:bg-[var(--surface-soft)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-[color:var(--text)] truncate">{a.ruleKey}</span>
                      <Badge variant={tierTone(a.tier)}>{TIER_LABEL[a.tier] || a.tier}</Badge>
                    </div>
                    {a.associationStrength != null && <div className="text-[11px] text-[color:var(--text-soft)] mt-0.5">strength {a.associationStrength}</div>}
                  </button>
                ))}
              </div>
            )}
          </AsyncState>
        </Panel>
        <Panel title="Detail">{sel ? <JsonView data={sel} /> : <p className="text-[13px] text-[color:var(--text-soft)]">Select an attribution.</p>}</Panel>
      </div>
    </div>
  );
}
