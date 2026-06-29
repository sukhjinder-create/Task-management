// src/layouts/SuperAdminLayout.jsx
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { Building2, CreditCard, Settings, LogOut, LayoutList, Database, TrendingUp } from "lucide-react";
import AppBrand from "../components/AppBrand";
import { useSuperadminAuth } from "../context/SuperadminAuthContext";

const NAV_ITEMS = [
  { to: "/superadmin/workspaces", label: "Workspaces", icon: <Building2  className="w-4 h-4" /> },
  { to: "/superadmin/growth",     label: "Growth Intelligence", icon: <TrendingUp className="w-4 h-4" /> },
  { to: "/superadmin/plans",      label: "Plans",      icon: <LayoutList className="w-4 h-4" /> },
  { to: "/superadmin/payments",   label: "Payments",   icon: <CreditCard className="w-4 h-4" /> },
  { to: "/superadmin/backups",    label: "Backups",    icon: <Database   className="w-4 h-4" /> },
  { to: "/superadmin/settings",   label: "Settings",   icon: <Settings   className="w-4 h-4" /> },
];

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const { logout } = useSuperadminAuth();

  function handleLogout() {
    logout();
    navigate("/superadmin/login", { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0b] text-[color:var(--text)]">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-60 bg-[var(--app-bg)] border-r border-[color:var(--sidebar-border)] flex flex-col shrink-0">

        {/* Logo */}
        <div className="h-16 px-3 border-b border-[color:var(--sidebar-border)] flex items-center shrink-0">
          <AppBrand className="w-full" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--surface-soft)] text-[color:var(--text)] border-l-2 border-[color:var(--primary)]"
                    : "text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[color:var(--text)]"
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-[color:var(--sidebar-border)] shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 bg-[#0a0a0b] overflow-auto flex flex-col">

        {/* Topbar */}
        <header className="h-16 bg-[var(--surface)] border-b border-[color:var(--border)] px-6 flex items-center justify-between shrink-0">
          <p className="text-sm font-medium text-[color:var(--text-muted)]">Platform Console</p>
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
