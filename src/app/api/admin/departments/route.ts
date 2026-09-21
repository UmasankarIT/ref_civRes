import { NextRequest, NextResponse } from 'next/server';
import { civicStore } from '@/lib/store';
import { getSession, isRole, unauthorized, denied } from '@/lib/auth';
import { logAction } from '@/lib/events';
import { Department } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** GET /api/admin/departments — list the dynamic department catalog (Tier 3). */
export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return unauthorized('Sign in to manage departments.');
  if (!isRole(user, 'city_admin')) return denied('Only the city admin can manage departments.');

  return NextResponse.json({ departments: civicStore.getDepartments() });
}

/** POST /api/admin/departments — create or update a department (Tier 3). */
export async function POST(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return unauthorized('Sign in to manage departments.');
  if (!isRole(user, 'city_admin')) return denied('Only the city admin can manage departments.');

  const body = (await req.json()) as Partial<Department>;
  const id = String(body.id || '').trim();
  const name = String(body.name || '').trim();
  if (!id) return NextResponse.json({ error: 'Department id is required.' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'Department name is required.' }, { status: 400 });

  const dept: Department = {
    id,
    code: String(body.code || id).trim(),
    name,
    nodalOfficer: String(body.nodalOfficer || 'Nodal Officer').trim(),
    slaHours: Number(body.slaHours) || 72,
    disabled: Boolean(body.disabled),
    categoryCodes: Array.isArray(body.categoryCodes) ? body.categoryCodes : [],
  };

  const saved = civicStore.upsertDepartment(dept);
  logAction(user, 'departments.update', `${dept.disabled ? 'Disabled' : 'Updated'} department ${dept.name}.`);

  return NextResponse.json({ department: saved, message: 'Department saved.' });
}