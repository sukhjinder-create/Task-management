import { useEffect, useState } from "react";
import { getExecutiveSummary } from "../../services/intelligence.api";

/**
 * ExecutiveSummary
 *
 * Admin-only, read-only view:
 * - Monthly executive summary
 * - Aggregated insights only
 */
export default function ExecutiveSummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Current month in YYYY-MM
  const month = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    let mounted = true;

    getExecutiveSummary(month)
      .then((res) => {
        if (mounted) setSummary(res.data || null);
      })
      .catch(() => {
        if (mounted)
          setError("Unable to load executive summary for this month");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [month]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] py-8">
        <span className="animate-pulse">Loading executive summary…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-[color:var(--score-danger)] rounded-lg p-4 text-sm text-[color:var(--score-danger)]">
        {error}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="border border-[color:var(--border)] rounded-lg p-6">
        <h2 className="text-[15px] font-semibold text-[color:var(--text)] mb-2">
          Executive Summary
        </h2>
        <p className="text-sm text-[color:var(--text-muted)] leading-relaxed">
          No executive summary is available yet.{" "}
          This will be generated after the monthly intelligence cycle completes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">
            Intelligence
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">
            Executive Summary
          </h1>
          <p className="text-[13px] text-[color:var(--text-muted)] mt-1">
            {month}
          </p>
        </div>
      </header>

      <div className="border border-[color:var(--border)] rounded-lg p-5">
        {Array.isArray(summary.sections) && summary.sections.length > 0 ? (
          <div className="space-y-4">
            {summary.sections.map((section) => (
              <section key={section.key || section.title}>
                <h2 className="text-sm font-semibold text-[color:var(--text)] mb-1">
                  {section.title}
                </h2>
                <p className="text-sm text-[color:var(--text-muted)] leading-relaxed">
                  {section.body}
                </p>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[color:var(--text)] leading-relaxed whitespace-pre-line">
            {summary.text || summary.summary || summary}
          </p>
        )}
      </div>
    </div>
  );
}
