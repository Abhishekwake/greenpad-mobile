"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <Sidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
        <div className="lg:pl-64">
          <Header onMenuClick={() => setMobileOpen((o) => !o)} />
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
