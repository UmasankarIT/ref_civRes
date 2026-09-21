import { Category, Issue, IssueReport } from './types';
import { calculatePriorityScore } from './scoring';

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat-road-pothole',
    code: 'ROAD_POTHOLE',
    name: 'Pothole & Surface Damage',
    description: 'Potholes, asphalt crumbling, and sharp pavement depressions',
    baseSeverityWeight: 1.2,
    defaultSlaHours: 48,
    responsibleDepartment: 'Public Works & Roads Dept',
    iconName: 'Construction',
  },
  {
    id: 'cat-drainage-overflow',
    code: 'DRAINAGE_OVERFLOW',
    name: 'Drainage & Sewage Leak',
    description: 'Open manholes, blocked storm gutters, and raw sewage overflow',
    baseSeverityWeight: 1.4,
    defaultSlaHours: 24,
    responsibleDepartment: 'Water Supply & Sewerage Board',
    iconName: 'Droplets',
  },
  {
    id: 'cat-garbage-dump',
    code: 'GARBAGE_DUMP',
    name: 'Garbage & Solid Waste Pile',
    description: 'Illegal road dumps, overflowing community bins, toxic debris',
    baseSeverityWeight: 1.0,
    defaultSlaHours: 36,
    responsibleDepartment: 'Solid Waste Management Cell',
    iconName: 'Trash2',
  },
  {
    id: 'cat-streetlight-outage',
    code: 'STREETLIGHT_OUTAGE',
    name: 'Broken Streetlight / Dark Spot',
    description: 'Non-functional lamps, dangling cables, and hazardous dark zones',
    baseSeverityWeight: 0.85,
    defaultSlaHours: 72,
    responsibleDepartment: 'Electrical & Street Lighting Cell',
    iconName: 'Lightbulb',
  },
  {
    id: 'cat-water-burst',
    code: 'WATER_SUPPLY_BURST',
    name: 'Clean Water Pipeline Burst',
    description: 'High-pressure clean water line rupture flooding road corridors',
    baseSeverityWeight: 1.5,
    defaultSlaHours: 12,
    responsibleDepartment: 'Water Supply & Sewerage Board',
    iconName: 'Waves',
  },
  {
    id: 'cat-others',
    code: 'OTHERS',
    name: 'Other Civic Issue',
    description: 'Any other civic infrastructure problem not covered by the categories above',
    baseSeverityWeight: 1.0,
    defaultSlaHours: 72,
    responsibleDepartment: 'General Municipal Cell',
    iconName: 'HelpCircle',
  },
];

// The in-memory store is intentionally empty on first load.
// Citizen reports and municipal updates are added at runtime via the API.
class CivicStore {
  private categories: Category[] = [...INITIAL_CATEGORIES];
  private issues: Issue[] = [];
  private reports: IssueReport[] = [];

  getCategories(): Category[] {
    return this.categories;
  }

  getCategoryById(id: string): Category | undefined {
    return this.categories.find((c) => c.id === id || c.code === id);
  }

  getIssues(): Issue[] {
    // Return sorted by priority score descending
    return [...this.issues].sort((a, b) => b.priorityScore - a.priorityScore);
  }

  getIssueById(id: string): Issue | undefined {
    return this.issues.find((i) => i.id === id);
  }

  addIssue(issue: Issue): Issue {
    this.issues.unshift(issue);
    return issue;
  }

  addReport(report: IssueReport): IssueReport {
    this.reports.push(report);
    return report;
  }

  incrementIssueReport(issueId: string, report: IssueReport): Issue | null {
    const issue = this.getIssueById(issueId);
    if (!issue) return null;

    issue.reportCount += 1;
    issue.updatedAt = new Date().toISOString();
    
    // Add report to list
    if (!issue.reports) issue.reports = [];
    issue.reports.push(report);

    // Recalculate priority
    const breakdown = calculatePriorityScore({
      mlSeverity: issue.mlSeverityScore,
      reportCount: issue.reportCount,
      communityUpvotes: issue.communityUpvotes,
      createdAt: issue.createdAt,
    });
    issue.priorityScore = breakdown.totalScore;

    return issue;
  }

  upvoteIssue(issueId: string): Issue | null {
    const issue = this.getIssueById(issueId);
    if (!issue) return null;

    issue.communityUpvotes += 1;
    issue.updatedAt = new Date().toISOString();

    const breakdown = calculatePriorityScore({
      mlSeverity: issue.mlSeverityScore,
      reportCount: issue.reportCount,
      communityUpvotes: issue.communityUpvotes,
      createdAt: issue.createdAt,
    });
    issue.priorityScore = breakdown.totalScore;

    return issue;
  }

  updateIssueStatus(
    issueId: string,
    params: {
      status: Issue['status'];
      assignedWorkerName?: string;
      assignedDepartment?: string;
      resolutionNotes?: string;
      resolutionProofUrl?: string;
    }
  ): Issue | null {
    const issue = this.getIssueById(issueId);
    if (!issue) return null;

    issue.status = params.status;
    if (params.assignedWorkerName !== undefined) issue.assignedWorkerName = params.assignedWorkerName;
    if (params.assignedDepartment !== undefined) issue.assignedDepartment = params.assignedDepartment;
    if (params.resolutionNotes !== undefined) issue.resolutionNotes = params.resolutionNotes;
    if (params.resolutionProofUrl !== undefined) issue.resolutionProofUrl = params.resolutionProofUrl;

    if (params.status === 'resolved') {
      issue.resolvedAt = new Date().toISOString();
    }

    issue.updatedAt = new Date().toISOString();
    return issue;
  }
}

// Global singleton instance across API routes
const globalForStore = globalThis as unknown as { civicStore: CivicStore };
export const civicStore = globalForStore.civicStore || new CivicStore();
if (process.env.NODE_ENV !== 'production') globalForStore.civicStore = civicStore;
