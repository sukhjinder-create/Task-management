import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  featureNameForPath,
  trackAbandonment,
  trackActionClicked,
  trackFeatureViewed,
  trackFrictionDetected,
  trackPageView,
  trackSearchPerformed,
  trackSessionFlowStep,
} from "../services/growthTelemetry";

function actionTypeForElement(element) {
  if (!element) return "unknown";
  if (element.matches("a")) return "navigation";
  if (element.matches("button")) return element.getAttribute("type") || "button";
  if (element.getAttribute("role") === "button") return "button";
  return "click";
}

function actionNameForElement(element) {
  const explicit = element?.getAttribute("data-analytics-action");
  if (explicit) return explicit;
  if (element?.matches("a")) {
    try {
      const href = element.getAttribute("href");
      if (!href) return "link";
      const url = new URL(href, window.location.origin);
      return `link:${url.pathname || "/"}`;
    } catch {
      return "link";
    }
  }
  const type = element?.getAttribute("type");
  const role = element?.getAttribute("role");
  return [element?.tagName?.toLowerCase() || "element", role, type].filter(Boolean).join(":");
}

function targetPathForElement(element) {
  if (!element?.matches("a")) return null;
  try {
    const href = element.getAttribute("href");
    if (!href) return null;
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return "external";
    return url.pathname || "/";
  } catch {
    return null;
  }
}

export default function GrowthTelemetry() {
  const location = useLocation();
  const routeStateRef = useRef({
    path: null,
    search: "",
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
    clickCount: 0,
    pathLength: 0,
  });

  const finalizeRoute = (nextPath = null) => {
    const state = routeStateRef.current;
    if (!state.path || state.path.startsWith("/superadmin")) return;
    const durationMs = Date.now() - state.startedAt;
    trackSessionFlowStep({
      path: state.path,
      fromPath: state.path,
      toPath: nextPath,
      durationMs,
      clickCount: state.clickCount,
      pathLength: state.pathLength,
    });
    if (durationMs < 5000 && state.clickCount === 0) {
      trackAbandonment({
        path: state.path,
        durationMs,
        clickCount: state.clickCount,
        pathLength: state.pathLength,
        reason: "quick_route_exit_without_action",
      });
    }
    if (durationMs > 45000 && state.clickCount === 0) {
      trackFrictionDetected({
        path: state.path,
        reason: "long_idle_without_action",
        idleMs: durationMs,
        clickCount: state.clickCount,
        pathLength: state.pathLength,
      });
    }
  };

  useEffect(() => {
    const previousPath = routeStateRef.current.path;
    if (previousPath && previousPath !== location.pathname) finalizeRoute(location.pathname);
    routeStateRef.current = {
      path: location.pathname,
      search: location.search,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      clickCount: 0,
      pathLength: (routeStateRef.current.pathLength || 0) + 1,
    };
    trackPageView(location.pathname, location.search);
    trackFeatureViewed(location.pathname, {
      screen: featureNameForPath(location.pathname),
      path_length: routeStateRef.current.pathLength,
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onClick = (event) => {
      const target = event.target?.closest?.("button,a,[role='button'],[data-analytics-action]");
      if (!target) return;
      const currentPath = window.location.pathname;
      if (currentPath.startsWith("/superadmin")) return;
      const now = Date.now();
      const state = routeStateRef.current;
      const hesitationMs = Math.max(0, now - (state.lastActivityAt || state.startedAt || now));
      state.clickCount = (state.clickCount || 0) + 1;
      state.lastActivityAt = now;
      trackActionClicked({
        path: currentPath,
        actionName: actionNameForElement(target),
        actionType: actionTypeForElement(target),
        component: target.getAttribute("data-analytics-component") || featureNameForPath(currentPath),
        toPath: targetPathForElement(target),
        hesitationMs,
        clickCount: state.clickCount,
        isKeyboard: event.detail === 0,
      });
      if (hesitationMs > 30000) {
        trackFrictionDetected({
          path: currentPath,
          reason: "hesitation_before_click",
          hesitationMs,
          clickCount: state.clickCount,
          pathLength: state.pathLength,
        });
      }
    };

    const onSubmit = (event) => {
      const form = event.target;
      const input = form?.querySelector?.("input[type='search'],input[name='q'],input[name='search']");
      if (!input) return;
      const queryLength = String(input.value || "").trim().length;
      if (!queryLength) return;
      trackSearchPerformed({
        path: window.location.pathname,
        queryLength,
        searchScope: input.getAttribute("data-search-scope") || "workspace",
      });
    };

    const onBeforeUnload = () => finalizeRoute(null);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      finalizeRoute(null);
    };
  }, []);
  return null;
}
