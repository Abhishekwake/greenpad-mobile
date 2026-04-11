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
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/users", label: "Users", icon: UserPlus },
  { href: "/agents", label: "Team", icon: UsersRound },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/redemptions", label: "Redemptions", icon: Package },
  { href: "/transactions", label: "Transactions", icon: CreditCard },
  { href: "/settings", label: "Coin rules", icon: SlidersHorizontal },
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
