"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { isSuperAdmin } from "@/lib/adminRole";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type AdminAccount = {
  _id: string;
  email: string;
  name: string;
  adminRole: "super_admin" | "ops";
  isActive: boolean;
  lastLoginAt?: string;
};

export default function AdminAccountsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [adminRole, setAdminRole] = useState<"super_admin" | "ops">("ops");

  useEffect(() => {
    if (!isSuperAdmin()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: async () => {
      const res = await api.get<{ data: AdminAccount[] }>("/admin/accounts");
      return res.data.data;
    },
    enabled: isSuperAdmin(),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/admin/accounts", { email, password, name, adminRole });
    },
    onSuccess: () => {
      success("Admin account created");
      setOpen(false);
      setEmail("");
      setPassword("");
      setName("");
      void qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    },
    onError: () => error("Create failed"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/admin/accounts/${id}`, { isActive });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    },
    onError: () => error("Update failed"),
  });

  if (!isSuperAdmin()) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Admin accounts</h2>
          <p className="text-sm text-gray-600">Manage who can access this dashboard.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          Add admin
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-40 animate-pulse bg-gray-100" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data || []).map((a) => (
                  <TableRow key={a._id}>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{a.email}</TableCell>
                    <TableCell className="capitalize">{a.adminRole.replace("_", " ")}</TableCell>
                    <TableCell>{a.isActive ? "Active" : "Deactivated"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() =>
                          toggleMutation.mutate({ id: a._id, isActive: !a.isActive })
                        }
                      >
                        {a.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New admin account</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={adminRole} onValueChange={(v) => setAdminRole(v as "super_admin" | "ops")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ops">Ops (leads, workflow, redemptions)</SelectItem>
                  <SelectItem value="super_admin">Super admin (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              Create
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
