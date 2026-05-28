"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Archive, Check, Info, Pencil, Plus, Users, X } from "lucide-react";
import { createRole, deleteRole, getRoles, updateRole } from "@/lib/projectApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Role = {
  _id: string;
  name: string;
  isActive?: boolean;
};

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
];

function getErrorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    return String(err.response?.data?.message || err.message || fallback);
  }
  return fallback;
}

export default function RolesPage() {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  const { data: roles = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const res = await getRoles();
      return res.data.data as Role[];
    },
  });

  const invalidateRoles = () => qc.invalidateQueries({ queryKey: ["admin-roles"] });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      await createRole({ name: name.trim() });
    },
    onSuccess: async () => {
      success("Role added");
      setShowAddForm(false);
      setNewRoleName("");
      await invalidateRoles();
    },
    onError: (err: unknown) => toastError(getErrorMessage(err, "Failed to add role")),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await updateRole(id, { name: name.trim() });
    },
    onSuccess: async () => {
      success("Role updated");
      setEditingId(null);
      setEditingName("");
      await invalidateRoles();
    },
    onError: (err: unknown) => toastError(getErrorMessage(err, "Failed to update role")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteRole(id);
    },
    onSuccess: async () => {
      success("Role archived");
      await invalidateRoles();
    },
    onError: (err: unknown) => toastError(getErrorMessage(err, "Failed to archive role")),
  });

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      toastError("Role name is required");
      return;
    }
    createMutation.mutate(newRoleName);
  };

  const startEditing = (role: Role) => {
    setEditingId(role._id);
    setEditingName(role.name);
  };

  const saveEdit = (id: string) => {
    if (!editingName.trim()) {
      toastError("Role name is required");
      return;
    }
    updateMutation.mutate({ id, name: editingName });
  };

  const archiveRole = (role: Role) => {
    if (!window.confirm("Archive this role?")) return;
    deleteMutation.mutate(role._id);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & team</h1>
          <p className="text-sm text-gray-500">Assign roles to workflow tasks</p>
        </div>
        <Button variant="outline" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" />
          Add role
        </Button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddRole}
          className="mb-4 rounded-xl border bg-white p-4"
        >
          <Input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="Role name e.g. Documentation Executive"
            autoFocus
            disabled={createMutation.isPending}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setNewRoleName("");
              }}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding…" : "Add role"}
            </Button>
          </div>
        </form>
      )}

      <div className="mb-6 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>These roles appear in the Workflow Builder when assigning tasks to team members.</p>
      </div>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Failed to load roles.{" "}
          <button type="button" className="font-medium underline" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : roles.length === 0 ? (
        <div className="rounded-xl border bg-white py-16 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-900">No roles yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Add your first role to start assigning workflow tasks
          </p>
          <Button className="mt-6" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4" />
            Add first role
          </Button>
        </div>
      ) : (
        <div>
          {roles.map((role, index) => {
            const colorClass = AVATAR_COLORS[index % AVATAR_COLORS.length];
            const initial = (role.name?.trim()?.[0] || "?").toUpperCase();
            const isEditing = editingId === role._id;

            return (
              <div
                key={role._id}
                className="mb-3 flex items-center gap-3 rounded-xl border bg-white p-4"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    colorClass
                  )}
                >
                  {initial}
                </div>

                {isEditing ? (
                  <>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                      disabled={updateMutation.isPending}
                      className="flex-1 border-blue-300 py-1.5 text-sm focus-visible:ring-blue-400"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(role._id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => saveEdit(role._id)}
                      disabled={updateMutation.isPending}
                      className="text-green-600 hover:text-green-700 disabled:opacity-50"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      disabled={updateMutation.isPending}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-gray-900">{role.name}</span>
                    <button
                      type="button"
                      onClick={() => startEditing(role)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => archiveRole(role)}
                      disabled={deleteMutation.isPending}
                      className="text-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
