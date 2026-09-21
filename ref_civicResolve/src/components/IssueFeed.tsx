'use client';

import React, { useState } from 'react';
import { Issue, Category } from '@/lib/types';
import { 
  ThumbsUp, 
  MapPin, 
  Zap, 
  Search,
  Compass
} from 'lucide-react';

interface IssueFeedProps {
  issues: Issue[];
  categories: Category[];
  onUpvote: (issueId: string) => Promise<void>;
  onSelectOnMap: (issue: Issue) => void;
}

export const IssueFeed: React.FC<IssueFeedProps> = ({
  issues,
  categories,
  onUpvote,
  onSelectOnMap,
}) => {
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'reports' | 'recent'>('priority');
  const [search, setSearch] = useState<string>('');
  const [upvotingId, setUpvotingId] = useState<string | null>(null);

  const filtered = issues
    .filter((iss) => {
      if (selectedCat !== 'all' && iss.categoryId !== selectedCat && iss.category.code !== selectedCat) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          iss.title.toLowerCase().includes(q) ||
          iss.formattedAddress.toLowerCase().includes(q) ||
          iss.category.name.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') return b.priorityScore - a.priorityScore;
      if (sortBy === 'reports') return b.reportCount - a.reportCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const handleUpvote = async (issueId: string) => {
    setUpvotingId(issueId);
    try {
      await onUpvote(issueId);
    } finally {
      setUpvotingId(null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-32 md:pb-16 space-y-6">
      {/* Search & Filter Header with generous padding */}
      <div className="space-y-3.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search verified neighborhood hazards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl text-xs sm:text-sm transition-colors border shadow-sm
                       bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none
                       dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>

        {/* Category Carousel with room to breathe */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-4 py-2 rounded-xl whitespace-nowrap font-semibold transition ${
              selectedCat === 'all'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            All Hazards
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`px-4 py-2 rounded-xl whitespace-nowrap font-semibold transition ${
                selectedCat === cat.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Sort & Count status bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
          <span>{filtered.length} Localized Incidents</span>
          <div className="flex items-center space-x-2">
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="priority">Priority Rank</option>
              <option value="reports">Report Count</option>
              <option value="recent">Most Recent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incident Stream Cards with ample spacing */}
      <div className="space-y-6">
        {filtered.map((issue) => (
          <article
            key={issue.id}
            className="rounded-3xl border shadow-sm hover:shadow-xl transition-all overflow-hidden space-y-4
                       bg-white border-slate-200/90 text-slate-900
                       dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-100"
          >
            {/* Top header row */}
            <div className="p-5 pb-0 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full
                               bg-emerald-50 text-emerald-700 border border-emerald-200
                               dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                {issue.category.name}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl
                                 bg-amber-50 text-amber-800 border border-amber-200
                                 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                  {issue.priorityScore.toFixed(2)} pts
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                    issue.status === 'resolved'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                      : issue.status === 'in_progress'
                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400'
                  }`}
                >
                  {issue.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Media Canvas */}
            <div className="px-5">
              <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={issue.imageUrl}
                  alt={issue.title}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                
                <div className="absolute top-3 right-3">
                  <button
                    type="button"
                    onClick={() => onSelectOnMap(issue)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-lg backdrop-blur-md hover:bg-slate-50 transition active:scale-95"
                  >
                    <Compass className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>View on Map</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Content & Details */}
            <div className="px-5 space-y-2">
              <h3 className="font-bold text-base sm:text-lg leading-snug">
                {issue.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {issue.description}
              </p>

              <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 space-x-1.5 pt-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span className="truncate">{issue.formattedAddress}</span>
              </div>

              {issue.mlAnalysis && (
                <div className="pt-2 flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap gap-y-1">
                  <span className="flex items-center text-amber-600 dark:text-amber-400 font-semibold mr-1">
                    <Zap className="w-3.5 h-3.5 mr-1" />
                    ML Severity {issue.mlSeverityScore}/5
                  </span>
                  {issue.mlAnalysis.detectedHazards.slice(0, 2).map((h, i) => (
                    <span key={i} className="bg-slate-100 dark:bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 text-[11px]">
                      #{h}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Card Footer with clean spacing */}
            <div className="p-5 pt-3 border-t flex items-center justify-between text-xs border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400">
                <span><strong>{issue.reportCount}</strong> reports</span>
                <span>•</span>
                <span><strong>{issue.communityUpvotes}</strong> upvotes</span>
              </div>

              <button
                type="button"
                onClick={() => handleUpvote(issue.id)}
                disabled={upvotingId === issue.id}
                className="flex items-center space-x-2 px-4 py-2 rounded-2xl text-xs font-bold transition active:scale-95 disabled:opacity-50
                           bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-700 border border-slate-200
                           dark:bg-slate-800 dark:hover:bg-emerald-600/20 dark:text-slate-200 dark:hover:text-emerald-400 dark:border-slate-700"
              >
                <ThumbsUp className={`w-3.5 h-3.5 ${upvotingId === issue.id ? 'animate-bounce' : ''}`} />
                <span>I Also Face This</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
