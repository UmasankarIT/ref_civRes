/**
 * CivicResolve - Issue Dynamic Prioritization Engine
 *
 * Implements the multi-factor civic priority formula:
 * Priority = (ML_Severity * 0.35) + (log10(Report_Count + 1) * 0.30) + (Community_Upvotes * 0.20) + (Urgency_Decay_Factor * 0.15)
 */

export interface PriorityCalculationParams {
  mlSeverity: number; // Scale: 1.0 to 5.0 (from ML Vision Service)
  reportCount: number; // Aggregate reports for this physical issue
  upvotesCount: number; // Community 'I also faced this' votes
  createdAt: Date; // Timestamp when first reported
  baseUrgencyWeight?: number; // Category multiplier (e.g., open manhole = 1.5, garbage = 1.0)
  slaHours?: number; // Target resolution window in hours (default 48)
}

export class PrioritizationEngine {
  // Weights matching the civic requirements specification
  private static readonly WEIGHT_ML_SEVERITY = 0.35;
  private static readonly WEIGHT_REPORT_COUNT = 0.30;
  private static readonly WEIGHT_UPVOTES = 0.20;
  private static readonly WEIGHT_URGENCY_DECAY = 0.15;

  /**
   * Calculates dynamic urgency decay factor.
   * As an unresolved ticket exceeds its SLA window, the urgency factor escalates from 1.0 up to 5.0.
   */
  public static calculateUrgencyDecayFactor(
    createdAt: Date,
    baseUrgencyWeight: number = 1.0,
    slaHours: number = 48,
    now: Date = new Date()
  ): number {
    const elapsedHours = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    const slaRatio = elapsedHours / Math.max(1, slaHours);

    // Escalation: 1.0 base + logarithmic growth based on overdue ratio, capped at 5.0
    const rawFactor = 1.0 + Math.log2(1 + slaRatio * 2.5);
    const weightedFactor = rawFactor * baseUrgencyWeight;

    // Constrain urgency factor to [1.0, 5.0]
    return Math.min(5.0, Math.max(1.0, parseFloat(weightedFactor.toFixed(3))));
  }

  /**
   * Computes the normalized priority score for dynamic municipal dispatch.
   */
  public static computePriorityScore(params: PriorityCalculationParams): number {
    const {
      mlSeverity,
      reportCount,
      upvotesCount,
      createdAt,
      baseUrgencyWeight = 1.0,
      slaHours = 48
    } = params;

    // 1. ML Severity Component (bounded between 1.0 and 5.0)
    const normalizedSeverity = Math.min(5.0, Math.max(1.0, mlSeverity));
    const severityComponent = normalizedSeverity * this.WEIGHT_ML_SEVERITY;

    // 2. Report Count Component: log10(count + 1) normalized to 1-5 scale
    // e.g. 1 report -> log10(2) = 0.301 * 3.32 ~ 1.0
    //     10 reports -> log10(11) = 1.041 * 3.32 ~ 3.45
    //    30+ reports -> capped at 5.0
    const rawReportFactor = Math.log10(Math.max(1, reportCount) + 1) * 3.32;
    const normalizedReportFactor = Math.min(5.0, Math.max(1.0, rawReportFactor));
    const reportComponent = normalizedReportFactor * this.WEIGHT_REPORT_COUNT;

    // 3. Community Upvotes Component: Scaled to 1-5 range
    // 0 upvotes -> 1.0, 20+ upvotes -> 5.0
    const normalizedUpvotes = Math.min(5.0, Math.max(1.0, 1.0 + (upvotesCount * 0.2)));
    const upvotesComponent = normalizedUpvotes * this.WEIGHT_UPVOTES;

    // 4. Urgency Decay Factor Component
    const urgencyDecay = this.calculateUrgencyDecayFactor(createdAt, baseUrgencyWeight, slaHours);
    const urgencyComponent = urgencyDecay * this.WEIGHT_URGENCY_DECAY;

    // Composite Final Priority Score (1.000 to 5.000)
    const finalScore = severityComponent + reportComponent + upvotesComponent + urgencyComponent;

    return parseFloat(finalScore.toFixed(3));
  }
}
