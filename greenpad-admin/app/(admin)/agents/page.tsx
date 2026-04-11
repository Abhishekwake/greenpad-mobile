"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Plus, UserCircle } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Agent = {
  _id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
};

const emptyForm = { name: "", role: "", phone: "", email: "" };

export default function AgentsPage() {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: agents = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-agents-list", showInactive],
    queryFn: async () => {
      const params = showInactive ? "?includeInactive=1" : "";
      const res = await api.get<{ data: Agent[] }>(`/admin/agents${params}`);
      return res.data.data;
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (a: Agent) => {
    setEditing(a);
    setForm({
      name: a.name,
      role: a.role || "",
      phone: a.phone || "",
      email: a.email || "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      if (editing) {
        await api.put(`/admin/agent/${editing._id}`, {
          name: form.name.trim(),
          role: form.role.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
        });
      } else {
        await api.post("/admin/agent", {
          name: form.name.trim(),
          role: form.role.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
        });
      }
    },
    onSuccess: () => {
      success(editing ? "Team member updated" : "Team member added");
      setDialogOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin-agents-list"] });
      void qc.invalidateQueries({ queryKey: ["admin-agents"] });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Request failed";
      if (axios.isAxiosError(err)) {
        toastError(String(err.response?.data?.message || err.message));
      } else {
        toastError(msg);
      }
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/admin/agent/${id}`, { isActive: false });
    },
    onSuccess: () => {
      success("Archived — they won’t appear in new lead assignments");
      void qc.invalidateQueries({ queryKey: ["admin-agents-list"] });
      void qc.invalidateQueries({ queryKey: ["admin-agents"] });
    },
    onError: () => toastError("Could not archive"),
  });

  const reactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/admin/agent/${id}`, { isActive: true });
    },
    onSuccess: () => {
      success("Restored");
      void qc.invalidateQueries({ queryKey: ["admin-agents-list"] });
      void qc.invalidateQueries({ queryKey: ["admin-agents"] });
    },
    onError: () => toastError("Could not restore"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Team</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Field agents and coordinators who can be assigned to leads. Assignments appear in the lead drawer and help
            ops know who owns the visit.
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-1 h-4 w-4" />
          Add member
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">Directory</CardTitle>
            <CardDescription>Active members are selectable when assigning a lead.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowInactive((v) => !v)}
          >
            {showInactive ? "Active only" : "Show archived"}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <div className="p-6 text-sm text-red-700">
              Failed to load team.{" "}
              <button type="button" className="font-medium underline" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          ) : isLoading ? (
            <div className="h-48 animate-pulse bg-gray-100" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-gray-500">
                      No team members yet. Add your first field agent above.
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map((a) => (
                    <TableRow key={a._id}>
                      <TableCell className="font-medium text-gray-900">
                        <span className="inline-flex items-center gap-2">
                          <UserCircle className="h-4 w-4 text-emerald-600" />
                          {a.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-600">{a.role || "—"}</TableCell>
                      <TableCell className="text-gray-600">{a.phone || "—"}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-gray-600">{a.email || "—"}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            a.isActive === false ? "bg-gray-200 text-gray-700" : "bg-emerald-100 text-emerald-800"
                          )}
                        >
                          {a.isActive === false ? "Archived" : "Active"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(a)}>
                            Edit
                          </Button>
                          {a.isActive === false ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={reactivateMutation.isPending}
                              onClick={() => reactivateMutation.mutate(a._id)}
                            >
                              Restore
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-red-700"
                              disabled={deactivateMutation.isPending}
                              onClick={() => {
                                if (window.confirm(`Archive ${a.name}? They will be removed from the assign list.`)) {
                                  deactivateMutation.mutate(a._id);
                                }
                              }}
                            >
                              Archive
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit team member" : "Add team member"}</DialogTitle>
            <p className="text-sm text-gray-500">
              Name is shown on lead assignment. Role and contact fields are optional but help the desk reach the right
              person.
            </p>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Full name *</Label>
              <Input
                id="agent-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Priya Sharma"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-role">Role / territory</Label>
              <Input
                id="agent-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Field — West, Coordinator…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-phone">Phone</Label>
              <Input
                id="agent-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-email">Email</Label>
              <Input
                id="agent-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@company.com"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saveMutation.isPending || !form.name.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving…" : editing ? "Save" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
