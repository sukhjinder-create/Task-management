// src/layouts/SuperAdminLayout.jsx
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import ThemeSwitcher from "../components/ThemeSwitcher";

/**
 * SuperAdminLayout
 * -------------------------------------------------
 * - Dedicated layout ONLY for superadmin routes
 * - No dependency on normal AuthContext
 * - Reads superadmin token from localStorage / window
 * - Prevents accidental fallback to user login
 * - FIXES: URL changes but page not rendering
 */

function getSuperadminToken() {
  try {
    const raw = localStorage.getItem("superadmin_auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  } catch {
    return null;
  }
}

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token =
      window.__SUPERADMIN_TOKEN__ ||
      getSuperadminToken();

    // 🔐 Hard guard: never allow rendering without token
    if (!token) {
      navigate("/superadmin/login", { replace: true });
      return;
    }

    // ✅ Auth verified
    setChecked(true);
  }, [navigate]);

  function logout() {
    try {
      localStorage.removeItem("superadmin_auth");
    } catch {}
    delete window.__SUPERADMIN_TOKEN__;
    navigate("/superadmin/login", { replace: true });
  }

  // ⛔ BLOCK RENDER until auth is verified
  if (!checked) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden theme-bg theme-text">
      {/* SIDEBAR */}
      <aside className="w-64 theme-surface border-r theme-border flex flex-col overflow-hidden shrink-0">
        <div className="h-16 px-4 border-b theme-border flex items-center">
          <h2 className="text-lg font-semibold">Superadmin</h2>
        </div>

        <nav className="space-y-2 flex-1 p-4 overflow-y-auto sidebar-scroll">
          <NavLink
            to="/superadmin/workspaces"
            end
            className={({ isActive }) =>
              `block px-3 py-2 rounded ${
                isActive ? "bg-primary-100 text-primary-800" : "hover:bg-[var(--surface-soft)]"
              }`
            }
          >
            Workspaces
          </NavLink>

          <NavLink
            to="/superadmin/payments"
            className={({ isActive }) =>
              `block px-3 py-2 rounded ${
                isActive ? "bg-primary-100 text-primary-800" : "hover:bg-[var(--surface-soft)]"
              }`
            }
          >
            Payments
          </NavLink>

          <NavLink
            to="/superadmin/settings"
            className={({ isActive }) =>
              `block px-3 py-2 rounded ${
                isActive ? "bg-primary-100 text-primary-800" : "hover:bg-[var(--surface-soft)]"
              }`
            }
          >
            Settings
          </NavLink>
        </nav>

        <div className="p-4 border-t theme-border shrink-0">
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded text-sm text-red-500 hover:bg-[var(--surface-soft)]"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 theme-bg overflow-auto">
        <header className="h-16 theme-surface border-b theme-border px-6 flex items-center justify-between">
          <div className="text-sm theme-text-muted">
            Superadmin Area
          </div>
          <ThemeSwitcher compact />
        </header>

        <div className="p-4">
          <div className="rounded-2xl border theme-border theme-surface shadow-lg p-3 md:p-4">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
