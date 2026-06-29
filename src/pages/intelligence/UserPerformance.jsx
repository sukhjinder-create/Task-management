import { useEffect, useState } from "react";
import { getUserMonthlyPerformance } from "../../services/intelligence.api";

export default function UserPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const month = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    let mounted = true;

    getUserMonthlyPerformance(month)
      .then((res) => {
        if (mounted) setData(res.data || null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => (mounted = false);
  }, [month]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)] py-8">
        <span className="animate-pulse">Loading performance…</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="border border-[color:var(--border)] rounded-lg p-6 text-sm text-[color:var(--text-muted)]">
        No performance data available.
      </div>
    );
  }

  const score = data.score || 0;
  const previousScore = Number.isFinite(Number(data.previousScore)) ? Number(data.previousScore) : null;
  const delta = previousScore == null ? null : score - previousScore;

  const breakdown = data.breakdown || {};
  const scoreExplanation = data.scoreExplanation || {};
  const scoreTooltip = data.scoreTooltip || scoreExplanation.scoreTooltip || {};
  const scoreTrace = data.scoreTrace || scoreExplanation.scoreTrace || scoreTooltip.scoreTrace || {};
  const coverage = scoreTooltip.coveragePeriod || {};
  const weightedContribution = Array.isArray(scoreTooltip.weightedContribution)
    ? scoreTooltip.weightedContribution
    : [];

  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (score / 100) * circumference;

  const scoreColorClass =
    score >= 75
      ? "text-[color:var(--primary)]"
      : score >= 50
      ? "text-[color:var(--score-warning)]"
      : "text-[color:var(--score-danger)]";

  const scoreStroke =
    score >= 75 ? "var(--primary)" : score >= 50 ? "var(--score-warning)" : "var(--score-danger)";

  const deltaColorClass =
    delta > 0 ? "text-[color:var(--primary)]" : "text-[color:var(--score-danger)]";

  function barColorClass(value) {
    if (value >= 75) return "bg-[var(--primary)]";
    if (value >= 50) return "bg-[var(--score-warning)]";
    return "bg-[var(--score-danger)]";
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">
            Intelligence
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">
            My Performance
          </h1>
          <p className="text-[13px] text-[color:var(--text-muted)] mt-1">
            Enterprise intelligence breakdown — {month}
          </p>
        </div>
      </header>

      {/* Score section */}
      <div className="border border-[color:var(--border)] rounded-lg p-5 flex items-center justify-between gap-6 flex-wrap">
        <div>
          <p className="text-sm text-[color:var(--text-muted)] mb-1">
            Enterprise Performance
          </p>
          {delta !== null && delta !== 0 && (
            <span className={`text-sm font-medium ${deltaColorClass}`}>
              {delta > 0 ? "↑" : "↓"} {Math.abs(delta)} from previous intelligence point
            </span>
          )}
          {delta === null && (
            <span className="text-sm font-medium text-[color:var(--text-muted)]">
              Previous intelligence point unavailable
            </span>
          )}
        </div>

        {/* Circular Meter */}
        <div className="relative w-40 h-40 shrink-0">
          <svg className="transform -rotate-90" width="160" height="160">
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="var(--surface-soft)"
              strokeWidth="12"
              fill="transparent"
            />
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke={scoreStroke}
              strokeWidth="12"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>

          <div className={`absolute inset-0 flex items-center justify-center text-3xl font-bold ${scoreColorClass}`}>
            {score}
          </div>
        </div>
      </div>

      {(scoreTooltip.authority || scoreTrace.finalScore != null) && (
        <div className="border border-[color:var(--border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-[color:var(--text)] mb-3">
            Score Explainability
          </h3>
          <div className="grid md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg border border-[color:var(--border)] p-3">
              <p className="text-[color:var(--text-muted)]">Authority</p>
              <p className="font-semibold text-[color:var(--text)] mt-1">
                {scoreTooltip.authority || scoreTrace.scoreAuthority}
              </p>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] p-3">
              <p className="text-[color:var(--text-muted)]">Confidence</p>
              <p className="font-semibold text-[color:var(--text)] mt-1">
                {scoreTooltip.confidence ?? scoreTrace.confidence ?? "—"}%
              </p>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] p-3">
              <p className="text-[color:var(--text-muted)]">Coverage</p>
              <p className="font-semibold text-[color:var(--text)] mt-1">
                {coverage.coverageStart || data.coverageStart || "—"} to {coverage.coverageEnd || data.coverageEnd || "—"}
              </p>
            </div>
          </div>
          {scoreTooltip.formula && (
            <p className="text-sm text-[color:var(--text-muted)] leading-relaxed mt-4">
              {scoreTooltip.formula}
            </p>
          )}
          {weightedContribution.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3 mt-4">
              {weightedContribution.slice(0, 6).map((item) => (
                <div key={item.key} className="rounded-lg border border-[color:var(--border)] p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-[color:var(--text)]">{item.label}</span>
                    <span className="text-[color:var(--primary)] font-semibold">{item.score ?? "—"}</span>
                  </div>
                  <p className="text-xs text-[color:var(--text-muted)] mt-1">
                    Contribution: {item.weightedContributionPoints ?? item.finalScoreImpactVsNeutral ?? "backend-owned"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Breakdown section */}
      <div className="border border-[color:var(--border)] rounded-lg p-5">
        <h3 className="text-sm font-semibold text-[color:var(--text)] mb-5">
          Score Breakdown
        </h3>

        <div className="space-y-5">
          {Object.entries(breakdown).map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="capitalize text-[color:var(--text-muted)]">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <span className={`font-medium ${
                  value >= 75
                    ? "text-[color:var(--primary)]"
                    : value >= 50
                    ? "text-[color:var(--score-warning)]"
                    : "text-[color:var(--score-danger)]"
                }`}>
                  {value}
                </span>
              </div>

              <div className="w-full bg-[var(--surface-soft)] rounded-full h-1">
                <div
                  className={`${barColorClass(value)} h-1 rounded-full transition-all duration-700`}
                  style={{ width: `${value}%` }}
                />
              </div>

              {/* Explanation per metric if available */}
              {data.reasoning?.evidence?.[key] && (
                <div className="text-xs text-[color:var(--text-soft)] mt-1">
                  {data.reasoning.evidence[key]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Overall explanation */}
      {data.reasoning?.explanation && (
        <div className="border border-[color:var(--border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-[color:var(--text)] mb-3">
            Detailed Explanation
          </h3>
          <p className="text-sm text-[color:var(--text-muted)] leading-relaxed">
            {data.reasoning.explanation}
          </p>
        </div>
      )}

      {/* Project performance */}
      {Array.isArray(data.projectScores) && data.projectScores.length > 0 && (
        <div className="border border-[color:var(--border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-[color:var(--text)] mb-5">
            Project Performance
          </h3>

          <div className="space-y-5">
            {data.projectScores.map((proj) => {
              const ps = proj.score || 0;
              return (
                <div key={proj.projectId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[color:var(--text-muted)] font-medium">
                      {proj.project_name || proj.projectName}
                    </span>
                    <span className={`font-semibold ${
                      ps >= 75
                        ? "text-[color:var(--primary)]"
                        : ps >= 50
                        ? "text-[color:var(--score-warning)]"
                        : "text-[color:var(--score-danger)]"
                    }`}>
                      {ps}
                    </span>
                  </div>

                  <div className="w-full bg-[var(--surface-soft)] rounded-full h-1">
                    <div
                      className={`${barColorClass(ps)} h-1 rounded-full transition-all duration-700`}
                      style={{ width: `${ps}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Coaching nudges */}
      {Array.isArray(data.coaching) && data.coaching.length > 0 && (
        <div className="border border-[color:var(--border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-[color:var(--text)] mb-5">
            Coaching Suggestions
          </h3>

          <div className="grid md:grid-cols-2 gap-3">
            {data.coaching.map((nudge, index) => (
              <div
                key={index}
                className="border border-[color:var(--border)] rounded-lg p-4 bg-[var(--surface-soft)]"
              >
                <div className="text-sm font-medium text-[color:var(--text)]">
                  {nudge.message}
                </div>

                {nudge.expectedImpact && (
                  <div className="text-xs text-[color:var(--text-muted)] mt-1">
                    Expected impact: {nudge.expectedImpact}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
