"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import axios from "axios";
import { Package, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import { fulfillmentBadgeClass, fulfillmentLabel } from "@/lib/redemption-labels";
import { Button } from "@/components/ui/button";
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

type RewardMeta = { title?: string; icon?: string; coinsRequired?: number } | null;

type RedemptionRow = {
  _id: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
  fulfilledAt?: string | null;
  userId: { name?: string; phone?: string } | null;
  reward: RewardMeta;
};

type Tab = "pending" | "completed" | "cancelled" | "all";

export default function RedemptionsPage() {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<Tab>("pending");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-redemptions", tab, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      params.set("status", tab);
      const res = await api.get<{
        data: {
          redemptions: RedemptionRow[];
          pagination: { page: number; pages: number; total: number };
        };
      }>(`/admin/redemptions?${params}`);
      return res.data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "completed" | "cancelled" }) => {
      const res = await api.patch<{ success?: boolean; message?: string }>(`/admin/redemption/${id}`, {
        status,
      });
      return res.data;
    },
    onSuccess: (res) => {
      success(res.message || "Updated");
      void qc.invalidateQueries({ queryKey: ["admin-redemptions"] });
      void qc.invalidateQueries({ queryKey: ["admin-stats"] });
      void qc.invalidateQueries({ queryKey: ["admin-transactions"] });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? String(err.response?.data?.message || err.message)
        : "Update failed";
      toastError(msg);
    },
  });

  const markFulfilled = (id: string) => {
    updateMutation.mutate({ id, status: "completed" });
  };

  const cancelAndRefund = (id: string, userName: string) => {
    if (
      !window.confirm(
        `Cancel this redemption for ${userName || "this user"}? Coins will be refunded and reward stock restored (if applicable).`
      )
    ) {
      return;
    }
    updateMutation.mutate({ id, status: "cancelled" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Reward redemptions</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Track installs and deliveries (e.g. Monitoring upgrade, panel cleaning). New redemptions start as{" "}
            <strong>Pending install</strong> until you mark them fulfilled. The general transaction log is still
            under{" "}
            <Link href="/transactions" className="font-medium text-emerald-700 underline-offset-2 hover:underline">
              Transactions
            </Link>
            .
          </p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <Link href="/transactions">
            Transaction log
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">View</label>
            <Select
              value={tab}
              onValueChange={(v) => {
                setTab(v as Tab);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Fulfillment queue (pending install)</SelectItem>
                <SelectItem value="completed">Fulfilled history</SelectItem>
                <SelectItem value="cancelled">Cancelled (refunded)</SelectItem>
                <SelectItem value="all">All redemptions</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-gray-500">
            <Package className="mr-1 inline h-4 w-4 text-emerald-600" />
            {data?.pagination.total ?? "—"} record{(data?.pagination.total ?? 0) !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-red-800">Failed to load redemptions.</p>
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
                  <TableHead>Reward</TableHead>
                  <TableHead>Coins</TableHead>
                  <TableHead>Fulfillment</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.redemptions?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-gray-500">
                      No redemptions in this view
                    </TableCell>
                  </TableRow>
                ) : (
                  data.redemptions.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell>
                        <span className="font-medium text-gray-900">{r.userId?.name || "—"}</span>
                        <span className="mt-0.5 block text-xs text-gray-500">{r.userId?.phone || ""}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-lg leading-none">{r.reward?.icon || "🎁"}</span>{" "}
                        <span className="text-sm text-gray-900">
                          {r.reward?.title || r.description.replace(/^Redeemed:\s*/i, "")}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-red-600">{r.amount}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                            fulfillmentBadgeClass(r.status)
                          )}
                        >
                          {fulfillmentLabel(r.status)}
                        </span>
                        {r.status === "completed" && r.fulfilledAt ? (
                          <span className="mt-1 block text-xs text-gray-500">
                            Done {format(new Date(r.fulfilledAt), "MMM d, yyyy")}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(r.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "pending" ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              disabled={updateMutation.isPending}
                              onClick={() => markFulfilled(r._id)}
                            >
                              Mark installed
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-gray-300 text-gray-700"
                              disabled={updateMutation.isPending}
                              onClick={() => cancelAndRefund(r._id, r.userId?.name || "")}
                            >
                              Cancel & refund
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
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
