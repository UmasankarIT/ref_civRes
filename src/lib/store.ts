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
];

// Seed incidents situated in an urban center (Bengaluru civic hub)
const SEED_ISSUES: Issue[] = [
  {
    id: 'iss-101',
    categoryId: 'cat-road-pothole',
    category: INITIAL_CATEGORIES[0],
    title: 'Severe Deep Crater on Main Carriageway',
    description: 'A 1.5-foot deep pothole causing vehicle tire bursts and severe traffic backlog during peak hours.',
    latitude: 12.9716,
    longitude: 77.5946,
    formattedAddress: 'Near Cubbon Park Metro Gate 2, Kasturba Road',
    status: 'in_progress',
    assignedWorkerName: 'Rajesh Kumar (Roads Squad 4)',
    assignedDepartment: 'Public Works & Roads Dept',
    reportCount: 8,
    communityUpvotes: 19,
    mlSeverityScore: 4.2,
    priorityScore: 3.42,
    imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    reports: [],
    mlAnalysis: {
      predictedCategory: 'ROAD_POTHOLE',
      categoryConfidence: 0.95,
      estimatedSeverity: 4.2,
      isCivicIssue: true,
      detectedHazards: ['wheel_damage_risk', 'traffic_bottleneck', 'accident_prone'],
      inferenceLatencyMs: 210,
    },
  },
  {
    id: 'iss-102',
    categoryId: 'cat-drainage-overflow',
    category: INITIAL_CATEGORIES[1],
    title: 'Sewage Overflowing onto Pedestrian Sidewalk',
    description: 'Stormwater manhole clogged with silt, discharging foul water across the pedestrian pathway.',
    latitude: 12.9742,
    longitude: 77.5982,
    formattedAddress: 'Cross Junction 3, MG Road Promenade',
    status: 'assigned',
    assignedWorkerName: 'Anil Sharma (Sanitation Wing)',
    assignedDepartment: 'Water Supply & Sewerage Board',
    reportCount: 5,
    communityUpvotes: 14,
    mlSeverityScore: 4.5,
    priorityScore: 3.38,
    imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f7?auto=format&fit=crop&w=800&q=80',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    reports: [],
  },
  {
    id: 'iss-103',
    categoryId: 'cat-garbage-dump',
    category: INITIAL_CATEGORIES[2],
    title: 'Uncollected Commercial Waste Accumulation',
    description: 'Heavily accumulated commercial food and plastic waste spilling onto the bicycle lane.',
    latitude: 12.9685,
    longitude: 77.5912,
    formattedAddress: 'Opposite Public Health Center, Richmond Circle',
    status: 'reported',
    reportCount: 3,
    communityUpvotes: 7,
    mlSeverityScore: 3.2,
    priorityScore: 2.28,
    imageUrl: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80',
    createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    reports: [],
  },
  {
    id: 'iss-104',
    categoryId: 'cat-streetlight-outage',
    category: INITIAL_CATEGORIES[3],
    title: 'Dozens of Streetlights Out - 200m Dark Stretch',
    description: 'Complete blackout along residential lane, creating safety concerns for night commuters.',
    latitude: 12.9658,
    longitude: 77.5975,
    formattedAddress: 'Residency Road Cross 5, Shanthala Nagar',
    status: 'resolved',
    assignedWorkerName: 'Suresh Babu (Electric Cell)',
    assignedDepartment: 'Electrical & Street Lighting Cell',
    reportCount: 4,
    communityUpvotes: 11,
    mlSeverityScore: 3.0,
    priorityScore: 2.15,
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    resolutionNotes: 'Replaced burnt fuse in distribution sub-box and installed 3 new 70W LED fittings.',
    resolutionProofUrl: 'https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?auto=format&fit=crop&w=800&q=80',
    resolvedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    reports: [],
  }
];

class CivicStore {
  private categories: Category[] = [...INITIAL_CATEGORIES];
  private issues: Issue[] = [...SEED_ISSUES];
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
