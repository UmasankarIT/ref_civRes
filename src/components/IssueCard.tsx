'use client';

import React, { useState } from 'react';
import { 
  ThumbsUp, 
  MapPin, 
  Clock, 
  Sparkles, 
  Layers, 
  Volume2, 
  VolumeX, 
  ShieldCheck, 
  AlertCircle,
  Wrench,
  CheckCircle2
} from 'lucide-react';
import { CivicIssue } from '@/types/civic';
import { SupportedLanguage, SUPPORTED_LANGUAGES, TRANSLATIONS } from '@/lib/languages';

interface IssueCardProps {
  issue: CivicIssue;
  currentLang: SupportedLanguage;
  onUpvoted?: (issue: CivicIssue) => void;
}

export const IssueCard: React.FC<IssueCardProps> = ({
  issue,
  currentLang,
  onUpvoted
}) => {
  const t = TRANSLATIONS[currentLang];
  const activeLangMeta = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  const [upvotes, setUpvotes] = useState<number>(issue.upvotesCount);
  const [hasUpvoted, setHasUpvoted] = useState<boolean>(!!issue.userHasUpvoted);
  const [priorityScore, setPriorityScore] = useState<number>(issue.priorityScore);
  const [isUpvoting, setIsUpvoting] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const handleUpvote = async () => {
    if (hasUpvoted || isUpvoting) return;
    setIsUpvoting(true);

    // Optimistic UI update
    setUpvotes((prev) => prev + 1);
    setHasUpvoted(true);
    setPriorityScore((prev) => Number((prev + 0.05).toFixed(3)));

    try {
      const res = await fetch(`/api/issues/${issue.id}/upvote`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.data) {
        setPriorityScore(data.data.priorityScore);
        if (onUpvoted) onUpvoted(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpvoting(false);
    }
  };

  // Text-to-Speech playback in Indian language
  const speakIssue = () => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this browser.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const text = `${issue.title}. ${issue.description}. Severity rating ${issue.mlSeverityScore} out of 5. Priority score ${priorityScore}.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = activeLangMeta.speechCode;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const getStatusBadge = () => {
    switch (issue.status) {
      case 'REPORTED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">{t.statusReported}</span>;
      case 'IN_REVIEW':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">{t.statusInReview}</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">{t.statusInProgress}</span>;
      case 'RESOLVED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{t.statusResolved}</span>;
      default:
        return null;
    }
  };

  const getPriorityColor = () => {
    if (priorityScore >= 4.0) return 'text-red-600 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900/60';
    if (priorityScore >= 3.0) return 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60';
    return 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900/60';
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-lg transition-all p-5 space-y-4">
      {/* Top Header: Tracking Number, Status & Audio */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
            {issue.trackingNumber}
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            {issue.categoryName}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={speakIssue}
            title="Read issue summary in selected language"
            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {isSpeaking ? <VolumeX className="w-4 h-4 text-blue-600 animate-bounce" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {getStatusBadge()}
        </div>
      </div>

      {/* Main Title and Description */}
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
          {issue.title}
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed line-clamp-3">
          {issue.description}
        </p>
      </div>

      {/* Google Gemini AI Vision Breakdown Box */}
      <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-800/80 dark:to-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-2.5 text-xs">
        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
          <div className="flex items-center space-x-1.5 text-blue-700 dark:text-blue-300 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{t.geminiAnalysis}</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Confidence: {(issue.mlConfidence * 100).toFixed(1)}%
          </span>
        </div>

        {/* Severity Gauge */}
        <div className="flex items-center justify-between">
          <span className="text-slate-600 dark:text-slate-300 font-medium">
            {t.severity}:
          </span>
          <div className="flex items-center space-x-2">
            <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 rounded-full"
                style={{ width: `${(issue.mlSeverityScore / 5) * 100}%` }}
              />
            </div>
            <span className="font-bold font-mono text-slate-800 dark:text-slate-100">
              {issue.mlSeverityScore.toFixed(1)} / 5.0
            </span>
          </div>
        </div>

        {/* Hazard & Remediation */}
        <div className="space-y-1 text-[11px]">
          <p className="text-slate-600 dark:text-slate-300">
            <strong className="text-slate-800 dark:text-slate-200">{t.hazard}:</strong> {issue.mlHazardAssessment}
          </p>
          <p className="text-blue-700 dark:text-blue-300">
            <strong className="text-slate-800 dark:text-slate-200">{t.remediation}:</strong> {issue.mlSuggestedRemediation}
          </p>
        </div>
      </div>

      {/* Resolution Proof Photo if Resolved */}
      {issue.status === 'RESOLVED' && issue.resolutionProofUrl && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-1.5">
          <div className="flex items-center space-x-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Resolution Verified by Municipal Ward Crew</span>
          </div>
          {issue.resolutionNotes && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{issue.resolutionNotes}</p>
          )}
        </div>
      )}

      {/* Footer: Priority Badge, Duplicate Count, Upvote Button */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        {/* Dynamic Priority Score */}
        <div className={`px-2.5 py-1 rounded-lg border font-bold flex items-center space-x-1.5 ${getPriorityColor()}`}>
          <span>{t.priorityScore}:</span>
          <span className="font-mono text-sm">{priorityScore.toFixed(2)}</span>
        </div>

        {/* Spatial Aggregate Reports Count */}
        <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400 font-medium">
          <Layers className="w-3.5 h-3.5 text-indigo-500" />
          <span>{issue.reportCount} {t.reportsCount}</span>
        </div>

        {/* Upvote Button */}
        <button
          type="button"
          onClick={handleUpvote}
          disabled={hasUpvoted || isUpvoting}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${
            hasUpvoted
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600'
          }`}
        >
          <ThumbsUp className={`w-3.5 h-3.5 ${hasUpvoted ? 'fill-current' : ''}`} />
          <span>{hasUpvoted ? 'Endorsed' : t.upvotes}</span>
          <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-full text-[10px] font-mono">
            {upvotes}
          </span>
        </button>
      </div>

      {/* Location & Time Stamp */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1">
        <div className="flex items-center space-x-1 truncate max-w-[240px]">
          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span className="truncate">{issue.addressText}</span>
        </div>
        <div className="flex items-center space-x-1 flex-shrink-0">
          <Clock className="w-3 h-3" />
          <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};
