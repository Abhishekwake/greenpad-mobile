"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Folder,
  MapPin,
  Phone,
  Zap,
} from "lucide-react";
import { getProject, getProjects, updateProjectStage } from "@/lib/projectApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type StageStatus = "pending" | "active" | "done" | "delayed";

type ProjectStage = {
  stageId: string;
  name: string;
  order: number;
  visibleToCustomer: boolean;
  status: StageStatus;
  delayReason?: string;
  delayExpectedDate?: string;
  tasks: {
    taskId: string;
    name: string;
    assignedRole: string;
    docRequired: boolean;
    completed: boolean;
  }[];
};

type Project = {
  _id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  status: string;
  currentStageId: string;
  stages: ProjectStage[];
  createdAt: string;
};

type ProjectListItem = {
  _id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  status: string;
  currentStageId: string;
  stageSummary: {
    done: number;
    total: number;
    delayedCount: number;
    delays: Array<{ stageId: string; delayReason?: string; delayExpectedDate?: string }>;
  };
  createdAt: string;
};

type StageUpdateModal = {
  open: boolean;
  project: Project;
  stage: ProjectStage;
} | null;

function StatSkeleton() {
  return <div className="h-28 animate-pulse rounded-xl bg-gray-200" />;
}

function getListDisplayStatus(item: ProjectListItem): "completed" | "delayed" | "active" {
  if (item.status === "completed") return "completed";
  if (item.stageSummary.delayedCount > 0) return "delayed";
  return "active";
}

function ListStatusBadge({ item }: { item: ProjectListItem }) {
  const display = getListDisplayStatus(item);
  if (display === "completed") {
    return (
      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        Completed
      </span>
    );
  }
  if (display === "delayed") {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        ⚠ Delayed
      </span>
    );
  }
  return (
    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Active</span>
  );
}

function StageStatusBadge({ status }: { status: StageStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        status === "done" && "bg-green-50 text-green-700",
        status === "active" && "bg-blue-50 text-blue-700",
        status === "delayed" && "bg-amber-50 text-amber-700",
        status === "pending" && "bg-gray-50 text-gray-500"
      )}
    >
      {status}
    </span>
  );
}

function OverallStatusBadge({ project }: { project: Project }) {
  const hasDelayed = project.stages.some((s) => s.status === "delayed");
  if (project.status === "completed") {
    return (
      <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        Completed
      </span>
    );
  }
  if (hasDelayed) {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        ⚠ Delayed
      </span>
    );
  }
  return (
    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">Active</span>
  );
}

