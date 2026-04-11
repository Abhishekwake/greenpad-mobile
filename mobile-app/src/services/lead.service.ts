import api from './api';

export type LeadType = 'self' | 'referral';

export interface Lead {
  _id: string;
  leadType?: LeadType;
  relationshipNote?: string;
  name: string;
  phone: string;
  address: string;
  propertyType: string;
  roofArea: number;
  preferredDate: string;
  timeSlot: string;
  notes?: string;
  status: string;
  createdAt: string;
}

interface CreateLeadPayload {
  name: string;
  phone: string;
  address: string;
  propertyType: string;
  roofArea: number;
  preferredDate: string;
  timeSlot: string;
  notes?: string;
  leadType: LeadType;
  relationshipNote?: string;
}

interface CreateLeadResponse {
  success: boolean;
  message: string;
  data: {
    lead: Lead;
    coinsEarned: number;
    totalCoins: number;
  };
}

export const leadService = {
  createLead: async (payload: CreateLeadPayload): Promise<CreateLeadResponse> => {
    const response = await api.post<CreateLeadResponse>('/lead/create', payload);
    return response.data;
  },

  getMyLeads: async (): Promise<Lead[]> => {
    const response = await api.get<{ success: boolean; data: Lead[] }>(
      '/lead/my-leads'
    );
    return response.data.data;
  },

  rescheduleLead: async (
    id: string,
    data: { preferredDate: string; timeSlot?: string }
  ): Promise<Lead> => {
    const response = await api.put<{ success: boolean; data: Lead }>(
      `/lead/${id}/reschedule`,
      data
    );
    return response.data.data;
  },

  cancelLead: async (id: string): Promise<Lead> => {
    const response = await api.put<{ success: boolean; data: Lead }>(
      `/lead/${id}/cancel`
    );
    return response.data.data;
  },
};

export default leadService;
