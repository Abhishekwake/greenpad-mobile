"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Film, ImageIcon, Pencil, Plus, Trash2, Video } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type VideoRow = {
  _id: string;
  title: string;
  description?: string;
  location?: string;
  orientation: "vertical" | "horizontal";
  duration?: string;
  sortOrder: number;
  isPublished: boolean;
  cloudinaryUrl?: string;
  thumbnailUrl?: string;
  displayUrl?: string;
  displayThumbnail?: string;
};

function thumbFor(v: VideoRow) {
  return v.displayThumbnail || v.thumbnailUrl || "";
}

export default function ReelsPage() {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Wardha, Maharashtra");
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<VideoRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editOrientation, setEditOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [editDuration, setEditDuration] = useState("0:00");
  const [editPublished, setEditPublished] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["admin-videos"],
    queryFn: async () => {
      const res = await api.get<{ data: VideoRow[] }>("/admin/videos");
      return res.data.data;
    },
  });

  const openEdit = (v: VideoRow) => {
    setEditing(v);
    setEditTitle(v.title);
    setEditDescription(v.description || "");
    setEditLocation(v.location || "");
    setEditOrientation(v.orientation);
    setEditDuration(v.duration || "0:00");
    setEditPublished(v.isPublished);
    setEditOpen(true);
  };

  useEffect(() => {
    if (!editOpen) setEditing(null);
  }, [editOpen]);

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/admin/videos", { title, description, location, orientation });
    },
    onSuccess: () => {
      success("Reel created — upload video and cover below");
      setTitle("");
      setDescription("");
      void qc.invalidateQueries({ queryKey: ["admin-videos"] });
    },
    onError: (err) => {
      error(axios.isAxiosError(err) ? String(err.response?.data?.message) : "Create failed");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await api.put(`/admin/videos/${editing._id}`, {
        title: editTitle.trim(),
        description: editDescription,
        location: editLocation,
        orientation: editOrientation,
        duration: editDuration.trim() || "0:00",
        isPublished: editPublished,
      });
    },
    onSuccess: () => {
      success("Reel updated");
      setEditOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin-videos"] });
    },
    onError: (err) => {
      error(axios.isAxiosError(err) ? String(err.response?.data?.message) : "Update failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/videos/${id}`);
    },
    onSuccess: () => {
      success("Reel deleted");
      void qc.invalidateQueries({ queryKey: ["admin-videos"] });
    },
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      await api.put(`/admin/videos/${id}`, { isPublished });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-videos"] }),
  });

  const uploadFile = async (id: string, file: File, kind: "video" | "thumbnail") => {
    setUploadingId(`${kind}-${id}`);
    const form = new FormData();
    form.append("file", file);
    const path = kind === "video" ? `/admin/videos/${id}/upload` : `/admin/videos/${id}/thumbnail`;
    try {
      await api.post(path, form, { headers: { "Content-Type": "multipart/form-data" } });
      success(kind === "video" ? "Video uploaded" : "Cover image updated");
      void qc.invalidateQueries({ queryKey: ["admin-videos"] });
    } catch (err) {
      error(axios.isAxiosError(err) ? String(err.response?.data?.message) : "Upload failed");
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Reels</h2>
        <p className="text-sm text-gray-500">
          Manage installation videos on the mobile home carousel. Upload a video file and an optional cover image.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> New reel
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Site visit highlights" />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Orientation</Label>
            <Select value={orientation} onValueChange={(v) => setOrientation(v as "vertical" | "horizontal")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vertical">Vertical (reels)</SelectItem>
                <SelectItem value="horizontal">Horizontal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              disabled={!title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create reel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Film className="h-4 w-4" /> All reels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
          ) : videos.length === 0 ? (
            <p className="text-sm text-gray-500">No reels yet.</p>
          ) : (
            videos.map((v) => {
              const thumb = thumbFor(v);
              const hasVideo = Boolean(v.cloudinaryUrl || v.displayUrl);
              const isVertical = v.orientation === "vertical";
              return (
                <div
                  key={v._id}
                  className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row"
                >
                  <div
                    className={cn(
                      "relative shrink-0 overflow-hidden rounded-lg bg-gray-100",
                      isVertical ? "h-36 w-24 sm:h-44 sm:w-28" : "h-24 w-40 sm:h-28 sm:w-48"
                    )}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-400">
                        <ImageIcon className="h-6 w-6" />
                        <span className="text-[10px]">No cover</span>
                      </div>
                    )}
                    {!hasVideo && (
                      <span className="absolute bottom-1 left-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        No video
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{v.title}</p>
                        <p className="text-sm text-gray-500 line-clamp-2">{v.description || "—"}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {v.location || "—"} · {v.orientation} · {v.duration || "0:00"} ·{" "}
                          <span className={v.isPublished ? "text-emerald-600" : "text-gray-500"}>
                            {v.isPublished ? "Published" : "Draft"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(v)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <label
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50",
                          uploadingId === `video-${v._id}` && "pointer-events-none opacity-60"
                        )}
                      >
                        <Video className="h-3.5 w-3.5" />
                        {uploadingId === `video-${v._id}` ? "Uploading…" : "Video"}
                        <input
                          type="file"
                          accept="video/mp4,video/quicktime,video/webm"
                          className="hidden"
                          disabled={Boolean(uploadingId)}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadFile(v._id, f, "video");
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <label
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50",
                          uploadingId === `thumbnail-${v._id}` && "pointer-events-none opacity-60"
                        )}
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        {uploadingId === `thumbnail-${v._id}` ? "Uploading…" : "Cover"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={Boolean(uploadingId)}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadFile(v._id, f, "thumbnail");
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => togglePublish.mutate({ id: v._id, isPublished: !v.isPublished })}
                      >
                        {v.isPublished ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (window.confirm(`Delete "${v.title}"?`)) deleteMutation.mutate(v._id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit reel</DialogTitle>
            <DialogDescription>Update details shown in the app. Video and cover are uploaded separately.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Orientation</Label>
                <Select
                  value={editOrientation}
                  onValueChange={(val) => setEditOrientation(val as "vertical" | "horizontal")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vertical">Vertical</SelectItem>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Duration (m:ss)</Label>
                <Input
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  placeholder="3:15"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editPublished}
                onChange={(e) => setEditPublished(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Published on mobile app
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!editTitle.trim() || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
