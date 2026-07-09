// src/pages/intelligence-studio/GlobalSearch.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Badge, Input } from "../../components/ui";
import { eiApi, eiError } from "../../services/ei.api";
import { PageHeader, Panel } from "./_shared";

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const run = async (e) => {
    e?.preventDefault?.();
    if (!q.trim()) return;
    setBusy(true); setErr(null);
    try { const d = await eiApi.search(q.trim()); setResults(d.results || []); }
    catch (ex) { setErr(eiError(ex)); setResults(null); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Intelligence Search" subtitle="Search every intelligence object — evidence, traces, predictions, recommendations, outcomes, experiments, learning and memory." />
      <Panel>
        <form onSubmit={run} className="flex items-center gap-2">
          <Input autoFocus placeholder="Search ids, predicates, types…" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
          <Button size="sm" type="submit" loading={busy}>Search</Button>
        </form>
        {err && <p className="text-[12px] text-[color:var(--score-danger)] mt-3">{err.message}</p>}
        {results && (
          <div className="mt-4 space-y-1.5">
            {results.length === 0 && <p className="text-[13px] text-[color:var(--text-soft)]">No matches.</p>}
            {results.map((r) => (
              <Link key={`${r.type}:${r.id}`} to={r.route} className="flex items-center justify-between rounded-[8px] border border-[color:var(--border)] px-3 py-2 hover:bg-[var(--surface-soft)]">
                <span className="text-[12.5px] text-[color:var(--text)] truncate">{r.label || r.id}</span>
                <Badge variant="neutral">{r.type}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
