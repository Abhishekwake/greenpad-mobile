"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { isSuperAdmin } from "@/lib/adminRole";

type Run = {
  _id: string;
  ranAt: string;
  usersChecked: number;
  mismatchCount: number;
  mismatches: Array<{
    phone?: string;
    storedCoins: number;
    expectedCoins: number;
    delta: number;
  }>;
  status: string;
};

export default function ReconciliationPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { success, error } = useToast();

  useEffect(() => {
    if (!isSuperAdmin()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-reconciliation"],
    queryFn: async () => {
      const res = await api.get<{ data: Run[] }>("/admin/reconciliation?limit=20");
      return res.data.data;
    },
    enabled: isSuperAdmin(),
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      await api.post("/admin/reconciliation/run");
    },
    onSuccess: () => {
      success("Reconciliation completed");
      void qc.invalidateQueries({ queryKey: ["admin-reconciliation"] });
    },
    onError: () => error("Reconciliation failed"),
  });

  if (!isSuperAdmin()) {
    return null;
  }

  const latest = data?.[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Coin reconciliation</h2>
          <p className="text-sm text-gray-600">
            Compares each user&apos;s balance to the sum of their transactions (read-only).
          </p>
        </div>
        <Button type="button" onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
          {runMutation.isPending ? "Running…" : "Run now"}
        </Button>
      </div>

      {latest && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest run</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700">
            <p>{format(new Date(latest.ranAt), "PPpp")}</p>
            <p className="mt-1">
              {latest.usersChecked} users checked —{" "}
              <span className={latest.mismatchCount > 0 ? "font-semibold text-red-700" : ""}>
                {latest.mismatchCount} mismatch(es)
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-32 animate-pulse bg-gray-100" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Mismatches</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data || []).map((run) => (
                  <TableRow key={run._id}>
                    <TableCell>{format(new Date(run.ranAt), "MMM d, HH:mm")}</TableCell>
                    <TableCell>{run.usersChecked}</TableCell>
                    <TableCell>{run.mismatchCount}</TableCell>
                    <TableCell className="capitalize">{run.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {latest && latest.mismatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mismatches (latest run)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone</TableHead>
                  <TableHead>Stored</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Delta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latest.mismatches.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell>{m.phone || "—"}</TableCell>
                    <TableCell>{m.storedCoins}</TableCell>
                    <TableCell>{m.expectedCoins}</TableCell>
                    <TableCell>{m.delta}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Button variant="outline" type="button" onClick={() => refetch()}>
        Refresh
      </Button>
    </div>
  );
}
