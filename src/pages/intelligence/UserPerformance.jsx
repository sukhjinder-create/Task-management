import { useEffect, useState } from "react";
import { getUserMonthlyPerformance } from "../../services/intelligence.api";

/**
 * UserPerformance
 *
 * Read-only view:
 * - Monthly score
 * - Explanation
 * - Coaching nudges
 *
 * Safe even if no data exists yet
 */
export default function UserPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Current month in YYYY-MM
  const month = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    let mounted = true;

    getUserMonthlyPerformance(month)
      .then((res) => {
        if (mounted) setData(res.data || null);
      })
      .catch(() => {
        if (mounted) setError("Unable to load performance data");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [month]);

  if (loading) {
    return <div>Loading your performance…</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!data) {
    return (
      <div>
        <h2>Performance Overview</h2>
        <p>
          No performance data is available yet.  
          This will appear after the monthly evaluation runs.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>Performance Overview – {month}</h2>

      {/* SCORE */}
      <div style={{ marginTop: 16 }}>
        <strong>Score:</strong> {data.score}
      </div>

      {/* EXPLANATION */}
      {data.explanation && (
        <div style={{ marginTop: 16 }}>
          <strong>Explanation</strong>
          <p>{data.explanation}</p>
        </div>
      )}

      {/* COACHING */}
      {Array.isArray(data.coaching) && data.coaching.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>Coaching Suggestions</h3>
          <ul>
            {data.coaching.map((nudge) => (
              <li key={nudge.id}>
                {nudge.message}
                {nudge.expectedImpact && (
                  <em> (Impact: {nudge.expectedImpact})</em>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
