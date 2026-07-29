// src/pages/intelligence-studio/OrganizationalMemory.jsx
import { useState } from "react";
import { Button, Badge, Input } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, JsonView, AsyncState, useAsync } from "./_shared";

const KIND_LABEL = { validated_pattern: "Pattern", repeated_failure: "Repeated failure", successful_intervention: "Successful intervention", seasonality: "Seasonality", baseline: "Baseline", historical_distribution: "Distribution" };

export default function OrganizationalMemory() {
  const query = useAsync(() => eiApi.memory(), []);
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState("");
  return (
    <div>
      <PageHeader title="Organizational Memory" subtitle="Long-term, versioned organizational knowledge: patterns, repeated failures, successful interventions, baselines and distributions." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Memory" actions={<Input placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 w-40" />}>
          <AsyncState query={query} empty="No organizational memory yet.">
            {(d) => (
              <div className="space-y-1.5">
                {(d.memory || []).filter((m) => !filter || `${m.kind} ${m.key}`.toLowerCase().includes(filter.toLowerCase())).map((m) => (
                  <button key={m.memoryId} onClick={() => setSel(m)} className="w-full text-left rounded-[8px] border border-[color:var(--border)] px-3 py-2.5 hover:bg-[var(--surface-soft)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-[color:var(--text)] truncate">{m.key}</span>
                      <Badge variant="neutral">{KIND_LABEL[m.kind] || m.kind}</Badge>
                    </div>
                    <div className="text-[11px] text-[color:var(--text-soft)] mt-0.5">v{m.version}</div>
                  </button>
                ))}
              </div>
            )}
          </AsyncState>
        </Panel>
        <Panel title="Detail">{sel ? <JsonView data={sel} /> : <p className="text-[13px] text-[color:var(--text-soft)]">Select a memory record.</p>}</Panel>
      </div>
    </div>
  );
}
