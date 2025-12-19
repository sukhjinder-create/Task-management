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
 * - Verbose routing preserved
 * - Blank page bug FIXED
 * ======================================================
 */

export default function App() {
  return (
    <SuperadminAuthProvider>
      <Routes>
        {/* ============================
            PUBLIC
        ============================ */}
        <Route path="/login" element={<Login />} />
        <Route path="/superadmin/login" element={<SuperadminLogin />} />

        {/* ============================
            USER APP (VERBOSE, FIXED)
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
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<ProjectTasks />} />
          <Route path="my-tasks" element={<MyTasks />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="chat" element={<Chat />} />
          <Route path="reports" element={<Reports />} />

          <Route
  path="/admin/attendance"
  element={
    <ProtectedRoute roles={["admin"]}>
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
        </Route>

        {/* ============================
            SUPERADMIN SYSTEM (VERBOSE)
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
            LEGACY / PRESERVED ROUTES
        ============================ */}
        <Route path="/__superadmin_extra/*" element={<SuperadminExtraRoutes />} />

        {/* ============================
            FALLBACK
        ============================ */}
        <Route path="*" element={<Navigate to="/projects" />} />
      </Routes>
    </SuperadminAuthProvider>
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
