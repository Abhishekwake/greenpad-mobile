"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import {
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  Rocket,
  User,
  Users,
} from "lucide-react";
import api from "@/lib/api";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { SourceBadge } from "@/components/crm/SourceBadge";
import { adminStatusLabel, LEAD_STATUS_SELECT, SALES_FUNNEL } from "@/lib/lead-status";
import { createProjectFromLead, getProjects, voidLead } from "@/lib/projectApi";
import { VoidConfirmDialog } from "@/components/crm/VoidConfirmDialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { FollowUpStatus, LeadFollowUp, LeadRow } from "@/types/lead";

export type TimelineEntry = {
  id: string;
  status: string;
  at: string;
  label: string;
};

export type LeadCRMState = {
  timeline: TimelineEntry[];
};

export type AgentOption = {
  _id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
};

const UNASSIGNED_VALUE = "__unassigned__";

const FOLLOW_UP_STATUS_LABEL: Record<FollowUpStatus, string> = {
  called: "Called",
  no_answer: "No answer",
  callback: "Callback requested",
  meeting_set: "Meeting set",
};

const FOLLOW_UP_STATUS_CLASS: Record<FollowUpStatus, string> = {
  called: "bg-green-50 text-green-700 border-green-200",
  no_answer: "bg-gray-50 text-gray-600 border-gray-200",
  callback: "bg-amber-50 text-amber-800 border-amber-200",
  meeting_set: "bg-blue-50 text-blue-700 border-blue-200",
};

function isPopulatedUser(u: LeadRow["userId"]): u is Exclude<LeadRow["userId"], string> {
  return typeof u === "object" && u !== null && "name" in u;
}

function resolveCustomerId(userId: LeadRow["userId"]): string | null {
  if (!userId) return null;
  if (typeof userId === "string") return userId;
  return userId._id ?? null;
}

function seedTimeline(lead: LeadRow): TimelineEntry[] {
  const created = new Date(lead.createdAt);
  const entries: TimelineEntry[] = [
    {
      id: "seed-created",
      status: "pending",
      at: created.toISOString(),
      label: "Lead created",
    },
  ];

  const st = lead.status as (typeof SALES_FUNNEL)[number] | string;
  if ((SALES_FUNNEL as readonly string[]).includes(st)) {
    const idx = (SALES_FUNNEL as readonly string[]).indexOf(st);
    let cursor = new Date(created);
    for (let i = 1; i <= idx; i++) {
      const status = SALES_FUNNEL[i];
      cursor = new Date(cursor.getTime() + 28 * 60 * 60 * 1000);
      entries.push({
        id: `seed-${status}`,
        status,
        at: cursor.toISOString(),
        label: `Moved to ${adminStatusLabel(status)}`,
      });
    }
    return entries;
  }

  const branchAt = new Date(created.getTime() + 24 * 60 * 60 * 1000);
  entries.push({
    id: "seed-current",
    status: lead.status,
    at: branchAt.toISOString(),
    label: `Status set to ${adminStatusLabel(lead.status)}`,
  });
  return entries;
}

function emptyCrmState(): LeadCRMState {
  return { timeline: [] };
}

function followUpId(fu: LeadFollowUp, index: number) {
  return fu._id || `${fu.createdAt}-${index}`;
}

type Props = {
  lead: LeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crmByLead: Record<string, LeadCRMState>;
  setCrmByLead: Dispatch<SetStateAction<Record<string, LeadCRMState>>>;
  onStatusChange: (leadId: string, newStatus: string) => void;
  isStatusSaving: boolean;
  agents: AgentOption[];
  onAssignAgent: (leadId: string, assignedAgentId: string | null) => void;
  isAssignSaving: boolean;
  onLeadUpdated: (lead: LeadRow) => void;
};

