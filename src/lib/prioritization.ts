/**
 * CivicResolve - Dynamic Prioritization Scoring Engine
 *
 * Formula:
 * Priority = (ML_Severity * 0.35) + (log(Report_Count + 1) * 0.30) + (Community_Upvotes * 0.20) + (Urgency_Decay_Factor * 0.15)
 */

export interface PriorityParams {
  mlSeverity: number; // 1.0 to 5.0
  reportCount: number; // Aggregate reports
  upvotesCount: number; // Community 'I also faced this' endorsements
  createdAt: string | Date;
  baseUrgencyWeight?: number; // Category multiplier e.g. 1.2 for pothole, 1.5 for open drain
  slaHours?: number; // Target SLA in hours
}

export interface PriorityScoreResult {
  score: number;
  breakdown: {
    mlSeverityComponent: number;
    reportCountComponent: number;
    upvotesComponent: number;
    urgencyDecayComponent: number;
  };
}

export function calculateUrgencyDecay(
  createdAt: string | Date,
  baseUrgencyWeight: number = 1.0,
  slaHours: number = 48,
  currentTime: Date = new Date()
): number {
  const created = new Date(createdAt);
  const elapsedHours = Math.max(0, (currentTime.getTime() - created.getTime()) / (1000 * 60 * 60));
  const slaRatio = elapsedHours / Math.max(1, slaHours);

  // Growth from 1.0 to 5.0 as the ticket breaches its SLA
  const factor = (1.0 + Math.log2(1 + slaRatio * 2.5)) * baseUrgencyWeight;
  return Math.min(5.0, Math.max(1.0, Number(factor.toFixed(3))));
}

export function computePriorityScore(params: PriorityParams): PriorityScoreResult {
  const {
    mlSeverity,
    reportCount,
    upvotesCount,
    createdAt,
    baseUrgencyWeight = 1.0,
    slaHours = 48
  } = params;

  // 1. ML Severity (1.0 - 5.0) * 0.35
  const clampedSeverity = Math.min(5.0, Math.max(1.0, mlSeverity));
  const mlSeverityComponent = clampedSeverity * 0.35;

  // 2. Log(Report_Count + 1) scaled to 1-5 range * 0.30
  // log10(1 + 1) * 3.32 = 1.0
  // log10(10 + 1) * 3.32 = 3.45
  // log10(30 + 1) * 3.32 = 4.95 -> 5.0
  const scaledReportCount = Math.min(5.0, Math.max(1.0, Math.log10(Math.max(1, reportCount) + 1) * 3.32));
  const reportCountComponent = scaledReportCount * 0.30;

  // 3. Community Upvotes scaled to 1-5 range * 0.20
  // 0 upvotes = 1.0; 20 upvotes = 5.0
  const scaledUpvotes = Math.min(5.0, Math.max(1.0, 1.0 + (upvotesCount * 0.20)));
  const upvotesComponent = scaledUpvotes * 0.20;

  // 4. Urgency Decay Factor * 0.15
  const urgencyDecay = calculateUrgencyDecay(createdAt, baseUrgencyWeight, slaHours);
  const urgencyDecayComponent = urgencyDecay * 0.15;

  const totalScore = Number((mlSeverityComponent + reportCountComponent + upvotesComponent + urgencyDecayComponent).toFixed(3));

  return {
    score: totalScore,
    breakdown: {
      mlSeverityComponent: Number(mlSeverityComponent.toFixed(3)),
      reportCountComponent: Number(reportCountComponent.toFixed(3)),
      upvotesComponent: Number(upvotesComponent.toFixed(3)),
      urgencyDecayComponent: Number(urgencyDecayComponent.toFixed(3))
    }
  };
}
