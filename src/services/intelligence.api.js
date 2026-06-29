import { useApi } from "../api";
/**
 * ===============================
 * USER INTELLIGENCE (READ-ONLY)
 * ===============================
 * - Enterprise score
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
export const getAdminInsights = (month, range = "30d") => {
  const api = useApi();

  return api.get("/intelligence/insights", {
    params: { month, range },
  });
};

/**
 * ===============================
 * EXECUTIVE SUMMARY (ADMINS ONLY)
 * ===============================
 * - Selected-period executive summary
 * - No user-level data
 */
export const getExecutiveSummary = (month, range = "30d") => {
  const api = useApi();

  return api.get("/intelligence/admin/executive-summary", {
    params: { month, range },
  });
};
