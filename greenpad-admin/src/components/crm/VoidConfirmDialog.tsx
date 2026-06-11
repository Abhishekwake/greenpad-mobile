"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void | Promise<void>;
  isPending?: boolean;
};

export function VoidConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Void record",
  onOpenChange,
  onConfirm,
  isPending = false,
}: Props) {
  const [reason, setReason] = useState("");

  if (!open) return null;

  const handleClose = () => {
    if (isPending) return;
    setReason("");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 5) return;
    await onConfirm(trimmed);
    setReason("");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-xl border border-amber-200 bg-white p-5 shadow-xl"
      >
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor="void-reason" className="text-xs text-gray-600">
            Reason for voiding <span className="text-red-600">*</span>
          </Label>
          <Textarea
            id="void-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Duplicate entry, customer cancelled, wrong phone number…"
            className="resize-y"
            disabled={isPending}
          />
          <p className="text-xs text-gray-500">
            Records are not permanently deleted. Voided items stay in the audit trail and can be viewed under
            &quot;Voided&quot; filters.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending || reason.trim().length < 5}
            onClick={() => void handleSubmit()}
          >
            {isPending ? "Voiding…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
