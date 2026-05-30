"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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

type UserOption = { _id: string; name: string; phone: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreateLeadDialog({ open, onOpenChange, onCreated }: Props) {
  const { success, error } = useToast();
  const [referrerSearch, setReferrerSearch] = useState("");
  const [referrerOptions, setReferrerOptions] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState("Residential");
  const [leadType, setLeadType] = useState<"self" | "referral">("self");
  const [notes, setNotes] = useState("");

  const searchReferrers = async () => {
    const q = referrerSearch.replace(/\D/g, "");
    if (q.length < 3) {
      setReferrerOptions([]);
      return;
    }
    try {
      const res = await api.get<{
        data: { users: UserOption[] };
      }>(`/admin/users?search=${encodeURIComponent(q)}&limit=8`);
      setReferrerOptions(res.data.data.users || []);
    } catch {
      setReferrerOptions([]);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/admin/lead", {
        userId,
        name,
        phone,
        address,
        propertyType,
        leadType,
        notes,
      });
    },
    onSuccess: () => {
      success("Lead created");
      onOpenChange(false);
      setName("");
      setPhone("");
      setAddress("");
      setNotes("");
      setUserId("");
      setReferrerSearch("");
      onCreated();
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err)
        ? String(err.response?.data?.message || err.message)
        : "Create failed";
      error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add lead (walk-in)</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!userId) {
              error("Select a referring app user");
              return;
            }
            createMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label>Referring app user (search phone)</Label>
            <div className="flex gap-2">
              <Input
                value={referrerSearch}
                onChange={(e) => setReferrerSearch(e.target.value)}
                placeholder="10-digit phone…"
              />
              <Button type="button" variant="outline" onClick={searchReferrers}>
                Search
              </Button>
            </div>
            {referrerOptions.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-md border border-gray-200">
                {referrerOptions.map((u) => (
                  <button
                    key={u._id}
                    type="button"
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      userId === u._id ? "bg-emerald-50 font-medium" : ""
                    }`}
                    onClick={() => {
                      setUserId(u._id);
                      setReferrerSearch(`${u.name} (${u.phone})`);
                      setReferrerOptions([]);
                    }}
                  >
                    {u.name} — {u.phone}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Customer phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={10} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} required rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Property type</Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Residential", "Commercial", "Industrial", "Agricultural"].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Lead type</Label>
              <Select value={leadType} onValueChange={(v) => setLeadType(v as "self" | "referral")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Self visit</SelectItem>
                  <SelectItem value="referral">Referral visit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <p className="text-xs text-gray-500">
            Walk-in leads do not auto-award booking coins. Duplicate active phones within 30 days are blocked.
          </p>
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
