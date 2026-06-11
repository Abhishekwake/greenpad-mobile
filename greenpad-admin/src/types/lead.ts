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

export type LeadSource = "mobile" | "manual" | "walk_in" | "referral";

export type FollowUpStatus = "called" | "no_answer" | "callback" | "meeting_set";

export type LeadFollowUp = {
  _id?: string;
  note: string;
  status: FollowUpStatus;
  nextFollowUpDate?: string;
  createdBy?: string;
  createdAt: string;
};

export type LeadRow = {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  propertyType?: string;
  preferredDate?: string;
  status: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  createdAt: string;
  updatedAt?: string;
  address?: string;
  roofArea?: number;
  timeSlot?: string;
  notes?: string;
  leadType?: string;
  relationshipNote?: string;
  source?: LeadSource;
  followUps?: LeadFollowUp[];
  nextFollowUpDate?: string;
  lastFollowUpAt?: string;
  createdByAdmin?: string;
  assignedTo?: string | null;
  /** Field team member from Team directory */
  assignedAgent?: LeadAgentRef | null;
  userId?: string | LeadUserRef;
};

export type LeadsSummary = {
  totalLeads: number;
  followUpDueToday: number;
  convertedThisMonth: number;
  lostThisMonth: number;
};
