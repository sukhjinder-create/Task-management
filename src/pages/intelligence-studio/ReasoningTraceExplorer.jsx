// src/pages/intelligence-studio/ReasoningTraceExplorer.jsx
import { Link, useParams } from "react-router-dom";
import { Button, Badge } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, JsonView, AsyncState, useAsync, statusTone, tierTone } from "./_shared";

function LinkList({ label, base, ids }) {
  if (!ids?.length) return null;
  return (
    <div className="mb-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-soft)] mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => base
          ? <Link key={id} to={`${base}/${id}`} className="text-[11.5px] rounded-[6px] border border-[color:var(--border)] px-2 py-1 hover:bg-[var(--surface-soft)] text-[color:var(--primary)]">{id}</Link>
          : <span key={id} className="text-[11.5px] rounded-[6px] border border-[color:var(--border)] px-2 py-1 text-[color:var(--text-muted)]">{id}</span>)}
      </div>
    </div>
  );
}

function Detail({ id }) {
  const query = useAsync(() => eiApi.trace(id), [id]);
  return (
    <div>
      <PageHeader title="Reasoning Trace" subtitle={id} actions={<Link to="/intelligence-studio/traces"><Button size="sm" variant="secondary">← All traces</Button></Link>} />
      <AsyncState query={query} empty="Trace not found.">
        {(d) => (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Claim & confidence">
              {d.trace ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={tierTone(d.trace.claim?.tier)}>tier {d.trace.claim?.tier}</Badge>
                    <Badge variant={statusTone(d.trace.claim?.status)}>{d.trace.claim?.status}</Badge>
                  </div>
                  <p className="text-[13px] text-[color:var(--text)]">{d.trace.claim?.entity?.type} {d.trace.claim?.entity?.id} — {d.trace.claim?.predicate}</p>
                  <JsonView data={d.trace.confidenceDecomposition} />
                </div>
              ) : <p className="text-[13px] text-[color:var(--text-soft)]">Not found.</p>}
            </Panel>
            <Panel title="Relationships (click to navigate)">
              <LinkList label="Predictions" base="/intelligence-studio/predictions" ids={d.relations?.predictions} />
              <LinkList label="Recommendations" base="/intelligence-studio/recommendations" ids={d.relations?.recommendations} />
              <LinkList label="Evidence" ids={d.relations?.referencedEvidence} />
              <LinkList label="Attributions" ids={d.relations?.referencedAttribution} />
              <LinkList label="Events" ids={d.relations?.referencedEvents} />
            </Panel>
            <div className="lg:col-span-2"><Panel title="Full trace"><JsonView data={d.trace} /></Panel></div>
          </div>
        )}
      </AsyncState>
    </div>
  );
}

function List() {
  const query = useAsync(() => eiApi.traces(), []);
  return (
    <div>
      <PageHeader title="Reasoning Trace Explorer" subtitle="Every structured reasoning trace — claim, tier, confidence decomposition — with full cross-navigation." />
      <AsyncState query={query} empty="No reasoning traces yet.">
        {(d) => (
          <div className="space-y-1.5">
            {(d.traces || []).map((t) => (
              <Link key={t.traceId} to={`/intelligence-studio/traces/${t.traceId}`} className="block rounded-[8px] border border-[color:var(--border)] px-3 py-2.5 hover:bg-[var(--surface-soft)]">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-medium text-[color:var(--text)] truncate">{t.claim?.entity?.type} {t.claim?.entity?.id} · {t.claim?.predicate}</span>
                  <div className="flex items-center gap-1.5"><Badge variant={tierTone(t.claim?.tier)}>{t.claim?.tier}</Badge><Badge variant={statusTone(t.claim?.status)}>{t.claim?.status}</Badge></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </AsyncState>
    </div>
  );
}

export default function ReasoningTraceExplorer() {
  const { id } = useParams();
  return id ? <Detail id={id} /> : <List />;
}
