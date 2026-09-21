import { NextRequest, NextResponse } from 'next/server';
import { civicStore } from '@/lib/store';
import { getSession, isRole, unauthorized, denied } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/department/queue
 * Tier-2 (department) scope: strictly the tickets routed to THIS department,
 * within the assigned jurisdiction (ward/block), currently assigned/in-progress.
 */
export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return unauthorized('Sign in to view the department queue.');
  if (!isRole(user, 'department')) return denied('Only department staff can view their queue.');

  const departmentId = user.departmentId;
  const queue = civicStore.getAssignableForDepartment(departmentId || '').filter((i) => {
    if (user.jurisdictionCode && i.jurisdictionCode && i.jurisdictionCode !== user.jurisdictionCode) return false;
    return true;
  });

  return NextResponse.json({ queue, departmentId, jurisdictionCode: user.jurisdictionCode });
}