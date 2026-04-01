// src/layouts/SuperAdminLayout.jsx
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { Building2, CreditCard, Settings, LogOut, Shield, LayoutList, Database } from "lucide-react";

function getSuperadminToken() {
  try {
    const raw = localStorage.getItem("superadmin_auth");
    if (!raw) return null;
    return JSON.parse(raw)?.token || null;
  } catch {
    return null;
  }
}

const NAV_ITEMS = [
  { to: "/superadmin/workspaces", label: "Workspaces", icon: <Building2  className="w-4 h-4" /> },
  { to: "/superadmin/plans",      label: "Plans",      icon: <LayoutList className="w-4 h-4" /> },
  { to: "/superadmin/payments",   label: "Payments",   icon: <CreditCard className="w-4 h-4" /> },
  { to: "/superadmin/backups",    label: "Backups",    icon: <Database   className="w-4 h-4" /> },
  { to: "/superadmin/settings",   label: "Settings",   icon: <Settings   className="w-4 h-4" /> },
];

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = window.__SUPERADMIN_TOKEN__ || getSuperadminToken();
    if (!token) { navigate("/superadmin/login", { replace: true }); return; }
    setChecked(true);
  }, [navigate]);

  function logout() {
    try { localStorage.removeItem("superadmin_auth"); } catch {}
    delete window.__SUPERADMIN_TOKEN__;
    navigate("/superadmin/login", { replace: true });
  }

  if (!checked) return null;

  return (
    <div className="flex h-screen overflow-hidden theme-bg theme-text">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-60 theme-surface border-r theme-border flex flex-col shrink-0">

        {/* Logo */}
        <div className="h-16 px-5 border-b theme-border flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold theme-text leading-none">Proxima</p>
            <p className="text-[10px] text-indigo-500 font-semibold tracking-wide mt-0.5">SUPERADMIN</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-500/10 text-indigo-500"
                    : "theme-text-muted hover:bg-[var(--surface-soft)] hover:theme-text"
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t theme-border shrink-0">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 theme-bg overflow-auto flex flex-col">

        {/* Topbar */}
        <header className="h-14 theme-surface border-b theme-border px-6 flex items-center justify-between shrink-0">
          <p className="text-sm font-medium theme-text-muted">Platform Console</p>
          <ThemeSwitcher compact />
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
