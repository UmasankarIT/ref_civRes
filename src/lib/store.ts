import {
  Category,
  Issue,
  IssueReport,
  Department,
  AppNotification,
  ProofOfWork,
  AuditLogEntry,
} from './types';
import { calculatePriorityScore } from './scoring';
import { DEFAULT_DEPARTMENTS } from './departments';

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
    responsibleDepartment: 'Drainage, Sewerage & Stormwater',
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
    responsibleDepartment: 'Water Supply & Sanitation',
    iconName: 'Waves',
  },
  {
    id: 'cat-others',
    code: 'OTHERS',
    name: 'Other Civic Issue',
    description: 'Any other civic infrastructure problem not covered by the categories above',
    baseSeverityWeight: 1.0,
    defaultSlaHours: 72,
    responsibleDepartment: 'Triage & Unassigned',
    iconName: 'HelpCircle',
  },
];

// The in-memory store is intentionally empty on first load.
// Citizen reports and municipal updates are added at runtime via the API.
class CivicStore {
  private categories: Category[] = [...INITIAL_CATEGORIES];
  private issues: Issue[] = [];
  private reports: IssueReport[] = [];
  private departments: Department[] = DEFAULT_DEPARTMENTS.map((d) => ({ ...d }));
  private notifications: AppNotification[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private upvoteKeys = new Set<string>(); // `${userId}:${issueId}` — unique constraint
  private proofOfWork: ProofOfWork[] = [];

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

    if (!issue.reports) issue.reports = [];
    issue.reports.push(report);

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

  // --- RBAC: upvote uniqueness (1 citizen = 1 upvote per report) ---
  hasUpvoted(userId: string, issueId: string): boolean {
    return this.upvoteKeys.has(`${userId}:${issueId}`);
  }

  recordUpvote(userId: string, issueId: string): boolean {
    const key = `${userId}:${issueId}`;
    if (this.upvoteKeys.has(key)) return false;
    this.upvoteKeys.add(key);
    return true;
  }

  // --- Departments (dynamic catalog; admin CRUD) ---
  getDepartments(): Department[] {
    return [...this.departments].sort((a, b) => a.name.localeCompare(b.name));
  }

  getDepartmentById(id: string): Department | undefined {
    const found = this.departments.find(
      (d) => d.id === id || d.code.toLowerCase() === String(id).toLowerCase()
    );
    if (found) return found;
    return DEFAULT_DEPARTMENTS.find((d) => d.id === id || d.code === id);
  }

  upsertDepartment(dept: Department): Department {
    const idx = this.departments.findIndex((d) => d.id === dept.id);
    if (idx >= 0) {
      this.departments[idx] = dept;
      return this.departments[idx];
    }
    this.departments.push(dept);
    return dept;
  }

  // --- Scoped queries (department isolation at the data layer) ---
  getIssuesForCitizen(userId: string): Issue[] {
    return this.getIssues().filter((i) => i.citizenUserId === userId);
  }

  getIssuesForDepartment(departmentId: string): Issue[] {
    return this.getIssues().filter(
      (i) => i.departmentId === departmentId && i.status !== 'merged' && i.status !== 'rejected'
    );
  }

  getAssignableForDepartment(departmentId: string): Issue[] {
    return this.getIssuesForDepartment(departmentId).filter(
      (i) => i.status === 'assigned' || i.status === 'in_progress'
    );
  }

  // --- Proof of work ---
  addProofOfWork(proof: ProofOfWork): Issue | null {
    const issue = this.getIssueById(proof.issueId);
    if (!issue) return null;
    this.proofOfWork.push(proof);
    issue.proof = proof;
    issue.updatedAt = new Date().toISOString();
    return issue;
  }

  // --- Dispatch reassign requests ---
  requestReassign(
    issueId: string,
    req: { byDepartment: string; reason: string; at: string }
  ): Issue | null {
    const issue = this.getIssueById(issueId);
    if (!issue) return null;
    issue.reassignRequest = req;
    issue.updatedAt = new Date().toISOString();
    return issue;
  }

  // --- Merger (MERGED_DUPLICATE) ---
  mergeIssue(secondaryId: string, primaryId: string): boolean {
    const secondary = this.getIssueById(secondaryId);
    const primary = this.getIssueById(primaryId);
    if (!secondary || !primary || secondaryId === primaryId) return false;
    secondary.status = 'merged';
    secondary.mergedIntoId = primaryId;
    secondary.updatedAt = new Date().toISOString();
    primary.reportCount += 1;
    primary.updatedAt = new Date().toISOString();
    return true;
  }

  updateIssueStatus(
    issueId: string,
    params: {
      status: Issue['status'];
      assignedWorkerName?: string;
      assignedDepartment?: string;
      departmentId?: string;
      resolutionNotes?: string;
      resolutionProofUrl?: string;
      jurisdictionCode?: string;
    }
  ): Issue | null {
    const issue = this.getIssueById(issueId);
    if (!issue) return null;

    issue.status = params.status;
    if (params.assignedWorkerName !== undefined) issue.assignedWorkerName = params.assignedWorkerName;
    if (params.assignedDepartment !== undefined) issue.assignedDepartment = params.assignedDepartment;
    if (params.departmentId !== undefined) issue.departmentId = params.departmentId;
    if (params.jurisdictionCode !== undefined) issue.jurisdictionCode = params.jurisdictionCode;
    if (params.resolutionNotes !== undefined) issue.resolutionNotes = params.resolutionNotes;
    if (params.resolutionProofUrl !== undefined) issue.resolutionProofUrl = params.resolutionProofUrl;

    if (params.status === 'verified' && !issue.verifiedAt) {
      issue.verifiedAt = new Date().toISOString();
    }

    if (params.status === 'assigned') {
      const dept = this.getDepartmentById(issue.departmentId || '');
      const slaHours = dept?.slaHours ?? issue.category.defaultSlaHours ?? 72;
      issue.slaDeadlineAt = new Date(Date.now() + slaHours * 3600_000).toISOString();
    }

    if (params.status === 'resolved') {
      issue.resolvedAt = new Date().toISOString();
    }

    issue.updatedAt = new Date().toISOString();
    return issue;
  }

  // --- Notifications ---
  pushNotification(n: AppNotification): void {
    this.notifications.unshift(n);
    if (this.notifications.length > 100) this.notifications.pop();
  }

  getNotificationsForUser(userId: string): AppNotification[] {
    return this.notifications.filter((n) => n.userId === userId);
  }

  markNotificationsRead(userId: string): void {
    this.notifications.forEach((n) => {
      if (n.userId === userId) n.read = true;
    });
  }

  // --- Audit log (append-only) ---
  addAuditLog(entry: AuditLogEntry): void {
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 200) this.auditLogs.pop();
  }

  getAuditLogs(limit = 50): AuditLogEntry[] {
    return this.auditLogs.slice(0, limit);
  }
}

// Global singleton instance across API routes
const globalForStore = globalThis as unknown as { civicStore: CivicStore };
export const civicStore = globalForStore.civicStore || new CivicStore();
if (process.env.NODE_ENV !== 'production') globalForStore.civicStore = civicStore;