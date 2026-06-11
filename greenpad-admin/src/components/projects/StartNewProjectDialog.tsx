"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import { Loader2, Rocket, Search } from "lucide-react";
import api from "@/lib/api";
import { createProjectFromLead, getProjects } from "@/lib/projectApi";
import { SourceBadge } from "@/components/crm/SourceBadge";
import type { LeadRow } from "@/types/lead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: (projectId: string, customerName: string) => void;
};

export function StartNewProjectDialog({ open, onOpenChange, onProjectCreated }: Props) {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const { data: convertedLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads-converted-for-project"],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "converted", limit: "100", page: "1" });
      const res = await api.get<{
        success: boolean;
        data: { leads: LeadRow[] };
      }>(`/admin/leads?${params}`);
      return res.data.data.leads;
    },
    enabled: open,
    staleTime: 30_000,
  });

  const { data: allProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects", "all-stats"],
    queryFn: async () => {
      const res = await getProjects({ view: "all" });
      const rows = res.data.data;
      return Array.isArray(rows) ? rows : [];
    },
    enabled: open,
    staleTime: 30_000,
  });

  const leadsWithProject = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProjects) {
      if (!p) continue;
      if (p.leadId && p.status !== "voided") {
        set.add(String(p.leadId));
      }
    }
    return set;
  }, [allProjects]);

  const eligibleLeads = useMemo(() => {
    return convertedLeads.filter((l) => !leadsWithProject.has(l._id));
  }, [convertedLeads, leadsWithProject]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligibleLeads;
    const digits = q.replace(/\D/g, "");
    return eligibleLeads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (digits.length > 0 && l.phone.includes(digits)) ||
        (l.address && l.address.toLowerCase().includes(q))
    );
  }, [eligibleLeads, search]);

  const selectedLead = eligibleLeads.find((l) => l._id === selectedLeadId) ?? null;

  const createMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await createProjectFromLead(leadId);
      return res.data.data as { _id: string; customerName?: string };
    },
    onSuccess: (project, leadId) => {
      const lead = eligibleLeads.find((l) => l._id === leadId);
      const name = project.customerName || lead?.name || "Customer";
      success(`Project started for ${name}`);
      void qc.invalidateQueries({ queryKey: ["projects"] });
      void qc.invalidateQueries({ queryKey: ["leads-converted-for-project"] });
      void qc.invalidateQueries({ queryKey: ["project-for-lead", leadId] });
      onProjectCreated?.(project._id, name);
      setSelectedLeadId(null);
      setSearch("");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toastError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.message || err.message)
          : "Failed to start project"
      );
    },
  });

  const handleClose = (next: boolean) => {
    if (createMutation.isPending) return;
    if (!next) {
      setSelectedLeadId(null);
      setSearch("");
    }
    onOpenChange(next);
  };

  const loading = leadsLoading || projectsLoading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="border-b border-gray-100 px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-emerald-600" />
            Start new project
          </DialogTitle>
          <DialogDescription>
            Pick a <strong>converted</strong> site visit that does not already have an active installation.
            Manual and app leads are both supported.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, or address…"
              className="pl-9"
              disabled={loading || createMutation.isPending}
            />
          </div>
        </div>

        <div className="min-h-[200px] flex-1 overflow-y-auto px-6 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" />
              Loading converted leads…
            </div>
          ) : eligibleLeads.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-10 text-center text-sm text-gray-600">
              <p className="font-medium text-gray-800">No leads ready for a new project</p>
              <p className="mt-2 text-xs text-gray-500">
                Convert a site visit on the Leads page first, or void duplicate projects if one already
                exists.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-4" asChild>
                <Link href="/leads">Go to Leads</Link>
              </Button>
            </div>
          ) : filteredLeads.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">No matches for your search.</p>
          ) : (
            <ul className="space-y-2">
              {filteredLeads.map((lead) => {
                const selected = selectedLeadId === lead._id;
                return (
                  <li key={lead._id}>
                    <button
                      type="button"
                      onClick={() => setSelectedLeadId(lead._id)}
                      disabled={createMutation.isPending}
                      className={cn(
                        "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200"
                          : "border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-900">{lead.name}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{lead.phone}</p>
                          {lead.address ? (
                            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{lead.address}</p>
                          ) : null}
                        </div>
                        {lead.source ? <SourceBadge source={lead.source} /> : null}
                      </div>
                      <p className="mt-2 text-xs text-gray-400">
                        Converted · {format(new Date(lead.updatedAt || lead.createdAt), "MMM d, yyyy")}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="border-t border-gray-100 px-6 py-4 sm:justify-between">
          <p className="text-xs text-gray-500 sm:max-w-[55%]">
            {eligibleLeads.length > 0
              ? `${eligibleLeads.length} converted lead${eligibleLeads.length === 1 ? "" : "s"} without a project`
              : ""}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedLeadId || createMutation.isPending}
              onClick={() => selectedLeadId && createMutation.mutate(selectedLeadId)}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting…
                </>
              ) : (
                "Start project"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
