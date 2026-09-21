'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MapPin, 
  Crosshair, 
  AlertTriangle, 
  CheckCircle2, 
  Navigation, 
  RefreshCw, 
  Lock, 
  Unlock, 
  Info 
} from 'lucide-react';

export interface GeoLocationState {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  isOnSite: boolean;
  address?: string;
  source: 'gps_device' | 'manual_pin';
}

interface GeoVerificationMapProps {
  onLocationChange: (loc: GeoLocationState) => void;
  defaultCenter?: [number, number]; // [lat, lng]
}

export const GeoVerificationMap: React.FC<GeoVerificationMapProps> = ({
  onLocationChange,
  defaultCenter = [12.9716, 77.5946] // Default city center coordinates
}) => {
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultCenter[0],
    lng: defaultCenter[1]
  });
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isOnSite, setIsOnSite] = useState<boolean>(true);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Acquire high accuracy GPS coordinates via HTML5 Geolocation API
  const acquireDeviceGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('HTML5 Geolocation is not supported by your browser or device.');
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    const geoOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 5000
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy: acc } = position.coords;
        setCoords({ lat: latitude, lng: longitude });
        setAccuracy(Math.round(acc));
        setPermissionStatus('granted');
        setIsLocating(false);
        setIsLocked(true); // Lock coordinates when acquired directly on-site
        setIsOnSite(true);

        onLocationChange({
          latitude,
          longitude,
          accuracyMeters: Math.round(acc),
          isOnSite: true,
          source: 'gps_device'
        });
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setPermissionStatus('denied');
            setGeoError('Location permission denied. Please enable location in browser settings or drag the map pin manually.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoError('GPS signal unavailable. You can manually adjust the pin to indicate the incident location.');
            break;
          case error.TIMEOUT:
            setGeoError('Location acquisition timed out. Please retry or place pin manually.');
            break;
          default:
            setGeoError('An unexpected error occurred while fetching device location.');
            break;
        }
      },
      geoOptions
    );
  }, [onLocationChange]);

  // Initial attempt on component mount
  useEffect(() => {
    acquireDeviceGPS();
  }, [acquireDeviceGPS]);

  // Handle manual coordinate adjustment (remote reporting mode)
  const handleManualLocationUpdate = (newLat: number, newLng: number) => {
    if (isLocked) return;
    setCoords({ lat: newLat, lng: newLng });
    setAccuracy(null);
    onLocationChange({
      latitude: newLat,
      longitude: newLng,
      accuracyMeters: null,
      isOnSite,
      source: 'manual_pin'
    });
  };

  const toggleOnSite = () => {
    const nextState = !isOnSite;
    setIsOnSite(nextState);
    if (!nextState) {
      setIsLocked(false); // Unlock pin dragging when reporting remotely
    }
    onLocationChange({
      latitude: coords.lat,
      longitude: coords.lng,
      accuracyMeters: nextState ? accuracy : null,
      isOnSite: nextState,
      source: nextState && isLocked ? 'gps_device' : 'manual_pin'
    });
  };

  return (
    <div className="w-full max-w-xl mx-auto rounded-2xl bg-white dark:bg-slate-900 shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
              Geo-Verification & Location
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isOnSite ? 'Verified Physical Presence' : 'Remote / Manual Pin Placement'}
            </p>
          </div>
        </div>

        {/* GPS Refresh button */}
        <button
          type="button"
          onClick={acquireDeviceGPS}
          disabled={isLocating}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLocating ? 'animate-spin' : ''}`} />
          {isLocating ? 'Locating...' : 'Re-detect'}
        </button>
      </div>

      {/* Error / Warning Alert Banner */}
      {geoError && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 text-amber-800 dark:text-amber-200 flex items-start space-x-2 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p>{geoError}</p>
            {permissionStatus === 'denied' && (
              <span className="mt-1 block font-medium underline cursor-pointer" onClick={() => setIsOnSite(false)}>
                Switch to manual map pin placement
              </span>
            )}
          </div>
        </div>
      )}

      {/* Map Pin Area / Preview */}
      <div className="relative w-full h-56 bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center border-b border-slate-200 dark:border-slate-800">
        {/* Mock/Interactive Visual Canvas */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Center Target Indicator */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 animate-ping absolute -top-2 -left-2" />
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-lg text-white">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <span className="mt-2 text-xs font-mono font-medium px-2.5 py-1 bg-white/90 dark:bg-slate-800/90 shadow backdrop-blur-sm rounded-full text-slate-700 dark:text-slate-200">
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
          </span>
        </div>

        {/* Lock Overlay Status */}
        <div className="absolute top-3 right-3 z-20">
          <button
            type="button"
            onClick={() => setIsLocked(!isLocked)}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur shadow-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700"
          >
            {isLocked ? (
              <>
                <Lock className="w-3 h-3 text-emerald-500" />
                <span>GPS Locked</span>
              </>
            ) : (
              <>
                <Unlock className="w-3 h-3 text-amber-500" />
                <span>Movable Pin</span>
              </>
            )}
          </button>
        </div>

        {/* Accuracy Badge */}
        {accuracy !== null && (
          <div className="absolute bottom-3 left-3 z-20 flex items-center space-x-1.5 px-2.5 py-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-full text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700">
            <Crosshair className="w-3.5 h-3.5 text-blue-500" />
            <span>Accuracy: ±{accuracy}m</span>
          </div>
        )}
      </div>

      {/* Control Panel & Verification Mode */}
      <div className="p-4 space-y-3">
        {/* Toggle On-site vs Remote */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
              I am currently at the incident site
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              On-site reports receive higher geo-trust confidence scores
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={isOnSite} 
              onChange={toggleOnSite} 
              className="sr-only peer" 
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Info / Anti-tamper verification notice */}
        <div className="flex items-start space-x-2 text-[11px] text-slate-500 dark:text-slate-400 p-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-500" />
          <span>
            Uploaded photos will undergo automated EXIF metadata validation against your submitted coordinates to ensure spatial integrity.
          </span>
        </div>
      </div>
    </div>
  );
};

export default GeoVerificationMap;
