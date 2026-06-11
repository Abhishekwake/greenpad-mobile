"use client";

import { useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, ExternalLink, FileText, Play, Plus, X } from "lucide-react";
import {
  addStageComment,
  addStageDocument,
  adminUpload,
  getDocumentAccessUrl,
  patchStageDocument,
} from "@/lib/projectApi";
import {
  teamUploadEnabled,
  teamUploadRequired,
  taskUploadMode,
  UPLOAD_MODE_LABELS,
} from "@/lib/uploadPolicy";
import { cn } from "@/lib/utils";

export type StageComment = {
  _id?: string;
  text: string;
  createdBy: string;
  createdAt: string;
  isInternal?: boolean;
};

export type RequiredDocumentSlot = {
  docId: string;
  label: string;
  uploadedBy: "customer" | "admin" | "both";
  required: boolean;
};

export type StageDocument = {
  _id: string;
  name: string;
  url?: string;
  docId?: string;
  taskId?: string;
  mimeType?: string;
  hasFile?: boolean;
  uploadedBy: string;
  uploadedAt: string;
  verificationStatus: "pending" | "verified" | "rejected";
  rejectionReason?: string;
};

export type StageMedia = {
  _id?: string;
  type: "image" | "video";
  url: string;
  caption?: string;
  uploadedBy: string;
  uploadedAt: string;
};

type StageExecutionPanelProps = {
  projectId: string;
  stageId: string;
  documentPolicy?: "none" | "optional" | "required";
  requiredDocuments?: RequiredDocumentSlot[];
  tasks: {
    taskId: string;
    name: string;
    docRequired?: boolean;
    customerUploadPolicy?: "none" | "optional" | "required";
    teamUploadPolicy?: "none" | "optional" | "required";
  }[];
  showDocuments?: boolean;
  comments?: StageComment[];
  documents?: StageDocument[];
  media?: StageMedia[];
  onUpdated: () => void;
  onError: (msg: string) => void;
};

const AVATAR_COLORS = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function uploadPolicyBadge(task: StageExecutionPanelProps["tasks"][number]) {
  const mode = taskUploadMode(task);
  if (mode === "off") return null;
  return (
    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
      {UPLOAD_MODE_LABELS[mode]}
    </span>
  );
}

