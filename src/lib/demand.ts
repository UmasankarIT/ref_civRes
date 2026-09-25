import { Issue, Department } from './types';

// ---------------------------------------------------------------------------
// Demand Intelligence — fuses citizen grievance data with contextual data to
// surface demand hotspots and recommend priority public projects.
// Store-agnostic: operates purely on Issue[] so it works identically over the
// MemoryStore and PostgresStore backends.
// ---------------------------------------------------------------------------

export interface Hotspot {
  id: string;
  centroidLat: number;
  centroidLng: number;
  issueCount: number;
  totalUpvotes: number;
  avgPriority: number;
  avgSeverity: number;
  topCategories: { id: string; name: string; count: number }[];
  leadingIssueId: string;
  leadingIssueTitle: string;
  areaName: string;
  demandScore: number; // 0-100
  radiusMeters: number;
}

export interface CategoryDemand {
  id: string;
  name: string;
  openCount: number;
  totalUpvotes: number;
  avgSeverity: number;
}

export interface ProjectRecommendation {
  rank: number;
  title: string;
  hotspotId: string;
  categoryId: string;
  category: string;
  departmentId: string;
  department: string;
  demandScore: number;
  rationale: string;
  estimatedImpact: string;
  indicativeInvestment: string;
  priority: 'high' | 'medium' | 'low';
}

// Static contextual datasets (lightweight substitute for live government
// feeds during the demo). In production these would be pulled from
// data.gov.in / ISRO-Bhuvan / FAO / WHO and cached in BigQuery or Firestore.
export const CONTEXTUAL_RISK: Record<string, { label: string; monsoonRisk: string; healthRisk: string }> = {
  'Andhra Pradesh': {
    label: 'Coastal urban centre, cyclonic exposure',
    monsoonRisk: 'Monsoon corridor — waterlogging compounds drainage failures',
    healthRisk: 'Stagnant water correlates with vector-borne disease clusters (WHO/NCVBDC)',
  },
  'Telangana': {
    label: 'High-population growth urban district',
    monsoonRisk: 'Flash-flood prone micro-drainage basins',
    healthRisk: 'Dense settlements amplify sanitation-linked outbreak risk',
  },
  'Karnataka': {
    label: 'IT-industrial hub, rapid peri-urban sprawl',
    monsoonRisk: 'Heavy southwest-monsoon skew',
    healthRisk: 'Lake-adjacent wards face leptospirosis exposure',
  },
  'Maharashtra': {
    label: 'Metropolitan-industrial corridor, high footfall density',
    monsoonRisk: 'Urban flood-prone low-lying wards experience intense rainfall',
    healthRisk: 'Density and drainage overload amplify vector-borne disease risk',
  },
  'Delhi': {
    label: 'National capital, extreme population density',
    monsoonRisk: 'Monsoon drainage overload and Yamuna floodplain exposure',
    healthRisk: 'Air quality and water-borne complaint co-occurrence is documented',
  },
  'Tamil Nadu': {
    label: 'Coastal metro with cyclone and surge exposure',
    monsoonRisk: 'Cyclonic storms raise surge and street-flood risk',
    healthRisk: 'Water scarcity coexists with intermittent drainage contamination',
  },
  'West Bengal': {
    label: 'High-density eastern metropolis, low-lying terrain',
    monsoonRisk: 'Monsoon waterlogging in low-lying wards is chronic',
    healthRisk: 'Drainage stagnation drives cholera and vector-borne alerts',
  },
  'Rajasthan': {
    label: 'Arid state, water-scarcity driven civic demand',
    monsoonRisk: 'Highly seasonal rainfall concentrates stress in monsoon months',
    healthRisk: 'Groundwater stress shapes water-supply grievance patterns',
  },
  'Uttar Pradesh': {
    label: 'Most populous state, fast-growing peri-urban belts',
    monsoonRisk: 'Flat terrain with poor micro-drainage during monsoon',
    healthRisk: 'Sanitation access gaps correlate with complaint density',
  },
  'Kerala': {
    label: 'High-rainfall coastal state, waterlogging endemic',
    monsoonRisk: 'Very heavy monsoon rainfall; persistent urban waterlogging',
    healthRisk: 'Mosquito and larval-disease risk rises with stagnant water',
  },
  'Assam': {
    label: 'Brahmaputra valley, flood-prone and climate-stressed',
    monsoonRisk: 'Annual Brahmaputra flooding displaces assets and blocks roads',
    healthRisk: 'Flood-related water contamination raises outbreak risk',
  },
  'Odisha': {
    label: 'Cyclone-bay coastal state, post-cyclone reconstruction',
    monsoonRisk: 'Cyclone and storm-surge exposure along the coastal belt',
    healthRisk: 'Saline and contaminated water post-storm drives health complaints',
  },
  'Gujarat': {
    label: 'Industrial and port economy, arid urban centres',
    monsoonRisk: 'Short intense monsoon bursts stress urban drains',
    healthRisk: 'Industrial and construction dust coexists with waste-burning complaints',
  },
};

