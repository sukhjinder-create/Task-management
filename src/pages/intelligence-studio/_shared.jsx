// src/pages/intelligence-studio/_shared.jsx
//
// Enterprise Intelligence Studio — shared building blocks. Real data only; honest
// loading / empty / error / disabled states. Reuses the Asystence design system.

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, EmptyState, Spinner } from "../../components/ui";
import { eiError } from "../../services/ei.api";

export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const run = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve().then(fn)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((err) => alive && setState({ data: null, loading: false, error: eiError(err) }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => run(), [run]);
  return { ...state, reload: run };
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-[color:var(--text)]">{title}</h1>
        {subtitle && <p className="text-[13px] text-[color:var(--text-soft)] mt-0.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className = "" }) {
  return (
    <Card className={className}>
      {(title || actions) && (
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-[13px]">{title}</CardTitle>
          {actions}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <Card><CardContent className="py-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-soft)]">{label}</p>
      <p className="text-[22px] font-semibold text-[color:var(--text)] mt-1 tabular-nums">{value ?? "—"}</p>
      {hint && <p className="text-[11px] text-[color:var(--text-soft)] mt-0.5">{hint}</p>}
    </CardContent></Card>
  );
}

export function JsonView({ data }) {
  return (
    <pre className="text-[11.5px] leading-relaxed overflow-auto rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)] p-3 text-[color:var(--text-muted)] max-h-[460px]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function Metric({ m }) {
  const insufficient = m.evidenceSufficient === false;
  return (
    <div className="flex items-center justify-between py-2 border-b border-[color:var(--border)] last:border-0">
      <span className="text-[12.5px] text-[color:var(--text-muted)]">{m.label || m.key}</span>
      {insufficient
        ? <Badge variant="neutral" title={m.reason}>insufficient evidence</Badge>
        : <span className="text-[13px] font-medium text-[color:var(--text)] tabular-nums">{typeof m.value === "object" ? JSON.stringify(m.value) : String(m.value)}</span>}
    </div>
  );
}

export function AsyncState({ query, empty = "Nothing here yet.", children }) {
  if (query.loading) return <div className="flex items-center gap-2 text-[color:var(--text-soft)] py-10 justify-center"><Spinner /> <span className="text-[13px]">Loading…</span></div>;
  if (query.error?.disabled) return <EmptyState title="Intelligence Studio disabled" description={query.error.message} />;
  if (query.error) return <EmptyState title="Couldn’t load" description={query.error.message} action={<Button size="sm" variant="secondary" onClick={query.reload}>Retry</Button>} />;
  const data = query.data;
  const isEmpty = !data || (Array.isArray(data) && data.length === 0);
  if (isEmpty) return <EmptyState title="Nothing yet" description={empty} />;
  return children(data);
}

export function tierTone(t) { return t === "C" ? "success" : t === "A" ? "warning" : "neutral"; }
export function statusTone(s) {
  const map = { attributed: "success", confirmed: "success", executed: "success", verified: "success", recommended: "success", approved: "success", candidate: "warning", insufficient_basis: "neutral", refuted: "danger", rejected: "danger", failed: "danger", blocked_confounded: "danger" };
  return map[s] || "neutral";
}
