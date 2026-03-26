// src/context/PlanContext.jsx
//
// Loads the workspace plan features once on mount and provides hasFeature(key).
// Wrap the app (inside AuthProvider) so every route can call useFeature().

import { createContext, useContext, useEffect, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "./AuthContext";

const EMPTY_STATE = {
  features: [], plan: null, loaded: false,
  onTrial: false, trialEndsAt: null, trialExpired: false,
};

const PlanContext = createContext(EMPTY_STATE);

/**
 * Core features always enabled regardless of plan — mirror backend ALWAYS_ALLOWED.
 */
const ALWAYS_ALLOWED = new Set([
  "task_management",
  "project_management",
  "my_tasks",
  "subtasks",
  "comments",
  "file_uploads",
  "notifications",
  "tags",
  "dashboard",
  "profile",
]);

export function PlanProvider({ children }) {
  const { auth } = useAuth();
  const api = useApi();
  const [state, setState] = useState(EMPTY_STATE);

  function applyPlanResponse(data) {
    setState({
      features:     Array.isArray(data.features) ? data.features : [],
      plan:         data.plan || null,
      loaded:       true,
      onTrial:      data.on_trial      || false,
      trialEndsAt:  data.trial_ends_at || null,
      trialExpired: data.trial_expired || false,
    });
  }

  // Fetch on login / token change
  useEffect(() => {
    if (!auth?.token || !auth?.user || auth.user.role === "superadmin") {
      setState({ ...EMPTY_STATE, loaded: true });
      return;
    }
    let cancelled = false;
    api.get("/workspaces/my-plan")
      .then(res => { if (!cancelled) applyPlanResponse(res.data); })
      .catch(() => { if (!cancelled) setState({ ...EMPTY_STATE, loaded: true }); });
    return () => { cancelled = true; };
  }, [auth?.token]);

  // Re-fetch when superadmin changes this workspace's plan in real-time
  useEffect(() => {
    if (!auth?.token || !auth?.user || auth.user.role === "superadmin") return;
    const handler = () => {
      api.get("/workspaces/my-plan")
        .then(res => applyPlanResponse(res.data))
        .catch(() => {});
    };
    window.addEventListener("plan:updated", handler);
    return () => window.removeEventListener("plan:updated", handler);
  }, [auth?.token]);

  return (
    <PlanContext.Provider value={state}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}

/**
 * Returns true if the current workspace plan includes the given feature key.
 * Always true during an active free trial.
 */
export function useFeature(featureKey) {
  const { features, loaded, onTrial } = useContext(PlanContext);
  if (!loaded) return false;
  if (onTrial) return true;                    // trial → full access
  if (ALWAYS_ALLOWED.has(featureKey)) return true;
  return features.includes(featureKey);
}
