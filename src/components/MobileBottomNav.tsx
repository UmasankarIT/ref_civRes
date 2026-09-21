'use client';

import React from 'react';
import { Map, List, Building2, Plus } from 'lucide-react';
import { UserRole } from '@/lib/types';

interface MobileBottomNavProps {
  activeTab: 'map' | 'feed' | 'admin';
  onTabChange: (tab: 'map' | 'feed' | 'admin') => void;
  onOpenReport: () => void;
  currentRole: UserRole;
  activeIncidentsCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenReport,
  currentRole,
  activeIncidentsCount,
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 transition-colors
                    bg-white/95 border-t border-slate-200/90 
                    dark:bg-slate-950/95 dark:border-slate-800/90 
                    backdrop-blur-2xl pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-around h-18 px-4 relative py-1">
        {/* Map Tab */}
        <button
          onClick={() => onTabChange('map')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'map'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <div className={`p-1.5 rounded-2xl transition ${activeTab === 'map' ? 'bg-emerald-500/10 dark:bg-emerald-500/20' : ''}`}>
            <Map className="w-5 h-5" />
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight font-medium">Map</span>
        </button>

        {/* Feed Tab */}
        <button
          onClick={() => onTabChange('feed')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'feed'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <div className={`relative p-1.5 rounded-2xl transition ${activeTab === 'feed' ? 'bg-emerald-500/10 dark:bg-emerald-500/20' : ''}`}>
            <List className="w-5 h-5" />
            {activeIncidentsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                {activeIncidentsCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight font-medium">Feed</span>
        </button>

        {/* Center Elevated FAB */}
        <div className="relative -top-4 flex items-center justify-center px-2">
          <button
            onClick={onOpenReport}
            className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 border-4 border-white dark:border-slate-950 active:scale-95 transition-transform"
            aria-label="Report Hazard"
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>

        {/* Municipal Dispatch Tab */}
        <button
          onClick={() => onTabChange('admin')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeTab === 'admin'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <div className={`p-1.5 rounded-2xl transition ${activeTab === 'admin' ? 'bg-emerald-500/10 dark:bg-emerald-500/20' : ''}`}>
            <Building2 className="w-5 h-5" />
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight font-medium">
            {currentRole === 'citizen' ? 'Dispatch' : 'Admin'}
          </span>
        </button>
      </div>
    </div>
  );
};
