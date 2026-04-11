"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, PanelRight } from "lucide-react";
import api from "@/lib/api";
import { downloadCsv } from "@/lib/utils";
import { adminStatusLabel, LEAD_STATUSES } from "@/lib/lead-status";
import type { LeadRow } from "@/types/lead";
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
import { StatusBadge } from "@/components/crm/StatusBadge";
import {
  LeadDetailsDrawer,
  type LeadCRMState,
  type AgentOption,
} from "@/components/crm/LeadDetailsDrawer";

type LeadsQueryData = {
  leads: LeadRow[];
  pagination: { page: number; pages: number; total: number };
};

export default function LeadsPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [crmByLead, setCrmByLead] = useState<Record<string, LeadCRMState>>({});

  const { data: agents = [] } = useQuery({
    queryKey: ["admin-agents"],
    queryFn: async () => {
      const res = await api.get<{ data: AgentOption[] }>("/admin/agents");
      return res.data.data;
    },
  });

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
        data: LeadsQueryData;
      }>(`/admin/leads?${params}`);
      return res.data.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      await api.patch(`/admin/lead/${id}/status`, { status: newStatus });
    },
    onMutate: async ({ id, newStatus }) => {
      await qc.cancelQueries({ queryKey: ["admin-leads"] });
      const previousEntries = qc.getQueriesData<LeadsQueryData>({ queryKey: ["admin-leads"] });

      qc.setQueriesData<LeadsQueryData>({ queryKey: ["admin-leads"] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          leads: old.leads.map((l) => (l._id === id ? { ...l, status: newStatus } : l)),
        };
      });

      setSelectedLead((cur) => (cur && cur._id === id ? { ...cur, status: newStatus } : cur));

      return { previousEntries };
    },
    onSuccess: () => {
      success("Lead status updated");
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (_err, _vars, ctx) => {
      error("Could not update status");
      if (ctx?.previousEntries) {
        for (const [key, val] of ctx.previousEntries) {
          if (val !== undefined) qc.setQueryData(key, val);
        }
      }
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({
      leadId,
      assignedAgentId,
    }: {
      leadId: string;
      assignedAgentId: string | null;
    }) => {
      await api.patch(`/admin/lead/${leadId}/assign`, { assignedAgentId });
    },
    onSuccess: () => {
      success("Field agent updated");
      void qc.invalidateQueries({ queryKey: ["admin-leads"] });
    },
    onError: () => error("Could not update assignment"),
  });

  const openDetails = (lead: LeadRow) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "500");
      if (status !== "all") params.set("status", status);
      if (searchDebounced.trim()) params.set("search", searchDebounced.trim());
      const res = await api.get<{ data: { leads: LeadRow[] } }>(`/admin/leads?${params}`);
      const rows = res.data.data.leads.map((l) => ({
        ID: l._id,
        Name: l.name,
        Phone: l.phone,
        PropertyType: l.propertyType || "",
        Date: l.preferredDate ? format(new Date(l.preferredDate), "yyyy-MM-dd") : "",
        Status: l.status,
        Assigned: l.assignedAgent?.name || "",
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

  useEffect(() => {
    if (!drawerOpen || !selectedLead?._id || !data?.leads?.length) return;
    const fresh = data.leads.find((l) => l._id === selectedLead._id);
    if (fresh) setSelectedLead(fresh);
  }, [data, drawerOpen, selectedLead?._id]);

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
            <label className="text-xs font-medium text-gray-500">Filter by status</label>
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
                {LEAD_STATUSES.map((s) => (
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
                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                  <TableHead className="font-semibold text-gray-700">ID</TableHead>
                  <TableHead className="font-semibold text-gray-700">Name</TableHead>
                  <TableHead className="font-semibold text-gray-700">Phone</TableHead>
                  <TableHead className="font-semibold text-gray-700">Property</TableHead>
                  <TableHead className="font-semibold text-gray-700">Date</TableHead>
                  <TableHead className="font-semibold text-gray-700">Status</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
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
                    <TableRow key={lead._id} className="transition-colors hover:bg-gray-50/60">
                      <TableCell className="max-w-[100px] truncate font-mono text-xs text-gray-500">{lead._id}</TableCell>
                      <TableCell className="font-medium text-gray-900">{lead.name}</TableCell>
                      <TableCell className="text-gray-700">{lead.phone}</TableCell>
                      <TableCell className="text-gray-600">{lead.propertyType || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-gray-600">
                        {lead.preferredDate
                          ? format(new Date(lead.preferredDate), "MMM d, yyyy")
                          : format(new Date(lead.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={lead.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-gray-200 font-medium text-gray-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-900"
                          onClick={() => openDetails(lead)}
                        >
                          <PanelRight className="h-3.5 w-3.5" />
                          View details
                        </Button>
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

      <LeadDetailsDrawer
        lead={selectedLead}
        open={drawerOpen}
        onOpenChange={(o) => {
          setDrawerOpen(o);
          if (!o) setSelectedLead(null);
        }}
        crmByLead={crmByLead}
        setCrmByLead={setCrmByLead}
        onStatusChange={(id, newStatus) => mutation.mutate({ id, newStatus })}
        isStatusSaving={mutation.isPending}
        agents={agents}
        onAssignAgent={(leadId, assignedAgentId) =>
          assignMutation.mutate({ leadId, assignedAgentId })
        }
        isAssignSaving={assignMutation.isPending}
      />
    </div>
  );
}
