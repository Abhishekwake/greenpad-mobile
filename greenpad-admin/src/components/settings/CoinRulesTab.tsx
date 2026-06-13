"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Coins, Info } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

type AppSettingsForm = {
  coinsWelcomeBonus: number;
  coinsReferralSignupReferee: number;
  coinsReferralSignupReferrer: number;
  coinsSelfBook: number;
  coinsReferralBook: number;
  coinsLeadVisited: number;
  coinsLeadVisitMilestoneOnConvert: number;
  coinsLeadConverted: number;
  bookingClawbackHours: number;
  supportWhatsApp: string;
  supportPhone: string;
  companyLegalName?: string;
  companyAddress?: string;
  companyGst?: string;
  companyEmail?: string;
  companyWebsite?: string;
  brandDisplayName?: string;
  brandPrimaryColor?: string;
  brandLogoUrl?: string;
  notifyLeadStatusPush?: boolean;
  notifyProjectStagePush?: boolean;
  notifyCoinRedemptionPush?: boolean;
  customerDocumentsEnabled?: boolean;
  internalDocumentsEnabled?: boolean;
  reelsEnabled?: boolean;
};

type NumberFieldDef = {
  kind: "number";
  key: keyof AppSettingsForm;
  label: string;
  hint: string;
  min?: number;
  max?: number;
};

type TextFieldDef = {
  kind: "text";
  key: "supportWhatsApp" | "supportPhone";
  label: string;
  hint: string;
};

type FieldDef = NumberFieldDef | TextFieldDef;

const SECTIONS: { title: string; description: string; fields: FieldDef[] }[] = [
  {
    title: "Signup & referral install",
    description: "Coins when someone creates an account or applies a referral code at signup.",
    fields: [
      {
        kind: "number",
        key: "coinsWelcomeBonus",
        label: "Welcome bonus (new signup)",
        hint: "Awarded once when a new user verifies OTP and creates an account.",
      },
      {
        kind: "number",
        key: "coinsReferralSignupReferee",
        label: "Referral code — new user (referee)",
        hint: "Coins for the person who enters a valid referral code.",
      },
      {
        kind: "number",
        key: "coinsReferralSignupReferrer",
        label: "Referral code — referrer",
        hint: "Coins for the user whose referral code was used.",
      },
    ],
  },
  {
    title: "Site visit bookings",
    description: "Coins earned when a user books a site visit in the mobile app.",
    fields: [
      {
        kind: "number",
        key: "coinsReferralBook",
        label: "Referral — booking reward",
        hint: "When a user books a visit for someone they referred.",
      },
      {
        kind: "number",
        key: "coinsSelfBook",
        label: "Self — booking reward",
        hint: "When a user books a visit for their own property.",
      },
    ],
  },
  {
    title: "Sales pipeline milestones",
    description: "Coins for the referring user when admin advances lead status.",
    fields: [
      {
        kind: "number",
        key: "coinsLeadVisited",
        label: "Site visited",
        hint: "When admin marks the lead as Visited.",
      },
      {
        kind: "number",
        key: "coinsLeadVisitMilestoneOnConvert",
        label: "Visit milestone on convert",
        hint: "If admin marks Converted without a separate Visited step (one-time).",
      },
      {
        kind: "number",
        key: "coinsLeadConverted",
        label: "Installation / converted",
        hint: "When admin marks the lead as Converted.",
      },
    ],
  },
  {
    title: "Policy",
    description: "Non-coin rules that affect the coin economy.",
    fields: [
      {
        kind: "number",
        key: "bookingClawbackHours",
        label: "Booking cancel clawback window (hours)",
        hint: "Reverse booking coins if user cancels within this many hours, or while lead is still pending.",
        min: 1,
        max: 168,
      },
    ],
  },
  {
    title: "Support contact (mobile app)",
    description: "Contact Us on the home screen opens WhatsApp or phone dialer to these numbers.",
    fields: [
      {
        kind: "text",
        key: "supportWhatsApp",
        label: "WhatsApp number (10 digits)",
        hint: "Indian mobile number without +91 — used for wa.me links.",
      },
      {
        kind: "text",
        key: "supportPhone",
        label: "Call number (10 digits)",
        hint: "Shown for direct phone calls from the app.",
      },
    ],
  },
];

