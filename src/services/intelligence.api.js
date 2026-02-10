import { useApi } from "../api";
/**
 * ===============================
 * USER INTELLIGENCE (READ-ONLY)
 * ===============================
 * - Monthly score
 * - Explanation
 * - Coaching nudges
 */
export const getUserMonthlyPerformance = (month) => {
  const api = useApi();

  return api.get("/intelligence/user/performance", {
    params: { month },
  });
};

/**
 * ===============================
 * ADMIN INTELLIGENCE (READ-ONLY)
 * ===============================
 * - Organization insights
 * - Coaching effectiveness
 */
export const getAdminInsights = (month) => {
  const api = useApi();

  return api.get("/intelligence/admin/insights", {
    params: { month },
  });
};

/**
 * ===============================
 * EXECUTIVE SUMMARY (ADMINS ONLY)
 * ===============================
 * - Aggregated monthly summary
 * - No user-level data
 */
export const getExecutiveSummary = (month) => {
  const api = useApi();

  return api.get("/intelligence/admin/executive-summary", {
    params: { month },
  });
};
