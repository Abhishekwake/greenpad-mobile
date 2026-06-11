"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, differenceInCalendarDays, startOfDay } from "date-fns";
import { Users, ClipboardList, TrendingUp, Coins, Package, Folder, AlertCircle } from "lucide-react";
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

type ActivityItem = {
  id: string;
  type: string;
  leadId?: string;
  leadName?: string;
  description: string;
  actor: string;
  at: string;
};

type RecentActivityItem = {
  type: string;
  text: string;
  time: string;
  color: string;
};

type FollowUpDueItem = {
  _id: string;
  name: string;
  phone: string;
  nextFollowUpDate?: string;
  lastFollowUpNote?: string;
};

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
  followUpsDueToday?: number;
  followUpsDue?: FollowUpDueItem[];
  followUpsDueLeads?: Array<{
    _id: string;
    name: string;
    phone: string;
    nextFollowUpDate?: string;
    status: string;
  }>;
  recentActivity?: RecentActivityItem[];
  recentCrmActivity?: ActivityItem[];
  activeProjects?: number;
  avgProjectProgress?: number;
  delayedProjects?: number;
  projectOverview?: Array<{
    _id: string;
    customerName: string;
    progressPct: number;
    delayedCount: number;
  }>;
};

function StatSkeleton() {
  return <div className="h-28 animate-pulse rounded-xl bg-gray-200" />;
}

const ACTIVITY_DOT: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
};

function dueDateLabel(dateStr?: string) {
  if (!dateStr) return { text: "—", className: "text-gray-400" };
  const due = startOfDay(new Date(dateStr));
  const today = startOfDay(new Date());
  const overdueDays = differenceInCalendarDays(today, due);
  if (overdueDays === 0) return { text: "Today", className: "text-amber-600 font-medium" };
  if (overdueDays > 0) {
    return {
      text: `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
      className: "text-red-600 font-medium",
    };
  }
  return { text: format(due, "MMM d, yyyy"), className: "text-gray-500" };
}

export default function DashboardPage() {
  const router = useRouter();
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {isLoading ? (
          <>
            <StatSkeleton />
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
            <Card className={cn((data.followUpsDueToday ?? 0) > 0 && "border-amber-200 bg-amber-50/40")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Follow-ups due</CardTitle>
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.followUpsDueToday ?? 0}</p>
                <Button variant="link" size="sm" className="h-auto p-0 text-emerald-700" asChild>
                  <Link href="/leads">View leads</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Active projects</CardTitle>
                <Folder className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.activeProjects ?? 0}</p>
                <p className="text-xs text-gray-500">Avg {data.avgProjectProgress ?? 0}% complete</p>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : data ? (
          <>
            <Link href="/leads?followUpDue=true">
              <Card
                className={cn(
                  "cursor-pointer transition-shadow hover:shadow-md",
                  (data.followUpsDueToday ?? 0) > 0
                    ? "border-amber-200 bg-amber-50/60"
                    : "border-green-200 bg-green-50/40"
                )}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Follow-ups due today
                  </CardTitle>
                  <AlertCircle
                    className={cn(
                      "h-5 w-5",
                      (data.followUpsDueToday ?? 0) > 0 ? "text-amber-600" : "text-green-600"
                    )}
                  />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data.followUpsDueToday ?? 0}</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/projects">
              <Card className="cursor-pointer border-blue-200 bg-blue-50/40 transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Active projects</CardTitle>
                  <Folder className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data.activeProjects ?? 0}</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/projects?status=delayed">
              <Card
                className={cn(
                  "cursor-pointer transition-shadow hover:shadow-md",
                  (data.delayedProjects ?? 0) > 0
                    ? "border-red-200 bg-red-50/40"
                    : "border-gray-200 bg-gray-50/60"
                )}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Delayed projects</CardTitle>
                  <AlertCircle
                    className={cn(
                      "h-5 w-5",
                      (data.delayedProjects ?? 0) > 0 ? "text-red-600" : "text-gray-400"
                    )}
                  />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data.delayedProjects ?? 0}</p>
                </CardContent>
              </Card>
            </Link>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Follow-ups due today</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/leads">All leads</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(data?.followUpsDueLeads || []).length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">No follow-ups due today</p>
            ) : (
              <ul className="space-y-2">
                {(data?.followUpsDueLeads || []).map((l) => (
                  <li key={l._id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <span className="font-medium text-gray-900">{l.name}</span>
                    <span className="text-gray-500">{l.phone}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Project progress</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/projects">All projects</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.projectOverview || []).length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">No active projects</p>
            ) : (
              (data?.projectOverview || []).map((p) => (
                <div key={p._id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-gray-900">{p.customerName}</span>
                    <span className="text-gray-500">{p.progressPct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {(data?.followUpsDue?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Follow-ups due</h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {data!.followUpsDue!.length}
            </span>
            <Link
              href="/leads?followUpDue=true"
              className="ml-auto text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              View all
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Last note</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.followUpsDue!.map((lead) => {
                  const due = dueDateLabel(lead.nextFollowUpDate);
                  const note = lead.lastFollowUpNote?.trim();
                  return (
                    <TableRow key={lead._id}>
                      <TableCell className="text-sm font-medium">{lead.name}</TableCell>
                      <TableCell className="text-sm text-gray-500">{lead.phone}</TableCell>
                      <TableCell className={cn("text-sm", due.className)}>{due.text}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-gray-500">
                        {note ? (note.length > 40 ? `${note.slice(0, 40)}…` : note) : "No notes yet"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border-emerald-200 text-xs text-emerald-700"
                          onClick={() => router.push("/leads")}
                        >
                          Follow up
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Recent activity</h3>
        <div className="rounded-xl border bg-white p-4">
          {isLoading ? (
            <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
          ) : (data?.recentActivity?.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No recent activity</p>
          ) : (
            <ul>
              {data!.recentActivity!.map((item, i) => (
                <li
                  key={`${item.type}-${item.time}-${i}`}
                  className="flex items-center gap-3 border-b py-2 last:border-0"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      ACTIVITY_DOT[item.color] || "bg-gray-400"
                    )}
                  />
                  <span className="flex-1 text-sm text-gray-700">{item.text}</span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent CRM activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.recentCrmActivity || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">
                      No activity yet
                    </TableCell>
                  </TableRow>
                ) : (
                  (data?.recentCrmActivity || []).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.leadName || "—"}</TableCell>
                      <TableCell className="max-w-xs truncate text-gray-600">{item.description}</TableCell>
                      <TableCell className="text-gray-500">{item.actor}</TableCell>
                      <TableCell className="text-gray-600">
                        {format(new Date(item.at), "MMM d, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent coin transactions</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/transactions">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
