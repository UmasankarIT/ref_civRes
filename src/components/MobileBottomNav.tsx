'use client';

import React from 'react';
import { Map, List, UserRound, ClipboardList, Building2, Plus } from 'lucide-react';
import { AuthUser } from '@/lib/types';
import { AppTab } from '@/lib/session';

interface MobileBottomNavProps {
  user: AuthUser | null;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenReport: () => void;
  activeIncidentsCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  user,
  activeTab,
  onTabChange,
  onOpenReport,
  activeIncidentsCount,
}) => {
  const role = user?.role ?? null;

  // Per-role navigation — everyone sees a different app shell.
  const tabs: { tab: AppTab; icon: React.ReactNode; label: string }[] =
    role === 'citizen'
      ? [
          { tab: 'my', icon: <UserRound className="w-5 h-5" />, label: 'My Reports' },
          { tab: 'map', icon: <Map className="w-5 h-5" />, label: 'Map' },
          { tab: 'feed', icon: <List className="w-5 h-5" />, label: 'Feed' },
        ]
      : role === 'department'
        ? [
            { tab: 'tasks', icon: <ClipboardList className="w-5 h-5" />, label: 'My Tasks' },
            { tab: 'map', icon: <Map className="w-5 h-5" />, label: 'Map' },
            { tab: 'feed', icon: <List className="w-5 h-5" />, label: 'Feed' },
          ]
        : role === 'city_admin'
          ? [
              { tab: 'admin', icon: <Building2 className="w-5 h-5" />, label: 'Console' },
              { tab: 'map', icon: <Map className="w-5 h-5" />, label: 'Map' },
              { tab: 'feed', icon: <List className="w-5 h-5" />, label: 'Feed' },
            ]
          : [
              { tab: 'map', icon: <Map className="w-5 h-5" />, label: 'Map' },
              { tab: 'feed', icon: <List className="w-5 h-5" />, label: 'Feed' },
            ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 transition-colors
                    bg-white/95 border-t border-slate-200/90 
                    dark:bg-slate-950/95 dark:border-slate-800/90 
                    backdrop-blur-2xl pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-around h-18 px-4 relative py-1">
        {tabs.map(({ tab, icon, label }) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className={`p-1.5 rounded-2xl transition ${isActive ? 'bg-emerald-500/10 dark:bg-emerald-500/20' : ''}`}>
                {icon}
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight font-medium">{label}</span>
            </button>
          );
        })}

        {/* Center FAB — anyone (signed in) can report */}
        <div className="flex flex-col items-center justify-center flex-1">
          <button
            onClick={onOpenReport}
            aria-label="Report a hazard"
            className={`-mt-7 w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition active:scale-90 ${
              activeIncidentsCount > 0 ? 'rotate-0' : ''
            }`}
          >
            <Plus className="w-6 h-6" />
          </button>
          <span className="text-[11px] mt-0.5 tracking-tight font-medium text-slate-500 dark:text-slate-400">
            Report
          </span>
        </div>
      </div>
    </div>
  );
};