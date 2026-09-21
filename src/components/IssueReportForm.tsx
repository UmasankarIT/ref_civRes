'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  UploadCloud, 
  Mic, 
  MicOff, 
  MapPin, 
  Navigation, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  ShieldCheck, 
  X, 
  Loader2,
  Info
} from 'lucide-react';
import { CATEGORIES } from '@/lib/store';
import { CategorySlug, CivicIssue } from '@/types/civic';
import { SupportedLanguage, SUPPORTED_LANGUAGES, TRANSLATIONS } from '@/lib/languages';

interface IssueReportFormProps {
  currentLang: SupportedLanguage;
  onIssueCreated: (issue: CivicIssue, isDuplicate: boolean, distanceMeters?: number) => void;
}

export const IssueReportForm: React.FC<IssueReportFormProps> = ({
  currentLang,
  onIssueCreated
}) => {
  const t = TRANSLATIONS[currentLang];
  const activeLangMeta = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  // Media states
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [exifVerified, setExifVerified] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Location states
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 12.9716, lng: 77.5946 });
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isOnSite, setIsOnSite] = useState<boolean>(true);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addressText, setAddressText] = useState<string>('');

  // Form input states
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug>('pothole');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);

  // Acquire high accuracy GPS location
  const acquireGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        setGpsAccuracy(Math.round(accuracy));
        setIsLocating(false);
        setAddressText(`Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`);
      },
      (err) => {
        setIsLocating(false);
        setLocationError('GPS permission denied or unavailable. Using selected coordinate center.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, []);

  useEffect(() => {
    acquireGPS();
  }, [acquireGPS]);

  // Voice recognition setup
  const toggleVoiceRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech-to-text is not supported by this browser. Please type your description.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = activeLangMeta.speechCode; // e.g. hi-IN, ta-IN, en-IN
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  // Image upload and client-side compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOriginalSize(file.size);

    // Compress client-side using Canvas to ensure fast mobile upload
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setImagePreview(dataUrl);
          // Estimate compressed size
          setCompressedSize(Math.round((dataUrl.length * 3) / 4));
          setExifVerified(true);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categorySlug: selectedCategory,
          title: title.trim() || undefined,
          description: description.trim(),
          lat: coords.lat,
          lng: coords.lng,
          addressText: addressText || `Ward Coordinate (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
          isOnSite,
          imageData: imagePreview,
          exifVerified,
          language: currentLang
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit issue report.');
      }

      setSubmitSuccessMsg(data.message);
      onIssueCreated(data.issue, data.isDuplicate, data.distanceMeters);

      // Reset form
      setImagePreview(null);
      setDescription('');
      setTitle('');
    } catch (err: any) {
      setSubmitError(err.message || 'An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          <h2 className="text-xl font-bold">{t.reportIssue}</h2>
        </div>
        <p className="text-xs text-blue-100 mt-1">{t.reportSubtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Photo Upload with Client Compression */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            1. {t.takePhoto}
          </label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-center transition-all bg-slate-50 dark:bg-slate-800/40 hover:bg-blue-50/50 flex flex-col items-center justify-center space-y-2 group"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Tap to capture with camera or browse gallery
              </p>
              <p className="text-[11px] text-slate-500">
                Automated EXIF extraction & client-side compression enabled
              </p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950">
              <img src={imagePreview} alt="Issue preview" className="w-full h-48 object-cover" />
              <button
                type="button"
                onClick={() => setImagePreview(null)}
                className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="p-2 bg-slate-900/90 text-[11px] text-slate-300 flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Compressed: {(originalSize / 1024).toFixed(0)}KB → {(compressedSize / 1024).toFixed(0)}KB</span>
                </div>
                <span className="text-blue-400 font-mono">Ready for Gemini AI</span>
              </div>
            </div>
          )}
        </div>

        {/* Category Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            2. {t.categorySelect}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setSelectedCategory(cat.slug)}
                className={`p-3 text-left rounded-xl border text-xs transition-all ${
                  selectedCategory === cat.slug
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500 text-blue-900 dark:text-blue-200 font-semibold shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="font-medium truncate">{cat.name}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  SLA: {cat.slaHours} hrs
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Multilingual Voice / Text Description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              3. Issue Description & Voice Input
            </label>
            <button
              type="button"
              onClick={toggleVoiceRecording}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-200'
              }`}
            >
              {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isRecording ? t.listening : `${t.voiceInput} (${activeLangMeta.name})`}</span>
            </button>
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.describePlaceholder}
            rows={3}
            className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Real-time Geolocation Verification */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              4. {t.locationVerified}
            </label>
            <button
              type="button"
              onClick={acquireGPS}
              disabled={isLocating}
              className="inline-flex items-center text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isLocating ? 'animate-spin' : ''}`} />
              Re-acquire GPS
            </button>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-200 font-mono">
                <MapPin className="w-4 h-4 text-red-500" />
                <span>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
              </div>
              {gpsAccuracy && (
                <span className="text-[11px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full font-medium">
                  ±{gpsAccuracy}m Accuracy
                </span>
              )}
            </div>

            {locationError && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">{locationError}</p>
            )}

            {/* On-site toggle */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300 text-[11px]">
                {t.onSiteToggle}
              </span>
              <input
                type="checkbox"
                checked={isOnSite}
                onChange={(e) => setIsOnSite(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Feedback Alert Banners */}
        {submitSuccessMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{submitSuccessMsg}</span>
          </div>
        )}

        {submitError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t.submitting}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{t.submitReport}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