export default function ProjectsPage() {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [stageUpdateModal, setStageUpdateModal] = useState<StageUpdateModal>(null);
  const [delayReason, setDelayReason] = useState("");
  const [delayExpectedDate, setDelayExpectedDate] = useState("");

  const { data: projects = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await getProjects();
      return res.data.data as ProjectListItem[];
    },
    staleTime: 30_000,
  });

  const {
    data: projectDetail,
    isLoading: detailLoading,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ["project", selectedProject?._id],
    queryFn: async () => {
      const res = await getProject(selectedProject!._id);
      return res.data.data as Project;
    },
    enabled: !!selectedProject?._id,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (projectDetail) {
      setSelectedProject(projectDetail);
    }
  }, [projectDetail]);

  useEffect(() => {
    if (stageUpdateModal?.open) {
      setDelayReason(stageUpdateModal.stage.delayReason || "");
      setDelayExpectedDate(stageUpdateModal.stage.delayExpectedDate || "");
    }
  }, [stageUpdateModal]);

  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === "active").length;
    const completed = projects.filter((p) => p.status === "completed").length;
    const delayed = projects.filter((p) => p.stageSummary.delayedCount > 0).length;
    return { total, active, completed, delayed };
  }, [projects]);

  const stageMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        stageId: string;
        status: string;
        delayReason?: string;
        delayExpectedDate?: string;
      };
    }) => {
      await updateProjectStage(id, data);
    },
    onSuccess: async () => {
      success("Stage updated");
      setStageUpdateModal(null);
      await qc.invalidateQueries({ queryKey: ["projects"] });
      if (selectedProject?._id) {
        await qc.invalidateQueries({ queryKey: ["project", selectedProject._id] });
        await refetchDetail();
      }
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? String(err.response?.data?.message || err.message)
        : "Failed to update stage";
      toastError(msg);
    },
  });

  const handleStageAction = (project: Project, stage: ProjectStage, value: string) => {
    if (!value) return;
    if (value === "delayed") {
      setStageUpdateModal({ open: true, project, stage });
      return;
    }
    stageMutation.mutate({
      id: project._id,
      data: { stageId: stage.stageId, status: value },
    });
  };

  const confirmDelayed = () => {
    if (!stageUpdateModal) return;
    if (!delayReason.trim()) {
      toastError("Delay reason is required");
      return;
    }
    stageMutation.mutate({
      id: stageUpdateModal.project._id,
      data: {
        stageId: stageUpdateModal.stage.stageId,
        status: "delayed",
        delayReason: delayReason.trim(),
        delayExpectedDate: delayExpectedDate || undefined,
      },
    });
  };

  const openProject = (item: ProjectListItem) => {
    setSelectedProject({
      _id: item._id,
      customerName: item.customerName,
      customerPhone: item.customerPhone,
      address: item.address,
      status: item.status,
      currentStageId: item.currentStageId,
      stages: [],
      createdAt: item.createdAt,
    });
  };

  const detailProject = selectedProject;

  if (selectedProject) {
    const sortedStages = [...(detailProject.stages || [])].sort((a, b) => a.order - b.order);

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedProject(null)}
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          All projects
        </button>

        <div className="rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{detailProject.customerName}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {detailProject.address}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {detailProject.customerPhone}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {detailProject.stages.length > 0 ? (
                <OverallStatusBadge project={detailProject} />
              ) : (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">Loading…</span>
              )}
              <span className="text-xs text-gray-400">
                Project #{detailProject._id.slice(-6).toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {detailLoading && sortedStages.length === 0 ? (
          <div className="space-y-3">
            <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
          </div>
        ) : (
          sortedStages.map((stage) => (
            <div key={stage.stageId} className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                    {stage.order}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{stage.name}</span>
                  {stage.visibleToCustomer ? (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                      👁 Customer
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Internal</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StageStatusBadge status={stage.status} />
                </div>
              </div>

              {stage.status === "delayed" && (stage.delayReason || stage.delayExpectedDate) && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {stage.delayReason && <p>⚠ {stage.delayReason}</p>}
                  {stage.delayExpectedDate && (
                    <p className="mt-1 text-amber-800">Expected: {stage.delayExpectedDate}</p>
                  )}
                </div>
              )}

              {(stage.status === "active" || stage.status === "done") && stage.tasks.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {stage.tasks.map((task) => (
                    <div key={task.taskId} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        readOnly
                        disabled
                        className="h-3.5 w-3.5 rounded border-gray-300"
                      />
                      <span className="flex-1 text-gray-800">{task.name}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">
                        {task.assignedRole}
                      </span>
                      {task.docRequired && (
                        <FileText className="h-3 w-3 text-gray-400" title="Document required" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {stage.status !== "done" && (
                <div className="mt-3 border-t pt-3">
                  <select
                    key={`${stage.stageId}-${stage.status}-${stageMutation.isPending}`}
                    defaultValue=""
                    disabled={stageMutation.isPending}
                    onChange={(e) => {
                      handleStageAction(detailProject, stage, e.target.value);
                      e.target.value = "";
                    }}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="" disabled>
                      Move to…
                    </option>
                    <option value="active">Mark active</option>
                    <option value="done">Mark done</option>
                    <option value="delayed">Mark delayed</option>
                  </select>
                </div>
              )}
            </div>
          ))
        )}

        {stageUpdateModal?.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-900">Mark stage as delayed</h2>
              <p className="mt-1 text-sm text-gray-500">{stageUpdateModal.stage.name}</p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Delay reason</label>
                  <Textarea
                    value={delayReason}
                    onChange={(e) => setDelayReason(e.target.value)}
                    placeholder="e.g. MSEDCL approval pending"
                    className="min-h-[80px]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Expected resolution
                  </label>
                  <Input
                    type="date"
                    value={delayExpectedDate}
                    onChange={(e) => setDelayExpectedDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStageUpdateModal(null)}
                  disabled={stageMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={confirmDelayed}
                  disabled={stageMutation.isPending}
                >
                  Confirm delayed
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <p className="text-sm text-gray-500">Post-conversion solar installations</p>
      </div>

      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-red-800">Failed to load projects.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Projects</CardTitle>
                <Folder className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Active</CardTitle>
                <Zap className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.active}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Completed</CardTitle>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.completed}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Delayed</CardTitle>
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.delayed}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-500">
            No projects yet. Create one from a converted lead.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const { done, total } = project.stageSummary;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <button
                key={project._id}
                type="button"
                onClick={() => openProject(project)}
                className="rounded-xl border bg-white p-4 text-left transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">{project.customerName}</span>
                  <ListStatusBadge item={project} />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="line-clamp-1">{project.address}</span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                  <Phone className="h-3 w-3 shrink-0" />
                  {project.customerPhone}
                </p>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {done} of {total} stages
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-green-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-400">
                  {format(new Date(project.createdAt), "MMM d, yyyy")}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
