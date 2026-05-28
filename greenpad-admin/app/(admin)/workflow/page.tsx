"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  FileText,
  GripVertical,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { getRoles, getWorkflow, saveWorkflow } from "@/lib/projectApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Task = {
  taskId: string;
  name: string;
  assignedRole: string;
  docRequired: boolean;
};

type Stage = {
  stageId: string;
  name: string;
  order: number;
  visibleToCustomer: boolean;
  tasks: Task[];
  _expanded: boolean;
};

type Role = {
  _id: string;
  name: string;
};

type WorkflowPayload = {
  name: string;
  stages: Omit<Stage, "_expanded">[];
};

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-emerald-500" : "bg-gray-300"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function SortableStageCard({
  stage,
  roles,
  onUpdate,
  onDelete,
  onToggleExpand,
}: {
  stage: Stage;
  roles: Role[];
  onUpdate: (stageId: string, patch: Partial<Stage>) => void;
  onDelete: (stageId: string) => void;
  onToggleExpand: (stageId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.stageId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const updateTask = (taskId: string, patch: Partial<Task>) => {
    onUpdate(stage.stageId, {
      tasks: stage.tasks.map((t) => (t.taskId === taskId ? { ...t, ...patch } : t)),
    });
  };

  const addTask = () => {
    const nextIndex = stage.tasks.length + 1;
    onUpdate(stage.stageId, {
      tasks: [
        ...stage.tasks,
        {
          taskId: `task_${stage.order}_${nextIndex}_${Date.now()}`,
          name: "New task",
          assignedRole: roles[0]?.name || "",
          docRequired: false,
        },
      ],
    });
  };

  const removeTask = (taskId: string) => {
    onUpdate(stage.stageId, {
      tasks: stage.tasks.filter((t) => t.taskId !== taskId),
    });
  };

  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(stage.stageId, { visibleToCustomer: !stage.visibleToCustomer });
  };

  const deleteStage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete stage "${stage.name}"?`)) {
      onDelete(stage.stageId);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-3 overflow-hidden rounded-xl border bg-white">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggleExpand(stage.stageId)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand(stage.stageId);
          }
        }}
        className="flex cursor-pointer items-center gap-3 px-4 py-3"
      >
        <span
          className="cursor-grab text-gray-300 hover:text-gray-400 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </span>

        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-700">
          {stage.order}
        </span>

        <Input
          value={stage.name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onUpdate(stage.stageId, { name: e.target.value })}
          className="flex-1 border-0 bg-transparent px-2 py-1 text-sm font-medium shadow-none focus-visible:bg-gray-50 focus-visible:ring-0"
        />

        <button
          type="button"
          onClick={toggleVisibility}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
            stage.visibleToCustomer
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          )}
        >
          {stage.visibleToCustomer ? "👁 Customer" : "Internal"}
        </button>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-gray-400 transition-transform",
            stage._expanded && "rotate-180"
          )}
        />

        <button
          type="button"
          onClick={deleteStage}
          className="shrink-0 text-red-400 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {stage._expanded && (
        <div className="border-t px-4 pb-4">
          <p className="mb-2 mt-3 text-xs font-medium uppercase tracking-wide text-gray-400">Tasks</p>

          {stage.tasks.length === 0 ? (
            <p className="mb-2 text-xs text-gray-400">No tasks yet.</p>
          ) : (
            stage.tasks.map((task) => (
              <div
                key={task.taskId}
                className="mb-2 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"
              >
                <GripVertical className="h-3 w-3 shrink-0 text-gray-300" />
                <Input
                  value={task.name}
                  onChange={(e) => updateTask(task.taskId, { name: e.target.value })}
                  className="flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                />
                <select
                  value={task.assignedRole}
                  onChange={(e) => updateTask(task.taskId, { assignedRole: e.target.value })}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {roles.length === 0 ? (
                    <option value="">No roles</option>
                  ) : (
                    roles.map((role) => (
                      <option key={role._id} value={role.name}>
                        {role.name}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  title="Toggle document required"
                  onClick={() => updateTask(task.taskId, { docRequired: !task.docRequired })}
                  className={cn(
                    "shrink-0",
                    task.docRequired ? "text-blue-500" : "text-gray-300 hover:text-gray-400"
                  )}
                >
                  <FileText className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeTask(task.taskId)}
                  className="shrink-0 text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))
          )}

          <button
            type="button"
            onClick={addTask}
            className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-3 w-3" />
            Add task
          </button>

          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <ToggleSwitch
              checked={stage.visibleToCustomer}
              onChange={(checked) => onUpdate(stage.stageId, { visibleToCustomer: checked })}
            />
            <span className="text-sm text-gray-600">Visible to customer</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkflowPage() {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [stages, setStages] = useState<Stage[]>([]);
  const [workflowName, setWorkflowName] = useState("Default Solar Workflow");
  const initializedRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: workflowData, isLoading: workflowLoading, isError: workflowError, refetch } = useQuery({
    queryKey: ["admin-workflow"],
    queryFn: async () => {
      const res = await getWorkflow();
      return res.data.data as WorkflowPayload;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const res = await getRoles();
      return res.data.data as Role[];
    },
  });

  useEffect(() => {
    if (workflowData && !initializedRef.current) {
      setWorkflowName(workflowData.name || "Default Solar Workflow");
      setStages(
        (workflowData.stages || [])
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s) => ({
            ...s,
            tasks: s.tasks || [],
            _expanded: false,
          }))
      );
      initializedRef.current = true;
    }
  }, [workflowData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: workflowName,
        stages: stages.map((stage, index) => {
          const { _expanded, ...rest } = stage;
          void _expanded;
          return {
            ...rest,
            order: index + 1,
          };
        }),
      };
      await saveWorkflow(payload);
    },
    onSuccess: async () => {
      success("Workflow saved! New projects will use this template.");
      initializedRef.current = false;
      await qc.invalidateQueries({ queryKey: ["admin-workflow"] });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? String(err.response?.data?.message || err.message)
        : "Failed to save workflow";
      toastError(msg);
    },
  });

  const updateStage = (stageId: string, patch: Partial<Stage>) => {
    setStages((prev) =>
      prev.map((s) => (s.stageId === stageId ? { ...s, ...patch } : s))
    );
  };

  const deleteStage = (stageId: string) => {
    setStages((prev) =>
      prev
        .filter((s) => s.stageId !== stageId)
        .map((s, index) => ({ ...s, order: index + 1 }))
    );
  };

  const toggleExpand = (stageId: string) => {
    setStages((prev) =>
      prev.map((s) => (s.stageId === stageId ? { ...s, _expanded: !s._expanded } : s))
    );
  };

  const addStage = () => {
    const nextOrder = stages.length + 1;
    setStages((prev) => [
      ...prev,
      {
        stageId: `stage_${nextOrder}_${Date.now()}`,
        name: "New Stage",
        order: nextOrder,
        visibleToCustomer: true,
        tasks: [],
        _expanded: true,
      },
    ]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setStages((prev) => {
      const oldIndex = prev.findIndex((s) => s.stageId === active.id);
      const newIndex = prev.findIndex((s) => s.stageId === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((s, index) => ({
        ...s,
        order: index + 1,
      }));
    });
  };

  if (workflowLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-16 animate-pulse rounded-lg bg-amber-100" />
        <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (workflowError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-800">Failed to load workflow template.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow builder</h1>
          <p className="text-sm text-gray-500">
            Customize stages and tasks — changes apply to all new projects
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠ Changes only affect new projects. Existing projects keep their current stage snapshot.
      </div>

      <Button variant="outline" className="mb-4" onClick={addStage}>
        <Plus className="h-4 w-4" />
        Add stage
      </Button>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={stages.map((s) => s.stageId)}
          strategy={verticalListSortingStrategy}
        >
          {stages.map((stage) => (
            <SortableStageCard
              key={stage.stageId}
              stage={stage}
              roles={roles}
              onUpdate={updateStage}
              onDelete={deleteStage}
              onToggleExpand={toggleExpand}
            />
          ))}
        </SortableContext>
      </DndContext>

      {stages.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          No stages yet. Click &quot;Add stage&quot; to get started.
        </div>
      )}
    </div>
  );
}
