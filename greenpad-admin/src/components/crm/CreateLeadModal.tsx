"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { LeadSource } from "@/types/lead";
import type { AgentOption } from "@/components/crm/LeadDetailsDrawer";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

const PROPERTY_TYPES = ["Residential", "Commercial", "Industrial", "Agricultural"] as const;
const TIME_SLOTS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
] as const;

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: "manual", label: "Manual entry" },
  { value: "walk_in", label: "Walk-in" },
  { value: "referral", label: "Referral" },
];

const UNASSIGNED = "__unassigned__";

function resetForm() {
  return {
    name: "",
    phone: "",
    email: "",
    source: "manual" as LeadSource,
    address: "",
    propertyType: "Residential",
    roofArea: "",
    preferredDate: "",
    timeSlot: "",
    assignedAgent: UNASSIGNED,
    initialNote: "",
  };
}

export function CreateLeadModal({ open, onOpenChange, onCreated }: Props) {
  const { success, error } = useToast();
  const [form, setForm] = useState(resetForm);

  const { data: agents = [] } = useQuery({
    queryKey: ["admin-agents"],
    queryFn: async () => {
      const res = await api.get<{ data: AgentOption[] }>("/admin/agents");
      return res.data.data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) setForm(resetForm());
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.replace(/\D/g, ""),
        source: form.source,
        propertyType: form.propertyType,
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.address.trim()) payload.address = form.address.trim();
      if (form.roofArea.trim()) payload.roofArea = Number(form.roofArea);
      if (form.preferredDate) payload.preferredDate = form.preferredDate;
      if (form.timeSlot) payload.timeSlot = form.timeSlot;
      if (form.assignedAgent !== UNASSIGNED) payload.assignedAgent = form.assignedAgent;
      if (form.initialNote.trim()) payload.initialNote = form.initialNote.trim();

      await api.post("/admin/lead/create", payload);
    },
    onSuccess: () => {
      success("Lead created");
      onOpenChange(false);
      onCreated();
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err)
        ? String(err.response?.data?.message || err.message)
        : "Create failed";
      error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.replace(/\D/g, "");

    if (name.length < 3) {
      error("Name must be at least 3 characters");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      error("Phone must be exactly 10 digits");
      return;
    }
    if (!form.source) {
      error("Source is required");
      return;
    }

    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <p className="text-sm text-gray-500">Manual entry</p>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lead-name">Full name *</Label>
              <Input
                id="lead-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                minLength={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-phone">Phone *</Label>
              <Input
                id="lead-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                required
                maxLength={10}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Source *</Label>
              <Select
                value={form.source}
                onValueChange={(v) => setForm((f) => ({ ...f, source: v as LeadSource }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-address">Address</Label>
              <Input
                id="lead-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Property type</Label>
              <Select
                value={form.propertyType}
                onValueChange={(v) => setForm((f) => ({ ...f, propertyType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-roof">Roof area (sq ft)</Label>
              <Input
                id="lead-roof"
                type="number"
                min={100}
                value={form.roofArea}
                onChange={(e) => setForm((f) => ({ ...f, roofArea: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-date">Preferred date</Label>
              <Input
                id="lead-date"
                type="date"
                value={form.preferredDate}
                onChange={(e) => setForm((f) => ({ ...f, preferredDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Time slot</Label>
              <Select
                value={form.timeSlot || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, timeSlot: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select slot" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign agent</Label>
              <Select
                value={form.assignedAgent}
                onValueChange={(v) => setForm((f) => ({ ...f, assignedAgent: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a._id} value={a._id}>
                      {a.name}
                      {a.role ? ` · ${a.role}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-note">Initial note</Label>
            <Textarea
              id="lead-note"
              rows={3}
              value={form.initialNote}
              onChange={(e) => setForm((f) => ({ ...f, initialNote: e.target.value }))}
              placeholder="Optional context for the team…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
