"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Eye } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type UserRow = {
  _id: string;
  name: string;
  phone: string;
  coins: number;
  totalReferrals?: number;
  createdAt: string;
  email?: string;
  referralCode?: string;
};

type Tx = {
  _id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
};

type LeadRow = {
  _id: string;
  name: string;
  status: string;
  createdAt: string;
  preferredDate?: string;
};

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-users", applied, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (applied.trim()) params.set("search", applied.trim());
      const res = await api.get<{
        data: { users: UserRow[]; pagination: { page: number; pages: number; total: number } };
      }>(`/admin/users?${params}`);
      return res.data.data;
    },
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-user", detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const res = await api.get<{
        data: {
          user: UserRow;
          transactions: Tx[];
          leads: LeadRow[];
          totalReferrals: number;
        };
      }>(`/admin/user/${detailId}`);
      return res.data.data;
    },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">User Management</h2>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <label className="text-xs font-medium text-gray-500">Search by phone</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Phone digits…"
            />
          </div>
          <Button
            type="button"
            onClick={() => {
              setPage(1);
              setApplied(search);
            }}
          >
            Search
          </Button>
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-red-800">Failed to load users.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-64 animate-pulse bg-gray-100" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Coins</TableHead>
                  <TableHead>Referrals</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.users?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-gray-500">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  data.users.map((u) => (
                    <TableRow
                      key={u._id}
                      className="cursor-pointer"
                      onClick={() => setDetailId(u._id)}
                    >
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.phone}</TableCell>
                      <TableCell>{u.coins}</TableCell>
                      <TableCell>{u.totalReferrals ?? 0}</TableCell>
                      <TableCell className="text-gray-600">
                        {format(new Date(u.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailId(u._id);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {data.pagination.page} of {data.pagination.pages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              type="button"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.pages}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User details</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-lg bg-gray-50 p-4 text-sm">
                <p>
                  <span className="font-medium text-gray-500">Name:</span> {detail.user.name}
                </p>
                <p>
                  <span className="font-medium text-gray-500">Phone:</span> {detail.user.phone}
                </p>
                <p>
                  <span className="font-medium text-gray-500">Email:</span> {detail.user.email || "—"}
                </p>
                <p>
                  <span className="font-medium text-gray-500">Referral code:</span>{" "}
                  {detail.user.referralCode || "—"}
                </p>
                <p>
                  <span className="font-medium text-gray-500">Coins:</span> {detail.user.coins}
                </p>
                <p>
                  <span className="font-medium text-gray-500">Total referrals:</span>{" "}
                  {detail.totalReferrals}
                </p>
              </div>
              <Tabs defaultValue="tx">
                <TabsList>
                  <TabsTrigger value="tx">Transactions</TabsTrigger>
                  <TabsTrigger value="leads">Leads</TabsTrigger>
                </TabsList>
                <TabsContent value="tx">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-500">
                            No transactions
                          </TableCell>
                        </TableRow>
                      ) : (
                        detail.transactions.map((t) => (
                          <TableRow key={t._id}>
                            <TableCell className="capitalize">{t.type}</TableCell>
                            <TableCell>{t.amount}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{t.description}</TableCell>
                            <TableCell className="whitespace-nowrap text-gray-600">
                              {format(new Date(t.createdAt), "MMM d, HH:mm")}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="leads">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.leads.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-gray-500">
                            No leads
                          </TableCell>
                        </TableRow>
                      ) : (
                        detail.leads.map((l) => (
                          <TableRow key={l._id}>
                            <TableCell>{l.name}</TableCell>
                            <TableCell className="capitalize">{l.status}</TableCell>
                            <TableCell className="text-gray-600">
                              {format(new Date(l.createdAt), "MMM d, yyyy")}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
