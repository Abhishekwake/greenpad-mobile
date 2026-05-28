"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/users", label: "Users", icon: UserPlus },
  { href: "/agents", label: "Team", icon: UsersRound },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/redemptions", label: "Redemptions", icon: Package },
  { href: "/transactions", label: "Transactions", icon: CreditCard },
  { href: "/settings", label: "Coin rules", icon: SlidersHorizontal },
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
      { href: "/roles-config", label: "Roles & team", icon: Shield },
    ],
  },
];

export default function Sidebar({
  mobileOpen,
  onNavigate,
}: {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminName");
    router.replace("/login");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-full w-64 bg-gradient-to-b from-emerald-700 to-emerald-900 text-white transition-transform lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      <div className="p-6 text-xl font-bold">GreenPad Admin</div>
      <nav className="flex flex-col gap-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => {
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
        })}
        {navSections.map(({ title, items }) => (
          <div key={title} className="mt-3">
            <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-white/60">
              {title}
            </div>
            {items.map(({ href, label, icon: Icon }) => {
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
            })}
          </div>
        ))}
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
