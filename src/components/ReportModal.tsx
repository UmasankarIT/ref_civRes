'use client';

import React, { useState } from 'react';
import { 
  X, 
  Construction, 
  Droplets, 
  Trash2, 
  Lightbulb, 
  Waves, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Send,
  Zap
} from 'lucide-react';
import { LocationPicker, LocationData } from './LocationPicker';
import { MediaUpload } from './MediaUpload';
import { Category, ExifMetadata, SubmissionResponse } from '@/lib/types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onReportSubmitted: (result: SubmissionResponse) => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  ROAD_POTHOLE: Construction,
  DRAINAGE_OVERFLOW: Droplets,
  GARBAGE_DUMP: Trash2,
  STREETLIGHT_OUTAGE: Lightbulb,
  WATER_SUPPLY_BURST: Waves,
};

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  categories,
  onReportSubmitted,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categories[0]?.id || '');
  const [location, setLocation] = useState<LocationData>({
    latitude: 12.9716,
    longitude: 77.5946,
    accuracyMeters: 10,
    isOnSite: true,
  });
  const [imageUrl, setImageUrl] = useState<string>('');
  const [exif, setExif] = useState<ExifMetadata>({ hasGps: false });
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCategoryId) {
      setErrorMessage('Please select an issue category.');
      return;
    }

    if (!imageUrl) {
      setErrorMessage('Please capture or select an image evidence.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        categoryId: selectedCategoryId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracyMeters: location.accuracyMeters,
        isOnSite: location.isOnSite,
        imageUrl,
        citizenNotes: notes,
        exif,
      };

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report.');
      }

      setSubmissionResult(data);
      onReportSubmitted(data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error submitting report');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setSubmissionResult(null);
    setErrorMessage(null);
    setImageUrl('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-md transition-all">
      <div className="relative w-full max-w-2xl border rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300 transition-colors
                      bg-white border-slate-200 text-slate-900 
                      dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100">
        
        {/* Mobile Pull Handle */}
        <div className="sm:hidden pt-3.5 pb-1 flex justify-center">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base sm:text-xl font-bold">Report Infrastructure Hazard</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              High-accuracy verification with PostGIS spatial deduplication
            </p>
          </div>
          <button
            onClick={resetAndClose}
            className="p-2 rounded-xl transition hover:bg-slate-100 text-slate-400 hover:text-slate-700 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body with generous padding */}
        <div className="p-6 overflow-y-auto space-y-6 pb-28 sm:pb-6">
          {submissionResult ? (
            /* Success Feedback Card */
            <div className="space-y-6 py-4 text-center">
              <div className="inline-flex p-4 rounded-3xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-xl sm:text-2xl font-bold">
                  {submissionResult.isDuplicate
                    ? 'Spatial Deduplication Triggered!'
                    : 'Incident Logged & Dispatched!'}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto mt-1.5 leading-relaxed">
                  {submissionResult.message}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl border bg-slate-50 border-slate-200/80 dark:bg-slate-950 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">Priority Score</span>
                  <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-1 block">
                    {submissionResult.priorityScore} pts
                  </span>
                </div>
                <div className="p-4 rounded-2xl border bg-slate-50 border-slate-200/80 dark:bg-slate-950 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block uppercase font-bold tracking-wider">Linked Reports</span>
                  <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1 block">
                    {submissionResult.reportCount}
                  </span>
                </div>
              </div>

              {submissionResult.mlAnalysis && (
                <div className="p-4 rounded-2xl border text-left text-xs space-y-2 bg-slate-50 border-slate-200/80 dark:bg-slate-950/90 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center">
                      <Zap className="w-4 h-4 text-amber-500 mr-1.5" />
                      Vision Classifier Inspection
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {Math.round(submissionResult.mlAnalysis.categoryConfidence * 100)}% Confidence
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span>Severity Score:</span>
                    <strong className="text-slate-900 dark:text-slate-100 font-bold">{submissionResult.mlAnalysis.estimatedSeverity} / 5.0</strong>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={resetAndClose}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition"
              >
                Return to Live Map
              </button>
            </div>
          ) : (
            <form id="report-form" onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300 text-xs flex items-center space-x-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. Category Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  1. Choose Hazard Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {categories.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat.code] || Construction;
                    const isSelected = selectedCategoryId === cat.id;

                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={`flex items-center space-x-3 p-3.5 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm dark:bg-emerald-500/15 dark:border-emerald-500 dark:text-white'
                            : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-950/60 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-950'
                        }`}
                      >
                        <Icon className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <span className="text-xs font-bold block truncate">{cat.name}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{cat.defaultSlaHours}h SLA</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Visual Evidence & EXIF */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  2. Photo Evidence & EXIF Audit
                </label>
                <MediaUpload
                  reportedLatitude={location.latitude}
                  reportedLongitude={location.longitude}
                  onImageReady={({ imageUrl: url, exif: meta }) => {
                    setImageUrl(url);
                    setExif(meta);
                  }}
                />
              </div>

              {/* 3. Location Verification */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  3. Geolocation Locking
                </label>
                <LocationPicker onLocationResolved={(loc) => setLocation(loc)} />
              </div>

              {/* 4. Notes */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  4. Landmark / Additional Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Near metro entrance, causes severe vehicle skidding..."
                  className="w-full rounded-2xl px-4 py-3 text-xs border transition-colors
                             bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500
                             dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                />
              </div>
            </form>
          )}
        </div>

        {/* Sticky Action Bar with generous padding */}
        {!submissionResult && (
          <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl">
            <button
              type="submit"
              form="report-form"
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deduplicating & Verifying...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit & Verify Infrastructure Report</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
