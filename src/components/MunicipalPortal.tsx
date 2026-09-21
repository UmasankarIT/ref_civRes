'use client';

import React, { useState } from 'react';
import { 
  Building2, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  UserCheck, 
  Filter, 
  Upload, 
  ShieldAlert, 
  TrendingUp, 
  Layers 
} from 'lucide-react';
import { CivicIssue, IssueStatus } from '@/types/civic';
import { SupportedLanguage, TRANSLATIONS } from '@/lib/languages';

interface MunicipalPortalProps {
  issues: CivicIssue[];
  currentLang: SupportedLanguage;
  onStatusUpdated: (updatedIssue: CivicIssue) => void;
}

export const MunicipalPortal: React.FC<MunicipalPortalProps> = ({
  issues,
  currentLang,
  onStatusUpdated
}) => {
  const t = TRANSLATIONS[currentLang];

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'critical' | 'high'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal / Action state
  const [activeIssue, setActiveIssue] = useState<CivicIssue | null>(null);
  const [newStatus, setNewStatus] = useState<IssueStatus>('IN_PROGRESS');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [workerName, setWorkerName] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Filtered issues
  const filteredIssues = issues.filter((issue) => {
    if (selectedCategory !== 'all' && issue.categorySlug !== selectedCategory) return false;
    if (priorityFilter === 'critical' && issue.priorityScore < 3.5) return false;
    if (priorityFilter === 'high' && issue.priorityScore < 3.0) return false;
    if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
    return true;
  });

  // Calculate high-level stats
  const totalReports = issues.reduce((acc, curr) => acc + curr.reportCount, 0);
  const duplicatesSaved = totalReports - issues.length;
  const criticalCount = issues.filter((i) => i.priorityScore >= 3.5 && i.status !== 'RESOLVED').length;
  const resolvedCount = issues.filter((i) => i.status === 'RESOLVED').length;

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIssue) return;
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/issues/${activeIssue.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          notes: resolutionNotes.trim() || undefined,
          workerName: workerName.trim() || undefined,
          proofUrl: newStatus === 'RESOLVED' ? 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=600&q=80' : undefined
        })
      });

      const data = await res.json();
      if (data.success && data.data) {
        onStatusUpdated(data.data);
        setActiveIssue(null);
        setResolutionNotes('');
        setWorkerName('');
      }
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Municipal Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Critical Priority</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-red-600 dark:text-red-400">
            {criticalCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Priority score ≥ 3.5 (Immediate SLA)</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Active Incidents</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-100">
            {issues.length - resolvedCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Deduplicated unique physical sites</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Duplicates Filtered</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {duplicatesSaved > 0 ? `+${duplicatesSaved}` : '0'}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">PostGIS 25m spatial clustering</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Resolved Cases</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {resolvedCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">With photo proof of work</p>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-bold text-slate-700 dark:text-slate-200">Filters:</span>
          
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical Only (≥ 3.5)</option>
            <option value="high">High & Above (≥ 3.0)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="REPORTED">Reported</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        <div className="text-slate-500 font-medium">
          Showing <strong>{filteredIssues.length}</strong> of {issues.length} incidents
        </div>
      </div>

      {/* Triage Queue Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4">Priority Score</th>
                <th className="p-4">Tracking & Category</th>
                <th className="p-4">Incident Details</th>
                <th className="p-4">Location & Reports</th>
                <th className="p-4">Assigned Worker</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredIssues.map((issue) => (
                <tr key={issue.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  {/* Priority */}
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                        issue.priorityScore >= 3.5 
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' 
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}>
                        {issue.priorityScore.toFixed(2)}
                      </span>
                    </div>
                  </td>

                  {/* Tracking & Category */}
                  <td className="p-4">
                    <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {issue.trackingNumber}
                    </div>
                    <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                      {issue.categoryName}
                    </div>
                  </td>

                  {/* Title & ML Details */}
                  <td className="p-4 max-w-xs">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {issue.title}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {issue.mlHazardAssessment}
                    </div>
                  </td>

                  {/* Location & Report Count */}
                  <td className="p-4">
                    <div className="truncate max-w-[160px] text-slate-700 dark:text-slate-300 font-medium">
                      {issue.addressText}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {issue.reportCount} reports • {issue.upvotesCount} upvotes
                    </div>
                  </td>

                  {/* Assigned Worker */}
                  <td className="p-4">
                    <div className="flex items-center space-x-1 text-slate-700 dark:text-slate-300">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>{issue.assignedWorker || 'Unassigned'}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {issue.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveIssue(issue);
                        setNewStatus(issue.status);
                        setWorkerName(issue.assignedWorker || '');
                        setResolutionNotes(issue.resolutionNotes || '');
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
                    >
                      Update / Dispatch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update / Dispatch Modal */}
      {activeIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Municipal Dispatch & Action</h3>
                <p className="text-xs text-blue-100 font-mono mt-0.5">
                  {activeIssue.trackingNumber} - {activeIssue.categoryName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveIssue(null)}
                className="text-white/80 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Incident Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as IssueStatus)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
                >
                  <option value="REPORTED">REPORTED (New Submission)</option>
                  <option value="IN_REVIEW">IN_REVIEW (Verified by Inspector)</option>
                  <option value="IN_PROGRESS">IN_PROGRESS (Worker Dispatched)</option>
                  <option value="RESOLVED">RESOLVED (Repairs Complete)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Assign Field Crew / Ward Engineer
                </label>
                <input
                  type="text"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar (Roads Ward #14)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Resolution Notes / Closure Remarks
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Describe repair work carried out, materials used, or inspection feedback..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveIssue(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save & Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