export function LeadDetailsDrawer({
  lead,
  open,
  onOpenChange,
  crmByLead,
  setCrmByLead,
  onStatusChange,
  isStatusSaving,
  agents,
  onAssignAgent,
  isAssignSaving,
  onLeadUpdated,
}: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState("details");
  const [noteDraft, setNoteDraft] = useState("");
  const [followStatus, setFollowStatus] = useState<FollowUpStatus>("called");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);

  const leadId = lead?._id;
  const adminName =
    typeof window !== "undefined" ? localStorage.getItem("adminName") || "Admin" : "Admin";

  const { data: projectsData, isLoading: projectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ["project-for-lead", leadId],
    queryFn: async () => {
      const res = await getProjects({ leadId: lead!._id });
      return res.data;
    },
    enabled: !!lead && lead.status === "converted" && open,
  });

  const existingProject = projectsData?.data?.[0];

  const voidLeadMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!lead) throw new Error("No lead selected");
      const res = await voidLead(lead._id, reason);
      return res.data.data as LeadRow;
    },
    onSuccess: (updated) => {
      success("Site visit voided");
      onLeadUpdated(updated);
      onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ["admin-leads"] });
      void qc.invalidateQueries({ queryKey: ["admin-leads-summary"] });
      setVoidDialogOpen(false);
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? String(err.response?.data?.message || err.message)
        : "Failed to void site visit";
      toastError(msg);
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      if (!lead) throw new Error("No lead selected");
      await createProjectFromLead(lead._id);
    },
    onSuccess: () => {
      if (lead) success(`Project created for ${lead.name}`);
      void refetchProjects();
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? String(err.response?.data?.message || err.message)
        : "Failed to create project";
      toastError(msg);
    },
  });

  const followUpMutation = useMutation({
    mutationFn: async () => {
      if (!leadId) throw new Error("No lead");
      const res = await api.post<{ data: LeadRow }>(`/admin/lead/${leadId}/followup`, {
        note: noteDraft.trim(),
        status: followStatus,
        nextFollowUpDate: nextFollowUp || undefined,
        createdBy: adminName,
      });
      return res.data.data;
    },
    onSuccess: (updated) => {
      success("Follow-up logged");
      setNoteDraft("");
      setNextFollowUp("");
      setFollowStatus("called");
      onLeadUpdated(updated);
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? String(err.response?.data?.message || err.message)
        : "Could not log follow-up";
      toastError(msg);
    },
  });

  useEffect(() => {
    if (!leadId || !open) return;
    setCrmByLead((prev) => {
      if (prev[leadId]) return prev;
      return {
        ...prev,
        [leadId]: {
          ...emptyCrmState(),
          timeline: seedTimeline(lead!),
        },
      };
    });
  }, [leadId, open, lead, setCrmByLead]);

  useEffect(() => {
    if (!open) {
      setNoteDraft("");
      setNextFollowUp("");
      setFollowStatus("called");
      setActiveTab("details");
    }
  }, [open]);

  const crm = leadId ? crmByLead[leadId] : undefined;

  const appendTimeline = useCallback(
    (status: string, label: string) => {
      if (!leadId) return;
      const entry: TimelineEntry = {
        id: crypto.randomUUID(),
        status,
        at: new Date().toISOString(),
        label,
      };
      setCrmByLead((prev) => {
        const cur = prev[leadId] ?? emptyCrmState();
        return {
          ...prev,
          [leadId]: { ...cur, timeline: [...cur.timeline, entry] },
        };
      });
    },
    [leadId, setCrmByLead]
  );

  const referrer = useMemo(() => (lead && isPopulatedUser(lead.userId) ? lead.userId : null), [lead]);

  if (!lead) return null;

  const propertyLabel = lead.propertyType || "—";
  const preferred = lead.preferredDate ? format(new Date(lead.preferredDate), "PPP") : "—";
  const created = format(new Date(lead.createdAt), "PPp");
  const timeSlotLabel = lead.timeSlot
    ? lead.timeSlot.charAt(0).toUpperCase() + lead.timeSlot.slice(1)
    : "—";

  const followUps = [...(lead.followUps ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const detailsTab = (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Lead info</h3>
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-gray-50 pb-2">
            <dt className="flex items-center gap-2 text-gray-500">
              <User className="h-4 w-4 text-gray-400" />
              Full name
            </dt>
            <dd className="font-medium text-gray-900">{lead.name}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-50 pb-2">
            <dt className="flex items-center gap-2 text-gray-500">
              <Phone className="h-4 w-4 text-gray-400" />
              Phone
            </dt>
            <dd className="font-medium text-gray-900">{lead.phone}</dd>
          </div>
          {lead.email ? (
            <div className="flex justify-between gap-4 border-b border-gray-50 pb-2">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900">{lead.email}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-b border-gray-50 pb-2">
            <dt className="text-gray-500">Source</dt>
            <dd>
              <SourceBadge source={lead.source} />
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-50 pb-2">
            <dt className="flex items-center gap-2 text-gray-500">
              <Building2 className="h-4 w-4 text-gray-400" />
              Property interested
            </dt>
            <dd className="text-right font-medium text-gray-900">{propertyLabel}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-50 pb-2">
            <dt className="flex items-center gap-2 text-gray-500">
              <Calendar className="h-4 w-4 text-gray-400" />
              Preferred visit
            </dt>
            <dd className="text-right text-gray-900">{preferred}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-gray-50 pb-2">
            <dt className="flex items-center gap-2 text-gray-500">
              <Clock className="h-4 w-4 text-gray-400" />
              Time slot
            </dt>
            <dd className="text-right text-gray-900">{timeSlotLabel}</dd>
          </div>
          {lead.address ? (
            <div className="flex justify-between gap-4 border-b border-gray-50 pb-2">
              <dt className="flex items-center gap-2 text-gray-500">
                <MapPin className="h-4 w-4 text-gray-400" />
                Address
              </dt>
              <dd className="max-w-[60%] text-right text-gray-900">{lead.address}</dd>
            </div>
          ) : null}
          {typeof lead.roofArea === "number" ? (
            <div className="flex justify-between gap-4 border-b border-gray-50 pb-2">
              <dt className="text-gray-500">Roof area (sq ft)</dt>
              <dd className="font-medium text-gray-900">{lead.roofArea}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="flex items-center gap-2 text-gray-500">
              <Calendar className="h-4 w-4 text-gray-400" />
              Created
            </dt>
            <dd className="text-right text-gray-900">{created}</dd>
          </div>
          {lead.createdByAdmin ? (
            <div className="flex justify-between gap-4 border-t border-gray-100 pt-2">
              <dt className="text-gray-500">Created by</dt>
              <dd className="text-right text-sm text-gray-900">{lead.createdByAdmin}</dd>
            </div>
          ) : null}
          {referrer ? (
            <div className="flex justify-between gap-4 border-t border-gray-100 pt-2">
              <dt className="flex items-center gap-2 text-gray-500">
                <Users className="h-4 w-4 text-gray-400" />
                Referring user
              </dt>
              <dd className="text-right text-sm text-gray-900">
                {referrer.name || "—"}
                {referrer.phone ? (
                  <span className="mt-0.5 block text-gray-500">{referrer.phone}</span>
                ) : null}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-gray-100 pt-2">
            <dt className="text-gray-500">Field assignee</dt>
            <dd className="max-w-[60%] text-right text-sm font-medium text-gray-900">
              {lead.assignedAgent?.name ? (
                <>
                  {lead.assignedAgent.name}
                  {lead.assignedAgent.role ? (
                    <span className="mt-0.5 block text-xs font-normal text-gray-500">
                      {lead.assignedAgent.role}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-gray-400">Unassigned</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Sales pipeline</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-gray-600">Update status</Label>
            <Select
              value={lead.status}
              onValueChange={(newStatus) => {
                if (newStatus === lead.status) return;
                onStatusChange(lead._id, newStatus);
                appendTimeline(newStatus, `Status updated to ${adminStatusLabel(newStatus)}`);
              }}
              disabled={isStatusSaving || lead.status === "voided"}
            >
              <SelectTrigger className="h-10 w-full rounded-lg border-gray-200 bg-gray-50/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUS_SELECT.map((s) => (
                  <SelectItem key={s} value={s}>
                    {adminStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {lead.status !== "voided" && lead.status !== "converted" ? (
            <Button
              type="button"
              variant="outline"
              className="w-full border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => setVoidDialogOpen(true)}
            >
              Void site visit…
            </Button>
          ) : null}
          {lead.status === "voided" && lead.voidReason ? (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
              Voided{lead.voidedBy ? ` by ${lead.voidedBy}` : ""}
              {lead.voidedAt ? ` · ${format(new Date(lead.voidedAt), "MMM d, yyyy")}` : ""}
              <br />
              <span className="text-red-700/90">{lead.voidReason}</span>
            </p>
          ) : null}
          <div className="space-y-2">
            <Label className="text-xs text-gray-600">Assign field agent</Label>
            <p className="text-xs text-gray-500">
              Choose from your{" "}
              <Link href="/agents" className="font-medium text-emerald-700 underline-offset-2 hover:underline">
                Team
              </Link>{" "}
              directory. Shown to ops for follow-up.
            </p>
            <Select
              value={lead.assignedAgent?._id ?? UNASSIGNED_VALUE}
              onValueChange={(v) => {
                const nextId = v === UNASSIGNED_VALUE ? null : v;
                const cur = lead.assignedAgent?._id ?? null;
                if (nextId === cur) return;
                onAssignAgent(lead._id, nextId);
                const label =
                  nextId == null
                    ? "Assignment cleared"
                    : `Assigned to ${agents.find((a) => a._id === nextId)?.name ?? "agent"}`;
                appendTimeline(lead.status, label);
              }}
              disabled={isAssignSaving || agents.length === 0}
            >
              <SelectTrigger className="h-10 rounded-lg border-gray-200 bg-white">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a._id} value={a._id}>
                    {a.name}
                    {a.role ? ` · ${a.role}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {agents.length === 0 ? (
              <p className="text-xs text-amber-800">
                No active agents yet. Add people under Team first.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Timeline</h3>
        <ol className="space-y-0">
          {(crm?.timeline ?? []).map((item, i, arr) => (
            <li key={item.id} className="relative flex gap-4 pb-8 last:pb-0">
              <div className="flex w-5 shrink-0 flex-col items-center pt-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm ring-4 ring-emerald-50" />
                {i < arr.length - 1 ? (
                  <span className="mt-1 min-h-[2rem] w-px flex-1 bg-gradient-to-b from-gray-200 to-gray-100" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <time className="shrink-0 text-xs tabular-nums text-gray-400">
                    {format(new Date(item.at), "MMM d, yyyy · HH:mm")}
                  </time>
                </div>
                <div className="mt-1.5">
                  <StatusBadge status={item.status} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );

  const followUpsTab = (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Add follow-up</h3>
        <Textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={3}
          placeholder="e.g. Called customer, interested but wants site survey first..."
          className="min-h-[88px] resize-y rounded-lg border-gray-200 bg-gray-50/30"
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-gray-600">Status</Label>
            <Select
              value={followStatus}
              onValueChange={(v) => setFollowStatus(v as FollowUpStatus)}
            >
              <SelectTrigger className="h-10 rounded-lg border-gray-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FOLLOW_UP_STATUS_LABEL) as FollowUpStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {FOLLOW_UP_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="next-follow-up" className="text-xs text-gray-600">
              Next follow-up
            </Label>
            <input
              id="next-follow-up"
              type="date"
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            />
          </div>
        </div>
        <Button
          type="button"
          className="mt-3"
          onClick={() => followUpMutation.mutate()}
          disabled={!noteDraft.trim() || followUpMutation.isPending}
        >
          {followUpMutation.isPending ? "Saving…" : "Log follow-up"}
        </Button>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">History</h3>
        {followUps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 py-8 text-center text-sm text-gray-500">
            No follow-ups yet. Log your first note above.
          </p>
        ) : (
          <ul className="space-y-2">
            {followUps.map((fu, index) => (
              <li key={followUpId(fu, index)} className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                      FOLLOW_UP_STATUS_CLASS[fu.status] ?? FOLLOW_UP_STATUS_CLASS.called
                    )}
                  >
                    {FOLLOW_UP_STATUS_LABEL[fu.status] ?? fu.status}
                  </span>
                  <time className="text-xs text-gray-400">
                    {format(new Date(fu.createdAt), "MMM d, yyyy · HH:mm")}
                  </time>
                </div>
                <p className="mt-1 text-sm text-gray-700">{fu.note}</p>
                {fu.nextFollowUpDate ? (
                  <p className="mt-1 text-xs text-blue-600">
                    Next: {format(new Date(fu.nextFollowUpDate), "MMM d, yyyy")}
                  </p>
                ) : null}
                {fu.createdBy ? (
                  <p className="mt-1 text-xs text-gray-400">{fu.createdBy}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  const projectTab = (
    <div className="space-y-5">
      {lead.status === "converted" ? (
        <>
          {!projectsLoading && !existingProject ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-2">
                <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Ready to start installation?</p>
                  <p className="mt-1 text-xs text-green-700">
                    This lead has been converted. Create a project to begin tracking the solar installation.
                    {!resolveCustomerId(lead.userId) ? (
                      <> A customer profile will be linked automatically using phone {lead.phone}.</>
                    ) : null}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => createProjectMutation.mutate()}
                disabled={createProjectMutation.isPending}
                className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {createProjectMutation.isPending ? "Creating…" : "🚀 Create project"}
              </button>
            </div>
          ) : null}

          {existingProject ? (
            <div className="flex items-center justify-between rounded-xl border bg-gray-50 p-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Project active</p>
                  <p className="text-xs text-gray-500">Installation in progress</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/projects")}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View project →
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 py-8 text-center text-sm text-gray-500">
          Convert this lead to create a project.
        </p>
      )}
    </div>
  );

  return (
    <>
      <VoidConfirmDialog
        open={voidDialogOpen}
        onOpenChange={setVoidDialogOpen}
        title="Void site visit?"
        description="This enquiry will be removed from active lists. It is not permanently deleted — you can still find it under the Voided filter."
        confirmLabel="Void site visit"
        isPending={voidLeadMutation.isPending}
        onConfirm={(reason) => voidLeadMutation.mutateAsync(reason)}
      />
      <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="pr-10 text-left">{lead.name}</DrawerTitle>
          <DrawerDescription className="sr-only">Lead details, follow-ups, and project</DrawerDescription>
          <div className="mt-3 flex flex-col gap-3 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={lead.status} />
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {lead.phone}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {propertyLabel}
              </span>
            </div>
          </div>
        </DrawerHeader>

        <DrawerBody>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4 grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="followups">Follow-ups</TabsTrigger>
              <TabsTrigger value="project">Project</TabsTrigger>
            </TabsList>
            <TabsContent value="details">{detailsTab}</TabsContent>
            <TabsContent value="followups">{followUpsTab}</TabsContent>
            <TabsContent value="project">{projectTab}</TabsContent>
          </Tabs>
        </DrawerBody>

        <DrawerFooter className="flex flex-row items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
    </>
  );
}
