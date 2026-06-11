import api from "./api";

export type ProjectListView = "active" | "completed" | "voided" | "all";

export const getProjects = (params?: {
  status?: string;
  leadId?: string;
  view?: ProjectListView;
}) => api.get("/admin/projects", { params });

/** Create installation project from a converted lead (manual + app leads). */
export const createProjectFromLead = (leadId: string) =>
  api.post(`/admin/lead/${leadId}/create-project`, {});

export const voidProject = (id: string, reason: string) =>
  api.post(`/admin/project/${id}/void`, { reason });

export const voidLead = (id: string, reason: string) =>
  api.post(`/admin/lead/${id}/void`, { reason });

export const getProject = (id: string) => api.get(`/admin/project/${id}`);

/** @deprecated Prefer createProjectFromLead for admin (supports manual leads) */
export const createProject = (data: { leadId: string; customerId?: string }) =>
  api.post("/project/create", data);

export const updateProjectStage = (
  id: string,
  data: {
    stageId: string;
    status: string;
    delayReason?: string;
    delayExpectedDate?: string;
  }
) => api.patch(`/admin/project/${id}/stage`, data);

export const getWorkflow = () => api.get("/admin/workflow");

export const saveWorkflow = (data: unknown) => api.put("/admin/workflow", data);

export const getRoles = () => api.get("/admin/roles");

export const createRole = (data: { name: string }) => api.post("/admin/role", data);

export const updateRole = (id: string, data: { name: string }) =>
  api.put(`/admin/role/${id}`, data);

export const deleteRole = (id: string) => api.delete(`/admin/role/${id}`);

export const updateProjectTask = (
  id: string,
  data: {
    stageId: string;
    taskId: string;
    completed?: boolean;
    name?: string;
    assignedRole?: string;
    docRequired?: boolean;
  }
) => api.patch(`/admin/project/${id}/task`, data);

export const addProjectTask = (
  id: string,
  data: { stageId: string; name: string; assignedRole?: string; docRequired?: boolean }
) => api.post(`/admin/project/${id}/task`, data);

export const deleteProjectTask = (
  id: string,
  data: { stageId: string; taskId: string }
) => api.delete(`/admin/project/${id}/task`, { data });

export const adminUpload = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post<{
    success: boolean;
    publicId: string;
    public_id: string;
    resourceType: string;
    format?: string;
    mimeType: string;
    bytes: number;
  }>("/admin/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const getDocumentAccessUrl = (projectId: string, stageId: string, docId: string) =>
  api.get<{ success: boolean; data: { accessUrl: string } }>(
    `/admin/project/${projectId}/stage/${stageId}/document/${docId}/access`
  );

export const approveProjectStage = (id: string, stageId: string) =>
  api.patch(`/admin/project/${id}/stage/${stageId}/approve`);

export const addStageComment = (
  id: string,
  stageId: string,
  data: { text: string; isInternal?: boolean; createdBy?: string }
) => api.post(`/admin/project/${id}/stage/${stageId}/comment`, data);

export const addStageDocument = (
  id: string,
  stageId: string,
  data: {
    publicId: string;
    name?: string;
    uploadedBy?: string;
    docId?: string;
    taskId?: string;
    mimeType?: string;
    resourceType?: string;
    format?: string;
  }
) => api.post(`/admin/project/${id}/stage/${stageId}/document`, data);

export const patchStageDocument = (
  id: string,
  stageId: string,
  docId: string,
  data: { verificationStatus: "pending" | "verified" | "rejected"; rejectionReason?: string }
) => api.patch(`/admin/project/${id}/stage/${stageId}/document/${docId}`, data);

export const addStageMedia = (
  id: string,
  stageId: string,
  data: { type: "image" | "video"; url: string; caption?: string; uploadedBy?: string }
) => api.post(`/admin/project/${id}/stage/${stageId}/media`, data);

export const getMyProject = () => api.get("/project/my-project");
