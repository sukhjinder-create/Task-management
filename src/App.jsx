// src/App.jsx
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

// ---- Normal user pages ----
import Login from "./pages/Login";
import Projects from "./pages/Projects";
import ProjectTasks from "./pages/ProjectTasks";
import UsersAdmin from "./pages/UsersAdmin";
import Dashboard from "./pages/Dashboard";
import MyTasks from "./pages/MyTasks";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import Reports from "./pages/Reports.jsx";
import AdminAttendance from "./pages/AdminAttendance.jsx";

// ---- Intelligence pages (NEW) ----
import UserPerformance from "./pages/intelligence/UserPerformance.jsx";
import AdminIntelligence from "./pages/intelligence/AdminIntelligence.jsx";
import ExecutiveSummary from "./pages/intelligence/ExecutiveSummary.jsx";

// ---- Layouts & protection ----
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";

// ---- Superadmin auth & layout ----
import SuperAdminLayout from "./layouts/SuperAdminLayout.jsx";
import SuperAdminWorkspaces from "./pages/SuperAdminWorkspaces.jsx";
import SuperadminLogin from "./pages/SuperadminLogin.jsx";
import SuperadminPayments from "./pages/SuperadminPayments.jsx";
import SuperadminSettings from "./pages/SuperadminSettings.jsx";
import ProtectedSuperadmin from "./components/ProtectedSuperadmin";
import { SuperadminAuthProvider } from "./context/SuperadminAuthContext";

// ---- Extra legacy / preserved ----
import CreateWorkspace from "./pages/CreateWorkspace";

/**
 * ======================================================
 * APP ROOT
 * ======================================================
 * - NOTHING removed
 * - Existing routes preserved
 * - Intelligence routes ADDED
 * ======================================================
 */

export default function App() {
  return (
      <Routes>
        {/* ============================
            PUBLIC
        ============================ */}
        <Route path="/login" element={<Login />} />
        <Route path="/superadmin/login" element={<SuperadminLogin />} />

        {/* ============================
            USER APP (PROTECTED)
        ============================ */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Outlet />
              </AppLayout>
            </ProtectedRoute>
          }
        >
          {/* ---- Existing user routes ---- */}
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<ProjectTasks />} />
          <Route path="my-tasks" element={<MyTasks />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="chat" element={<Chat />} />
          <Route path="reports" element={<Reports />} />

          {/* ---- NEW: User Intelligence ---- */}
          <Route
            path="dashboard/performance"
            element={<UserPerformance />}
          />

          {/* ---- Existing admin routes ---- */}
          <Route
            path="admin/attendance"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminAttendance />
              </ProtectedRoute>
            }
          />

          <Route
            path="admin/users"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <UsersAdmin />
              </ProtectedRoute>
            }
          />

          {/* ---- NEW: Admin Intelligence ---- */}
          <Route
            path="admin/intelligence"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminIntelligence />
              </ProtectedRoute>
            }
          />

          <Route
            path="admin/executive-summary"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <ExecutiveSummary />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* ============================
            SUPERADMIN SYSTEM
        ============================ */}
        <Route
          path="/superadmin"
          element={
            <ProtectedSuperadmin>
              <SuperAdminLayout>
                <Outlet />
              </SuperAdminLayout>
            </ProtectedSuperadmin>
          }
        >
          <Route index element={<Navigate to="workspaces" replace />} />
          <Route path="workspaces" element={<SuperAdminWorkspaces />} />
          <Route path="payments" element={<SuperadminPayments />} />
          <Route path="settings" element={<SuperadminSettings />} />
        </Route>

        {/* ============================
            LEGACY / PRESERVED
        ============================ */}
        <Route
          path="/__superadmin_extra/*"
          element={<SuperadminExtraRoutes />}
        />

        {/* ============================
            FALLBACK
        ============================ */}
        <Route path="*" element={<Navigate to="/projects" />} />
      </Routes>

  );
}

/**
 * ======================================================
 * LEGACY SUPERADMIN ROUTES (PRESERVED)
 * ======================================================
 */
function SuperadminExtraRoutes() {
  return (
    <Routes>
      <Route
        path="/superadmin"
        element={
          <ProtectedSuperadmin>
            <SuperAdminLayout>
              <Outlet />
            </SuperAdminLayout>
          </ProtectedSuperadmin>
        }
      >
        <Route path="workspaces" element={<SuperAdminWorkspaces />} />
        <Route path="workspaces/create" element={<CreateWorkspace />} />
      </Route>
    </Routes>
  );
}
