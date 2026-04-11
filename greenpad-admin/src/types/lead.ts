export type LeadUserRef = {
  _id?: string;
  name?: string;
  phone?: string;
  referralCode?: string;
};

export type LeadAgentRef = {
  _id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
};

export type LeadRow = {
  _id: string;
  name: string;
  phone: string;
  propertyType?: string;
  preferredDate?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  address?: string;
  roofArea?: number;
  timeSlot?: string;
  notes?: string;
  leadType?: string;
  relationshipNote?: string;
  assignedTo?: string | null;
  /** Field team member from Team directory */
  assignedAgent?: LeadAgentRef | null;
  userId?: string | LeadUserRef;
};
