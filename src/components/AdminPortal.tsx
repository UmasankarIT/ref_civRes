'use client';

import React, { useState } from 'react';
import { Issue, IssueStatus, Category } from '@/lib/types';
import { 
  Building2, 
  Clock, 
  CheckCircle, 
  Search, 
  FileCheck2, 
  MapPin
} from 'lucide-react';

interface AdminPortalProps {
  issues: Issue[];
  categories: Category[];
  onStatusUpdate: (
    issueId: string,
    params: {
      status: IssueStatus;
      assignedWorkerName?: string;
      resolutionNotes?: string;
      resolutionProofUrl?: string;
    }
  ) => Promise<void>;
}

const MUNICIPAL_FIELD_WORKERS = [
  'Rajesh Kumar (Roads Squad 4)',
  'Anil Sharma (Sanitation Wing)',
  'Suresh Babu (Electric Cell)',
  'Priya Nair (Stormwater Ops)',
  'Vikas Gowda (Water Line Repair)',
];

export const AdminPortal: React.FC<AdminPortalProps> = ({
  issues,
  categories,
  onStatusUpdate,
}) => {
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [resolvingIssue, setResolvingIssue] = useState<Issue | null>(null);
  const [resolutionProofUrl, setResolutionProofUrl] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const filteredIssues = issues.filter((iss) => {
    if (selectedDept !== 'all' && !iss.category.responsibleDepartment.toLowerCase().includes(selectedDept.toLowerCase())) {
      return false;
    }
    if (selectedStatus !== 'all' && iss.status !== selectedStatus) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        iss.title.toLowerCase().includes(q) ||
        iss.formattedAddress.toLowerCase().includes(q) ||
        iss.category.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleWorkerAssign = async (issueId: string, workerName: string) => {
    setIsUpdating(true);
    try {
      await onStatusUpdate(issueId, {
        status: 'assigned',
        assignedWorkerName: workerName,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (issueId: string, newStatus: IssueStatus) => {
    if (newStatus === 'resolved') {
      const target = issues.find((i) => i.id === issueId);
      if (target) {
        setResolvingIssue(target);
        return;
      }
    }

    setIsUpdating(true);
    try {
      await onStatusUpdate(issueId, { status: newStatus });
    } finally {
      setIsUpdating(false);
    }
  };

  const submitResolution = async () => {
    if (!resolvingIssue) return;
    setIsUpdating(true);

    try {
      await onStatusUpdate(resolvingIssue.id, {
        status: 'resolved',
        resolutionNotes: resolutionNotes || 'Repairs completed and validated on-site by municipal crew.',
        resolutionProofUrl: resolutionProofUrl || 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80',
      });
      setResolvingIssue(null);
      setResolutionProofUrl('');
      setResolutionNotes('');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 pb-32 md:pb-16 space-y-6 sm:space-y-8">
      {/* Top Banner & KPI Overview with generous padding */}
      <div className="p-6 sm:p-8 rounded-3xl border shadow-sm transition-colors space-y-6
                      bg-white border-slate-200/90 text-slate-900 
                      dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-100">
        
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight">
              Municipal Resolution Dispatch
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Priority-ranked queue based on computer vision severity, duplicate report density, and SLA decay.
            </p>
          </div>
        </div>

        {/* Clean KPI Cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-1">
          <div className="p-4 sm:p-6 rounded-2xl border text-center transition-colors
                          bg-slate-50 border-slate-200/80 
                          dark:bg-slate-950 dark:border-slate-800">
            <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider">
              Pending Queue
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-1 block">
              {issues.filter((i) => i.status !== 'resolved').length}
            </span>
          </div>
          
          <div className="p-4 sm:p-6 rounded-2xl border text-center transition-colors
                          bg-slate-50 border-slate-200/80 
                          dark:bg-slate-950 dark:border-slate-800">
            <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider">
              In Progress
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-sky-600 dark:text-sky-400 font-mono mt-1 block">
              {issues.filter((i) => i.status === 'in_progress' || i.status === 'assigned').length}
            </span>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl border text-center transition-colors
                          bg-slate-50 border-slate-200/80 
                          dark:bg-slate-950 dark:border-slate-800">
            <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 block font-bold uppercase tracking-wider">
              Resolved
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1 block">
              {issues.filter((i) => i.status === 'resolved').length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl border transition-colors
                      bg-white border-slate-200/90 
                      dark:bg-slate-900/70 dark:border-slate-800/80">
        
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search road, hazard, or ward..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs transition-colors border
                       bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500
                       dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-1/2 sm:w-auto px-3.5 py-2.5 rounded-xl text-xs font-medium border
                       bg-slate-50 border-slate-200 text-slate-700 focus:outline-none
                       dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300"
          >
            <option value="all">All Departments</option>
            <option value="Roads">Roads (PWD)</option>
            <option value="Water">Water Board</option>
            <option value="Solid Waste">Solid Waste</option>
            <option value="Electrical">Electrical Cell</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-1/2 sm:w-auto px-3.5 py-2.5 rounded-xl text-xs font-medium border
                       bg-slate-50 border-slate-200 text-slate-700 focus:outline-none
                       dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300"
          >
            <option value="all">All Statuses</option>
            <option value="reported">Reported</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* MOBILE VIEW: Roomy Card Stream (< md) */}
      <div className="md:hidden space-y-4">
        {filteredIssues.map((issue) => (
          <div
            key={issue.id}
            className="p-5 rounded-3xl border shadow-sm space-y-4 transition-colors
                       bg-white border-slate-200 text-slate-900 
                       dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex space-x-3 items-center">
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 border
                                bg-slate-100 border-slate-200 dark:bg-slate-950 dark:border-slate-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={issue.imageUrl} alt={issue.title} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    {issue.category.name}
                  </span>
                  <h4 className="text-sm font-bold line-clamp-1 mt-0.5">{issue.title}</h4>
                  <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 space-x-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{issue.formattedAddress}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end flex-shrink-0">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl
                                 bg-amber-50 text-amber-800 border border-amber-200
                                 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                  {issue.priorityScore.toFixed(2)} pts
                </span>
                <span className={`text-[10px] uppercase font-bold mt-1.5 px-2 py-0.5 rounded-full ${
                  issue.status === 'resolved'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                    : issue.status === 'in_progress'
                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-400'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400'
                }`}>
                  {issue.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Department & SLA badge */}
            <div className="flex items-center justify-between text-xs p-3 rounded-2xl border
                            bg-slate-50 border-slate-200/80 text-slate-600 
                            dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400">
              <span className="truncate max-w-[65%] font-medium">{issue.category.responsibleDepartment}</span>
              <div className="flex items-center space-x-1 text-slate-700 dark:text-slate-300 font-semibold">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{issue.category.defaultSlaHours}h SLA</span>
              </div>
            </div>

            {/* Field Assignment & Actions */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <select
                disabled={isUpdating}
                onChange={(e) => {
                  if (e.target.value) handleWorkerAssign(issue.id, e.target.value);
                }}
                value={issue.assignedWorkerName || ''}
                className="w-full rounded-xl px-3 py-2 text-xs font-medium border
                           bg-slate-50 border-slate-200 text-slate-800 focus:outline-none
                           dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200"
              >
                <option value="" disabled>Assign Field Crew...</option>
                {MUNICIPAL_FIELD_WORKERS.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>

              {issue.status !== 'resolved' && (
                <div className="grid grid-cols-2 gap-2.5">
                  {issue.status !== 'in_progress' && (
                    <button
                      disabled={isUpdating}
                      onClick={() => handleStatusChange(issue.id, 'in_progress')}
                      className="w-full py-2.5 rounded-2xl border text-xs font-semibold transition
                                 bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200
                                 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700"
                    >
                      In Progress
                    </button>
                  )}
                  <button
                    disabled={isUpdating}
                    onClick={() => handleStatusChange(issue.id, 'resolved')}
                    className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Resolve Proof</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP VIEW: Roomy Table (>= md) */}
      <div className="hidden md:block rounded-3xl border shadow-sm overflow-hidden transition-colors
                      bg-white border-slate-200 
                      dark:bg-slate-900/80 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wider font-semibold border-b
                              bg-slate-50/80 border-slate-200 text-slate-500 
                              dark:bg-slate-950/80 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="py-4 px-6">Priority</th>
                <th className="py-4 px-6">Incident Details</th>
                <th className="py-4 px-6">Severity & Reports</th>
                <th className="py-4 px-6">Department</th>
                <th className="py-4 px-6">Assigned Squad</th>
                <th className="py-4 px-6">Status / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredIssues.map((issue) => (
                <tr key={issue.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                  <td className="py-5 px-6 align-top">
                    <span className="inline-flex items-center px-3 py-1 rounded-xl font-mono text-xs font-bold
                                     bg-amber-50 text-amber-800 border border-amber-200
                                     dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                      {issue.priorityScore.toFixed(2)} pts
                    </span>
                  </td>
                  <td className="py-5 px-6 align-top max-w-xs">
                    <div className="flex space-x-3.5">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 border
                                      bg-slate-100 border-slate-200 dark:bg-slate-950 dark:border-slate-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={issue.imageUrl} alt={issue.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                          {issue.category.name}
                        </span>
                        <h4 className="text-xs font-bold line-clamp-1 mt-0.5 text-slate-900 dark:text-white">{issue.title}</h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{issue.formattedAddress}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-6 align-top">
                    <div className="space-y-1">
                      <div className="text-slate-800 dark:text-slate-200">Severity: <strong>{issue.mlSeverityScore.toFixed(1)}/5.0</strong></div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">{issue.reportCount} reports • {issue.communityUpvotes} upvotes</div>
                    </div>
                  </td>
                  <td className="py-5 px-6 align-top">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{issue.category.responsibleDepartment}</div>
                    <div className="text-slate-500 text-[11px] mt-0.5">{issue.category.defaultSlaHours}h SLA</div>
                  </td>
                  <td className="py-5 px-6 align-top">
                    <select
                      disabled={isUpdating}
                      onChange={(e) => {
                        if (e.target.value) handleWorkerAssign(issue.id, e.target.value);
                      }}
                      value={issue.assignedWorkerName || ''}
                      className="rounded-xl px-3 py-1.5 text-xs font-medium border
                                 bg-slate-50 border-slate-200 text-slate-800 
                                 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300"
                    >
                      <option value="" disabled>Assign Squad...</option>
                      {MUNICIPAL_FIELD_WORKERS.map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-5 px-6 align-top">
                    <div className="flex items-center space-x-2.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        issue.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                          : issue.status === 'in_progress'
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-400'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400'
                      }`}>
                        {issue.status.replace('_', ' ')}
                      </span>
                      {issue.status !== 'resolved' && (
                        <button
                          onClick={() => handleStatusChange(issue.id, 'resolved')}
                          className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1 shadow-sm"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Resolve</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolution Proof Upload Modal with spacious form */}
      {resolvingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl p-6 border shadow-2xl space-y-4
                          bg-white border-slate-200 text-slate-900 
                          dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-base">Resolution Ground Proof</h3>
              </div>
              <button onClick={() => setResolvingIssue(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Attaching proof for: <strong>{resolvingIssue.title}</strong>
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold uppercase block mb-1">
                  Resolution Photo URL
                </label>
                <input
                  type="text"
                  placeholder="https://... image URL"
                  value={resolutionProofUrl}
                  onChange={(e) => setResolutionProofUrl(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-xs border
                             bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:border-emerald-500
                             dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase block mb-1">
                  Work Completion Summary
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Asphalting completed; drain unclogged..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-xs border
                             bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:border-emerald-500
                             dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setResolvingIssue(null)}
                  className="flex-1 py-2.5 rounded-xl border text-xs font-semibold transition
                             bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200
                             dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={submitResolution}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Mark Resolved</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
