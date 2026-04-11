"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Building2, Calendar, Clock, MapPin, Phone, User, Users } from "lucide-react";
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
import { StatusBadge } from "@/components/crm/StatusBadge";
import { adminStatusLabel, LEAD_STATUSES, SALES_FUNNEL } from "@/lib/lead-status";
import type { LeadRow } from "@/types/lead";

export type TimelineEntry = {
  id: string;
  status: string;
  at: string;
  label: string;
};

export type LeadNote = {
  id: string;
  body: string;
  at: string;
};

export type LeadCRMState = {
  notes: LeadNote[];
  timeline: TimelineEntry[];
  nextFollowUp: string;
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

function isPopulatedUser(u: LeadRow["userId"]): u is Exclude<LeadRow["userId"], string> {
  return typeof u === "object" && u !== null && "name" in u;
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
  return {
    notes: [],
    timeline: [],
    nextFollowUp: "",
  };
}

type Props = {
  lead: LeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Persisted mock CRM state per lead */
  crmByLead: Record<string, LeadCRMState>;
  setCrmByLead: Dispatch<SetStateAction<Record<string, LeadCRMState>>>;
  onStatusChange: (leadId: string, newStatus: string) => void;
  isStatusSaving: boolean;
  agents: AgentOption[];
  onAssignAgent: (leadId: string, assignedAgentId: string | null) => void;
  isAssignSaving: boolean;
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
}: Props) {
  const [noteDraft, setNoteDraft] = useState("");

  const leadId = lead?._id;

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
    if (!open) setNoteDraft("");
  }, [open]);

  const crm = leadId ? crmByLead[leadId] : undefined;

  const mergeCrm = useCallback(
    (patch: Partial<LeadCRMState>) => {
      if (!leadId) return;
      setCrmByLead((prev) => ({
        ...prev,
        [leadId]: { ...(prev[leadId] ?? emptyCrmState()), ...patch },
      }));
    },
    [leadId, setCrmByLead]
  );

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

  const handleAddNote = () => {
    const text = noteDraft.trim();
    if (!text || !leadId) return;
    const note: LeadNote = { id: crypto.randomUUID(), body: text, at: new Date().toISOString() };
    setCrmByLead((prev) => {
      const cur = prev[leadId] ?? emptyCrmState();
      return {
        ...prev,
        [leadId]: { ...cur, notes: [note, ...cur.notes] },
      };
    });
    setNoteDraft("");
  };

  const referrer = useMemo(() => (lead && isPopulatedUser(lead.userId) ? lead.userId : null), [lead]);

  if (!lead) return null;

  const propertyLabel = lead.propertyType || "—";
  const preferred = lead.preferredDate ? format(new Date(lead.preferredDate), "PPP") : "—";
  const created = format(new Date(lead.createdAt), "PPp");
  const timeSlotLabel = lead.timeSlot
    ? lead.timeSlot.charAt(0).toUpperCase() + lead.timeSlot.slice(1)
    : "—";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="pr-10 text-left">{lead.name}</DrawerTitle>
          <DrawerDescription className="sr-only">Lead details, notes, and status history</DrawerDescription>
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

        <DrawerBody className="space-y-5">
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
                  disabled={isStatusSaving}
                >
                  <SelectTrigger className="h-10 w-full rounded-lg border-gray-200 bg-gray-50/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {adminStatusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
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
                <div className="space-y-2">
                  <Label htmlFor="follow-up" className="text-xs text-gray-600">
                    Next follow-up
                  </Label>
                  <input
                    id="follow-up"
                    type="date"
                    value={crm?.nextFollowUp ?? ""}
                    onChange={(e) => mergeCrm({ nextFollowUp: e.target.value })}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Notes</h3>
            <Textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Add context for your team…"
              className="min-h-[88px] resize-y rounded-lg border-gray-200 bg-gray-50/30"
            />
            <Button type="button" className="mt-2" size="sm" onClick={handleAddNote} disabled={!noteDraft.trim()}>
              Add note
            </Button>
            <ul className="mt-4 space-y-3">
              {(crm?.notes ?? []).length === 0 ? (
                <li className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 py-6 text-center text-sm text-gray-500">
                  No notes yet — add the first one above.
                </li>
              ) : (
                (crm?.notes ?? []).map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg border border-gray-100 bg-gray-50/40 px-3 py-2.5 text-sm text-gray-800 shadow-sm"
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{n.body}</p>
                    <p className="mt-2 text-xs text-gray-400">{format(new Date(n.at), "PPp")}</p>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Timeline</h3>
            <ol className="space-y-0">
              {(crm?.timeline ?? []).map((item, i, arr) => (
                <li key={item.id} className="relative flex gap-4 pb-8 last:pb-0">
                  <div className="flex w-5 shrink-0 flex-col items-center pt-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm ring-4 ring-emerald-50" />
                    {i < arr.length - 1 ? <span className="mt-1 min-h-[2rem] w-px flex-1 bg-gradient-to-b from-gray-200 to-gray-100" /> : null}
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
        </DrawerBody>

        <DrawerFooter className="flex flex-row items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
