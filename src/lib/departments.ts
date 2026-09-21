import { Category, Department } from './types';

/**
 * Default municipal department catalog. Departments are dynamic at runtime —
 * a city admin can create/rename/disable them — these are the system defaults
 * that seed the store (mirrored in database/schema.sql).
 */
export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: 'DEPT_WATER',
    code: 'DEPT_WATER',
    name: 'Water Supply & Sanitation',
    nodalOfficer: 'Nodal Officer, Water',
    slaHours: 12,
    disabled: false,
    categoryCodes: ['WATER_SUPPLY_BURST'],
  },
  {
    id: 'DEPT_DRAINAGE',
    code: 'DEPT_DRAINAGE',
    name: 'Drainage, Sewerage & Stormwater',
    nodalOfficer: 'Nodal Officer, Drainage',
    slaHours: 24,
    disabled: false,
    categoryCodes: ['DRAINAGE_OVERFLOW'],
  },
  {
    id: 'DEPT_PWD',
    code: 'DEPT_PWD',
    name: 'Public Works & Roads',
    nodalOfficer: 'Nodal Officer, PWD',
    slaHours: 48,
    disabled: false,
    categoryCodes: ['ROAD_POTHOLE'],
  },
  {
    id: 'DEPT_WASTE',
    code: 'DEPT_WASTE',
    name: 'Solid Waste Management',
    nodalOfficer: 'Nodal Officer, Waste',
    slaHours: 36,
    disabled: false,
    categoryCodes: ['GARBAGE_DUMP'],
  },
  {
    id: 'DEPT_ELECTRICITY',
    code: 'DEPT_ELECTRICITY',
    name: 'Electricity / DISCOM & Street Lighting',
    nodalOfficer: 'Nodal Officer, Electricity',
    slaHours: 72,
    disabled: false,
    categoryCodes: ['STREETLIGHT_OUTAGE'],
  },
  {
    id: 'DEPT_HEALTH',
    code: 'DEPT_HEALTH',
    name: 'Public Health & Safety',
    nodalOfficer: 'Nodal Officer, Health',
    slaHours: 48,
    disabled: false,
    categoryCodes: [],
  },
  {
    id: 'DEPT_TOWN_PLANNING',
    code: 'DEPT_TOWN_PLANNING',
    name: 'Town Planning & Encroachments',
    nodalOfficer: 'Nodal Officer, Planning',
    slaHours: 72,
    disabled: false,
    categoryCodes: [],
  },
  {
    id: 'DEPT_UNASSIGNED',
    code: 'DEPT_UNASSIGNED',
    name: 'Triage & Unassigned',
    nodalOfficer: 'City Admin',
    slaHours: 72,
    disabled: false,
    categoryCodes: ['OTHERS'],
  },
];

/**
 * Route a category to its responsible department. Anything ambiguous or
 * unrecognised lands in the triage queue (DEPT_UNASSIGNED) for admin review.
 */
export function departmentForCategory(category: Category | undefined): Department {
  if (!category) return DEFAULT_DEPARTMENTS.find((d) => d.id === 'DEPT_UNASSIGNED')!;
  const match = DEFAULT_DEPARTMENTS.find((d) => d.categoryCodes.includes(category.code));
  return match || DEFAULT_DEPARTMENTS.find((d) => d.id === 'DEPT_UNASSIGNED')!;
}