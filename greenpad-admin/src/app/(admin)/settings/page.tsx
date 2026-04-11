"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Coins, Info } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

type CoinSettings = {
  coinsSelfBook: number;
  coinsReferralBook: number;
  coinsLeadVisited: number;
  coinsLeadVisitMilestoneOnConvert: number;
  coinsLeadConverted: number;
};

const FIELDS: {
  key: keyof CoinSettings;
  label: string;
  hint: string;
}[] = [
  {
    key: "coinsReferralBook",
    label: "Referral — booking reward",
    hint: "Coins when a user books a site visit for someone they referred (mobile app).",
  },
  {
    key: "coinsSelfBook",
    label: "Self — booking reward",
    hint: "Coins when a user books a visit for their own property.",
  },
  {
    key: "coinsLeadVisited",
    label: "Pipeline — site visited",
    hint: "Awarded to the referring user when admin marks the lead as Visited.",
  },
  {
    key: "coinsLeadVisitMilestoneOnConvert",
    label: "Pipeline — visit milestone on convert",
    hint: "Extra coins if admin marks Converted without a separate Visited step (one-time milestone).",
  },
  {
    key: "coinsLeadConverted",
    label: "Pipeline — installation / converted",
    hint: "Awarded when admin marks the lead as Converted.",
  },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState<CoinSettings | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-coin-settings"],
    queryFn: async () => {
      const res = await api.get<{ data: CoinSettings }>("/admin/coin-settings");
      return res.data.data;
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (body: CoinSettings) => {
      const res = await api.put<{ data: CoinSettings }>("/admin/coin-settings", body);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Coin rules</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Control how many GreenCoins users earn for bookings and how much referrers receive when you move leads
          through the pipeline. Changes apply to new bookings and future status updates only (past transactions are
          unchanged).
        </p>
      </div>

      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-red-800">Could not load settings.</p>
            <Button variant="outline" size="sm" type="button" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-600" />
            <CardTitle>Economy</CardTitle>
          </div>
          <CardDescription>All amounts are whole GreenCoins (0–500,000).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !form ? (
            <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
          ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              {FIELDS.map(({ key, label, hint }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key} className="text-sm font-medium text-gray-800">
                    {label}
                  </Label>
                  <Input
                    id={key}
                    type="number"
                    min={0}
                    max={500000}
                    className="max-w-xs"
                    value={form[key]}
                    onChange={(e) => {
                      const v = e.target.value === "" ? 0 : Number(e.target.value);
                      setForm((prev) => (prev ? { ...prev, [key]: Number.isNaN(v) ? 0 : v } : prev));
                    }}
                  />
                  <p className="flex gap-2 text-xs text-gray-500">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    {hint}
                  </p>
                </div>
              ))}
              <Button type="submit" disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                {saveMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
