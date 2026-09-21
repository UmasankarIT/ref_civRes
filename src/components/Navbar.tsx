'use client';

import React from 'react';
import { UserRole } from '@/lib/types';
import { ThemeToggle } from './ThemeToggle';
import { 
  ShieldCheck, 
  Map as MapIcon, 
  List,
  Building2,
  Plus, 
  User
} from 'lucide-react';

interface NavbarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeTab: 'map' | 'feed' | 'admin';
  onTabChange: (tab: 'map' | 'feed' | 'admin') => void;
  onOpenReportModal: () => void;
  stats: {
    totalActive: number;
    inProgress: number;
    resolved: number;
  };
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  activeTab,
  onTabChange,
  onOpenReportModal,
  stats,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur-2xl transition-colors
                       bg-white/85 border-slate-200/80 
                       dark:bg-slate-950/85 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Brand Logo & Title with generous breathing room */}
          <div className="flex items-center space-x-3.5">
            <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white">
                  CivicResolve
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Spatial Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Community Infrastructure & Dynamic Deduplication
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Spacious, modern pill container) */}
          <nav className="hidden md:flex items-center p-1.5 rounded-2xl border transition-colors
                          bg-slate-100/90 border-slate-200/80 
                          dark:bg-slate-900/80 dark:border-slate-800">
            <button
              onClick={() => onTabChange('map')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'map'
                  ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span>Map View</span>
            </button>
            <button
              onClick={() => onTabChange('feed')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'feed'
                  ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
              <span>Incident Stream</span>
            </button>
            <button
              onClick={() => onTabChange('admin')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'admin'
                  ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Municipal Portal</span>
              {stats.totalActive > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono font-bold">
                  {stats.totalActive}
                </span>
              )}
            </button>
          </nav>

          {/* Right Controls: Role, Theme Toggle & Report CTA */}
          <div className="flex items-center space-x-3">
            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* Role Switcher */}
            <div className="flex items-center rounded-xl border px-2.5 py-1.5 text-xs transition-colors
                            bg-slate-100 border-slate-200 text-slate-700 
                            dark:bg-slate-900/80 dark:border-slate-800 dark:text-slate-300">
              <User className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <select
                value={currentRole}
                onChange={(e) => onRoleChange(e.target.value as UserRole)}
                className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer pr-1 text-slate-800 dark:text-slate-200"
                aria-label="Select Role"
              >
                <option value="citizen">Citizen</option>
                <option value="municipal_staff">Staff</option>
                <option value="department_admin">City Admin</option>
              </select>
            </div>

            {/* Primary Report Action Button */}
            <button
              onClick={onOpenReportModal}
              className="hidden md:flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/25 transition-all transform active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Report Hazard</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
