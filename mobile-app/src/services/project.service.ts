import axios from 'axios';
import api from './api';

export type ProjectTask = {
  taskId: string;
  name: string;
  assignedRole: string;
  docRequired: boolean;
  completed: boolean;
};

export type ProjectStage = {
  stageId: string;
  name: string;
  order: number;
  visibleToCustomer: boolean;
  status: 'pending' | 'active' | 'done' | 'delayed';
  delayReason?: string;
  delayExpectedDate?: string;
  tasks: ProjectTask[];
};

export type MyProject = {
  projectId: string;
  customerName: string;
  address: string;
  status: string;
  stages: ProjectStage[];
};

type ProjectApiPayload = {
  _id: string;
  customerName?: string;
  address?: string;
  status?: string;
  stages?: ProjectStage[];
};

/** Normalized fetch — used by Home + MyProject (same react-query key). */
export async function fetchMyProject(): Promise<MyProject | null> {
  try {
    const res = await api.get<{ success: boolean; data: ProjectApiPayload }>('/project/my-project');
    const raw = res.data?.data;
    if (!raw?._id) return null;

    return {
      projectId: raw._id,
      customerName: raw.customerName ?? '',
      address: raw.address ?? '',
      status: raw.status ?? 'active',
      stages: raw.stages ?? [],
    };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

/** @deprecated Use fetchMyProject — kept for any legacy callers expecting axios. */
export const getMyProject = () => api.get('/project/my-project');
