"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";

type ToastItem = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, variant: ToastVariant = "default") => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (m) => toast(m, "success"),
      error: (m) => toast(m, "error"),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg",
              t.variant === "error" && "border-red-200 bg-red-50 text-red-900",
              t.variant === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
              t.variant === "default" && "border-gray-200 bg-white text-gray-900"
            )}
          >
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button type="button" onClick={() => remove(t.id)} className="rounded p-0.5 hover:bg-black/5">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
