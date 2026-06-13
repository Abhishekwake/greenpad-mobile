"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Folder,
  MapPin,
  Phone,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import {
  addProjectTask,
  deleteProjectTask,
  getProject,
  getProjects,
  getRoles,
  voidProject,
  updateProjectStage,
  updateProjectTask,
  type ProjectListView,
} from "@/lib/projectApi";
import { VoidConfirmDialog } from "@/components/crm/VoidConfirmDialog";
import { StartNewProjectDialog } from "@/components/projects/StartNewProjectDialog";
import {
  StageExecutionPanel,
  type StageComment,
  type StageDocument,
  type StageMedia,
} from "@/components/projects/StageExecutionPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { teamUploadEnabled, teamUploadRequired } from "@/lib/uploadPolicy";

type StageStatus = "pending" | "active" | "done" | "delayed";

type ProjectStage = {
  stageId: string;
  name: string;
  order: number;
  visibleToCustomer: boolean;
  documentPolicy?: "none" | "optional" | "required";
  requiredDocuments?: Array<{
    docId: string;
    label: string;
    uploadedBy: "customer" | "admin" | "both";
    required: boolean;
  }>;
  status: StageStatus;
  delayReason?: string;
  delayExpectedDate?: string;
  tasks: {
    taskId: string;
    name: string;
    assignedRole: string;
    docRequired: boolean;
    customerUploadPolicy?: "none" | "optional" | "required";
    teamUploadPolicy?: "none" | "optional" | "required";
    documents?: { url: string; name?: string }[];
    completed: boolean;
    isCustom?: boolean;
  }[];
  comments?: StageComment[];
  documents?: StageDocument[];
  media?: StageMedia[];
};

type ProjectPhase = {
  phaseId: string;
  name: string;
  order: number;
  stages: ProjectStage[];
};

type Project = {
  _id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  status: string;
  currentStageId: string;
  phases?: ProjectPhase[];
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

function getListDisplayStatus(item: ProjectListItem): "completed" | "delayed" | "active" | "voided" {
  if (item.status === "voided") return "voided";
  if (item.status === "completed") return "completed";
  if (item.stageSummary.delayedCount > 0) return "delayed";
  return "active";
}

function ListStatusBadge({ item }: { item: ProjectListItem }) {
  const display = getListDisplayStatus(item);
  if (display === "voided") {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Voided</span>
    );
  }
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

const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  pending: "Not active",
  active: "Active",
  done: "Done",
  delayed: "Delayed",
};

function StageStatusBadge({ status }: { status: StageStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        status === "done" && "bg-green-50 text-green-700",
        status === "active" && "bg-blue-50 text-blue-700",
        status === "delayed" && "bg-amber-50 text-amber-700",
        status === "pending" && "bg-gray-50 text-gray-500"
      )}
    >
      {STAGE_STATUS_LABEL[status]}
    </span>
  );
}

