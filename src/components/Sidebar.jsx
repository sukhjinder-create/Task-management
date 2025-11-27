import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const { auth } = useAuth();
  const role = auth.user?.role;

  // Dynamic label for tasks tab
  const tasksLabel = role === "user" ? "My Tasks" : "Tasks";

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isUser = role === "user";

  return (
    <div className="w-60 bg-white border-r border-slate-200 h-screen fixed left-0 top-0 px-4 py-6 flex flex-col">
      <h1 className="text-xl font-bold mb-6 text-slate-800">TaskManager</h1>

      <nav className="flex-1 space-y-1">
        {(isAdmin || isManager) && (
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm ${
                isActive ? "bg-blue-100 text-blue-700" : "text-slate-700"
              }`
            }
          >
            Dashboard
          </NavLink>
        )}

        <NavLink
          to="/projects"
          className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm ${
              isActive ? "bg-blue-100 text-blue-700" : "text-slate-700"
            }`
          }
        >
          Projects
        </NavLink>

        {/* ✅ Same route as before, only label is dynamic */}
        <NavLink
          to="/my-tasks"
          className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm ${
              isActive ? "bg-blue-100 text-blue-700" : "text-slate-700"
            }`
          }
        >
          {tasksLabel}
        </NavLink>

        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm ${
              isActive ? "bg-blue-100 text-blue-700" : "text-slate-700"
            }`
          }
        >
          Notifications
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm ${
                isActive ? "bg-blue-100 text-blue-700" : "text-slate-700"
              }`
            }
          >
            Admin Panel
          </NavLink>
        )}
      </nav>

      {/* FOOTER */}
      <div className="text-xs text-slate-500 border-t border-slate-200 pt-4">
        Logged in as <b>{auth.user.username}</b> ({auth.user.role})
      </div>
    </div>
  );
}
