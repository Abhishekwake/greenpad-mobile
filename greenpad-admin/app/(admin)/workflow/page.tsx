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
  Layers,
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

type Phase = {
  phaseId: string;
  name: string;
  order: number;
  stages: Stage[];
  _expanded: boolean;
};

type Role = { _id: string; name: string };

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
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

function SortableTaskRow({
  task,
  roles,
  onUpdate,
  onDelete,
}: {
  task: Task;
  roles: Role[];
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
      <GripVertical className="h-3 w-3 shrink-0 text-gray-300" />
      <Input
        value={task.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
      />
      <select
        value={task.assignedRole}
        onChange={(e) => onUpdate({ assignedRole: e.target.value })}
        className="max-w-[160px] rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
      >
        {roles.length === 0 ? (
          <option value="">No roles</option>
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
        title="Document required"
        onClick={() => onUpdate({ docRequired: !task.docRequired })}
        className={cn("shrink-0", task.docRequired ? "text-blue-500" : "text-gray-300 hover:text-gray-400")}
      >
        <FileText className="h-4 w-4" />
      </button>
      <button type="button" onClick={onDelete} className="shrink-0 text-gray-400 hover:text-red-500">
        <X className="h-4 w-4" />
      </button>
    </div>
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
  onUpdate: (patch: Partial<Stage>) => void;
  onDelete: () => void;
  onToggleExpand: () => void;
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
    onUpdate({
      tasks: stage.tasks.map((t) => (t.taskId === taskId ? { ...t, ...patch } : t)),
    });
  };

  const addTask = () => {
    onUpdate({
      tasks: [
        ...stage.tasks,
        {
          taskId: `task_${stage.order}_${Date.now()}`,
          name: "New work item",
          assignedRole: roles[0]?.name || "",
          docRequired: false,
        },
      ],
    });
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-3 overflow-hidden rounded-xl border bg-white">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand();
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
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 border-0 bg-transparent px-2 py-1 text-sm font-medium shadow-none focus-visible:bg-gray-50 focus-visible:ring-0"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUpdate({ visibleToCustomer: !stage.visibleToCustomer });
          }}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
            stage.visibleToCustomer ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          )}
        >
          {stage.visibleToCustomer ? "👁 Customer" : "Internal"}
        </button>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-gray-400 transition-transform", stage._expanded && "rotate-180")}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete stage "${stage.name}"?`)) onDelete();
          }}
          className="shrink-0 text-red-400 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {stage._expanded && (
        <div className="border-t px-4 pb-4">
          <p className="mb-2 mt-3 text-xs font-medium uppercase tracking-wide text-gray-400">Work items</p>
          {stage.tasks.length === 0 ? (
            <p className="mb-2 text-xs text-gray-400">No work items yet.</p>
          ) : (
            stage.tasks.map((task) => (
              <SortableTaskRow
                key={task.taskId}
                task={task}
                roles={roles}
                onUpdate={(patch) => updateTask(task.taskId, patch)}
                onDelete={() => onUpdate({ tasks: stage.tasks.filter((t) => t.taskId !== task.taskId) })}
              />
            ))
          )}
          <button type="button" onClick={addTask} className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
            <Plus className="h-3 w-3" /> Add work item
          </button>
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <ToggleSwitch
              checked={stage.visibleToCustomer}
              onChange={(checked) => onUpdate({ visibleToCustomer: checked })}
            />
            <span className="text-sm text-gray-600">Visible to customer</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SortablePhaseBlock({
  phase,
  roles,
  onUpdate,
  onDelete,
  onStageDragEnd,
}: {
  phase: Phase;
  roles: Role[];
  onUpdate: (patch: Partial<Phase>) => void;
  onDelete: () => void;
  onStageDragEnd: (phaseId: string, activeId: string, overId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: phase.phaseId,
  });

  const stageSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  const updateStage = (stageId: string, patch: Partial<Stage>) => {
    onUpdate({
      stages: phase.stages.map((s) => (s.stageId === stageId ? { ...s, ...patch } : s)),
    });
  };

  const addStage = () => {
    const next = phase.stages.length + 1;
    onUpdate({
      stages: [
        ...phase.stages,
        {
          stageId: `stage_${Date.now()}`,
          name: "New Stage",
          order: next,
          visibleToCustomer: true,
          tasks: [],
          _expanded: true,
        },
      ],
    });
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-4 overflow-hidden rounded-xl border-2 border-emerald-100 bg-white">
      <div className="flex items-center gap-3 bg-emerald-50 px-4 py-3">
        <span
          className="cursor-grab text-emerald-400 hover:text-emerald-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </span>
        <Layers className="h-5 w-5 text-emerald-600" />
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
          Phase {phase.order}
        </span>
        <Input
          value={phase.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 border-0 bg-transparent px-2 py-1 text-base font-semibold shadow-none focus-visible:bg-white focus-visible:ring-0"
        />
        <button type="button" onClick={() => onUpdate({ _expanded: !phase._expanded })}>
          <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", phase._expanded && "rotate-180")} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete phase "${phase.name}"?`)) onDelete();
          }}
          className="text-red-400 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {phase._expanded && (
        <div className="border-t p-4">
          <DndContext
            sensors={stageSensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => {
              const { active, over } = e;
              if (over && active.id !== over.id) {
                onStageDragEnd(phase.phaseId, String(active.id), String(over.id));
              }
            }}
          >
            <SortableContext items={phase.stages.map((s) => s.stageId)} strategy={verticalListSortingStrategy}>
              {phase.stages.map((stage) => (
                <SortableStageCard
                  key={stage.stageId}
                  stage={stage}
                  roles={roles}
                  onUpdate={(patch) => updateStage(stage.stageId, patch)}
                  onDelete={() => onUpdate({ stages: phase.stages.filter((s) => s.stageId !== stage.stageId) })}
                  onToggleExpand={() =>
                    updateStage(stage.stageId, { _expanded: !stage._expanded })
                  }
                />
              ))}
            </SortableContext>
          </DndContext>
          <Button variant="outline" size="sm" onClick={addStage}>
            <Plus className="h-3.5 w-3.5" /> Add stage
          </Button>
        </div>
      )}
    </div>
  );
}