export const DEFAULT_RISK = {
  label: 'Indian urban ward',
  monsoonRisk: 'Monsoon season amplifies infrastructure stress',
  healthRisk: 'Civic failure correlates with report density (data.gov.in ward indicators)',
};

const OPEN_STATUSES = new Set(['reported', 'in_review', 'verified', 'assigned', 'in_progress']);

export function isOpenIssue(issue: Issue): boolean {
  return OPEN_STATUSES.has(issue.status);
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function areaLabel(issue: Issue): string {
  if (issue.wardId) return issue.wardId;
  if (issue.locationDetails?.district) return issue.locationDetails.district;
  if (issue.locationDetails?.mandal) return issue.locationDetails.mandal;
  if (issue.locationDetails?.state) return issue.locationDetails.state;
  return 'Ward';
}

// DBSCAN-lite: greedy radius clustering by great-circle distance.
export function clusterIssues(issues: Issue[], epsMeters = 800): Issue[][] {
  const remaining = [...issues];
  const clusters: Issue[][] = [];
  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const cluster: Issue[] = [seed];
    for (let i = remaining.length - 1; i >= 0; i--) {
      const cand = remaining[i];
      if (haversineMeters(seed.latitude, seed.longitude, cand.latitude, cand.longitude) <= epsMeters) {
        cluster.push(cand);
        remaining.splice(i, 1);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

export function buildHotspots(issues: Issue[]): Hotspot[] {
  if (issues.length === 0) return [];

  const clusters = clusterIssues(issues);
  return clusters
    .map((cluster, idx) => {
      const count = cluster.length;
      const totalUpvotes = cluster.reduce((acc, i) => acc + i.communityUpvotes, 0);
      const avgSeverity =
        cluster.reduce((acc, i) => acc + (i.mlSeverityScore || 3), 0) / count;
      const avgPriority = cluster.reduce((acc, i) => acc + (i.priorityScore || 2), 0) / count;

      const cenLat = cluster.reduce((acc, i) => acc + i.latitude, 0) / count;
      const cenLng = cluster.reduce((acc, i) => acc + i.longitude, 0) / count;

      const catCounts = new Map<string, { id: string; name: string; count: number }>();
      for (const i of cluster) {
        const entry = catCounts.get(i.categoryId) || { id: i.categoryId, name: i.category.name, count: 0 };
        entry.count += 1;
        catCounts.set(i.categoryId, entry);
      }
      const topCategories = Array.from(catCounts.values()).sort((a, b) => b.count - a.count).slice(0, 3);

      const leading = [...cluster].sort((a, b) => b.priorityScore - a.priorityScore)[0];

      const demandScore = Math.min(
        100,
        Math.round(count * 12 + totalUpvotes * 5 + (avgPriority - 1) * 18)
      );

      // Farthest cluster member sets the radius.
      const radiusMeters = Math.max(
        100,
        Math.round(Math.max(...cluster.map((c) => haversineMeters(cenLat, cenLng, c.latitude, c.longitude))))
      );

      return {
        id: `hs-${idx + 1}`,
        centroidLat: Number(cenLat.toFixed(6)),
        centroidLng: Number(cenLng.toFixed(6)),
        issueCount: count,
        totalUpvotes,
        avgPriority: Number(avgPriority.toFixed(2)),
        avgSeverity: Number(avgSeverity.toFixed(2)),
        topCategories,
        leadingIssueId: leading.id,
        leadingIssueTitle: leading.title,
        areaName: areaLabel(leading),
        demandScore,
        radiusMeters,
      };
    })
    .sort((a, b) => b.demandScore - a.demandScore);
}

export function buildCategoryDemand(issues: Issue[]): CategoryDemand[] {
  const map = new Map<string, CategoryDemand>();
  for (const issue of issues) {
    const entry = map.get(issue.categoryId) || {
      id: issue.categoryId,
      name: issue.category.name,
      openCount: 0,
      totalUpvotes: 0,
      avgSeverity: 0,
    };
    entry.openCount += 1;
    entry.totalUpvotes += issue.communityUpvotes;
    entry.avgSeverity += issue.mlSeverityScore || 3;
    map.set(issue.categoryId, entry);
  }
  return Array.from(map.values())
    .map((c) => ({ ...c, avgSeverity: Number((c.avgSeverity / Math.max(1, c.openCount)).toFixed(2)) }))
    .sort((a, b) => b.openCount - a.openCount);
}

const PROJECT_TEMPLATES: Record<string, (area: string) => string> = {
  pothole: (a) => `Relay and resurface arterial & collector roads in ${a}`,
  broken_drainage: (a) => `Reconstruct storm-drainage network in ${a}`,
  sewage: (a) => `Sewer de-silting and overflow containment in ${a}`,
  garbage: (a) => `Daily mechanical sweeping + segregation bins in ${a}`,
  street_light: (a) => `LED street-lighting retrofit in ${a}`,
  water_pipeline: (a) => `Water pipeline replacement & metering in ${a}`,
};

export function buildRecommendations(
  hotspots: Hotspot[],
  departments: Department[],
  issues: Issue[]
): ProjectRecommendation[] {
  const deptByCode = new Map(
    departments.filter((d) => !d.disabled).map((d) => [d.code, d])
  );
  return hotspots.slice(0, 8).map((hs, i) => {
    const top = hs.topCategories[0];
    const fundamental = issues.find((i) => i.id === hs.leadingIssueId);
    const stateName = fundamental?.locationDetails?.state;
    const risk = (stateName && CONTEXTUAL_RISK[stateName]) || DEFAULT_RISK;
    const buildTitle = PROJECT_TEMPLATES[top.id.replace('cat-', '')] || ((a) => `Integrated civic asset repair programme in ${a}`);

    const priority = hs.demandScore >= 70 ? 'high' : hs.demandScore >= 40 ? 'medium' : 'low';

    const title = buildTitle(hs.areaName);

    const deptCode = fundamental?.category.responsibleDepartment || 'DEPT_PWD';
    const dept = deptByCode.get(deptCode) || deptByCode.get('DEPT_PWD');
    const departmentId = dept?.id || 'DEPT_PWD';
    const department = dept?.name || 'Public Works';

    return {
      rank: i + 1,
      title,
      hotspotId: hs.id,
      categoryId: top?.id || '',
      category: top?.name || 'Civic infrastructure',
      departmentId,
      department,
      demandScore: hs.demandScore,
      rationale: `${hs.issueCount} open grievance${hs.issueCount > 1 ? 's' : ''} across ${hs.topCategories.length} categor${hs.topCategories.length > 1 ? 'ies' : 'y'} cluster around ${hs.areaName} (${hs.totalUpvotes} community endorsements). ${risk.monsoonRisk}.`,
      estimatedImpact: `${risk.label}; ${risk.healthRisk}. Resolving ${hs.issueCount} work orders protects a dense catchment.`,
      indicativeInvestment: hs.demandScore >= 60 ? '₹40–80 lakh' : hs.demandScore >= 30 ? '₹15–40 lakh' : '₹5–15 lakh',
      priority,
    };
  });
}

export function buildPromptContext(
  issues: Issue[],
  hotspots: Hotspot[],
  categoryDemand: CategoryDemand[]
): string {
  const stateCounts = new Map<string, number>();
  for (const i of issues) {
    const s = i.locationDetails?.state || 'Unknown';
    stateCounts.set(s, (stateCounts.get(s) || 0) + 1);
  }

  return `
You are the Demand Intelligence advisor for CivicResolve, an Indian civic infrastructure platform that aggregates citizen grievances. Based ONLY on the data below, recommend 3-6 high-priority public projects for municipal policymakers with concise technical and community rationale.

DATA
Total open work orders: ${issues.length}
By state: ${Array.from(stateCounts.entries()).map(([s, c]) => `${s} (${c})`).join(', ')}
Category demand (name, open, upvotes, avg severity):
${categoryDemand.map((c) => `- ${c.name}: ${c.openCount} open, ${c.totalUpvotes} upvotes, severity ${c.avgSeverity}`).join('\n')}
Demand hotspots (id, area, issue count, upvotes, avg priority 1-5, top category, demand score 0-100):
${hotspots.map((h) => `- ${h.id} ${h.areaName}: ${h.issueCount} issues, ${h.totalUpvotes} upvotes, priority ${h.avgPriority}, top=${h.topCategories[0]?.name || 'n/a'}, score=${h.demandScore}`).join('\n')}

Respond with a JSON object of shape:
{ "recommendations": [ { "rank": 1, "title": string, "hotspot_id": string, "category": string, "department": string, "rationale": string, "estimated_impact": string, "indicative_investment": string } ] }
Only structural, actionable municipal projects. Rank by urgency and community impact.
`;
}