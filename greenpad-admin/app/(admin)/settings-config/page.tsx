"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import api from "@/lib/api";
import { isSuperAdmin } from "@/lib/adminRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { CoinRulesTab } from "@/components/settings/CoinRulesTab";
import { cn } from "@/lib/utils";

const BRAND_COLORS = [
  "#1D9E75",
  "#185FA5",
  "#BA7517",
  "#9333EA",
  "#DC2626",
  "#0891B2",
  "#65A30D",
  "#374151",
];

type CompanySettings = {
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  logoUrl: string;
  primaryColor: string;
  smsNotifications: boolean;
  emailNotifications: boolean;
  notifyOnLeadCreated: boolean;
  notifyOnLeadConverted: boolean;
  notifyOnProjectStageUpdate: boolean;
  notifyOnRedemptionRequested: boolean;
};

function isValidImageUrl(url: string) {
  if (!url.trim()) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function SettingsConfigPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    tabParam === "coins" || tabParam === "notifications" ? tabParam : "company"
  );
  const [companyForm, setCompanyForm] = useState<CompanySettings | null>(null);
  const [notifyForm, setNotifyForm] = useState<CompanySettings | null>(null);

  useEffect(() => {
    if (!isSuperAdmin()) {
      router.replace("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    if (tabParam === "coins" || tabParam === "notifications" || tabParam === "company") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-company-settings"],
    queryFn: async () => {
      const res = await api.get<{ data: CompanySettings }>("/admin/company-settings");
      return res.data.data;
    },
    enabled: isSuperAdmin(),
  });

  useEffect(() => {
    if (data) {
      setCompanyForm(data);
      setNotifyForm(data);
    }
  }, [data]);

  const saveCompanyMutation = useMutation({
    mutationFn: async (body: Partial<CompanySettings>) => {
      const res = await api.put<{ data: CompanySettings }>("/admin/company-settings", body);
      return res.data.data;
    },
    onSuccess: (d) => {
      success("Saved");
      setCompanyForm(d);
      setNotifyForm(d);
      void qc.invalidateQueries({ queryKey: ["admin-company-settings"] });
    },
    onError: (err) => {
      toastError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.message || err.message)
          : "Save failed"
      );
    },
  });

  const saveNotifyMutation = useMutation({
    mutationFn: async (body: Partial<CompanySettings>) => {
      const res = await api.put<{ data: CompanySettings }>("/admin/company-settings", body);
      return res.data.data;
    },
    onSuccess: (d) => {
      success("Saved");
      setNotifyForm(d);
      setCompanyForm(d);
      void qc.invalidateQueries({ queryKey: ["admin-company-settings"] });
    },
    onError: (err) => {
      toastError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.message || err.message)
          : "Save failed"
      );
    },
  });

  if (!isSuperAdmin()) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        <p className="mt-1 text-sm text-gray-600">
          Company profile, coin rules, and notification preferences.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="company">Company profile</TabsTrigger>
          <TabsTrigger value="coins">Coin rules</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          {isLoading || !companyForm ? (
            <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
          ) : (
            <div className="rounded-xl border bg-white p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company name</Label>
                  <Input
                    id="companyName"
                    value={companyForm.companyName}
                    onChange={(e) =>
                      setCompanyForm((p) => (p ? { ...p, companyName: e.target.value } : p))
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Contact email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={companyForm.contactEmail}
                      onChange={(e) =>
                        setCompanyForm((p) => (p ? { ...p, contactEmail: e.target.value } : p))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Contact phone</Label>
                    <Input
                      id="contactPhone"
                      value={companyForm.contactPhone}
                      onChange={(e) =>
                        setCompanyForm((p) => (p ? { ...p, contactPhone: e.target.value } : p))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    rows={2}
                    value={companyForm.address}
                    onChange={(e) =>
                      setCompanyForm((p) => (p ? { ...p, address: e.target.value } : p))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    value={companyForm.logoUrl}
                    onChange={(e) =>
                      setCompanyForm((p) => (p ? { ...p, logoUrl: e.target.value } : p))
                    }
                  />
                  {isValidImageUrl(companyForm.logoUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={companyForm.logoUrl}
                      alt="Logo preview"
                      className="mt-2 h-12 w-auto rounded border object-contain"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Primary color</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {BRAND_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCompanyForm((p) => (p ? { ...p, primaryColor: c } : p))}
                        className={cn(
                          "h-5 w-5 rounded-full",
                          companyForm.primaryColor === c && "ring-2 ring-offset-1 ring-gray-400"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <Input
                      value={companyForm.primaryColor}
                      onChange={(e) =>
                        setCompanyForm((p) => (p ? { ...p, primaryColor: e.target.value } : p))
                      }
                      className="h-8 w-28 text-xs"
                    />
                  </div>
                </div>
              </div>
              <Button
                type="button"
                className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={saveCompanyMutation.isPending}
                onClick={() => companyForm && saveCompanyMutation.mutate(companyForm)}
              >
                {saveCompanyMutation.isPending ? "Saving…" : "Save company info"}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="coins">
          <CoinRulesTab />
        </TabsContent>

        <TabsContent value="notifications">
          {isLoading || !notifyForm ? (
            <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
          ) : (
            <>
              <div className="rounded-xl border bg-white p-6">
                <div className="flex items-center justify-between border-b py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">SMS notifications</p>
                    <p className="text-xs text-gray-500">Requires MSG91 API key</p>
                  </div>
                  <Toggle
                    checked={notifyForm.smsNotifications}
                    onChange={(v) => setNotifyForm((p) => (p ? { ...p, smsNotifications: v } : p))}
                  />
                </div>
                <div className="flex items-center justify-between border-b py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email notifications</p>
                    <p className="text-xs text-gray-500">Requires SMTP configuration</p>
                  </div>
                  <Toggle
                    checked={notifyForm.emailNotifications}
                    onChange={(v) => setNotifyForm((p) => (p ? { ...p, emailNotifications: v } : p))}
                  />
                </div>

                <p className="pt-4 text-sm font-medium text-gray-900">Notify when…</p>

                {(
                  [
                    ["notifyOnLeadCreated", "New lead created"],
                    ["notifyOnLeadConverted", "Lead converted"],
                    ["notifyOnProjectStageUpdate", "Project stage updated"],
                    ["notifyOnRedemptionRequested", "Redemption requested"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between border-b py-3 last:border-0">
                    <span className="text-sm text-gray-700">{label}</span>
                    <Toggle
                      checked={notifyForm[key]}
                      onChange={(v) => setNotifyForm((p) => (p ? { ...p, [key]: v } : p))}
                    />
                  </div>
                ))}

                <Button
                  type="button"
                  className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={saveNotifyMutation.isPending}
                  onClick={() => notifyForm && saveNotifyMutation.mutate(notifyForm)}
                >
                  {saveNotifyMutation.isPending ? "Saving…" : "Save notification settings"}
                </Button>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                ⚠ Notification delivery requires SMS or email service integration. Toggle settings
                are saved and will activate once services are connected.
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
