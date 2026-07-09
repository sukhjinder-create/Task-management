// src/pages/intelligence-studio/PredictionCenter.jsx
import { Link, useParams } from "react-router-dom";
import { Button, Badge } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, JsonView, AsyncState, useAsync, statusTone } from "./_shared";

function Detail({ id }) {
  const query = useAsync(() => eiApi.prediction(id), [id]);
  return (
    <div>
      <PageHeader title="Prediction" subtitle={id} actions={<Link to="/intelligence-studio/predictions"><Button size="sm" variant="secondary">← All predictions</Button></Link>} />
      <AsyncState query={query} empty="Prediction not found.">
        {(d) => (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Prediction">
              {d.prediction ? (<div className="space-y-2">
                <p className="text-[13px]">{d.prediction.predictionType} · <b>{d.prediction.predictionValue}</b> · p={d.prediction.probability}</p>
                {d.trace && <Link to={`/intelligence-studio/traces/${d.trace.traceId}`} className="text-[12px] text-[color:var(--primary)]">Supporting reasoning trace →</Link>}
                <JsonView data={d.prediction} />
              </div>) : <p className="text-[13px] text-[color:var(--text-soft)]">Not found.</p>}
            </Panel>
            <Panel title="Outcome history">
              {(d.outcomes || []).length ? (d.outcomes || []).map((o) => (
                <div key={o.outcomeId} className="flex items-center justify-between py-1.5 border-b border-[color:var(--border)] last:border-0">
                  <span className="text-[12px] text-[color:var(--text-muted)]">{o.observedAt}</span>
                  <Badge variant={statusTone(o.status)}>{o.status}</Badge>
                </div>
              )) : <p className="text-[13px] text-[color:var(--text-soft)]">No outcomes recorded yet.</p>}
            </Panel>
          </div>
        )}
      </AsyncState>
    </div>
  );
}

function List() {
  const query = useAsync(() => eiApi.predictions(), []);
  return (
    <div>
      <PageHeader title="Prediction Center" subtitle="Every prediction, its probability and confidence, linked to the reasoning trace and outcome history." />
      <AsyncState query={query} empty="No predictions yet.">
        {(d) => (
          <div className="space-y-1.5">
            {(d.predictions || []).map((p) => (
              <Link key={p.predictionId} to={`/intelligence-studio/predictions/${p.predictionId}`} className="block rounded-[8px] border border-[color:var(--border)] px-3 py-2.5 hover:bg-[var(--surface-soft)]">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-medium text-[color:var(--text)] truncate">{p.entity?.type} {p.entity?.id} · {p.predictionType}</span>
                  <Badge variant={p.predictionValue === "likely" ? "warning" : "neutral"}>p={p.probability}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </AsyncState>
    </div>
  );
}

export default function PredictionCenter() {
  const { id } = useParams();
  return id ? <Detail id={id} /> : <List />;
}
