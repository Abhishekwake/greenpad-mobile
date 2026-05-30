"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leads": "Leads",
  "/users": "User Management",
  "/rewards": "Rewards Store",
  "/transactions": "Transaction Log",
};

export default function Header({
  onMenuClick,
}: {
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const title = titles[pathname] || "GreenPad Admin";
  const [adminName, setAdminName] = useState("Admin");

  useEffect(() => {
    setAdminName(localStorage.getItem("adminName") || "Admin");
  }, []);

  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminName");
    localStorage.removeItem("adminRole");
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:pl-[calc(16rem+1rem)]">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} type="button">
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-gray-600 sm:inline">{adminName}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
          {adminName.charAt(0).toUpperCase()}
        </div>
        <Button variant="ghost" size="icon" onClick={logout} type="button" className="hidden sm:flex" title="Logout">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
