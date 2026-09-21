export type UserRole = 'citizen' | 'municipal_staff' | 'department_admin' | 'super_admin';

export type IssueStatus = 
  | 'reported' 
  | 'in_review' 
  | 'verified' 
  | 'assigned' 
  | 'in_progress' 
  | 'resolved' 
  | 'rejected';

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string;
  baseSeverityWeight: number;
  defaultSlaHours: number;
  responsibleDepartment: string;
  iconName: string;
}

export interface MLAnalysis {
  predictedCategory: string;
  categoryConfidence: number;
  estimatedSeverity: number; // 1.0 to 5.0
  isCivicIssue: boolean;
  detectedHazards: string[];
  inferenceLatencyMs: number;
}

export interface ExifMetadata {
  capturedAt?: string;
  hasGps: boolean;
  exifLatitude?: number;
  exifLongitude?: number;
  deltaMeters?: number; // Distance between EXIF GPS and user reported GPS
  isSpoofed?: boolean;
  deviceMake?: string;
  deviceModel?: string;
}

export interface IssueReport {
  id: string;
  issueId: string;
  reporterId?: string;
  reporterName?: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  isOnSite: boolean;
  imageUrl: string;
  citizenNotes?: string;
  exif?: ExifMetadata;
  createdAt: string;
}

export interface Issue {
  id: string;
  categoryId: string;
  category: Category;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  wardId?: string;
  status: IssueStatus;
  assignedWorkerName?: string;
  assignedDepartment?: string;
  reportCount: number;
  communityUpvotes: number;
  mlSeverityScore: number;
  priorityScore: number;
  imageUrl: string;
  resolutionNotes?: string;
  resolutionProofUrl?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  reports?: IssueReport[];
  mlAnalysis?: MLAnalysis;
}

export interface CreateReportRequest {
  categoryId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  isOnSite: boolean;
  imageUrl: string;
  title?: string;
  citizenNotes?: string;
  exif?: ExifMetadata;
}

export interface SubmissionResponse {
  issueId: string;
  isDuplicate: boolean;
  reportCount: number;
  status: IssueStatus;
  priorityScore: number;
  mlAnalysis: MLAnalysis;
  message: string;
}
