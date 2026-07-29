// src/pages/intelligence-studio/EvidenceExplorer.jsx
import { Button, Badge } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, JsonView, AsyncState, useAsync } from "./_shared";
import { useState } from "react";

export default function EvidenceExplorer() {
  const query = useAsync(() => eiApi.evidence(), []);
  const [sel, setSel] = useState(null);
  return (
    <div>
      <PageHeader title="Evidence Explorer" subtitle="Immutable, provenance-carrying evidence — supporting and contradicting — behind every attribution." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Evidence">
          <AsyncState query={query} empty="No evidence yet.">
            {(d) => (
              <div className="space-y-1.5">
                {(d.evidence || []).map((e) => (
                  <button key={e.evidenceId} onClick={() => setSel(e)} className="w-full text-left rounded-[8px] border border-[color:var(--border)] px-3 py-2.5 hover:bg-[var(--surface-soft)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-[color:var(--text)] truncate">{e.entity?.type} {e.entity?.id}</span>
                      <Badge variant="neutral">{e.confidenceSource}</Badge>
                    </div>
                    <div className="text-[11px] text-[color:var(--text-soft)] mt-0.5">{(e.supportingEvidence || []).length} supporting · {(e.contradictingEvidence || []).length} contradicting</div>
                  </button>
                ))}
              </div>
            )}
          </AsyncState>
        </Panel>
        <Panel title="Detail">{sel ? <JsonView data={sel} /> : <p className="text-[13px] text-[color:var(--text-soft)]">Select an evidence record.</p>}</Panel>
      </div>
    </div>
  );
}
