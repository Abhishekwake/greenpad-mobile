"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Package } from "lucide-react";
import api from "@/lib/api";
import { fulfillmentBadgeClass, fulfillmentLabel } from "@/lib/redemption-labels";
import { downloadCsv } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type TxRow = {
  _id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
  userId: { name?: string; phone?: string } | null;
};

function typeBadge(t: string) {
  switch (t) {
    case "earn":
      return "bg-emerald-100 text-emerald-800";
    case "redeem":
      return "bg-red-100 text-red-800";
    case "pending":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default function TransactionsPage() {
  const { error: showError } = useToast();
  const [type, setType] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-transactions", type, startDate, endDate, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (type !== "all") params.set("type", type);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await api.get<{
        data: { transactions: TxRow[]; pagination: { page: number; pages: number; total: number } };
      }>(`/admin/transactions?${params}`);
      return res.data.data;
    },
  });

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "1000");
      if (type !== "all") params.set("type", type);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await api.get<{ data: { transactions: TxRow[] } }>(`/admin/transactions?${params}`);
      const rows = res.data.data.transactions.map((t) => ({
        UserName: t.userId?.name || "",
        Phone: t.userId?.phone || "",
        Type: t.type,
        Amount: t.amount,
        Description: t.description,
        Status: t.status,
        Date: format(new Date(t.createdAt), "yyyy-MM-dd HH:mm"),
      }));
      downloadCsv(`transactions-${format(new Date(), "yyyyMMdd-HHmm")}.csv`, rows);
    } catch {
      showError("Export failed");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-emerald-100 bg-emerald-50/50">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-sm font-medium text-emerald-950">Reward installs &amp; deliveries</p>
              <p className="text-sm text-emerald-900/80">
                Use the <strong>Redemptions</strong> page to track pending installs and mark rewards fulfilled. This
                screen is the full ledger (earn / redeem / all statuses).
              </p>
            </div>
          </div>
          <Button variant="outline" className="shrink-0 border-emerald-300 bg-white" asChild>
            <Link href="/redemptions">Open redemptions</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Transaction Log</h2>
        <Button variant="outline" type="button" onClick={exportCsv}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Type</label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="earn">Earn</SelectItem>
                <SelectItem value="redeem">Redeem</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Start date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">End date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-red-800">Failed to load transactions.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-64 animate-pulse bg-gray-100" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.transactions?.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-gray-500">
                      No transactions
                    </TableCell>
                  </TableRow>
                ) : (
                  data.transactions.map((t) => (
                    <TableRow key={t._id}>
                      <TableCell>{t.userId?.name || "—"}</TableCell>
                      <TableCell>{t.userId?.phone || "—"}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                            typeBadge(t.type)
                          )}
                        >
                          {t.type}
                        </span>
                      </TableCell>
                      <TableCell className={cn(t.amount >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {t.amount > 0 ? "+" : ""}
                        {t.amount}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{t.description}</TableCell>
                      <TableCell>
                        {t.type === "redeem" ? (
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                              fulfillmentBadgeClass(t.status)
                            )}
                          >
                            {fulfillmentLabel(t.status)}
                          </span>
                        ) : (
                          <span className="capitalize">{t.status}</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-gray-600">
                        {format(new Date(t.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {data.pagination.page} of {data.pagination.pages} ({data.pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              type="button"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.pages}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