export function CoinRulesTab() {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState<AppSettingsForm | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-coin-settings"],
    queryFn: async () => {
      const res = await api.get<{ data: AppSettingsForm }>("/admin/coin-settings");
      return res.data.data;
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (body: AppSettingsForm) => {
      const res = await api.put<{ data: AppSettingsForm }>("/admin/coin-settings", body);
      return res.data.data;
    },
    onSuccess: (d) => {
      success("Coin rules saved");
      setForm(d);
      void qc.invalidateQueries({ queryKey: ["admin-coin-settings"] });
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err)
        ? String(err.response?.data?.message || err.message)
        : "Save failed";
      toastError(msg);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    saveMutation.mutate(form);
  };

  if (isError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-center justify-between py-4">
          <p className="text-sm text-red-800">Could not load coin settings.</p>
          <Button variant="outline" size="sm" type="button" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !form) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-600" />
              <CardTitle>{section.title}</CardTitle>
            </div>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {section.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key} className="text-sm font-medium text-gray-800">
                  {field.label}
                </Label>
                {field.kind === "text" ? (
                  <Input
                    id={field.key}
                    type="tel"
                    maxLength={10}
                    className="max-w-xs"
                    value={form[field.key]}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setForm((prev) => (prev ? { ...prev, [field.key]: digits } : prev));
                    }}
                  />
                ) : (
                  <Input
                    id={field.key}
                    type="number"
                    min={field.min ?? 0}
                    max={field.max ?? 500000}
                    className="max-w-xs"
                    value={form[field.key] as number}
                    onChange={(e) => {
                      const v = e.target.value === "" ? 0 : Number(e.target.value);
                      setForm((prev) =>
                        prev ? { ...prev, [field.key]: Number.isNaN(v) ? 0 : v } : prev
                      );
                    }}
                  />
                )}
                <p className="flex gap-2 text-xs text-gray-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  {field.hint}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {(["companyLegalName", "companyEmail", "companyWebsite", "companyGst"] as const).map((key) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{key.replace("company", "").replace(/([A-Z])/g, " $1")}</Label>
              <Input
                id={key}
                value={String(form[key] ?? "")}
                onChange={(e) => setForm((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))}
              />
            </div>
          ))}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="companyAddress">Address</Label>
            <Input
              id="companyAddress"
              value={form.companyAddress ?? ""}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, companyAddress: e.target.value } : prev))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input
              value={form.brandDisplayName ?? ""}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, brandDisplayName: e.target.value } : prev))}
            />
          </div>
          <div className="space-y-2">
            <Label>Primary color</Label>
            <Input
              value={form.brandPrimaryColor ?? ""}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, brandPrimaryColor: e.target.value } : prev))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Logo URL</Label>
            <Input
              value={form.brandLogoUrl ?? ""}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, brandLogoUrl: e.target.value } : prev))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications & features</CardTitle>
          <CardDescription>Push toggles and optional modules (documents off by default).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ["notifyLeadStatusPush", "Lead status push"],
              ["notifyProjectStagePush", "Project stage push"],
              ["notifyCoinRedemptionPush", "Coin / redemption push"],
              ["customerDocumentsEnabled", "Customer document uploads"],
              ["internalDocumentsEnabled", "Internal document uploads (admin)"],
              ["reelsEnabled", "Home screen reels"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-gray-700">{label}</span>
              <input
                type="checkbox"
                checked={Boolean(form[key])}
                onChange={(e) =>
                  setForm((prev) => (prev ? { ...prev, [key]: e.target.checked } : prev))
                }
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <Button type="submit" disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
        {saveMutation.isPending ? "Saving…" : "Save all changes"}
      </Button>
    </form>
  );
}
