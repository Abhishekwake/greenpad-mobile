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

export type ProjectPhase = {
  phaseId: string;
  name: string;
  order: number;
  stages: ProjectStage[];
};

export type CustomerView = {
  currentPhase: string | null;
  currentStage: string | null;
  currentWork: string | null;
  assignedTeam: string | null;
  status: string;
  statusLabel: string;
  isDelayed: boolean;
  delayReason: string | null;
  delayExpectedDate: string | null;
};

export type MyProject = {
  projectId: string;
  customerName: string;
  address: string;
  status: string;
  phases: ProjectPhase[];
  stages: ProjectStage[];
  customerView: CustomerView;
};

type ProjectApiPayload = {
  _id: string;
  customerName?: string;
  address?: string;
  status?: string;
  phases?: ProjectPhase[];
  stages?: ProjectStage[];
  customerView?: CustomerView;
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
      phases: raw.phases ?? [],
      stages: raw.stages ?? [],
      customerView: raw.customerView ?? {
        currentPhase: null,
        currentStage: null,
        currentWork: null,
        assignedTeam: null,
        status: 'pending',
        statusLabel: 'Waiting',
        isDelayed: false,
        delayReason: null,
        delayExpectedDate: null,
      },
    };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

/** @deprecated Use fetchMyProject */
export const getMyProject = () => api.get('/project/my-project');
