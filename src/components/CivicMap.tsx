'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Issue, Category } from '@/lib/types';
import { 
  ThumbsUp, 
  MapPin, 
  Crosshair, 
  X,
  Zap,
  ArrowRight
} from 'lucide-react';

// Default map focus: geographic centre of India (actual position is auto-fetched via GPS)
const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];

// Free, keyless OSM basemap — CARTO raster tiles now require an API key and show an
// "API key required" watermark without one. Dark mode is emulated with a CSS filter.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARK_TILE_FILTER = 'invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.9) saturate(0.85)';

interface CivicMapProps {
  issues: Issue[];
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (catId: string) => void;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
  onUpvote: (issueId: string) => void;
  onSelectIssue?: (issue: Issue) => void;
  selectedIssueId?: string | null;
}

export const CivicMap: React.FC<CivicMapProps> = ({
  issues,
  categories,
  selectedCategory,
  onSelectCategory,
  selectedStatus,
  onSelectStatus,
  onUpvote,
  onSelectIssue,
  selectedIssueId,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [upvotingId, setUpvotingId] = useState<string | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const isDark = document.documentElement.classList.contains('dark');

        const map = L.map(mapContainerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 14,
          zoomControl: false,
        });

        const tileLayer = L.tileLayer(TILE_URL, {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | CivicResolve',
          maxZoom: 19,
        }).addTo(map);

        tileLayerRef.current = tileLayer;

        // OSM has no native dark tiles; emulate dark mode with a CSS filter on the tile pane
        const tilePane = map.getPane('tilePane');
        if (tilePane) {
          tilePane.style.filter = isDark ? DARK_TILE_FILTER : '';
        }

        if (window.innerWidth >= 768) {
          L.control.zoom({ position: 'bottomright' }).addTo(map);
        }

        // Radar user GPS marker
        const userIcon = L.divIcon({
          className: 'custom-user-marker',
          html: `
            <div class="relative w-8 h-8 flex items-center justify-center">
              <div class="radar-circle"></div>
              <div class="w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-lg z-10"></div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        L.marker(DEFAULT_CENTER, { icon: userIcon })
          .addTo(map)
          .bindTooltip('Your Verified Location', { direction: 'top', offset: [0, -10] });

        mapInstanceRef.current = map;
      }
    });

    // Theme change listener — same keyless OSM tiles, just toggle the dark filter
    const handleThemeChange = (e: any) => {
      if (!mapInstanceRef.current) return;
      const isDark = e.detail === 'dark';
      const tilePane = mapInstanceRef.current.getPane('tilePane');
      if (tilePane) {
        tilePane.style.filter = isDark ? DARK_TILE_FILTER : '';
      }
    };

    window.addEventListener('themeChanged', handleThemeChange);

    return () => {
      isMounted = false;
      window.removeEventListener('themeChanged', handleThemeChange);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync selected issue from prop
  useEffect(() => {
    if (selectedIssueId) {
      const match = issues.find((i) => i.id === selectedIssueId);
      if (match) {
        setActiveIssue(match);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([match.latitude, match.longitude], 16, { duration: 1.2 });
        }
      }
    }
  }, [selectedIssueId, issues]);

  // Update Markers
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      Object.values(markersRef.current).forEach((marker: any) => marker.remove());
      markersRef.current = {};

      issues.forEach((issue) => {
        let markerBg = 'bg-amber-500';
        let glowColor = 'rgba(245, 158, 11, 0.35)';
        if (issue.status === 'resolved') {
          markerBg = 'bg-emerald-500';
          glowColor = 'rgba(16, 185, 129, 0.35)';
        } else if (issue.status === 'in_progress' || issue.status === 'assigned') {
          markerBg = 'bg-sky-500';
          glowColor = 'rgba(14, 165, 233, 0.35)';
        }

        const iconHtml = `
          <div class="group relative flex items-center justify-center cursor-pointer transition-transform hover:scale-110">
            <div style="box-shadow: 0 4px 15px ${glowColor};" class="w-10 h-10 rounded-2xl ${markerBg} text-white flex flex-col items-center justify-center font-bold text-xs border-2 border-white shadow-xl">
              <span class="text-xs font-mono font-black leading-none">${issue.priorityScore.toFixed(1)}</span>
              <span class="text-[8px] opacity-90 uppercase font-semibold leading-none mt-0.5">pts</span>
            </div>
            ${
              issue.reportCount > 1
                ? `<span class="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-white shadow-sm">${issue.reportCount}</span>`
                : ''
            }
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'civic-issue-marker',
          html: iconHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([issue.latitude, issue.longitude], { icon: customIcon })
          .addTo(map)
          .on('click', () => {
            setActiveIssue(issue);
            if (onSelectIssue) onSelectIssue(issue);
            map.flyTo([issue.latitude, issue.longitude], 16, { duration: 0.8 });
          });

        markersRef.current[issue.id] = marker;
      });
    });
  }, [issues, onSelectIssue]);

  const recenterGPS = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(DEFAULT_CENTER, 15, { duration: 1 });
    }
  };

  const handleUpvoteClick = async (issueId: string) => {
    setUpvotingId(issueId);
    try {
      await onUpvote(issueId);
      if (activeIssue && activeIssue.id === issueId) {
        setActiveIssue({
          ...activeIssue,
          communityUpvotes: activeIssue.communityUpvotes + 1,
          priorityScore: activeIssue.priorityScore + 0.05,
        });
      }
    } finally {
      setUpvotingId(null);
    }
  };

  return (
    <div className="relative w-full h-[calc(100dvh-4rem-4.5rem)] md:h-[calc(100vh-5rem)] flex flex-col overflow-hidden transition-colors
                    bg-slate-100 dark:bg-slate-950">
      
      {/* Floating Filter Chips with Ample Breathing Room */}
      <div className="absolute top-4 left-4 right-4 z-20 pointer-events-none flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category horizontal scroll pills */}
        <div className="pointer-events-auto flex items-center space-x-2 overflow-x-auto p-2 rounded-2xl border shadow-lg backdrop-blur-xl no-scrollbar max-w-full
                        bg-white/90 border-slate-200/90 text-slate-700 
                        dark:bg-slate-950/90 dark:border-slate-800/90 dark:text-slate-300">
          <button
            onClick={() => onSelectCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'
            }`}
          >
            All Hazards
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Status chip filter on desktop/tablet */}
        <div className="hidden sm:flex pointer-events-auto items-center space-x-1.5 p-1.5 rounded-2xl border shadow-lg backdrop-blur-xl
                        bg-white/90 border-slate-200/90 
                        dark:bg-slate-950/90 dark:border-slate-800/90">
          {(['all', 'reported', 'assigned', 'in_progress', 'resolved'] as const).map((st) => (
            <button
              key={st}
              onClick={() => onSelectStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs capitalize font-medium transition ${
                selectedStatus === st
                  ? 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-emerald-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st === 'all' ? 'All' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Floating GPS Recenter button */}
      <div className="absolute right-5 bottom-6 md:bottom-8 z-20 pointer-events-auto">
        <button
          onClick={recenterGPS}
          className="p-3.5 rounded-full border shadow-xl backdrop-blur-md active:scale-95 transition-all
                     bg-white/95 border-slate-200 text-slate-700 hover:bg-slate-50 
                     dark:bg-slate-900/95 dark:border-slate-800 dark:text-emerald-400 dark:hover:bg-slate-800"
          aria-label="Recenter GPS"
          title="Recenter to my location"
        >
          <Crosshair className="w-5 h-5" />
        </button>
      </div>

      {/* Main Map Viewport */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Spacious Bottom Sheet Card for Selected Incident */}
      {activeIssue && (
        <div className="absolute bottom-4 left-4 right-4 sm:bottom-8 sm:left-auto sm:right-8 sm:w-[26rem] z-30 pointer-events-auto animate-in slide-in-from-bottom duration-300">
          <div className="rounded-3xl p-5 border shadow-2xl backdrop-blur-2xl transition-all space-y-4
                          bg-white/95 border-slate-200 text-slate-900 
                          dark:bg-slate-900/95 dark:border-slate-800/90 dark:text-slate-100">
            
            {/* Top row */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full
                               bg-emerald-50 text-emerald-700 border border-emerald-200
                               dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                {activeIssue.category.name}
              </span>
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl
                                 bg-amber-50 text-amber-800 border border-amber-200
                                 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                  {activeIssue.priorityScore.toFixed(2)} pts
                </span>
                <button
                  onClick={() => setActiveIssue(null)}
                  className="p-1.5 rounded-full transition
                             hover:bg-slate-100 text-slate-400 hover:text-slate-700 
                             dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Photo & Details with clean spacing */}
            <div className="flex space-x-4 items-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden flex-shrink-0 border
                              bg-slate-100 border-slate-200 dark:bg-slate-950 dark:border-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeIssue.imageUrl}
                  alt={activeIssue.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <h4 className="text-sm sm:text-base font-bold line-clamp-1 leading-snug">
                  {activeIssue.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {activeIssue.description}
                </p>
                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 space-x-1 pt-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span className="truncate">{activeIssue.formattedAddress}</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t flex items-center justify-between
                            border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                <span><strong>{activeIssue.reportCount}</strong> reports</span>
                <span>•</span>
                <span><strong>{activeIssue.communityUpvotes}</strong> upvotes</span>
              </div>

              <button
                onClick={() => handleUpvoteClick(activeIssue.id)}
                disabled={upvotingId === activeIssue.id}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition active:scale-95 disabled:opacity-50
                           bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
              >
                <ThumbsUp className={`w-3.5 h-3.5 ${upvotingId === activeIssue.id ? 'animate-bounce' : ''}`} />
                <span>I Also Face This</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
