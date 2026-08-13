import { NavLink } from "react-router-dom";
import { BellRing, BriefcaseBusiness, FileBarChart, ListChecks, Settings2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const MANAGER_ROLES = new Set(["admin", "manager"]);
const CONFIGURE_ROLES = new Set(["admin"]);

export default function AssuranceNav() {
  const { auth } = useAuth();
  const role = String(auth.user?.role || "").toLowerCase();
  const links = [
    { to: "/outcomes", label: "Outcomes", icon: ListChecks, show: true, end: true },
    { to: "/outcomes/inbox", label: "Decisions", icon: BellRing, show: true },
    { to: "/outcomes/portfolio", label: "Portfolio", icon: BriefcaseBusiness, show: MANAGER_ROLES.has(role) },
    { to: "/outcomes/insights", label: "Executive view", icon: FileBarChart, show: MANAGER_ROLES.has(role) },
    { to: "/outcomes/policy", label: "Policy", icon: Settings2, show: CONFIGURE_ROLES.has(role) },
  ].filter((item) => item.show);

  return (
    <nav aria-label="Execution assurance" className="flex gap-1 overflow-x-auto rounded-[9px] border border-[color:var(--border)] bg-[var(--surface-soft)] p-1">
      {links.map((item) => {
        const ItemIcon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `inline-flex shrink-0 items-center gap-1.5 rounded-[7px] px-3 py-2 text-[11px] font-semibold transition-colors ${
              isActive
                ? "bg-[var(--surface)] text-[color:var(--primary)] shadow-sm"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
            }`}
          >
            <ItemIcon className="h-3.5 w-3.5" /> {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
