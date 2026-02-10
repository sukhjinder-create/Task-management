import { useEffect, useState } from "react";
import { getAdminInsights } from "../../services/intelligence.api";

/**
 * AdminIntelligence
 *
 * Read-only admin view:
 * - Org score overview
 * - Coaching effectiveness
 * - Risk distribution
 *
 * Safe if no data exists yet
 */
export default function AdminIntelligence() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Current month in YYYY-MM
  const month = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    let mounted = true;

    getAdminInsights(month)
      .then((res) => {
        if (mounted) setData(res.data || null);
      })
      .catch(() => {
        if (mounted) setError("Unable to load admin intelligence data");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [month]);

  if (loading) {
    return <div>Loading organization intelligence…</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!data) {
    return (
      <div>
        <h2>Organization Intelligence</h2>
        <p>
          No intelligence data is available yet.  
          This will appear after the monthly evaluation runs.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>Organization Intelligence – {month}</h2>

      {/* ORG SCORE OVERVIEW */}
      {data.orgScore && (
        <div style={{ marginTop: 16 }}>
          <h3>Score Overview</h3>
          <ul>
            <li>Average score: {data.orgScore.averageScore}</li>
            <li>Total users: {data.orgScore.userCount}</li>
            <li>High performers: {data.orgScore.highPerformers}</li>
            <li>At-risk users: {data.orgScore.atRiskUsers}</li>
          </ul>
        </div>
      )}

      {/* COACHING EFFECTIVENESS */}
      {data.coachingEffectiveness && (
        <div style={{ marginTop: 24 }}>
          <h3>Coaching Effectiveness</h3>
          <ul>
            {Object.entries(data.coachingEffectiveness).map(
              ([key, value]) => (
                <li key={key}>
                  {key}: {value}
                </li>
              )
            )}
          </ul>
        </div>
      )}

      {/* RISK DISTRIBUTION */}
      {data.riskDistribution && (
        <div style={{ marginTop: 24 }}>
          <h3>Risk Distribution</h3>
          <ul>
            <li>Low risk: {data.riskDistribution.lowRisk}</li>
            <li>Medium risk: {data.riskDistribution.mediumRisk}</li>
            <li>High risk: {data.riskDistribution.highRisk}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