export default function WorkflowPage() {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [workflowName, setWorkflowName] = useState("Default Solar Workflow");
  const initializedRef = useRef(false);

  const phaseSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: workflowData, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-workflow"],
    queryFn: async () => {
      const res = await getWorkflow();
      return res.data.data as { name: string; phases?: Phase[]; stages?: Stage[] };
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
      let loaded: Phase[] = [];
      if (workflowData.phases?.length) {
        loaded = workflowData.phases.map((p) => ({
          ...p,
          _expanded: true,
          stages: (p.stages || [])
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => ({ ...s, tasks: s.tasks || [], _expanded: false })),
        }));
      } else if (workflowData.stages?.length) {
        loaded = [
          {
            phaseId: "phase_legacy",
            name: "Workflow",
            order: 1,
            _expanded: true,
            stages: workflowData.stages.map((s) => ({ ...s, tasks: s.tasks || [], _expanded: false })),
          },
        ];
      }
      setPhases(loaded);
      initializedRef.current = true;
    }
  }, [workflowData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await saveWorkflow({
        name: workflowName,
        phases: phases.map((phase, pi) => ({
          phaseId: phase.phaseId,
          name: phase.name,
          order: pi + 1,
          stages: phase.stages.map((stage, si) => {
            const { _expanded, ...rest } = stage;
            void _expanded;
            return {
              ...rest,
              order: si + 1,
              tasks: rest.tasks.map((t) => ({
                taskId: t.taskId,
                name: t.name,
                assignedRole: t.assignedRole,
                docRequired: t.docRequired,
              })),
            };
          }),
        })),
      });
    },
    onSuccess: async () => {
      success("Workflow saved! New projects will use this template.");
      initializedRef.current = false;
      await qc.invalidateQueries({ queryKey: ["admin-workflow"] });
    },
    onError: (err: unknown) => {
      toastError(
        axios.isAxiosError(err)
          ? String(err.response?.data?.message || err.message)
          : "Failed to save workflow"
      );
    },
  });

  const handlePhaseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPhases((prev) => {
      const oldIndex = prev.findIndex((p) => p.phaseId === active.id);
      const newIndex = prev.findIndex((p) => p.phaseId === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((p, i) => ({ ...p, order: i + 1 }));
    });
  };

  const handleStageDragEnd = (phaseId: string, activeId: string, overId: string) => {
    setPhases((prev) =>
      prev.map((p) => {
        if (p.phaseId !== phaseId) return p;
        const oldIndex = p.stages.findIndex((s) => s.stageId === activeId);
        const newIndex = p.stages.findIndex((s) => s.stageId === overId);
        if (oldIndex === -1 || newIndex === -1) return p;
        return {
          ...p,
          stages: arrayMove(p.stages, oldIndex, newIndex).map((s, i) => ({ ...s, order: i + 1 })),
        };
      })
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-800">Failed to load workflow template.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow builder</h1>
          <p className="text-sm text-gray-500">
            Drag phases &amp; stages · edit work items · assign teams · set customer visibility
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-gray-500">Template name</label>
        <Input value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} className="max-w-md" />
      </div>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠ Template changes apply to <strong>new projects</strong> only. Edit work items on an open project to customize that customer.
      </div>

      <Button
        variant="outline"
        className="mb-4"
        onClick={() =>
          setPhases((prev) => [
            ...prev,
            { phaseId: `phase_${Date.now()}`, name: "New Phase", order: prev.length + 1, stages: [], _expanded: true },
          ])
        }
      >
        <Plus className="h-4 w-4" /> Add phase
      </Button>

      <DndContext sensors={phaseSensors} collisionDetection={closestCenter} onDragEnd={handlePhaseDragEnd}>
        <SortableContext items={phases.map((p) => p.phaseId)} strategy={verticalListSortingStrategy}>
          {phases.map((phase) => (
            <SortablePhaseBlock
              key={phase.phaseId}
              phase={phase}
              roles={roles}
              onUpdate={(patch) =>
                setPhases((prev) => prev.map((p) => (p.phaseId === phase.phaseId ? { ...p, ...patch } : p)))
              }
              onDelete={() => setPhases((prev) => prev.filter((p) => p.phaseId !== phase.phaseId))}
              onStageDragEnd={handleStageDragEnd}
            />
          ))}
        </SortableContext>
      </DndContext>

      {phases.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          No phases yet. Click &quot;Add phase&quot; to get started.
        </div>
      )}
    </div>
  );
}
