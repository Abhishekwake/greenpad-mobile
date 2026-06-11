"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Gift,
  Package,
  CreditCard,
  SlidersHorizontal,
  UsersRound,
  Folder,
  GitBranch,
  Shield,
  Film,
  LogOut,
  UserCog,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAdminRole, type AdminRole } from "@/lib/adminRole";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AdminRole[];
};

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/users", label: "Users", icon: UserPlus },
  { href: "/agents", label: "Team", icon: UsersRound },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/redemptions", label: "Redemptions", icon: Package },
  { href: "/transactions", label: "Transactions", icon: CreditCard },
];

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Operations",
    items: [{ href: "/projects", label: "Projects", icon: Folder }],
  },
  {
    title: "Configuration",
    items: [
      { href: "/workflow", label: "Workflow builder", icon: GitBranch },
      { href: "/roles-config", label: "Workflow roles", icon: Shield },
      { href: "/reels", label: "Reels", icon: Film },
      { href: "/settings-config", label: "Settings", icon: SlidersHorizontal, roles: ["super_admin"] },
    ],
  },
  {
    title: "Super admin",
    items: [
      { href: "/admin-accounts", label: "Admin accounts", icon: UserCog, roles: ["super_admin"] },
      { href: "/reconciliation", label: "Coin reconciliation", icon: Scale, roles: ["super_admin"] },
    ],
  },
];

function canSee(item: NavItem, role: AdminRole | null) {
  if (!item.roles) return true;
  if (!role) return false;
  return item.roles.includes(role);
}

export default function Sidebar({
  mobileOpen,
  onNavigate,
}: {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<AdminRole | null>(null);

  useEffect(() => {
    setRole(getAdminRole());
  }, []);

  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminName");
    localStorage.removeItem("adminRole");
    router.replace("/login");
  };

  const renderLink = ({ href, label, icon: Icon }: NavItem) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        key={href}
        href={href}
        onClick={() => onNavigate?.()}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/10",
          active && "bg-white/20"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {label}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-full w-64 bg-gradient-to-b from-emerald-700 to-emerald-900 text-white transition-transform lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      <div className="p-6">
        <div className="text-xl font-bold">GreenPad Admin</div>
        {role && (
          <p className="mt-1 text-xs text-white/70 capitalize">{role.replace("_", " ")}</p>
        )}
      </div>
      <nav className="flex flex-col gap-1 px-3 pb-24">
        {nav.filter((item) => canSee(item, role)).map(renderLink)}
        {navSections.map(({ title, items }) => {
          const visible = items.filter((item) => canSee(item, role));
          if (visible.length === 0) return null;
          return (
            <div key={title} className="mt-3">
              <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                {title}
              </div>
              {visible.map(renderLink)}
            </div>
          );
        })}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-white/10"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
