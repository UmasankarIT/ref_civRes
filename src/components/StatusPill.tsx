'use client';

import React from 'react';
import { IssueStatus } from '@/lib/types';

export const STATUS_LABELS: Record<IssueStatus, string> = {
  reported: 'SUBMITTED',
  in_review: 'PENDING TRIAGE',
  verified: 'VERIFIED',
  assigned: 'ASSIGNED',
  in_progress: 'IN PROGRESS',
  resolved: 'RESOLVED',
  rejected: 'REJECTED',
  merged: 'MERGED',
};

const STATUS_STYLES: Record<IssueStatus, string> = {
  reported: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  in_review: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30',
  verified: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
  assigned: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30',
  in_progress: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30',
  resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
  merged: 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700/40 dark:text-slate-300 dark:border-slate-600',
};

export const StatusPill: React.FC<{ status: IssueStatus; className?: string }> = ({ status, className }) => (
  <span
    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide border ${STATUS_STYLES[status]} ${className || ''}`}
  >
    {STATUS_LABELS[status]}
  </span>
);