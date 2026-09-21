'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, 
  Navigation, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  SlidersHorizontal,
  Compass
} from 'lucide-react';
import { calculateGeodesicDistanceMeters } from '@/lib/spatial';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  isOnSite: boolean;
}

interface LocationPickerProps {
  onLocationResolved: (data: LocationData) => void;
  onSiteThresholdMeters?: number;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationResolved,
  onSiteThresholdMeters = 80,
}) => {
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLat, setSelectedLat] = useState<number>(12.9716);
  const [selectedLng, setSelectedLng] = useState<number>(77.5946);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [isOnSite, setIsOnSite] = useState<boolean>(true);

  const acquireGPS = useCallback(() => {
    if (!navigator.geolocation) {
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
        setDeviceCoords({ lat: latitude, lng: longitude });
        setSelectedLat(latitude);
        setSelectedLng(longitude);
        setAccuracy(acc);
        setIsOnSite(true);
        setIsManualOverride(false);
        setLoading(false);

        onLocationResolved({
          latitude,
          longitude,
          accuracyMeters: acc,
          isOnSite: true,
        });
      },
      (err) => {
        setLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setErrorStatus('Location permission denied. Switched to manual pinpointing.');
            setIsManualOverride(true);
            setIsOnSite(false);
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

        onLocationResolved({
          latitude: selectedLat,
          longitude: selectedLng,
          accuracyMeters: 50,
          isOnSite: false,
        });
      },
      geoOptions
    );
  }, [onLocationResolved, selectedLat, selectedLng]);

  useEffect(() => {
    acquireGPS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualCoordChange = (newLat: number, newLng: number) => {
    setSelectedLat(newLat);
    setSelectedLng(newLng);
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

    setIsOnSite(verifiedOnSite);
    onLocationResolved({
      latitude: newLat,
      longitude: newLng,
      accuracyMeters: accuracy || 50,
      isOnSite: verifiedOnSite,
    });
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
            <h4 className="text-xs sm:text-sm font-bold">Geolocation Verification</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Locking exact incident coordinates</p>
          </div>
        </div>

        <button
          type="button"
          onClick={acquireGPS}
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

      {/* Status Badges with Roomy Layout */}
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

      {/* Lat/Lng display and manual override toggle */}
      <div className="p-3 rounded-2xl border font-mono text-xs flex items-center justify-between transition-colors
                      bg-white border-slate-200 text-slate-700 
                      dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300">
        <div className="flex items-center space-x-3">
          <span>LAT: <strong className="text-emerald-600 dark:text-emerald-400">{selectedLat.toFixed(5)}</strong></span>
          <span>LNG: <strong className="text-emerald-600 dark:text-emerald-400">{selectedLng.toFixed(5)}</strong></span>
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
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={selectedLat}
                onChange={(e) => handleManualCoordChange(parseFloat(e.target.value) || 0, selectedLng)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={selectedLng}
                onChange={(e) => handleManualCoordChange(selectedLat, parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
