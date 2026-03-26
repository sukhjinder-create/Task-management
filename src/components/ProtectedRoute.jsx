import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFeature } from "../context/PlanContext";

/**
 * ProtectedRoute
 *
 * Props:
 *  - allowedRoles     string[]  — role whitelist (optional)
 *  - requiredFeature  string    — billing_plans feature key (optional)
 *
 * Security layers (applied in order):
 *  1. Must be authenticated
 *  2. Must have correct role (if allowedRoles specified)
 *  3. Workspace plan must include the feature (if requiredFeature specified)
 *     — this is a FRONTEND guard; backend independently rejects 403 on API calls
 */
function FeatureGuard({ featureKey, children }) {
  const allowed = useFeature(featureKey);
  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
        <div className="text-4xl">🔒</div>
        <p className="font-semibold theme-text text-center">Feature not available on your plan</p>
        <p className="text-sm theme-text-muted text-center max-w-xs">
          Upgrade your workspace plan to unlock this module.
        </p>
      </div>
    );
  }
  return children ?? <Outlet />;
}

export default function ProtectedRoute({ children, allowedRoles, requiredFeature }) {
  const { auth } = useAuth();

  // 1. Not authenticated → login
  if (!auth?.token || !auth?.user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Role restricted route
  if (allowedRoles && !allowedRoles.includes(auth.user.role)) {
    return <Navigate to="/" replace />;
  }

  // 3. Feature gated — show upgrade message instead of navigating away
  if (requiredFeature) {
    return (
      <FeatureGuard featureKey={requiredFeature}>
        {children}
      </FeatureGuard>
    );
  }

  if (children) return <>{children}</>;
  return <Outlet />;
}
