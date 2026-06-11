"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ClipboardList, Download, PanelRight, Plus, TrendingDown, TrendingUp } from "lucide-react";
import api from "@/lib/api";
import { downloadCsv, cn } from "@/lib/utils";
import { adminStatusLabel, LEAD_STATUSES } from "@/lib/lead-status";
import type { LeadRow, LeadsSummary } from "@/types/lead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SourceBadge } from "@/components/crm/SourceBadge";
import { FollowUpCell } from "@/components/crm/FollowUpCell";
import {
  LeadDetailsDrawer,
  type LeadCRMState,
  type AgentOption,
} from "@/components/crm/LeadDetailsDrawer";
import { CreateLeadModal } from "@/components/crm/CreateLeadModal";

type LeadsQueryData = {
  leads: LeadRow[];
  pagination: { page: number; pages: number; total: number };
};

function StatSkeleton() {
  return <div className="h-28 animate-pulse rounded-xl bg-gray-200" />;
}

export default function LeadsPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const { success, error } = useToast();
  const [status, setStatus] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [followUpFilter, setFollowUpFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [crmByLead, setCrmByLead] = useState<Record<string, LeadCRMState>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (searchParams.get("followUpDue") === "true") {
      setFollowUpFilter("today");
    }
  }, [searchParams]);

  const { data: agents = [] } = useQuery({
    queryKey: ["admin-agents"],
    queryFn: async () => {
      const res = await api.get<{ data: AgentOption[] }>("/admin/agents");
      return res.data.data;
    },
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["admin-leads-summary"],
    queryFn: async () => {
      const res = await api.get<{ data: LeadsSummary }>("/admin/leads/summary");
      return res.data.data;
    },
  });

  const useFollowUpSort = followUpFilter !== "all";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-leads", status, sourceFilter, followUpFilter, searchDebounced, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (status !== "all") params.set("status", status);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (followUpFilter === "today") params.set("followUpFilter", "today");
      else if (followUpFilter === "week") params.set("followUpFilter", "week");
      else if (followUpFilter === "overdue") params.set("followUpFilter", "overdue");
      if (useFollowUpSort) params.set("sort", "nextFollowUpDate");
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
      const res = await api.patch<{ data: LeadRow }>(`/admin/lead/${id}/status`, { status: newStatus });
      return res.data.data;
    },
    onMutate: async ({ id, newStatus }) => {
      await qc.cancelQueries({ queryKey: ["admin-leads"] });
      const previousEntries = qc.getQueriesData<LeadsQueryData>({ queryKey: ["admin-leads"] });
      const previousSelectedLead = selectedLead;

      qc.setQueriesData<LeadsQueryData>({ queryKey: ["admin-leads"] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          leads: old.leads.map((l) => (l._id === id ? { ...l, status: newStatus } : l)),
        };
      });

      setSelectedLead((cur) => (cur && cur._id === id ? { ...cur, status: newStatus } : cur));

      return { previousEntries, previousSelectedLead };
    },
    onSuccess: (updatedLead) => {
      success("Lead status updated");
      // Use server response to set the authoritative lead data
      if (updatedLead?._id) {
        setSelectedLead((cur) => (cur && cur._id === updatedLead._id ? updatedLead : cur));
        qc.setQueriesData<LeadsQueryData>({ queryKey: ["admin-leads"] }, (old) => {
          if (!old) return old;
          return {
            ...old,
            leads: old.leads.map((l) => (l._id === updatedLead._id ? updatedLead : l)),
          };
        });
      }
      qc.invalidateQueries({ queryKey: ["admin-leads"] });
      qc.invalidateQueries({ queryKey: ["admin-leads-summary"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (_err, _vars, ctx) => {
      error("Could not update status");
      if (ctx?.previousEntries) {
        for (const [key, val] of ctx.previousEntries) {
          if (val !== undefined) qc.setQueryData(key, val);
        }
      }
      // Also rollback the selectedLead optimistic update
      if (ctx?.previousSelectedLead) {
        setSelectedLead(ctx.previousSelectedLead);
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
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (followUpFilter === "today") params.set("followUpFilter", "today");
      else if (followUpFilter === "week") params.set("followUpFilter", "week");
      else if (followUpFilter === "overdue") params.set("followUpFilter", "overdue");
      if (searchDebounced.trim()) params.set("search", searchDebounced.trim());
      const res = await api.get<{ data: { leads: LeadRow[] } }>(`/admin/leads?${params}`);
      const rows = res.data.data.leads.map((l) => ({
        ID: l._id,
        Name: l.name,
        Phone: l.phone,
        Source: l.source || "mobile",
        PropertyType: l.propertyType || "",
        Date: l.preferredDate ? format(new Date(l.preferredDate), "yyyy-MM-dd") : "",
        NextFollowUp: l.nextFollowUpDate ? format(new Date(l.nextFollowUpDate), "yyyy-MM-dd") : "",
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

  const invalidateLeads = () => {
    void qc.invalidateQueries({ queryKey: ["admin-leads"] });
    void qc.invalidateQueries({ queryKey: ["admin-leads-summary"] });
    void qc.invalidateQueries({ queryKey: ["admin-stats"] });
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
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" />
            New Lead
          </Button>
          <Button variant="outline" onClick={exportCsv} type="button">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : summary ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Leads</CardTitle>
                <ClipboardList className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{summary.totalLeads}</p>
              </CardContent>
            </Card>
            <Card
              className={cn(summary.followUpDueToday > 0 && "border-amber-200 bg-amber-50/40")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle
                  className={cn(
                    "text-sm font-medium",
                    summary.followUpDueToday > 0 ? "text-amber-800" : "text-gray-500"
                  )}
                >
                  Follow-up Due Today
                </CardTitle>
                <ClipboardList
                  className={cn(
                    "h-5 w-5",
                    summary.followUpDueToday > 0 ? "text-amber-600" : "text-emerald-600"
                  )}
                />
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    "text-3xl font-bold",
                    summary.followUpDueToday > 0 ? "text-amber-900" : "text-gray-900"
                  )}
                >
                  {summary.followUpDueToday}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Converted This Month</CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{summary.convertedThisMonth}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Lost This Month</CardTitle>
                <TrendingDown className="h-5 w-5 text-gray-500" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{summary.lostThisMonth}</p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <CreateLeadModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreated={invalidateLeads}
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:flex-wrap md:items-end">
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
          <div className="space-y-2 md:w-48">
            <label className="text-xs font-medium text-gray-500">Source</label>
            <Select
              value={sourceFilter}
              onValueChange={(v) => {
                setSourceFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="mobile">Mobile App</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="walk_in">Walk-in</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:w-48">
            <label className="text-xs font-medium text-gray-500">Follow-up</label>
            <Select
              value={followUpFilter}
              onValueChange={(v) => {
                setFollowUpFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="today">Due Today</SelectItem>
                <SelectItem value="week">Due This Week</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
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
                  <TableHead className="font-semibold text-gray-700">Source</TableHead>
                  <TableHead className="font-semibold text-gray-700">Next Follow-up</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.leads?.length ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-gray-500">
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
                      <TableCell>
                        <SourceBadge source={lead.source} />
                      </TableCell>
                      <TableCell>
                        <FollowUpCell date={lead.nextFollowUpDate} />
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
        onLeadUpdated={(updated) => {
          setSelectedLead(updated);
          invalidateLeads();
        }}
      />
    </div>
  );
}
