// src/App.jsx
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

// ---- Normal user pages ----
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectTasks = lazy(() => import("./pages/ProjectTasks"));
const UsersAdmin = lazy(() => import("./pages/UsersAdmin"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MyTasks = lazy(() => import("./pages/MyTasks"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Profile = lazy(() => import("./pages/Profile"));
const Chat = lazy(() => import("./pages/Chat"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const AdminAttendance = lazy(() => import("./pages/AdminAttendance.jsx"));
const StrategicIntelligence = lazy(() => import("./pages/StrategicIntelligence.jsx"));
const Autopilot = lazy(() => import("./pages/Autopilot.jsx"));
const TestingAgent = lazy(() => import("./pages/TestingAgent.jsx"));
const SlackMigration = lazy(() => import("./pages/SlackMigration.jsx"));
const Migrations = lazy(() => import("./pages/Migrations.jsx"));
const WorkspaceBilling = lazy(() => import("./pages/WorkspaceBilling.jsx"));
const WorkspaceSearchMemory = lazy(() => import("./pages/WorkspaceSearchMemory.jsx"));
const UserProfile = lazy(() => import("./pages/UserProfile.jsx"));
const HuddleMeetingIntelligence = lazy(() => import("./pages/HuddleMeetingIntelligence.jsx"));
const AdaptiveIntelligenceEvaluation = lazy(() => import("./pages/AdaptiveIntelligenceEvaluation.jsx"));

// ---- Gradient Demo (Development) ----
import { GradientDemo } from "./components/ui/GradientDemo";

// ---- Intelligence pages (NEW) ----
const UserPerformance = lazy(() => import("./pages/intelligence/UserPerformance.jsx"));
const AdminIntelligence = lazy(() => import("./pages/intelligence/AdminIntelligence.jsx"));
const ExecutiveSummary = lazy(() => import("./pages/intelligence/ExecutiveSummary.jsx"));

// ---- Layouts & protection ----
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";

// ---- Superadmin auth & layout ----
import SuperAdminLayout from "./layouts/SuperAdminLayout.jsx";
const SuperAdminWorkspaces = lazy(() => import("./pages/SuperAdminWorkspaces.jsx"));
const SuperadminLogin = lazy(() => import("./pages/SuperadminLogin.jsx"));
const SuperadminForgotPassword = lazy(() => import("./pages/SuperadminForgotPassword.jsx"));
const SuperadminResetPassword = lazy(() => import("./pages/SuperadminResetPassword.jsx"));
const SuperadminPayments = lazy(() => import("./pages/SuperadminPayments.jsx"));
const SuperadminSettings = lazy(() => import("./pages/SuperadminSettings.jsx"));
const SuperadminPlans = lazy(() => import("./pages/SuperadminPlans.jsx"));
const SuperadminBackups = lazy(() => import("./pages/SuperadminBackups.jsx"));
const SuperadminGrowthIntelligence = lazy(() => import("./pages/SuperadminGrowthIntelligence.jsx"));
const SuperadminAdaptiveIntelligence = lazy(() => import("./pages/SuperadminAdaptiveIntelligence.jsx"));
const SuperadminAiStudio = lazy(() => import("./pages/SuperadminAiStudio.jsx"));
import ProtectedSuperadmin from "./components/ProtectedSuperadmin";
import { SuperadminAuthProvider } from "./context/SuperadminAuthContext";
import GrowthTelemetry from "./components/GrowthTelemetry";

// ---- Extra legacy / preserved ----
const CreateWorkspace = lazy(() => import("./pages/CreateWorkspace"));

// ---- Enterprise Phase 1-4 pages ----
const Enterprise = lazy(() => import("./pages/Enterprise.jsx"));
const EnterpriseIntelligence = lazy(() => import("./pages/EnterpriseIntelligence.jsx"));
const Wiki = lazy(() => import("./pages/Wiki.jsx"));
const Leave = lazy(() => import("./pages/Leave.jsx"));
const OKR = lazy(() => import("./pages/OKR.jsx"));
const Reviews = lazy(() => import("./pages/Reviews.jsx"));
const AIFeatures = lazy(() => import("./pages/AIFeatures.jsx"));
const WorkspaceAiSettings = lazy(() => import("./pages/WorkspaceAiSettings.jsx"));

// ---- Enterprise Work Intelligence Platform V3 (execution) ----
const EnterpriseControlCenter = lazy(() => import("./pages/execution/EnterpriseControlCenter.jsx"));
const ExecDecisions = lazy(() => import("./pages/execution/Decisions.jsx"));
const ExecApprovals = lazy(() => import("./pages/execution/Approvals.jsx"));
const ExecutionDashboard = lazy(() => import("./pages/execution/ExecutionDashboard.jsx"));
const CapabilityStudio = lazy(() => import("./pages/execution/CapabilityStudio.jsx"));
const PolicyStudio = lazy(() => import("./pages/execution/PolicyStudio.jsx"));
const AutomationStudio = lazy(() => import("./pages/execution/AutomationStudio.jsx"));
const WorkflowBuilder = lazy(() => import("./pages/execution/WorkflowBuilder.jsx"));
const EnterpriseGraph = lazy(() => import("./pages/execution/EnterpriseGraph.jsx"));
const ExecExecutiveDashboard = lazy(() => import("./pages/execution/ExecutiveDashboard.jsx"));
const AIHub = lazy(() => import("./pages/AIHub.jsx"));

// ---- Auth flow pages ----
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));

// ---- Public pages ----
const SLA = lazy(() => import("./pages/SLA.jsx"));

function RouteLoading() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center bg-[var(--background)] text-sm text-[color:var(--text-muted)]">
      Loading...
    </div>
  );
}

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
    <Suspense fallback={<RouteLoading />}>
      <GrowthTelemetry />
      <Routes>
        {/* ============================
            PUBLIC
        ============================ */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/magic" element={<AuthCallback />} />
        <Route path="/superadmin/login" element={<SuperadminLogin />} />
        <Route path="/superadmin/forgot-password" element={<SuperadminForgotPassword />} />
        <Route path="/superadmin/reset-password" element={<SuperadminResetPassword />} />
        <Route path="/sla" element={<SLA />} />
        <Route path="/gradient-demo" element={<GradientDemo />} />

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
          <Route path="huddles/:sessionId/intelligence" element={<HuddleMeetingIntelligence />} />
          <Route path="profile" element={<Profile />} />
          <Route path="users/:userId/profile" element={<UserProfile />} />
          <Route
            path="operations"
            element={
              <ProtectedRoute allowedRoles={["admin"]} requiredFeature="workspace_search_memory">
                <Navigate to="/admin/workspace-search" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="chat"
            element={<ProtectedRoute requiredFeature="team_chat"><Chat /></ProtectedRoute>}
          />
          <Route
            path="reports"
            element={
              <ProtectedRoute allowedRoles={["admin", "manager"]} requiredFeature="basic_reporting">
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="intelligence"
            element={
              <ProtectedRoute allowedRoles={["admin", "manager"]} requiredFeature="advanced_analytics">
                <StrategicIntelligence />
              </ProtectedRoute>
            }
          />

          {/* ---- Enterprise Phase 1-4 routes ---- */}
          <Route path="wiki"   element={<ProtectedRoute requiredFeature="wiki_docs"><Wiki /></ProtectedRoute>} />
          <Route path="leave"  element={<ProtectedRoute requiredFeature="leave_management"><Leave /></ProtectedRoute>} />
          <Route
            path="okr"
            element={
              <ProtectedRoute allowedRoles={["admin"]} requiredFeature="okr_goals">
                <OKR />
              </ProtectedRoute>
            }
          />
          <Route path="reviews"     element={<ProtectedRoute requiredFeature="performance_reviews"><Reviews /></ProtectedRoute>} />
          <Route path="ai-features" element={<ProtectedRoute requiredFeature="ai_hub"><AIFeatures /></ProtectedRoute>} />
          <Route path="ai-settings" element={<WorkspaceAiSettings />} />

          {/* ---- Enterprise Work Intelligence Platform V3 (execution) — admin ---- */}
          <Route path="execution"            element={<ProtectedRoute allowedRoles={["admin"]}><EnterpriseControlCenter /></ProtectedRoute>} />
          <Route path="execution/decisions"  element={<ProtectedRoute allowedRoles={["admin"]}><ExecDecisions /></ProtectedRoute>} />
          <Route path="execution/approvals"  element={<ProtectedRoute allowedRoles={["admin", "manager"]}><ExecApprovals /></ProtectedRoute>} />
          <Route path="execution/dashboard"  element={<ProtectedRoute allowedRoles={["admin"]}><ExecutionDashboard /></ProtectedRoute>} />
          <Route path="execution/capabilities" element={<ProtectedRoute allowedRoles={["admin"]}><CapabilityStudio /></ProtectedRoute>} />
          <Route path="execution/policies"   element={<ProtectedRoute allowedRoles={["admin"]}><PolicyStudio /></ProtectedRoute>} />
          <Route path="execution/automations" element={<ProtectedRoute allowedRoles={["admin"]}><AutomationStudio /></ProtectedRoute>} />
          <Route path="execution/workflows"  element={<ProtectedRoute allowedRoles={["admin"]}><WorkflowBuilder /></ProtectedRoute>} />
          <Route path="execution/graph"      element={<ProtectedRoute allowedRoles={["admin"]}><EnterpriseGraph /></ProtectedRoute>} />
          <Route path="execution/executive"  element={<ProtectedRoute allowedRoles={["admin"]}><ExecExecutiveDashboard /></ProtectedRoute>} />
          <Route
            path="ai"
            element={
              <ProtectedRoute allowedRoles={["admin", "manager"]} requiredFeature="ai_hub">
                <AIHub />
              </ProtectedRoute>
            }
          />
          <Route
            path="enterprise"
            element={
              <ProtectedRoute allowedRoles={["admin"]} requiredFeature="custom_branding">
                <Enterprise />
              </ProtectedRoute>
            }
          />
          <Route
            path="enterprise-intel"
            element={
              <ProtectedRoute allowedRoles={["admin"]} requiredFeature="workspace_intelligence">
                <EnterpriseIntelligence />
              </ProtectedRoute>
            }
          />

          {/* ---- NEW: AI Autopilot ---- */}
          <Route
            path="autopilot"
            element={
              <ProtectedRoute allowedRoles={["admin"]} requiredFeature="ai_autopilot">
                <Autopilot />
              </ProtectedRoute>
            }
          />

          <Route
            path="testing-agent"
            element={
              <ProtectedRoute allowedRoles={["admin", "manager"]} requiredFeature="ai_testing_agent">
                <TestingAgent />
              </ProtectedRoute>
            }
          />

          <Route
            path="admin/slack-migration"
            element={
              <ProtectedRoute allowedRoles={["admin"]} requiredFeature="slack_migration">
                <SlackMigration />
              </ProtectedRoute>
            }
          />

          <Route
            path="admin/migrations"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Migrations />
              </ProtectedRoute>
            }
          />

          {/* ---- NEW: User Intelligence ---- */}
          <Route
            path="dashboard/performance"
            element={<UserPerformance />}
          />

          {/* ---- Existing admin routes ---- */}
          <Route
            path="admin/attendance"
            element={
              <ProtectedRoute allowedRoles={["admin"]} requiredFeature="attendance">
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

          <Route
            path="admin/workspace-search"
            element={
              <ProtectedRoute allowedRoles={["admin"]} requiredFeature="workspace_search_memory">
                <WorkspaceSearchMemory />
              </ProtectedRoute>
            }
          />

          <Route
            path="admin/billing"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <WorkspaceBilling />
              </ProtectedRoute>
            }
          />

          <Route
            path="admin/adaptive-intelligence"
            element={
              <ProtectedRoute allowedRoles={["admin"]} requiredFeature="workspace_intelligence">
                <AdaptiveIntelligenceEvaluation />
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
          <Route path="growth"     element={<SuperadminGrowthIntelligence />} />
          <Route path="adaptive-intelligence" element={<SuperadminAdaptiveIntelligence />} />
          <Route path="plans"      element={<SuperadminPlans />} />
          <Route path="payments"   element={<SuperadminPayments />} />
          <Route path="settings"   element={<SuperadminSettings />} />
          <Route path="backups"    element={<SuperadminBackups />} />
          <Route path="ai-studio"  element={<SuperadminAiStudio />} />
          <Route path="*"          element={<Navigate to="/superadmin/workspaces" replace />} />
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
    </Suspense>
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
