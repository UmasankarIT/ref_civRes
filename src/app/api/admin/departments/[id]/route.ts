import { NextRequest, NextResponse } from 'next/server';
import { civicStore } from '@/lib/store';
import { getSession, isRole, unauthorized, denied } from '@/lib/auth';
import { logAction } from '@/lib/events';
import { Department } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/departments/:id — update nodal officer, SLA, or enable/disable. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSession(req);
  if (!user) return unauthorized('Sign in to manage departments.');
  if (!isRole(user, 'city_admin')) return denied('Only the city admin can manage departments.');

  const dept = await civicStore.getDepartmentById(params.id);
  if (!dept) return NextResponse.json({ error: 'Department not found.' }, { status: 404 });

  const body = (await req.json()) as Partial<Department>;

  const merged: Department = {
    ...dept,
    name: body.name !== undefined ? String(body.name).trim() || dept.name : dept.name,
    nodalOfficer: body.nodalOfficer !== undefined ? String(body.nodalOfficer).trim() || dept.nodalOfficer : dept.nodalOfficer,
    slaHours: body.slaHours !== undefined ? Number(body.slaHours) || dept.slaHours : dept.slaHours,
    disabled: body.disabled !== undefined ? Boolean(body.disabled) : dept.disabled,
    categoryCodes: body.categoryCodes !== undefined ? body.categoryCodes : dept.categoryCodes,
  };

  const saved = await civicStore.upsertDepartment(merged);
  await logAction(user, 'departments.update', `${dept.disabled ? 'Disabled' : 'Updated'} department ${saved.name} (SLA ${saved.slaHours}h).`);

  return NextResponse.json({ department: saved, message: 'Department updated.' });
}