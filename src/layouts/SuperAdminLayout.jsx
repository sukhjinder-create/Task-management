// src/layouts/SuperAdminLayout.jsx
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

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
    <div className="flex h-screen bg-slate-100">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col p-4">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">Superadmin</h2>
          <p className="text-xs text-slate-400">
            Platform Control Panel
          </p>
        </div>

        <nav className="space-y-2 flex-1">
          <NavLink
            to="/superadmin/workspaces"
            end
            className={({ isActive }) =>
              `block px-3 py-2 rounded ${
                isActive ? "bg-slate-700" : "hover:bg-slate-800"
              }`
            }
          >
            Workspaces
          </NavLink>

          <NavLink
            to="/superadmin/payments"
            className={({ isActive }) =>
              `block px-3 py-2 rounded ${
                isActive ? "bg-slate-700" : "hover:bg-slate-800"
              }`
            }
          >
            Payments
          </NavLink>

          <NavLink
            to="/superadmin/settings"
            className={({ isActive }) =>
              `block px-3 py-2 rounded ${
                isActive ? "bg-slate-700" : "hover:bg-slate-800"
              }`
            }
          >
            Settings
          </NavLink>
        </nav>

        <button
          onClick={logout}
          className="mt-4 text-left px-3 py-2 rounded text-sm text-red-400 hover:bg-slate-800"
        >
          Logout
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 bg-slate-50 overflow-auto">
        <header className="bg-white border-b px-6 py-4">
          <div className="text-sm text-slate-500">
            Superadmin Area
          </div>
        </header>

        <div className="p-6">
          {/* ✅ THIS WILL NOW RENDER CORRECTLY */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
