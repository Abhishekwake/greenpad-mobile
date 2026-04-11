"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1, "Required"),
  description: z.string().min(1, "Required"),
  coinsRequired: z.number().min(50, "Min 50"),
  icon: z.string().min(1, "Icon required"),
  stock: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Reward = {
  _id: string;
  title: string;
  description: string;
  coinsRequired: number;
  icon: string;
  stock: number | null;
  isActive?: boolean;
};

export default function RewardsPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["admin-rewards"],
    queryFn: async () => {
      const res = await api.get<{ data: Reward[] }>("/admin/rewards");
      return res.data.data;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      coinsRequired: 50,
      icon: "🎁",
      stock: "",
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      title: "",
      description: "",
      coinsRequired: 50,
      icon: "🎁",
      stock: "",
    });
    setOpen(true);
  };

  const openEdit = (r: Reward) => {
    setEditing(r);
    form.reset({
      title: r.title,
      description: r.description,
      coinsRequired: r.coinsRequired,
      icon: r.icon || "🎁",
      stock: r.stock == null ? "" : String(r.stock),
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = {
        title: values.title,
        description: values.description,
        coinsRequired: values.coinsRequired,
        icon: values.icon,
        stock: values.stock === "" || values.stock === undefined ? null : Number(values.stock),
      };
      if (editing) {
        await api.put(`/admin/reward/${editing._id}`, body);
      } else {
        await api.post("/admin/reward", body);
      }
    },
    onSuccess: () => {
      success(editing ? "Reward updated" : "Reward created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-rewards"] });
    },
    onError: () => error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/reward/${id}`);
    },
    onSuccess: () => {
      success("Reward deleted");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["admin-rewards"] });
    },
    onError: () => error("Delete failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Rewards Store</h2>
        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Reward
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(rewards || []).map((r) => (
            <Card key={r._id} className={cn(!r.isActive && "opacity-60")}>
              <CardContent className="p-6">
                <div className="mb-3 text-4xl">{r.icon}</div>
                <h3 className="font-bold text-gray-900">{r.title}</h3>
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">{r.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    {r.coinsRequired} coins
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {r.stock == null ? "Unlimited" : `Stock: ${r.stock}`}
                  </span>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" size="icon" type="button" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    type="button"
                    onClick={() => setDeleteId(r._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit reward" : "Add reward"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
          >
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...form.register("title")} />
              {form.formState.errors.title && (
                <p className="text-xs text-red-600">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...form.register("description")} />
              {form.formState.errors.description && (
                <p className="text-xs text-red-600">{form.formState.errors.description.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coins">Coins required</Label>
                <Input
                  id="coins"
                  type="number"
                  min={50}
                  {...form.register("coinsRequired", { valueAsNumber: true })}
                />
                {form.formState.errors.coinsRequired && (
                  <p className="text-xs text-red-600">{form.formState.errors.coinsRequired.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon">Icon (emoji)</Label>
                <Input id="icon" {...form.register("icon")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">Stock (empty = unlimited)</Label>
              <Input id="stock" type="number" placeholder="Unlimited" {...form.register("stock")} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete reward?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">This cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
