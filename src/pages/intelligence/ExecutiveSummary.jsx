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
    return <div>Loading executive summary…</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!summary) {
    return (
      <div>
        <h2>Executive Summary</h2>
        <p>
          No executive summary is available yet.  
          This will be generated after the monthly intelligence cycle completes.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>Executive Summary – {month}</h2>

      <div style={{ marginTop: 16, whiteSpace: "pre-line" }}>
        {summary.text || summary.summary || summary}
      </div>
    </div>
  );
}
