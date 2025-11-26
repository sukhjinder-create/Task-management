import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { auth } = useAuth();

  if (!auth.token || !auth.user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(auth.user.role)) {
    return <div className="p-4 text-red-600">Access denied (insufficient role).</div>;
  }

  return children;
}
