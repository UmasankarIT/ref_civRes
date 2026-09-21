export type UserRole = 'citizen' | 'municipal_staff' | 'admin';

export type IssueStatus = 'REPORTED' | 'IN_REVIEW' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';

export type CategorySlug = 
  | 'pothole' 
  | 'broken_drainage' 
  | 'sewage' 
  | 'garbage' 
  | 'street_light' 
  | 'road_damage' 
  | 'water_pipeline';

export interface Category {
  id: string;
  slug: CategorySlug;
  name: string;
  description: string;
  baseUrgencyWeight: number; // e.g. 1.0 to 1.6
  slaHours: number;
  iconName: string;
}

export interface IssueReport {
  id: string;
  issueId: string;
  reporterName?: string;
  reporterPhone?: string;
  clientLocation: {
    lat: number;
    lng: number;
  };
  gpsAccuracyMeters?: number;
  isOnSite: boolean;
  rawImageUrl: string;
  compressedImageUrl?: string;
  exifTimestamp?: string;
  exifVerified?: boolean;
  userComment?: string;
  audioVoiceNoteUrl?: string;
  language?: string;
  createdAt: string;
}

export interface CivicIssue {
  id: string;
  trackingNumber: string;
  categoryId: string;
  categorySlug: CategorySlug;
  categoryName: string;
  title: string;
  description: string;
  location: {
    lat: number;
    lng: number;
  };
  addressText: string;
  city: string;
  status: IssueStatus;
  assignedDepartment?: string;
  assignedWorker?: string;
  reportCount: number;
  upvotesCount: number;
  userHasUpvoted?: boolean;
  
  // Google AI Gemini Multimodal Analysis
  mlDetectedCategory: string;
  mlConfidence: number; // 0.0 to 1.0
  mlSeverityScore: number; // 1.0 to 5.0
  mlHazardAssessment: string;
  mlSuggestedRemediation: string;
  isCivicIssue: boolean;
  
  // Dynamic Priority
  priorityScore: number; // 1.000 to 5.000
  priorityBreakdown?: {
    mlSeverityComponent: number;
    reportCountComponent: number;
    upvotesComponent: number;
    urgencyDecayComponent: number;
  };

  // Resolution Details
  resolutionNotes?: string;
  resolutionProofUrl?: string;
  resolvedAt?: string;

  reports: IssueReport[];
  createdAt: string;
  updatedAt: string;
}