export function StageExecutionPanel({
  projectId,
  stageId,
  documentPolicy = "none",
  requiredDocuments = [],
  tasks,
  showDocuments = false,
  comments = [],
  documents = [],
  media = [],
  onUpdated,
  onError,
}: StageExecutionPanelProps) {
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  const showDocsSection = showDocuments || documents.length > 0 || documentPolicy !== "none";

  const customerDocs = documents.filter(
    (d) => d.uploadedBy === "Customer" || d.uploadedBy?.toLowerCase() === "customer"
  );
  const teamDocs = documents.filter(
    (d) => d.uploadedBy !== "Customer" && d.uploadedBy?.toLowerCase() !== "customer"
  );

  const visibleComments = showAllComments ? comments : comments.slice(-3);

  const missingRequired = requiredDocuments.filter((slot) => {
    if (!slot.required) return false;
    return !documents.some(
      (d) => d.docId === slot.docId && d.verificationStatus !== "rejected"
    );
  });

  const postComment = async () => {
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      await addStageComment(projectId, stageId, {
        text: commentText.trim(),
        isInternal,
      });
      setCommentText("");
      setIsInternal(false);
      onUpdated();
    } catch {
      onError("Failed to post comment");
    } finally {
      setPostingComment(false);
    }
  };

  const handleDocUpload = async (file: File, docId?: string) => {
    setUploadingDoc(true);
    try {
      const uploadRes = await adminUpload(file);
      const payload = uploadRes.data;
      await addStageDocument(projectId, stageId, {
        publicId: payload.publicId || payload.public_id,
        name: file.name,
        docId,
        mimeType: payload.mimeType,
        resourceType: payload.resourceType,
        format: payload.format,
      });
      onUpdated();
    } catch {
      onError("Failed to upload document");
    } finally {
      setUploadingDoc(false);
    }
  };

  const openDocument = async (docId: string) => {
    try {
      const res = await getDocumentAccessUrl(projectId, stageId, docId);
      const url = res.data?.data?.accessUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else onError("Could not open document");
    } catch {
      onError("Could not open document");
    }
  };

  const verifyDoc = async (docId: string) => {
    try {
      await patchStageDocument(projectId, stageId, docId, {
        verificationStatus: "verified",
      });
      onUpdated();
    } catch {
      onError("Failed to verify document");
    }
  };

  const rejectDoc = async (docId: string) => {
    const reason = window.prompt("Rejection reason:");
    if (!reason?.trim()) return;
    try {
      await patchStageDocument(projectId, stageId, docId, {
        verificationStatus: "rejected",
        rejectionReason: reason.trim(),
      });
      onUpdated();
    } catch {
      onError("Failed to reject document");
    }
  };

  const renderDocRow = (doc: StageDocument) => (
    <div
      key={doc._id}
      className="mb-1 flex items-center gap-2 rounded bg-gray-50 p-2 text-xs"
      title={doc.rejectionReason || undefined}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-gray-500" />
      <span className="min-w-0 flex-1 truncate">{doc.name}</span>
      <span
        className={cn(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize",
          doc.verificationStatus === "pending" && "bg-gray-100 text-gray-600",
          doc.verificationStatus === "verified" && "bg-green-50 text-green-700",
          doc.verificationStatus === "rejected" && "bg-red-50 text-red-700"
        )}
      >
        {doc.verificationStatus}
      </span>
      {doc.verificationStatus === "pending" && (
        <>
          <button
            type="button"
            onClick={() => verifyDoc(doc._id)}
            className="shrink-0 text-green-600 hover:text-green-700"
            title="Verify"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => rejectDoc(doc._id)}
            className="shrink-0 text-red-500 hover:text-red-600"
            title="Reject"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      {(doc.hasFile || doc.url) && (
        <button
          type="button"
          onClick={() => void openDocument(doc._id)}
          className="shrink-0 text-gray-500 hover:text-gray-700"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <>
      {tasks.some((t) => uploadPolicyBadge(t)) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tasks.map((task) => {
            const badge = uploadPolicyBadge(task);
            if (!badge) return null;
            return (
              <span key={task.taskId} className="inline-flex items-center gap-1 text-xs text-gray-600">
                <span className="font-medium">{task.name}:</span> {badge}
              </span>
            );
          })}
        </div>
      )}

      {documentPolicy === "required" && missingRequired.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Missing required documents: {missingRequired.map((d) => d.label || d.docId).join(", ")}
        </div>
      )}

      {requiredDocuments.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase text-gray-400">Document checklist</p>
          <ul className="mt-1 space-y-1">
            {requiredDocuments.map((slot) => {
              const uploaded = documents.find(
                (d) => d.docId === slot.docId && d.verificationStatus !== "rejected"
              );
              return (
                <li key={slot.docId} className="flex items-center gap-2 text-xs">
                  <span className={uploaded ? "text-green-600" : "text-gray-400"}>
                    {uploaded ? "✓" : "○"}
                  </span>
                  <span className="flex-1">
                    {slot.label || slot.docId}
                    {slot.required && <span className="text-red-500"> *</span>}
                    <span className="ml-1 text-gray-400">({slot.uploadedBy})</span>
                  </span>
                  {!uploaded && (slot.uploadedBy === "admin" || slot.uploadedBy === "both") && (
                    <button
                      type="button"
                      disabled={uploadingDoc}
                      onClick={() => docInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Upload
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Comments */}
      <div className="mt-3">
        <p className="text-xs font-medium uppercase text-gray-400">Comments</p>
        {comments.length > 0 && (
          <div className="mt-1">
            {visibleComments.map((c, i) => (
              <div key={c._id || i} className="flex gap-2 py-1 text-xs">
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                    avatarColor(c.createdBy)
                  )}
                >
                  {initials(c.createdBy)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-gray-800">{c.createdBy}</span>
                    <span className="text-gray-400">
                      {c.createdAt
                        ? formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })
                        : ""}
                    </span>
                    {c.isInternal && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                        Internal
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600">{c.text}</p>
                </div>
              </div>
            ))}
            {comments.length > 3 && !showAllComments && (
              <button
                type="button"
                onClick={() => setShowAllComments(true)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Show all ({comments.length})
              </button>
            )}
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a note..."
            className="h-8 flex-1 rounded-md border border-gray-200 px-2 text-xs"
            onKeyDown={(e) => e.key === "Enter" && postComment()}
          />
          <label className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="h-3 w-3"
            />
            Internal only
          </label>
          <button
            type="button"
            disabled={postingComment || !commentText.trim()}
            onClick={postComment}
            className="shrink-0 text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
          >
            {postingComment ? "…" : "Post"}
          </button>
        </div>
      </div>

      {/* Documents */}
      {showDocsSection && (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase text-gray-400">
              Files
              {tasks.some((t) => teamUploadEnabled(t)) && (
                <span className="ml-1 font-normal normal-case text-gray-500">
                  (team uploads per work item)
                </span>
              )}
            </p>
            <button
              type="button"
              disabled={uploadingDoc}
              onClick={() => docInputRef.current?.click()}
              className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {uploadingDoc ? "Uploading…" : "Upload"}
            </button>
            <input
              ref={docInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleDocUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          {customerDocs.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-medium uppercase text-gray-400">Customer uploads</p>
              {customerDocs.map(renderDocRow)}
            </div>
          )}

          {teamDocs.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-medium uppercase text-gray-400">Team uploads</p>
              {teamDocs.map(renderDocRow)}
            </div>
          )}

          {documents.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">No documents yet</p>
          )}
        </div>
      )}

      {media.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase text-gray-400">Photos &amp; media</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {media.map((item, i) => (
              <div key={item._id || i}>
                {item.type === "video" ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex aspect-square items-center justify-center rounded-lg bg-gray-900"
                  >
                    <Play className="h-8 w-8 text-white" />
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.caption || "Stage media"}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export { teamUploadRequired };
