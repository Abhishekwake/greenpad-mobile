"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download } from "lucide-react";
import api from "@/lib/api";
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

const STATUSES = [
  "pending",
  "contacted",
  "visited",
  "converted",
  "not_converted",
  "cancelled",
  "rejected",
] as const;

function adminStatusLabel(s: string) {
  switch (s) {
    case "not_converted":
      return "Not converted";
    case "converted":
      return "Converted";
    case "cancelled":
      return "Cancelled";
    default:
      return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

function statusBadgeClass(s: string) {
  switch (s) {
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "contacted":
      return "bg-blue-100 text-blue-800";
    case "visited":
      return "bg-purple-100 text-purple-800";
    case "converted":
      return "bg-emerald-100 text-emerald-800";
    case "not_converted":
      return "bg-orange-100 text-orange-900";
    case "cancelled":
    case "rejected":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

type Lead = {
  _id: string;
  name: string;
  phone: string;
  propertyType?: string;
  preferredDate?: string;
  status: string;
  createdAt: string;
};

export default function LeadsPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-leads", status, searchDebounced, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (status !== "all") params.set("status", status);
      if (searchDebounced.trim()) params.set("search", searchDebounced.trim());
      const res = await api.get<{
        success: boolean;
        data: { leads: Lead[]; pagination: { page: number; pages: number; total: number } };
      }>(`/admin/leads?${params}`);
      return res.data.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      await api.patch(`/admin/lead/${id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      success("Lead status updated");
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: () => error("Could not update status"),
  });

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "500");
      if (status !== "all") params.set("status", status);
      if (searchDebounced.trim()) params.set("search", searchDebounced.trim());
      const res = await api.get<{ data: { leads: Lead[] } }>(`/admin/leads?${params}`);
      const rows = res.data.data.leads.map((l) => ({
        ID: l._id,
        Name: l.name,
        Phone: l.phone,
        PropertyType: l.propertyType || "",
        Date: l.preferredDate ? format(new Date(l.preferredDate), "yyyy-MM-dd") : "",
        Status: l.status,
        Created: format(new Date(l.createdAt), "yyyy-MM-dd HH:mm"),
      }));
      downloadCsv(`leads-${format(new Date(), "yyyyMMdd-HHmm")}.csv`, rows);
    } catch {
      error("Export failed");
    }
  };

  const applySearch = () => {
    setPage(1);
    setSearchDebounced(search);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Leads</h2>
        <Button variant="outline" onClick={exportCsv} type="button">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-end">
          <div className="space-y-2 md:w-48">
            <label className="text-xs font-medium text-gray-500">Status</label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {adminStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <label className="text-xs font-medium text-gray-500">Search name or phone</label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" />
            </div>
            <Button type="button" onClick={applySearch}>
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-red-800">Failed to load leads.</p>
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
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.leads?.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-gray-500">
                      No leads found
                    </TableCell>
                  </TableRow>
                ) : (
                  data.leads.map((lead) => (
                    <TableRow key={lead._id}>
                      <TableCell className="max-w-[100px] truncate font-mono text-xs">{lead._id}</TableCell>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.phone}</TableCell>
                      <TableCell>{lead.propertyType || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-gray-600">
                        {lead.preferredDate
                          ? format(new Date(lead.preferredDate), "MMM d, yyyy")
                          : format(new Date(lead.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            statusBadgeClass(lead.status)
                          )}
                        >
                          {adminStatusLabel(lead.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={lead.status}
                          onValueChange={(newStatus) =>
                            mutation.mutate({ id: lead._id, newStatus })
                          }
                          disabled={mutation.isPending}
                        >
                          <SelectTrigger className="h-9 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {adminStatusLabel(s)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
