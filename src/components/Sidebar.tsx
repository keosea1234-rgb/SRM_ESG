import { useLocation, Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Building2,
  BarChart3,
  ShieldAlert,
  FileText,
  Activity,
  Leaf,
  GitCompare,
  HandCoins,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useAuth, usePermissions, type AppRole } from "../context/AuthContext";

// ── Nav item definition ───────────────────────────────────────────────────────

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  // Which roles can see this item. Undefined = all authenticated roles.
  allowedRoles?: AppRole[];
}

const NAV_GROUPS = [
  { label: "Overview", items: ["/"] },
  { label: "Supplier", items: ["/suppliers", "/contracts", "/compare", "/spend"] },
  { label: "Analytics", items: ["/performance", "/risks", "/esg", "/compliance"] },
  { label: "System", items: ["/activity", "/settings"] },
];

const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    icon: LayoutDashboard,
    label: "Dashboard",
    // Everyone sees the dashboard
  },
  {
    to: "/suppliers",
    icon: Building2,
    label: "Suppliers",
  },
  {
    to: "/contracts",
    icon: FileText,
    label: "Contracts",
  },
  {
    to: "/compare",
    icon: GitCompare,
    label: "Compare",
    allowedRoles: ["admin", "procurement_manager"],
  },
  {
    to: "/spend",
    icon: HandCoins,
    label: "Spend",
    allowedRoles: ["admin", "procurement_manager"],
  },
  {
    to: "/performance",
    icon: BarChart3,
    label: "Performance",
    allowedRoles: ["admin", "procurement_manager"],
  },
  {
    to: "/risks",
    icon: ShieldAlert,
    label: "Risk",
    allowedRoles: ["admin", "procurement_manager"],
  },
  {
    to: "/esg",
    icon: Leaf,
    label: "ESG",
  },
  {
    to: "/compliance",
    icon: ShieldCheck,
    label: "Compliance",
    allowedRoles: ["admin", "procurement_manager", "esg_analyst"],
  },
  {
    to: "/activity",
    icon: Activity,
    label: "Audit Log",
    allowedRoles: ["admin", "procurement_manager", "esg_analyst"],
  },
  {
    to: "/settings",
    icon: Settings,
    label: "Settings",
    allowedRoles: ["admin"],
  },
];

// Role display labels — shown in the sidebar footer
const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  procurement_manager: "Procurement Manager",
  esg_analyst: "ESG Analyst",
  viewer: "Viewer",
  supplier: "Supplier",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const permissions = usePermissions();

  const role = profile?.role ?? "viewer";

  // Filter nav items based on role
  const visibleItems = NAV_ITEMS.filter((item) => {
    // Suppliers: only show to those who can view
    if (item.to === "/suppliers" && !permissions.canViewSuppliers) return false;
    // Contracts: only show to those who can view
    if (item.to === "/contracts" && !permissions.canViewContracts) return false;
    // Comparison: only show to those who can view
    if (item.to === "/compare" && !permissions.canViewComparison) return false;
    // ESG: only show to those who can view
    if (item.to === "/esg" && !permissions.canViewESG) return false;
    // Compliance follows the ESG visibility model
    if (item.to === "/compliance" && !permissions.canViewESG) return false;
    // Role-restricted items
    if (item.allowedRoles && !item.allowedRoles.includes(role)) return false;
    return true;
  });

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  const visibleByTo = new Map(visibleItems.map((item) => [item.to, item]));

  return (
    <aside className="w-60 border-r border-brand-800 bg-brand-900 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-brand-800">
        <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-display text-lg font-semibold text-white">SRM</span>
          <p className="text-[10px] text-brand-300 leading-none -mt-0.5">Supplier Manager</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_GROUPS.map((group) => {
          const groupItems = group.items
            .map((to) => visibleByTo.get(to))
            .filter((item): item is NavItem => item !== undefined);
          if (groupItems.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-brand-500">
                {group.label}
              </p>
              <div className="space-y-1">
                {groupItems.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                                  transition-colors duration-150 ${
                                    active
                                      ? "bg-brand-800 text-white"
                                      : "text-brand-200 hover:bg-brand-800 hover:text-white"
                                  }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active-pill"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r-full"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <item.icon className="w-[18px] h-[18px]" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer — user role badge */}
      <div className="px-4 py-4 border-t border-brand-800 space-y-2">
        {profile && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-800 text-brand-200 rounded-full flex items-center
                            justify-center text-xs font-semibold shrink-0">
              {(profile.fullName ?? profile.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {profile.fullName ?? profile.email}
              </p>
              <p className="text-[10px] text-brand-300">{ROLE_LABELS[role]}</p>
            </div>
          </div>
        )}
        <p className="text-[10px] text-brand-400">ContractGuard integration active</p>
      </div>
    </aside>
  );
}
