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
  Eye,
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
import {
  applyUploadMode,
  normalizeTaskUpload,
  taskUploadMode,
  UPLOAD_MODE_LABELS,
  type UploadMode,
} from "@/lib/uploadPolicy";

type RequiredDocument = {
  docId: string;
  label: string;
  uploadedBy: "customer" | "admin" | "both";
  required: boolean;
};

type Task = {
  taskId: string;
  name: string;
  assignedRole: string;
  docRequired: boolean;
  customerUploadPolicy?: "none" | "optional" | "required";
  teamUploadPolicy?: "none" | "optional" | "required";
  mediaUploadPolicy?: "none" | "optional" | "required";
};

type Stage = {
  stageId: string;
  name: string;
  order: number;
  visibleToCustomer: boolean;
  documentPolicy?: "none" | "optional" | "required";
  approvalRequired?: boolean;
  stageColor?: string | null;
  stageIcon?: string | null;
  allowStageComments?: boolean;
  color: string;
  icon: string;
  requiresApproval: boolean;
  approvalLabel: string;
  requiredDocuments: RequiredDocument[];
  estimatedDays: number | null;
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

const STAGE_COLORS = [
  "#1D9E75",
  "#185FA5",
  "#BA7517",
  "#9333EA",
  "#DC2626",
  "#0891B2",
  "#65A30D",
  "#374151",
];

const STAGE_EMOJIS = [
  "📋", "📄", "🔍", "🏠", "💰", "🔧", "⚡", "📡", "✅", "🎯", "📞", "🤝", "📸", "🔌", "🌞",
];

function normalizeStageFromApi(s: Stage): Stage {
  return {
    ...s,
    tasks: (s.tasks || []).map((t) => normalizeTaskUpload(t)),
    documentPolicy: s.documentPolicy ?? "none",
    requiredDocuments: s.requiredDocuments ?? [],
    _expanded: s._expanded ?? false,
    color: s.color || s.stageColor || "#1D9E75",
    icon: s.icon || s.stageIcon || "📋",
    requiresApproval: s.requiresApproval ?? s.approvalRequired ?? false,
    approvalLabel: s.approvalLabel || "Approval required",
    estimatedDays: s.estimatedDays ?? null,
  };
}

function defaultStage(order: number): Stage {
  return {
    stageId: `stage_${Date.now()}`,
    name: "New Stage",
    order,
    visibleToCustomer: true,
    documentPolicy: "none",
    color: "#1D9E75",
    icon: "📋",
    requiresApproval: false,
    approvalLabel: "Approval required",
    requiredDocuments: [],
    estimatedDays: null,
    tasks: [],
    _expanded: false,
  };
}

function customerDocCount(stage: Stage) {
  return stage.requiredDocuments.filter(
    (d) => d.required && (d.uploadedBy === "customer" || d.uploadedBy === "both")
  ).length;
}

function EmojiPickerPopover({
  open,
  onSelect,
  onClose,
}: {
  open: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div className="absolute left-0 top-full z-50 mt-1 grid w-48 grid-cols-5 gap-1 rounded-lg border bg-white p-2 shadow-lg">
        {STAGE_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 text-xl"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}

function WorkflowPreviewPanel({
  phases,
  onClose,
}: {
  phases: Phase[];
  onClose: () => void;
}) {
  const allStages = phases
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((p) =>
      p.stages.map((s) => ({ ...s, phaseName: p.name, phaseOrder: p.order }))
    )
    .sort((a, b) => a.phaseOrder - b.phaseOrder || a.order - b.order);
  const customerStages = allStages.filter((s) => s.visibleToCustomer);

  const renderStage = (stage: Stage & { phaseName?: string }, showInternalBadge: boolean) => {
    const docsFromCustomer = customerDocCount(stage);
    return (
      <div key={stage.stageId} className="flex gap-2 py-2">
        <div className="flex flex-col items-center pt-0.5">
          <span className="text-base leading-none">{stage.icon}</span>
          <span
            className="mt-1 h-2 w-2 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-gray-900">{stage.name}</span>
            {showInternalBadge && !stage.visibleToCustomer && (
              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">
                Internal
              </span>
            )}
          </div>
          {stage.estimatedDays != null && stage.estimatedDays > 0 && (
            <p className="text-xs text-gray-500">~{stage.estimatedDays} days</p>
          )}
          {docsFromCustomer > 0 && (
            <p className="text-xs text-gray-500">
              📄 {docsFromCustomer} document(s) required from you
            </p>
          )}
          {stage.requiresApproval && (
            <p className="text-xs text-amber-700">⏳ Requires approval</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className="sticky top-4 h-[calc(100vh-2rem)] w-72 shrink-0 overflow-y-auto border-l bg-gray-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Workflow preview</h2>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mb-2 text-xs font-medium uppercase text-gray-500">Customer will see:</p>
      {customerStages.length === 0 ? (
        <p className="mb-4 text-xs text-gray-400">No customer-visible stages</p>
      ) : (
        <div className="mb-6 border-b border-gray-200 pb-4">
          {customerStages.map((s) => renderStage(s, false))}
        </div>
      )}

      <p className="mb-2 text-xs font-medium uppercase text-gray-500">Admin sees (all stages):</p>
      {allStages.length === 0 ? (
        <p className="text-xs text-gray-400">No stages</p>
      ) : (
        <div>{allStages.map((s) => renderStage(s, true))}</div>
      )}
    </aside>
  );
}

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
  const uploadMode = taskUploadMode(task);

  return (
    <div className="grid gap-2 rounded-lg border border-gray-100 bg-gray-50/80 p-2 sm:grid-cols-[1fr_minmax(140px,180px)_minmax(200px,1fr)_auto] sm:items-end sm:gap-3">
      <div className="flex min-w-0 items-center gap-2 sm:col-span-1">
        <GripVertical className="hidden h-3 w-3 shrink-0 text-gray-300 sm:block" />
        <Input
          value={task.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Work item name"
          className="h-9 flex-1 text-sm"
        />
      </div>
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Assigned team</span>
        <select
          value={task.assignedRole}
          onChange={(e) => onUpdate({ assignedRole: e.target.value })}
          className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800"
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
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">File uploads</span>
        <select
          value={uploadMode}
          onChange={(e) => onUpdate(applyUploadMode(task, e.target.value as UploadMode))}
          className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs"
        >
          {(Object.keys(UPLOAD_MODE_LABELS) as UploadMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {UPLOAD_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onDelete}
        className="flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
        title="Remove work item"
      >
        <Trash2 className="h-4 w-4" />
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.stageId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    borderLeftColor: stage.color,
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
        applyUploadMode(
          {
            taskId: `task_${stage.order}_${Date.now()}`,
            name: "New work item",
            assignedRole: roles[0]?.name || "",
          } as Task,
          "off"
        ) as Task,
      ],
    });
  };

  const taskSummary =
    stage.tasks.length === 0
      ? "No work items"
      : `${stage.tasks.length} work item${stage.tasks.length === 1 ? "" : "s"}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-3 overflow-hidden rounded-xl border border-l-4 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <span
          className="cursor-grab text-gray-300 hover:text-gray-400 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <span className="shrink-0 text-lg leading-none sm:text-xl">{stage.icon}</span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-700">
          {stage.order}
        </span>
        <Input
          value={stage.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="min-w-[120px] flex-1 text-sm font-medium"
        />
        <button
          type="button"
          onClick={() => onUpdate({ visibleToCustomer: !stage.visibleToCustomer })}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            stage.visibleToCustomer ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
          )}
        >
          {stage.visibleToCustomer ? "👁 Customer" : "Internal"}
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className={cn(
            "shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
            stage._expanded
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          )}
        >
          Options
          <ChevronDown
            className={cn("ml-0.5 inline h-3 w-3 transition-transform", stage._expanded && "rotate-180")}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete stage "${stage.name}"?`)) onDelete();
          }}
          className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
          title="Delete stage"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="border-t bg-gray-50/40 px-3 pb-3 pt-2 sm:px-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-gray-600">
            Work items <span className="font-normal text-gray-400">· {taskSummary}</span>
          </p>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addTask}>
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
        {stage.tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-xs text-gray-400">
            Add work items your team completes at this stage.
          </p>
        ) : (
          <div className="space-y-2">
            {stage.tasks.map((task) => (
              <SortableTaskRow
                key={task.taskId}
                task={task}
                roles={roles}
                onUpdate={(patch) => updateTask(task.taskId, patch)}
                onDelete={() => onUpdate({ tasks: stage.tasks.filter((t) => t.taskId !== task.taskId) })}
              />
            ))}
          </div>
        )}
      </div>

      {stage._expanded && (
        <div className="border-t px-3 pb-4 pt-3 sm:px-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Stage options</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative">
              <span className="text-xs text-gray-400">Icon</span>
              <button
                type="button"
                onClick={() => setEmojiOpen((o) => !o)}
                className="mt-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-gray-100 p-1 text-[28px] leading-none"
              >
                {stage.icon}
              </button>
              <EmojiPickerPopover
                open={emojiOpen}
                onSelect={(emoji) => onUpdate({ icon: emoji })}
                onClose={() => setEmojiOpen(false)}
              />
            </div>
            <div>
              <span className="text-xs text-gray-400">Color</span>
              <div className="mt-1 flex items-center gap-1.5">
                {STAGE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => onUpdate({ color: c })}
                    className={cn(
                      "h-5 w-5 rounded-full",
                      stage.color === c && "ring-2 ring-offset-1 ring-gray-400"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-400">Est. days</span>
              <div className="mt-1 flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  placeholder="—"
                  value={stage.estimatedDays ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onUpdate({
                      estimatedDays: v === "" ? null : Math.max(0, Number(v)),
                    });
                  }}
                  className="h-8 w-16 text-xs"
                />
                <span className="text-xs text-gray-500">days</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <ToggleSwitch
              checked={Boolean(stage.allowStageComments)}
              onChange={(checked) => onUpdate({ allowStageComments: checked })}
            />
            <span className="text-xs text-gray-600">Allow comments on open projects</span>
          </div>

          {/* Document policy */}
          <div className="mt-3 space-y-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400">Stage document policy</span>
              <select
                value={stage.documentPolicy ?? "none"}
                onChange={(e) =>
                  onUpdate({
                    documentPolicy: e.target.value as Stage["documentPolicy"],
                  })
                }
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs"
              >
                <option value="none">Off — no stage-level documents</option>
                <option value="optional">Optional — customer or team may upload</option>
                <option value="required">Required — at least one doc before stage completion</option>
              </select>
            </label>

            {(stage.documentPolicy === "optional" || stage.documentPolicy === "required") && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">Required document slots</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate({
                        requiredDocuments: [
                          ...stage.requiredDocuments,
                          {
                            docId: `doc_${Date.now()}`,
                            label: "",
                            uploadedBy: "customer",
                            required: true,
                          },
                        ],
                      })
                    }
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    + Add slot
                  </button>
                </div>
                {stage.requiredDocuments.length === 0 ? (
                  <p className="text-xs text-gray-400">No document slots defined.</p>
                ) : (
                  <div className="space-y-2">
                    {stage.requiredDocuments.map((doc, idx) => (
                      <div
                        key={doc.docId}
                        className="grid gap-2 rounded border border-gray-100 bg-white p-2 sm:grid-cols-[1fr_120px_auto_auto]"
                      >
                        <Input
                          value={doc.label}
                          onChange={(e) => {
                            const next = [...stage.requiredDocuments];
                            next[idx] = { ...doc, label: e.target.value };
                            onUpdate({ requiredDocuments: next });
                          }}
                          placeholder="e.g. Aadhaar card"
                          className="h-8 text-xs"
                        />
                        <select
                          value={doc.uploadedBy}
                          onChange={(e) => {
                            const next = [...stage.requiredDocuments];
                            next[idx] = {
                              ...doc,
                              uploadedBy: e.target.value as RequiredDocument["uploadedBy"],
                            };
                            onUpdate({ requiredDocuments: next });
                          }}
                          className="h-8 rounded-md border border-gray-200 px-2 text-xs"
                        >
                          <option value="customer">Customer</option>
                          <option value="admin">Admin</option>
                          <option value="both">Both</option>
                        </select>
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={doc.required}
                            onChange={(e) => {
                              const next = [...stage.requiredDocuments];
                              next[idx] = { ...doc, required: e.target.checked };
                              onUpdate({ requiredDocuments: next });
                            }}
                            className="h-3 w-3"
                          />
                          Required
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdate({
                              requiredDocuments: stage.requiredDocuments.filter(
                                (d) => d.docId !== doc.docId
                              ),
                            })
                          }
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Approval step */}
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <ToggleSwitch
                checked={stage.requiresApproval}
                onChange={(checked) =>
                  onUpdate({ requiresApproval: checked, approvalRequired: checked })
                }
              />
              <span className="text-sm text-gray-600">Requires approval before next stage</span>
            </div>
            {stage.requiresApproval && (
              <Input
                value={stage.approvalLabel}
                onChange={(e) => onUpdate({ approvalLabel: e.target.value })}
                placeholder="e.g. Manager approval required"
                className="mt-2 h-8 text-xs"
              />
            )}
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
      stages: [...phase.stages, defaultStage(next)],
    });
  };

  const setAllStageOptions = (open: boolean) => {
    onUpdate({
      stages: phase.stages.map((s) => ({ ...s, _expanded: open })),
    });
  };

  const stageCount = phase.stages.length;

  return (
    <div ref={setNodeRef} style={style} className="mb-4 overflow-hidden rounded-xl border-2 border-emerald-100 bg-white shadow-sm">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onUpdate({ _expanded: !phase._expanded })}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onUpdate({ _expanded: !phase._expanded });
          }
        }}
        className="flex cursor-pointer items-center gap-2 bg-emerald-50 px-3 py-3 sm:gap-3 sm:px-4"
      >
        <span
          className="cursor-grab text-emerald-400 hover:text-emerald-600 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </span>
        <Layers className="hidden h-5 w-5 shrink-0 text-emerald-600 sm:block" />
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
          Phase {phase.order}
        </span>
        <Input
          value={phase.name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold shadow-none focus-visible:bg-white focus-visible:ring-0 sm:text-base"
        />
        <span className="shrink-0 text-xs text-emerald-700/80">
          {stageCount} stage{stageCount === 1 ? "" : "s"}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-gray-500 transition-transform", phase._expanded && "rotate-180")}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete phase "${phase.name}"?`)) onDelete();
          }}
          className="shrink-0 rounded-md p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {phase._expanded && (
        <div className="border-t p-3 sm:p-4">
          {stageCount > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAllStageOptions(true)}
                className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Show all options
              </button>
              <button
                type="button"
                onClick={() => setAllStageOptions(false)}
                className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Hide all options
              </button>
            </div>
          )}
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
  const [previewOpen, setPreviewOpen] = useState(false);
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
            .map((s) => normalizeStageFromApi({ ...s, tasks: s.tasks || [], _expanded: false })),
        }));
      } else if (workflowData.stages?.length) {
        loaded = [
          {
            phaseId: "phase_legacy",
            name: "Workflow",
            order: 1,
            _expanded: true,
            stages: workflowData.stages.map((s) =>
              normalizeStageFromApi({ ...s, tasks: s.tasks || [], _expanded: false })
            ),
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
              approvalRequired: rest.requiresApproval,
              stageColor: rest.color,
              stageIcon: rest.icon,
              requiredDocuments: rest.requiredDocuments.map((d) => ({
                docId: d.docId,
                label: d.label,
                uploadedBy: d.uploadedBy,
                required: d.required,
              })),
              tasks: rest.tasks.map((t) => ({
                taskId: t.taskId,
                name: t.name,
                assignedRole: t.assignedRole,
                docRequired: t.docRequired,
                customerUploadPolicy: t.customerUploadPolicy,
                teamUploadPolicy: t.teamUploadPolicy,
                mediaUploadPolicy: t.mediaUploadPolicy,
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
    <div className="flex gap-0">
      <div className="min-w-0 flex-1">
      <div className="sticky top-0 z-10 -mx-1 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/95 px-1 py-3 backdrop-blur sm:top-0">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Workflow builder</h1>
          <p className="text-xs text-gray-500 sm:text-sm">
            Set <strong>File uploads</strong> per work item (default Off). Use <strong>Options</strong> for icon &amp; approval only.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen((o) => !o)}>
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
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

      {previewOpen && (
        <WorkflowPreviewPanel phases={phases} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}
