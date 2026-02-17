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

  if (loading) return <div>Loading performance...</div>;
  if (!data) return <div>No performance data available.</div>;

  const score = data.score || 0;
  const previousScore = data.previousScore || 0;
  const delta = score - previousScore;

  const breakdown = data.breakdown || {};

  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (score / 100) * circumference;

  const scoreColor =
    score >= 75
      ? "text-emerald-600"
      : score >= 50
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="space-y-8">

      {/* =======================
          SCORE SECTION
      ======================== */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border flex items-center justify-between">

        <div>
          <h2 className="text-xl font-semibold">
            Monthly Performance – {month}
          </h2>

          <div className="mt-2 text-sm text-slate-500">
            {delta !== 0 && (
              <span className={delta > 0 ? "text-emerald-600" : "text-red-600"}>
                {delta > 0 ? "↑" : "↓"} {Math.abs(delta)} from last month
              </span>
            )}
          </div>
        </div>

        {/* Circular Meter */}
        <div className="relative w-40 h-40">
          <svg className="transform -rotate-90" width="160" height="160">
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="#e5e7eb"
              strokeWidth="12"
              fill="transparent"
            />
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="#3b82f6"
              strokeWidth="12"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>

          <div className={`absolute inset-0 flex items-center justify-center text-3xl font-bold ${scoreColor}`}>
            {score}
          </div>
        </div>
      </div>

      {/* =======================
          BREAKDOWN SECTION
      ======================== */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border">
        <h3 className="font-semibold mb-6">Score Breakdown</h3>

        <div className="space-y-5">
          {Object.entries(breakdown).map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="capitalize text-slate-700">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <span className="font-medium">{value}</span>
              </div>

              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-700"
                  style={{ width: `${value}%` }}
                />
              </div>

              {/* Explanation per metric if available */}
              {data.reasoning?.evidence?.[key] && (
                <div className="text-xs text-slate-500 mt-1">
                  {data.reasoning.evidence[key]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* =======================
          OVERALL EXPLANATION
      ======================== */}
      {data.reasoning?.explanation && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border">
          <h3 className="font-semibold mb-3">Detailed Explanation</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            {data.reasoning.explanation}
          </p>
        </div>
      )}

      {/* =======================
    PROJECT PERFORMANCE
======================= */}
{Array.isArray(data.projectScores) && data.projectScores.length > 0 && (
  <div className="bg-white p-8 rounded-2xl shadow-sm border">
    <h3 className="font-semibold mb-6">Project Performance</h3>

    <div className="space-y-5">
      {data.projectScores.map((proj) => (
        <div key={proj.projectId}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-700 font-medium">
              {proj.project_name || proj.projectName}
            </span>
            <span className="font-semibold">
              {proj.score || 0}
            </span>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-700"
              style={{ width: `${proj.score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
)}

      {/* =======================
          COACHING NUDGES
      ======================== */}
      {Array.isArray(data.coaching) && data.coaching.length > 0 && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border">
          <h3 className="font-semibold mb-6">Coaching Suggestions</h3>

          <div className="grid md:grid-cols-2 gap-4">
            {data.coaching.map((nudge, index) => (
              <div
                key={index}
                className="border rounded-xl p-4 bg-slate-50"
              >
                <div className="text-sm font-medium text-slate-800">
                  {nudge.message}
                </div>

                {nudge.expectedImpact && (
                  <div className="text-xs text-slate-500 mt-1">
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
