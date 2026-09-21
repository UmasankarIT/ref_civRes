'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { IssueFeed } from '@/components/IssueFeed';
import { AdminPortal } from '@/components/AdminPortal';
import { ReportModal } from '@/components/ReportModal';
import { Issue, Category, LocationFix, UserRole, SubmissionResponse, IssueStatus } from '@/lib/types';
import { Loader2, MapPin } from 'lucide-react';

// Dynamic import of CivicMap with SSR disabled to guarantee Leaflet executes only on client
const CivicMap = dynamic(() => import('@/components/CivicMap').then((mod) => mod.CivicMap), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100dvh-4rem-4rem)] md:h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-950 text-slate-400">
      <div className="flex flex-col items-center space-y-2">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-xs font-medium">Booting PostGIS Spatial Radar...</span>
      </div>
    </div>
  ),
});

export default function HomePage() {
  const [currentRole, setCurrentRole] = useState<UserRole>('citizen');
  const [activeTab, setActiveTab] = useState<'map' | 'feed' | 'admin'>('map');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [locStatus, setLocStatus] = useState<'requesting' | 'granted' | 'denied' | 'unsupported'>('requesting');
  const [userLocation, setUserLocation] = useState<LocationFix | null>(null);

  // Ask for location permission on first open — the whole app centres around the citizen's place
  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocStatus('unsupported');
      return;
    }
    setLocStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
        });
        setLocStatus('granted');
      },
      () => setLocStatus('denied'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Fetch live issues and categories
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/issues');
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Failed to load issues:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Upvote an issue
  const handleUpvote = async (issueId: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/upvote`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setIssues((prev) =>
          prev.map((iss) =>
            iss.id === issueId
              ? {
                  ...iss,
                  communityUpvotes: data.communityUpvotes,
                  priorityScore: data.priorityScore,
                }
              : iss
          )
        );
      }
    } catch (err) {
      console.error('Upvote failed:', err);
    }
  };

  // Municipal status transition & worker assignment
  const handleStatusUpdate = async (
    issueId: string,
    params: {
      status: IssueStatus;
      assignedWorkerName?: string;
      resolutionNotes?: string;
      resolutionProofUrl?: string;
    }
  ) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        const data = await res.json();
        setIssues((prev) =>
          prev.map((iss) => (iss.id === issueId ? data.issue : iss))
        );
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleReportSubmitted = (result: SubmissionResponse) => {
    fetchData();
    // Return to map view to show the newly added or updated pin
    setActiveTab('map');
  };

  const handleSelectOnMap = (issue: Issue) => {
    setSelectedIssueId(issue.id);
    setActiveTab('map');
  };

  const totalActive = issues.filter((i) => i.status !== 'resolved' && i.status !== 'rejected').length;
  const inProgress = issues.filter((i) => i.status === 'in_progress' || i.status === 'assigned').length;
  const resolved = issues.filter((i) => i.status === 'resolved').length;

  const filteredMapIssues = issues.filter((iss) => {
    if (selectedCategory !== 'all' && iss.categoryId !== selectedCategory && iss.category.code !== selectedCategory) {
      return false;
    }
    if (selectedStatus !== 'all' && iss.status !== selectedStatus) {
      return false;
    }
    return true;
  });

  return (
    <main className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-[#0a0e17] dark:text-slate-100 selection:bg-emerald-500 selection:text-white transition-colors">
      {/* Universal Top App Bar */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        stats={{ totalActive, inProgress, resolved }}
      />

      {/* Location permission banner — fires once, on first open */}
      {(locStatus === 'denied' || locStatus === 'unsupported') && (
        <div className="px-4 py-2.5 text-xs flex items-center justify-between gap-3
                        bg-amber-50 border-b border-amber-200 text-amber-800
                        dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300">
          <span className="flex items-center space-x-1.5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {locStatus === 'unsupported'
                ? 'This browser does not support location services.'
                : 'Location access is needed so your reports map to your exact place — allow it and retry.'}
            </span>
          </span>
          {locStatus === 'denied' && (
            <button
              onClick={requestLocation}
              className="shrink-0 px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white font-bold transition active:scale-95"
            >
              Enable Location
            </button>
          )}
        </div>
      )}

      {/* Main Viewport Container */}
      <div className="flex-1 flex flex-col relative">
        {activeTab === 'map' && (
          <CivicMap
            issues={filteredMapIssues}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            selectedStatus={selectedStatus}
            onSelectStatus={setSelectedStatus}
            onUpvote={handleUpvote}
            selectedIssueId={selectedIssueId}
            initialLocation={userLocation}
            locationStatus={locStatus}
          />
        )}

        {activeTab === 'feed' && (
          <IssueFeed
            issues={issues}
            categories={categories}
            onUpvote={handleUpvote}
            onSelectOnMap={handleSelectOnMap}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPortal
            issues={issues}
            categories={categories}
            onStatusUpdate={handleStatusUpdate}
          />
        )}
      </div>

      {/* Mobile-Native Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenReport={() => setIsReportModalOpen(true)}
        currentRole={currentRole}
        activeIncidentsCount={totalActive}
      />

      {/* Reporting Modal / Bottom Sheet */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        categories={categories}
        onReportSubmitted={handleReportSubmitted}
        initialLocation={userLocation}
      />
    </main>
  );
}
