import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { civicStore } from '@/lib/store';
import { getSession, isRole, unauthorized, denied } from '@/lib/auth';
import { isSlaBreached, hoursOpen } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

/** GET /api/admin/analytics — command-and-control KPIs (Tier 3 only). */
export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return unauthorized('Sign in to view analytics.');
  if (!isRole(user, 'city_admin')) return denied('Only the city admin can view platform analytics.');

  const issues = civicStore.getIssues();
  const departments = civicStore.getDepartments();
  const now = new Date();

  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byDepartment: Record<
    string,
    { name: string; open: number; avgHours: number; slaBreaches: number; resolved: number }
  > = {};

  departments.forEach((d) => {
    byDepartment[d.id] = { name: d.name, open: 0, avgHours: 0, slaBreaches: 0, resolved: 0 };
  });

  let upvotesTotal = 0;
  let resolvedCount = 0;

  for (const issue of issues) {
    byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;
    byCategory[issue.category.name] = (byCategory[issue.category.name] || 0) + 1;
    upvotesTotal += issue.communityUpvotes;

    const deptId = issue.departmentId;
    if (deptId) {
      const agg = byDepartment[deptId];
      if (agg) {
        if (issue.status === 'resolved') {
          agg.resolved += 1;
          resolvedCount += 1;
        } else if (issue.status !== 'merged' && issue.status !== 'rejected') {
          agg.open += 1;
          agg.avgHours += hoursOpen(issue, now);
          if (isSlaBreached(issue, now)) agg.slaBreaches += 1;
        }
      }
    }
  }

  // averages
  Object.values(byDepartment).forEach((agg) => {
    if (agg.open > 0) agg.avgHours = Math.round((agg.avgHours / agg.open) * 10) / 10;
  });

  const slaBreachedIssues = issues.filter((i) => isSlaBreached(i, now)).map((i) => ({
    id: i.id,
    title: i.title,
    departmentId: i.departmentId,
    status: i.status,
    slaDeadlineAt: i.slaDeadlineAt,
  }));

  const active = ['reported', 'in_review', 'verified', 'assigned', 'in_progress'].reduce(
    (acc, s) => acc + (byStatus[s] || 0),
    0
  );

  return NextResponse.json({
    generatedAt: now.toISOString(),
    totals: {
      total: issues.length,
      active,
      resolved: resolvedCount,
      rejected: byStatus['rejected'] || 0,
      merged: byStatus['merged'] || 0,
      upvotes: upvotesTotal,
      resolutionRate: issues.length ? Math.round((resolvedCount / issues.length) * 100) : 0,
    },
    byStatus,
    byCategory,
    byDepartment,
    slaBreachedIssues,
    recentAudit: civicStore.getAuditLogs(12),
  });
}