// src/components/ProtectedSuperadmin.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSuperadminAuth } from "../context/SuperadminAuthContext";

/**
 * Protect routes that are only for Superadmin.
 * If not logged in as superadmin -> redirect to /superadmin/login.
 *
 * This component WAITs until the SuperadminAuthContext has finished hydrating
 * (ready === true) to avoid immediate redirects while storage loads.
 */

export default function ProtectedSuperadmin({ children }) {
  const { superadmin, token, ready } = useSuperadminAuth();
  const location = useLocation();

  // 1️⃣ Wait until auth context is hydrated
  if (!ready) {
    // Intentionally render nothing to avoid flicker
    return null;
  }

  // 2️⃣ Not logged in as superadmin
  if (!token || superadmin?.role !== "superadmin") {
    return <Navigate to="/superadmin/login" replace state={{ from: location.pathname }} />;
  }

  /**
   * 3️⃣ IMPORTANT FIX
   * ------------------------------------------------
   * Same rule as ProtectedRoute:
   * - NEVER render children AND <Outlet /> together
   * - Choose exactly ONE
   */
  if (children) {
    return <>{children}</>;
  }

  return <Outlet />;
}