function OverallStatusBadge({ project }: { project: Project }) {
  const allStages = project.phases?.flatMap((p) => p.stages) ?? project.stages ?? [];
  const hasDelayed = allStages.some((s) => s.status === "delayed");
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

const LIST_VIEWS: { key: ProjectListView; label: string }[] = [
  { key: "active", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "voided", label: "Voided" },
];

export default function ProjectsPage() {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [listView, setListView] = useState<ProjectListView>("active");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [stageUpdateModal, setStageUpdateModal] = useState<StageUpdateModal>(null);
  const [delayReason, setDelayReason] = useState("");
  const [delayExpectedDate, setDelayExpectedDate] = useState("");
  const [voidProjectOpen, setVoidProjectOpen] = useState(false);
  const [startProjectOpen, setStartProjectOpen] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});

  const { data: projects = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["projects", listView],
    queryFn: async () => {
      const res = await getProjects({ view: listView });
      return res.data.data as ProjectListItem[];
    },
    staleTime: 30_000,
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects", "all-stats"],
    queryFn: async () => {
      const res = await getProjects({ view: "all" });
      return res.data.data as ProjectListItem[];
    },
    staleTime: 60_000,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const res = await getRoles();
      return res.data.data as { _id: string; name: string }[];
    },
  });

  const {
    data: projectDetail,
    isLoading: detailLoading,
    isError: detailError,
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
      const phases =
        projectDetail.phases && projectDetail.phases.length > 0
          ? projectDetail.phases
          : [{ stages: projectDetail.stages ?? [] }];
      const nextExpanded: Record<string, boolean> = {};
      for (const phase of phases) {
        for (const stage of phase.stages) {
          if (stage.status === "active" || stage.status === "delayed") {
            nextExpanded[stage.stageId] = true;
          }
        }
      }
      setExpandedStages(nextExpanded);
    }
  }, [projectDetail]);

  useEffect(() => {
    if (stageUpdateModal?.open) {
      setDelayReason(stageUpdateModal.stage.delayReason || "");
      setDelayExpectedDate(stageUpdateModal.stage.delayExpectedDate || "");
    }
  }, [stageUpdateModal]);

  const stats = useMemo(() => {
    const total = allProjects.filter((p) => p.status !== "voided").length;
    const active = allProjects.filter((p) => p.status === "active" || p.status === "on_hold").length;
    const completed = allProjects.filter((p) => p.status === "completed").length;
    const delayed = allProjects.filter(
      (p) => p.status !== "voided" && p.stageSummary.delayedCount > 0
    ).length;
    return { total, active, completed, delayed };
  }, [allProjects]);

  const voidProjectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await voidProject(id, reason);
    },
    onSuccess: async () => {
      success("Project voided");
      setVoidProjectOpen(false);
      setSelectedProject(null);
      await qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: unknown) => {
      toastError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.message || err.message)
          : "Failed to void project"
      );
    },
  });

  const invalidateProject = async () => {
    await qc.invalidateQueries({ queryKey: ["projects"] });
    if (selectedProject?._id) {
      await qc.invalidateQueries({ queryKey: ["project", selectedProject._id] });
      await refetchDetail();
    }
  };

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
      await invalidateProject();
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? String(err.response?.data?.message || err.message)
        : "Failed to update stage";
      toastError(msg);
    },
  });

  const taskMutation = useMutation({
    mutationFn: async (data: {
      projectId: string;
      stageId: string;
      taskId: string;
      completed?: boolean;
      name?: string;
      assignedRole?: string;
      docRequired?: boolean;
    }) => {
      const { projectId, stageId, taskId, ...rest } = data;
      await updateProjectTask(projectId, { stageId, taskId, ...rest });
    },
    onSuccess: async () => {
      await invalidateProject();
    },
    onError: (err: unknown) => {
      toastError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.message || err.message)
          : "Failed to update work item"
      );
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: async (data: { projectId: string; stageId: string; name: string; assignedRole?: string }) => {
      await addProjectTask(data.projectId, data);
    },
    onSuccess: async () => {
      success("Work item added");
      await invalidateProject();
    },
    onError: (err: unknown) => {
      toastError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.message || err.message)
          : "Failed to add work item"
      );
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (data: { projectId: string; stageId: string; taskId: string }) => {
      await deleteProjectTask(data.projectId, data);
    },
    onSuccess: async () => {
      success("Work item removed");
      await invalidateProject();
    },
    onError: (err: unknown) => {
      toastError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.message || err.message)
          : "Failed to remove work item"
      );
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

  const detailProject = projectDetail ?? selectedProject;

  if (selectedProject && detailProject) {
    const phases =
      detailProject.phases && detailProject.phases.length > 0
        ? detailProject.phases
        : detailProject.stages && detailProject.stages.length > 0
          ? [
              {
                phaseId: "phase_legacy",
                name: "Workflow",
                order: 1,
                stages: [...detailProject.stages].sort((a, b) => a.order - b.order),
              },
            ]
          : [];

    const totalStages = phases.reduce((n, p) => n + p.stages.length, 0);

    const stageHasDocuments = (stage: ProjectStage) => (stage.documents?.length ?? 0) > 0;

    const canCompleteTask = (task: ProjectStage["tasks"][number], stage: ProjectStage) => {
      if (!teamUploadRequired(task)) return true;
      const taskDocs = task.documents?.length ?? 0;
      return taskDocs > 0 || stageHasDocuments(stage);
    };

    const stageShowsDocuments = (stage: ProjectStage) =>
      stageHasDocuments(stage) ||
      stage.tasks.some((t) => teamUploadEnabled(t)) ||
      stage.documentPolicy !== "none" ||
      (stage.requiredDocuments?.length ?? 0) > 0;

    const renderStage = (stage: ProjectStage) => {
      const isExpanded = expandedStages[stage.stageId] ?? stage.status === "active";

      return (
      <div
        key={stage.stageId}
        className={cn(
          "overflow-hidden rounded-xl border bg-white shadow-sm",
          stage.status === "active" && "border-emerald-300 ring-1 ring-emerald-100",
          stage.status === "done" && "border-gray-200 opacity-90"
        )}
      >
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-gray-50/80"
          onClick={() =>
            setExpandedStages((prev) => ({ ...prev, [stage.stageId]: !isExpanded }))
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-800">
              {stage.order}
            </span>
            <span className="text-sm font-semibold text-gray-900">{stage.name}</span>
            {stage.visibleToCustomer ? (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                Customer visible
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Internal</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StageStatusBadge status={stage.status} />
            <ChevronDown
              className={cn("h-4 w-4 text-gray-400 transition-transform", isExpanded && "rotate-180")}
            />
          </div>
        </button>

        {isExpanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
        {stage.status === "delayed" && (stage.delayReason || stage.delayExpectedDate) && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {stage.delayReason && <p>⚠ {stage.delayReason}</p>}
            {stage.delayExpectedDate && <p className="mt-1 text-amber-800">Expected: {stage.delayExpectedDate}</p>}
          </div>
        )}

        <div className="mt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Work items</p>
          <div className="space-y-2">
            {stage.tasks.map((task) => (
              <div key={task.taskId} className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="checkbox"
                  checked={task.completed}
                  disabled={taskMutation.isPending || detailProject.status === "voided"}
                  onChange={(e) => {
                    if (e.target.checked && !canCompleteTask(task, stage)) {
                      toastError(
                        "This work item requires a team file — upload under Documents below first."
                      );
                      return;
                    }
                    taskMutation.mutate({
                      projectId: detailProject._id,
                      stageId: stage.stageId,
                      taskId: task.taskId,
                      completed: e.target.checked,
                    });
                  }}
                  className="h-3.5 w-3.5 rounded border-gray-300"
                />
                <Input
                  defaultValue={task.name}
                  key={`${task.taskId}-${task.name}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== task.name) {
                      taskMutation.mutate({
                        projectId: detailProject._id,
                        stageId: stage.stageId,
                        taskId: task.taskId,
                        name: v,
                      });
                    }
                  }}
                  className="h-8 min-w-[120px] flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-1"
                />
                <select
                  value={task.assignedRole}
                  disabled={taskMutation.isPending}
                  onChange={(e) =>
                    taskMutation.mutate({
                      projectId: detailProject._id,
                      stageId: stage.stageId,
                      taskId: task.taskId,
                      assignedRole: e.target.value,
                    })
                  }
                  className="max-w-[180px] rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                >
                  {roles.length === 0 ? (
                    <option value={task.assignedRole}>{task.assignedRole || "No role"}</option>
                  ) : (
                    roles.map((r) => (
                      <option key={r._id} value={r.name}>
                        {r.name}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  disabled={deleteTaskMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove "${task.name}" from this project?`)) {
                      deleteTaskMutation.mutate({
                        projectId: detailProject._id,
                        stageId: stage.stageId,
                        taskId: task.taskId,
                      });
                    }
                  }}
                  className="shrink-0 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {teamUploadRequired(task) && !task.completed && !canCompleteTask(task, stage) && (
                <p className="mt-1.5 text-xs text-amber-700">
                  Team file required — upload under <strong>Documents</strong> below, then mark complete.
                </p>
              )}
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={addTaskMutation.isPending}
            onClick={() => {
              const name = window.prompt("Work item name");
              if (!name?.trim()) return;
              addTaskMutation.mutate({
                projectId: detailProject._id,
                stageId: stage.stageId,
                name: name.trim(),
                assignedRole: roles[0]?.name,
              });
            }}
            className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-3 w-3" /> Add work item
          </button>
        </div>

        <StageExecutionPanel
          projectId={detailProject._id}
          stageId={stage.stageId}
          documentPolicy={stage.documentPolicy}
          requiredDocuments={stage.requiredDocuments}
          tasks={stage.tasks}
          showDocuments={stageShowsDocuments(stage)}
          comments={stage.comments}
          documents={stage.documents}
          media={stage.media}
          onUpdated={() => void invalidateProject()}
          onError={toastError}
        />

        {detailProject.status !== "voided" && stage.status !== "done" && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            <span className="w-full text-xs font-medium uppercase tracking-wide text-gray-400">
              Update stage
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={stageMutation.isPending || stage.status === "active"}
              onClick={() => handleStageAction(detailProject, stage, "active")}
            >
              Mark active
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={stageMutation.isPending || stage.status === "pending"}
              onClick={() => handleStageAction(detailProject, stage, "pending")}
            >
              Mark not active
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-green-200 text-green-800 hover:bg-green-50"
              disabled={stageMutation.isPending}
              onClick={() => handleStageAction(detailProject, stage, "done")}
            >
              Mark done
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-amber-200 text-amber-800 hover:bg-amber-50"
              disabled={stageMutation.isPending}
              onClick={() => handleStageAction(detailProject, stage, "delayed")}
            >
              Mark delayed
            </Button>
          </div>
        )}
        </div>
        )}
      </div>
    );
    };

    return (
      <div className="space-y-4">
        <VoidConfirmDialog
          open={voidProjectOpen}
          onOpenChange={setVoidProjectOpen}
          title="Void installation project?"
          description="This project will be removed from the active installations list. Progress data is kept for audit — use this instead of deleting records."
          confirmLabel="Void project"
          isPending={voidProjectMutation.isPending}
          onConfirm={(reason) =>
            voidProjectMutation.mutateAsync({ id: detailProject._id, reason })
          }
        />
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
              {detailLoading && !projectDetail ? (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">Loading…</span>
              ) : detailError ? (
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs text-red-700">Failed to load</span>
              ) : totalStages > 0 ? (
                <OverallStatusBadge project={detailProject} />
              ) : (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">No stages</span>
              )}
              <span className="text-xs text-gray-400">Project #{detailProject._id.slice(-6).toUpperCase()}</span>
              {detailProject.status !== "voided" && detailProject.status !== "completed" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => setVoidProjectOpen(true)}
                >
                  Void project…
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {detailProject.status === "voided" && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            This project was voided and is read-only. It no longer appears in the active installations list.
          </div>
        )}

        {detailError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center justify-between">
            <p className="text-sm text-red-800">Could not load project workflow. Check API connection.</p>
            <Button variant="outline" size="sm" onClick={() => refetchDetail()}>Retry</Button>
          </div>
        )}

        {detailLoading && !projectDetail ? (
          <div className="space-y-3">
            <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
            <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
          </div>
        ) : totalStages === 0 && !detailLoading ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
            No workflow stages found for this project.
          </div>
        ) : (
          phases.map((phase) => (
            <div key={phase.phaseId} className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-800">
                <span className="rounded bg-emerald-100 px-2 py-0.5">Phase {phase.order}</span>
                {phase.name}
              </h2>
              <div className="space-y-3 pl-2">{phase.stages.map(renderStage)}</div>
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
      <StartNewProjectDialog
        open={startProjectOpen}
        onOpenChange={setStartProjectOpen}
        onProjectCreated={(projectId, customerName) => {
          setListView("active");
          setSelectedProject({
            _id: projectId,
            customerName,
            customerPhone: "",
            address: "",
            status: "active",
            currentStageId: "",
            stages: [],
            createdAt: new Date().toISOString(),
          });
        }}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500">
            Active installations only — completed and voided are in separate tabs
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => setStartProjectOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Start new project
          </Button>
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            {LIST_VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setListView(v.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  listView === v.key
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
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
          <CardContent className="flex flex-col items-center py-12 text-center text-sm text-gray-500">
            {listView === "active" ? (
              <>
                <p>No active installations yet.</p>
                <p className="mt-1 text-xs text-gray-400">
                  Start from a converted site visit — manual and app leads are supported.
                </p>
                <Button
                  type="button"
                  className="mt-4 gap-2"
                  onClick={() => setStartProjectOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Start new project
                </Button>
              </>
            ) : listView === "completed" ? (
              "No completed projects yet."
            ) : (
              "No voided projects."
            )}
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
