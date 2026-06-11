import axios from 'axios';
import api from './api';

export type RequiredDocumentSlot = {
  docId: string;
  label: string;
  uploadedBy: 'customer' | 'admin' | 'both';
  required: boolean;
};

export type ProjectTask = {
  taskId: string;
  name: string;
  assignedRole: string;
  docRequired: boolean;
  customerUploadPolicy?: 'none' | 'optional' | 'required';
  teamUploadPolicy?: 'none' | 'optional' | 'required';
  mediaUploadPolicy?: 'none' | 'optional' | 'required';
  completed: boolean;
  documents?: Array<{ url: string; name?: string; uploadedAt?: string }>;
};

export type ProjectDocument = {
  _id?: string;
  name: string;
  url?: string;
  docId?: string;
  taskId?: string;
  mimeType?: string;
  hasFile?: boolean;
  uploadedBy?: string;
  uploadedAt?: string;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
};

export type ProjectStage = {
  stageId: string;
  name: string;
  order: number;
  visibleToCustomer: boolean;
  documentPolicy?: 'none' | 'optional' | 'required';
  requiredDocuments?: RequiredDocumentSlot[];
  status: 'pending' | 'active' | 'done' | 'delayed';
  delayReason?: string;
  delayExpectedDate?: string;
  tasks: ProjectTask[];
  documents?: ProjectDocument[];
};

export type ProjectPhase = {
  phaseId: string;
  name: string;
  order: number;
  stages: ProjectStage[];
};

export type CustomerView = {
  currentStageId?: string | null;
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

export type ProjectFeatures = {
  customerDocumentsEnabled: boolean;
  internalDocumentsEnabled?: boolean;
  reelsEnabled?: boolean;
};

export type MyProject = {
  projectId: string;
  customerName: string;
  address: string;
  status: string;
  currentStageId?: string;
  phases: ProjectPhase[];
  stages: ProjectStage[];
  customerView: CustomerView;
  features?: ProjectFeatures;
};

type ProjectApiPayload = {
  _id: string;
  customerName?: string;
  address?: string;
  status?: string;
  currentStageId?: string;
  phases?: ProjectPhase[];
  stages?: ProjectStage[];
  customerView?: CustomerView;
  features?: ProjectFeatures;
};

export type UploadFileResult = {
  publicId: string;
  resourceType: string;
  format?: string;
  mimeType: string;
  bytes: number;
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
      currentStageId: raw.currentStageId ?? raw.customerView?.currentStageId ?? undefined,
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
      features: raw.features,
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

export async function uploadProjectFile(base64: string, mimeType = 'image/jpeg'): Promise<UploadFileResult> {
  const res = await api.post<{
    success: boolean;
    publicId: string;
    public_id: string;
    resourceType: string;
    format?: string;
    mimeType: string;
    bytes: number;
    message?: string;
  }>('/project/upload', { file: base64, mimeType });

  const publicId = res.data.publicId || res.data.public_id;
  if (!publicId) {
    throw new Error(res.data.message || 'Upload failed — no file reference returned');
  }

  return {
    publicId,
    resourceType: res.data.resourceType,
    format: res.data.format,
    mimeType: res.data.mimeType,
    bytes: res.data.bytes,
  };
}

export async function uploadStageDocument(
  projectId: string,
  stageId: string,
  data: {
    name: string;
    publicId: string;
    docId?: string;
    taskId?: string;
    mimeType?: string;
    resourceType?: string;
    format?: string;
  }
) {
  const res = await api.post(`/project/${projectId}/stage/${stageId}/document`, data);
  return res.data;
}

export async function getDocumentAccessUrl(
  projectId: string,
  stageId: string,
  docId: string
): Promise<string> {
  const res = await api.get<{ success: boolean; data: { accessUrl: string } }>(
    `/project/${projectId}/stage/${stageId}/document/${docId}/access`
  );
  return res.data.data.accessUrl;
}
