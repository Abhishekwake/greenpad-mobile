"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Users, ClipboardList, TrendingUp, Coins, Package } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type StatsData = {
  totalUsers: number;
  totalLeads: number;
  conversions: number;
  conversionRate: number;
  totalCoinsIssued: number;
  pendingRedemptions: number;
  leadsByStatus: Record<string, number>;
  signupsPerDay: { date: string; count: number }[];
  recentTransactions: Array<{
    _id: string;
    type: string;
    amount: number;
    description: string;
    status: string;
    createdAt: string;
    userId: { name?: string; phone?: string } | null;
  }>;
};

function StatSkeleton() {
  return <div className="h-28 animate-pulse rounded-xl bg-gray-200" />;
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: StatsData }>("/admin/stats");
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  const adminName =
    typeof window !== "undefined" ? localStorage.getItem("adminName") || "Admin" : "Admin";

  const barData = data
    ? Object.entries(data.leadsByStatus || {}).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count: value,
      }))
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome back, {adminName}</h2>
        <p className="text-sm text-gray-500">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-red-800">Failed to load dashboard.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : data ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Users</CardTitle>
                <Users className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.totalUsers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Leads</CardTitle>
                <ClipboardList className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.totalLeads}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Conversion Rate</CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.conversionRate}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Coins Issued</CardTitle>
                <Coins className="h-5 w-5 text-amber-500" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{Number(data.totalCoinsIssued).toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-amber-900">Pending installs</CardTitle>
                <Package className="h-5 w-5 text-amber-700" />
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-3xl font-bold text-amber-950">{data.pendingRedemptions ?? 0}</p>
                <Button variant="outline" size="sm" className="border-amber-300 text-amber-950" asChild>
                  <Link href="/redemptions">Open queue</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Signups (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <div className="h-full animate-pulse rounded-lg bg-gray-100" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.signupsPerDay || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => format(new Date(v + "T12:00:00"), "MMM d")}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(v) => String(v)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Leads by status</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {isLoading ? (
              <div className="h-full animate-pulse rounded-lg bg-gray-100" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent activity</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/transactions">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.recentTransactions || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">
                      No transactions yet
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.recentTransactions || []).map((tx) => (
                    <TableRow key={tx._id}>
                      <TableCell>
                        {tx.userId?.name || "—"}
                        <span className="block text-xs text-gray-500">{tx.userId?.phone}</span>
                      </TableCell>
                      <TableCell className="capitalize">{tx.type}</TableCell>
                      <TableCell className={cn(tx.amount >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {format(new Date(tx.createdAt), "MMM d, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
