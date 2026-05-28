import api from "./api";

export const getProjects = (params?: { status?: string; leadId?: string }) =>
  api.get("/admin/projects", { params });

export const getProject = (id: string) => api.get(`/admin/project/${id}`);

export const createProject = (data: { leadId: string; customerId: string }) =>
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

export const saveWorkflow = (data: any) => api.put("/admin/workflow", data);

export const getRoles = () => api.get("/admin/roles");

export const createRole = (data: { name: string }) => api.post("/admin/role", data);

export const updateRole = (id: string, data: { name: string }) =>
  api.put(`/admin/role/${id}`, data);

export const deleteRole = (id: string) => api.delete(`/admin/role/${id}`);

export const getMyProject = () => api.get("/project/my-project");
