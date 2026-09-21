'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MapPin, 
  Navigation, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  SlidersHorizontal,
  Compass,
  Building2,
  Loader2,
  Search,
  X
} from 'lucide-react';
import { calculateGeodesicDistanceMeters } from '@/lib/spatial';
import { LocationDetails, LocationFix, GeocodeHit } from '@/lib/types';
import { searchPlaces } from '@/lib/places';
import { SupportedLanguage, TRANSLATIONS } from '@/lib/languages';

// Neutral default (geographic centre of India) — actual coordinate is auto-fetched via GPS
const DEFAULT_LAT = 20.5937;
const DEFAULT_LNG = 78.9629;

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  isOnSite: boolean;
  locationDetails?: LocationDetails;
}

interface LocationPickerProps {
  onLocationResolved: (data: LocationData) => void;
  onSiteThresholdMeters?: number;
  lang?: SupportedLanguage;
  initialLocation?: LocationFix | null;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationResolved,
  onSiteThresholdMeters = 80,
  lang = 'en',
  initialLocation = null,
}) => {
  const t = TRANSLATIONS[lang];

  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLat, setSelectedLat] = useState<number>(initialLocation?.latitude ?? DEFAULT_LAT);
  const [selectedLng, setSelectedLng] = useState<number>(initialLocation?.longitude ?? DEFAULT_LNG);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [isOnSite, setIsOnSite] = useState<boolean>(true);

  // Searched / typed location — lets citizens report remotely even without GPS
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Reverse-geocoded administrative details (state / district / mandal / pincode)
  const [locationDetails, setLocationDetails] = useState<LocationDetails | null>(null);
  const [locLoading, setLocLoading] = useState<boolean>(false);
  const [locError, setLocError] = useState<boolean>(false);

  // Refs let us always emit the freshest pin + admin details to the parent,
  // even when the reverse-geocode resolves after the position callback.
  const detailsRef = useRef<LocationDetails | null>(null);
  const lastPosRef = useRef({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, acc: 10, onSite: true });
  // Once the citizen picks a location themselves (typed search or manual coords),
  // that choice is FINAL — a late GPS callback must never override it.
  const manualOverrideRef = useRef<boolean>(false);

  const emitLocation = useCallback(
    (details?: LocationDetails | null) => {
      const pos = lastPosRef.current;
      onLocationResolved({
        latitude: pos.lat,
        longitude: pos.lng,
        accuracyMeters: pos.acc,
        isOnSite: pos.onSite,
        locationDetails: (details !== undefined ? details : detailsRef.current) ?? undefined,
      });
    },
    [onLocationResolved]
  );

  const fetchLocationDetails = useCallback(
    async (lat: number, lng: number) => {
      setLocLoading(true);
      setLocError(false);
      try {
        const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lng}`);
        if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
        const data = (await res.json()) as LocationDetails & { error?: string };
        if (data.error) throw new Error(data.error);
        detailsRef.current = {
          state: data.state || undefined,
          district: data.district || undefined,
          mandal: data.mandal || undefined,
          pincode: data.pincode || undefined,
        };
        setLocationDetails(detailsRef.current);
        // Re-emit so the report form receives the freshly resolved details
        emitLocation(detailsRef.current);
      } catch (err) {
        console.error('[LocationPicker] Reverse geocode failed:', err);
        detailsRef.current = null;
        setLocationDetails(null);
        setLocError(true);
        emitLocation(null);
      } finally {
        setLocLoading(false);
      }
    },
    [emitLocation]
  );

  const updatePin = useCallback(
    (lat: number, lng: number, acc: number, onSite: boolean) => {
      lastPosRef.current = { lat, lng, acc, onSite };
      setSelectedLat(lat);
      setSelectedLng(lng);
      setAccuracy(acc);
      setIsOnSite(onSite);
    },
    []
  );

  const acquireGPS = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorStatus('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    setErrorStatus(null);

    const geoOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        // Always keep the device position for on-site distance checks...
        setDeviceCoords({ lat: latitude, lng: longitude });
        setLoading(false);
        setErrorStatus(null);

        // ...but if the citizen already picked a location themselves, their
        // manual choice is FINAL — never stomp it with the GPS fix.
        if (manualOverrideRef.current) {
          return;
        }

        updatePin(latitude, longitude, acc, true);
        setIsManualOverride(false);

        // Emit immediately with whatever admin details are known, then refresh them
        emitLocation(detailsRef.current);
        fetchLocationDetails(latitude, longitude);
      },
      (err) => {
        setLoading(false);
        // Keep their manually chosen location untouched if GPS fails late
        if (manualOverrideRef.current) {
          setErrorStatus('GPS unavailable — using your manually chosen location.');
          return;
        }
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setErrorStatus('Location permission denied. Switched to manual pinpointing.');
            setIsManualOverride(true);
            break;
          case err.POSITION_UNAVAILABLE:
            setErrorStatus('GPS satellite lock unavailable. Please adjust manually.');
            setIsManualOverride(true);
            break;
          case err.TIMEOUT:
            setErrorStatus('Location request timed out. Pin manually or retry.');
            break;
          default:
            setErrorStatus('Unable to acquire high-accuracy coordinates.');
        }

        updatePin(selectedLat, selectedLng, 50, false);
        emitLocation(detailsRef.current);
      },
      geoOptions
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitLocation, updatePin]);

  useEffect(() => {
    manualOverrideRef.current = false;
    if (initialLocation) {
      // App already fetched + granted location at startup — reuse it (no second prompt)
      updatePin(
        initialLocation.latitude,
        initialLocation.longitude,
        initialLocation.accuracyMeters ?? 10,
        true
      );
      setDeviceCoords({ lat: initialLocation.latitude, lng: initialLocation.longitude });
      setIsManualOverride(false);
      emitLocation(detailsRef.current);
      fetchLocationDetails(initialLocation.latitude, initialLocation.longitude);
    } else {
      acquireGPS();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced forward-geocode search while the citizen types a place name
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError(false);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const hits = await searchPlaces(q, controller.signal);
        setSearchResults(hits);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setSearchError(true);
        setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  // Close the search dropdown when clicking/tapping outside it
  useEffect(() => {
    if (!showResults) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [showResults]);

  // Apply a searched place: move the pin there and treat it as a remote report
  const applySearchedPlace = (hit: GeocodeHit) => {
    manualOverrideRef.current = true;
    setIsManualOverride(true);
    setSearchQuery(hit.label);
    setShowResults(false);

    let verifiedOnSite = false;
    if (deviceCoords) {
      const distance = calculateGeodesicDistanceMeters(deviceCoords.lat, deviceCoords.lng, hit.lat, hit.lon);
      verifiedOnSite = distance <= onSiteThresholdMeters;
    }
    updatePin(hit.lat, hit.lon, 20, verifiedOnSite);
    emitLocation(detailsRef.current);
    fetchLocationDetails(hit.lat, hit.lon);
  };

  const handleManualCoordChange = (newLat: number, newLng: number) => {
    manualOverrideRef.current = true;
    setIsManualOverride(true);

    let verifiedOnSite = false;
    if (deviceCoords) {
      const distance = calculateGeodesicDistanceMeters(
        deviceCoords.lat,
        deviceCoords.lng,
        newLat,
        newLng
      );
      verifiedOnSite = distance <= onSiteThresholdMeters;
    }

    updatePin(newLat, newLng, accuracy || 50, verifiedOnSite);
    emitLocation(detailsRef.current);

    // Refresh administrative details for the manually chosen pin
    fetchLocationDetails(newLat, newLng);
  };

  // A deliberate tap on "Re-acquire" overrides the manual lock (citizen wants GPS back)
  const handleReAcquire = () => {
    manualOverrideRef.current = false;
    setErrorStatus(null);
    acquireGPS();
  };

  return (
    <div className="p-5 rounded-3xl border transition-colors space-y-4
                    bg-slate-50 border-slate-200 text-slate-800 
                    dark:bg-slate-950/70 dark:border-slate-800 dark:text-slate-200">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold">{t.geoTitle}</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Locking exact incident coordinates</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReAcquire}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition disabled:opacity-50
                     bg-white border-slate-200 text-slate-700 hover:bg-slate-100 
                     dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Acquiring...' : 'Re-acquire'}</span>
        </button>
      </div>

      {errorStatus && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorStatus}</span>
        </div>
      )}

      {/* Search / type a location — works even when GPS is unavailable (remote reporting) */}
      <div ref={searchBoxRef} className="relative">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1.5 mb-1.5">
          <Search className="w-3 h-3" />
          <span>{t.locSearchIntro}</span>
        </p>
        <div className="flex items-center space-x-2 px-3 py-2.5 rounded-2xl border transition-colors
                        bg-white border-slate-200/80 text-slate-800
                        dark:bg-slate-900/60 dark:border-slate-800/80 dark:text-slate-200">
          <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            placeholder={t.locSearchPlaceholder}
            className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          {searching && <Loader2 className="w-4 h-4 animate-spin text-sky-500 flex-shrink-0" />}
          {searchQuery && !searching && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}
              className="flex-shrink-0 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        {showResults && (searching || searchError || searchResults.length > 0 || searchQuery.trim().length >= 3) && (
          <div className="absolute left-0 right-0 top-full mt-2 z-20 max-h-56 overflow-y-auto rounded-2xl border shadow-2xl backdrop-blur-xl
                          bg-white/95 border-slate-200 text-slate-700
                          dark:bg-slate-900/95 dark:border-slate-800 dark:text-slate-200">
            {searching ? (
              <p className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
                <span>{t.locSearching}</span>
              </p>
            ) : searchError ? (
              <p className="px-4 py-3 text-xs text-amber-600 dark:text-amber-400">{t.locSearchError}</p>
            ) : searchResults.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{t.locNoResults}</p>
            ) : (
              searchResults.map((hit, i) => (
                <button
                  key={`${hit.lat},${hit.lon},${i}`}
                  type="button"
                  // Keep focus on the input so this click is never cancelled by a blur-triggered close
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySearchedPlace(hit)}
                  className="w-full text-left px-4 py-2.5 flex items-start space-x-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <MapPin className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{hit.label}</span>
                    {hit.sublabel && <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">{hit.sublabel}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1.5 mt-1.5">
          <Navigation className="w-3 h-3 text-sky-500 flex-shrink-0" />
          <span>Type any place to pin it here — even when location access is off — or use GPS for your exact spot.</span>
        </p>
      </div>

      {/* Status Badges */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl border transition-colors
                        bg-white border-slate-200/80 
                        dark:bg-slate-900/60 dark:border-slate-800/80">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block mb-1">On-Site Lock</span>
          <div className="flex items-center space-x-1.5">
            {isOnSite ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Verified On-Site</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0" />
                <span className="text-xs font-bold text-sky-700 dark:text-sky-300">Remote Pin</span>
              </>
            )}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border transition-colors
                        bg-white border-slate-200/80 
                        dark:bg-slate-900/60 dark:border-slate-800/80">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block mb-1">GPS Accuracy</span>
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {accuracy !== null ? `±${Math.round(accuracy)} meters` : 'Manual Estimate'}
          </div>
        </div>
      </div>

      {/* Fetched Administrative Details: State / District / Mandal / PIN Code */}
      <div className="p-4 rounded-2xl border transition-colors space-y-3
                      bg-white border-slate-200/80 
                      dark:bg-slate-900/60 dark:border-slate-800/80">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
            {t.locDetails}
          </span>
          {locLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500 ml-auto" />}
        </div>

        {locLoading && !locationDetails ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{t.loadingLoc}</span>
          </p>
        ) : locError && !locationDetails ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">{t.locUnavailable}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">{t.state}</span>
              <strong className="text-slate-800 dark:text-slate-100 block truncate">{locationDetails?.state || '—'}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">{t.district}</span>
              <strong className="text-slate-800 dark:text-slate-100 block truncate">{locationDetails?.district || '—'}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">{t.mandal}</span>
              <strong className="text-slate-800 dark:text-slate-100 block truncate">{locationDetails?.mandal || '—'}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">{t.pincode}</span>
              <strong className="text-slate-800 dark:text-slate-100 block truncate">{locationDetails?.pincode || '—'}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Lat/Lng display and manual override toggle */}
      <div className="p-3 rounded-2xl border font-mono text-xs flex items-center justify-between transition-colors
                      bg-white border-slate-200 text-slate-700 
                      dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300">
        <div className="flex items-center space-x-3">
          <span>{t.latLabel}: <strong className="text-emerald-600 dark:text-emerald-400">{selectedLat.toFixed(5)}</strong></span>
          <span>{t.lngLabel}: <strong className="text-emerald-600 dark:text-emerald-400">{selectedLng.toFixed(5)}</strong></span>
        </div>
        <button
          type="button"
          onClick={() => setIsManualOverride(!isManualOverride)}
          className="text-xs font-medium px-2.5 py-1 rounded-lg border transition
                     bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900
                     dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white"
        >
          <SlidersHorizontal className="w-3 h-3 inline mr-1" />
          <span>{isManualOverride ? 'Auto' : 'Adjust'}</span>
        </button>
      </div>

      {isManualOverride && (
        <div className="p-4 rounded-2xl border text-xs space-y-3 transition-colors
                        bg-white border-slate-200 dark:bg-slate-900/80 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-xs">
            Fine-tune coordinates manually if reporting remotely:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">{t.latLabel}</label>
              <input
                type="number"
                step="0.0001"
                value={selectedLat}
                onChange={(e) => handleManualCoordChange(parseFloat(e.target.value) || 0, selectedLng)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">{t.lngLabel}</label>
              <input
                type="number"
                step="0.0001"
                value={selectedLng}
                onChange={(e) => handleManualCoordChange(selectedLat, parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="flex items-start space-x-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>State / district / mandal / pincode refresh automatically when the pin moves.</span>
          </div>
        </div>
      )}
    </div>
  );
};