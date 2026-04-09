"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const router = useRouter();
  const { error: showError } = useToast();
  const [email, setEmail] = useState("admin@greenpad.com");

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("adminToken")) {
      router.replace("/dashboard");
    }
  }, [router]);
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post<{ success: boolean; token: string; user: { name: string; email?: string } }>(
        "/auth/admin-login",
        { email, password }
      );
      if (data.success && data.token) {
        localStorage.setItem("adminToken", data.token);
        localStorage.setItem("adminName", data.user?.name || "Admin");
        router.push("/dashboard");
      } else {
        showError("Invalid credentials");
      }
    } catch {
      showError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl">
            ☀️
          </div>
          <h1 className="text-2xl font-bold text-gray-900">GreenPad</h1>
          <p className="mt-1 text-sm text-gray-500">Admin dashboard</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Signing in…
              </>
            ) : (
              "Login"
            )}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-gray-400">Default: admin@greenpad.com / admin123</p>
      </div>
    </div>
  );
}
