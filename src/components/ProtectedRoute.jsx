import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { auth } = useAuth();

  // 1️⃣ Not authenticated → login
  if (!auth?.token || !auth?.user) {
    return <Navigate to="/login" replace />;
  }

  // 2️⃣ Role restricted route
  if (allowedRoles && !allowedRoles.includes(auth.user.role)) {
    return (
      <>
        <div className="p-4 text-red-600">
          Access denied (insufficient role).
        </div>
        <Navigate to="/" replace />
      </>
    );
  }

  /**
   * 3️⃣ IMPORTANT FIX
   * ------------------------------------------------
   * React Router v6 already renders children via <Outlet />
   * Returning BOTH children and <Outlet /> causes DOUBLE UI.
   *
   * Rule:
   * - If used as <Route element={<ProtectedRoute />}> → use <Outlet />
   * - If someone accidentally passes children → still render ONLY once
   */
  if (children) {
    return <>{children}</>;
  }

  return <Outlet />;
}
