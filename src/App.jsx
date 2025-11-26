import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Projects from "./pages/Projects";
import ProjectTasks from "./pages/ProjectTasks";
import UsersAdmin from "./pages/UsersAdmin";
import Dashboard from "./pages/Dashboard";      // (to be created later)
import MyTasks from "./pages/MyTasks";          // (to be created later)
import Notifications from "./pages/Notifications"; // later
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";

export default function App() {
  return (
    <Routes>

      {/* LOGIN (no layout) */}
      <Route path="/login" element={<Login />} />

      {/* PAGES WITH SIDEBAR LAYOUT */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Projects />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects/:projectId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProjectTasks />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/my-tasks"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MyTasks />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Notifications />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppLayout>
              <UsersAdmin />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/projects" />} />
    </Routes>
  );
}
