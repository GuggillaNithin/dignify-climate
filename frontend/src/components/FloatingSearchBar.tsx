import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Search,
  X,
  Loader2,
  MapPin,
  Flame,
  CloudSun,
  CloudRain,
  Navigation,
  Check,
  ShieldCheck,
  Sliders,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import type { PointCoordinate, GeocodingResult } from '../types/api';
import { searchPlaces } from '../api/client';
import type { HazardType } from './DashboardShell';
import {
  SUPPORTED_OBSERVATORIES,
  type SupportedObservatory,
} from '../utils/globeTextures';
import {
  AnalysisControlsPanel,
  type AnalysisControlsPanelProps,
} from './AnalysisControlsPanel';

interface FloatingSearchBarProps {
  locationName: string;
  onLocationSelect: (location: { name: string; point: PointCoordinate }) => void;
  selectedHazard: HazardType;
  onHazardChange: (hazard: HazardType) => void;
  thresholdPercentile?: number;
  thresholdValue?: number;
  thresholdUnit?: string;
  onToggleNavRail?: () => void;
  isNavExpanded?: boolean;
  selectedPoint?: PointCoordinate;
  onShortcutSelect?: (station: SupportedObservatory) => void;
  isControlsOpen?: boolean;
  onToggleControls?: () => void;
  startYear?: number;
  endYear?: number;
  isDirty?: boolean;
  isAnalyzing?: boolean;
  controlsProps?: Omit<AnalysisControlsPanelProps, 'isOpen' | 'onClose'>;
}

// Preset locations for rapid 1-click climate analysis
const QUICK_PRESETS: Array<{ name: string; country: string; lat: number; lon: number }> = [
  { name: 'Mumbai', country: 'India', lat: 19.0760, lon: 72.8777 },
  { name: 'Tokyo', country: 'Japan', lat: 35.6895, lon: 139.6917 },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
  { name: 'Phoenix', country: 'United States', lat: 33.4484, lon: -112.0740 },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lon: 12.4964 },
  { name: 'Nairobi', country: 'Kenya', lat: -1.2921, lon: 36.8219 },
];

export const FloatingSearchBar: React.FC<FloatingSearchBarProps> = ({
  locationName,
  onLocationSelect,
  selectedHazard,
  onHazardChange,
  thresholdPercentile,
  thresholdValue,
  thresholdUnit = '°C',
  selectedPoint,
  onShortcutSelect,
  isControlsOpen = false,
  onToggleControls,
  startYear,
  endYear,
  isDirty = false,
  isAnalyzing = false,
  controlsProps,
}) => {
  const [query, setQuery] = useState(locationName || 'Mumbai, India');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Sync internal search input when external locationName changes
  useEffect(() => {
    if (locationName) {
      setQuery(locationName);
    }
  }, [locationName]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if input looks like coordinates (lat, lon)
  const parseCoordinates = (input: string): PointCoordinate | null => {
    const match = input.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[3]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { latitude: lat, longitude: lon };
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setErrorMessage(null);

    // If query is short, clear results
    if (val.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // Check for direct coordinate input
    const coords = parseCoordinates(val.trim());
    if (coords) {
      setResults([]);
      setIsOpen(true);
      return;
    }

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await searchPlaces(val.trim(), 5);
        if (res.data && res.data.results) {
          setResults(res.data.results);
          setIsOpen(true);
        } else if (res.error) {
          setErrorMessage(res.error);
          setIsOpen(true);
        }
      } catch {
        setErrorMessage('Failed to search locations');
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  const handleSelectGeocoded = (item: GeocodingResult) => {
    const fullName = `${item.name}${item.admin1 ? `, ${item.admin1}` : ''}, ${item.country}`;
    setQuery(fullName);
    setIsOpen(false);
    onLocationSelect({
      name: fullName,
      point: { latitude: item.latitude, longitude: item.longitude },
    });
  };

  const handleSelectCoords = (coords: PointCoordinate) => {
    const label = `${coords.latitude.toFixed(4)}°N, ${coords.longitude.toFixed(4)}°E`;
    setQuery(label);
    setIsOpen(false);
    onLocationSelect({
      name: label,
      point: coords,
    });
  };

  const handleSelectPreset = (preset: typeof QUICK_PRESETS[0]) => {
    const label = `${preset.name}, ${preset.country}`;
    setQuery(label);
    setIsOpen(false);
    onLocationSelect({
      name: label,
      point: { latitude: preset.lat, longitude: preset.lon },
    });
  };

  const handleSelectStation = (obs: SupportedObservatory) => {
    if (onShortcutSelect) {
      onShortcutSelect(obs);
    } else {
      const label = `${obs.name}, ${obs.country}`;
      setQuery(label);
      setIsOpen(false);
      onLocationSelect({
        name: label,
        point: { latitude: obs.latitude, longitude: obs.longitude },
      });
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const parsedCoord = parseCoordinates(query.trim());

  return (
    <div
      ref={searchContainerRef}
      className="absolute top-3 left-3 sm:top-4 sm:left-4 z-30 w-[calc(100%-1.5rem)] sm:w-[460px] md:w-[480px] max-w-[calc(100vw-2rem)] pointer-events-auto max-h-[calc(100vh-5rem)] flex flex-col"
    >
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xl flex flex-col gap-2.5 text-slate-800 transition-all max-h-[calc(100vh-5.5rem)]">
        {/* Row 1: Workspace Heading & Subtitle */}
        <div className="flex items-start justify-between gap-2 pb-1 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Layers className="w-4 h-4 text-teal-700 shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 tracking-wide uppercase">
                Interactive 2D Climate Map
              </h2>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-800 font-semibold shrink-0">
                ECMWF ERA5
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
              Spatial climate hazard reanalysis & deterministic grid metrics
            </p>
          </div>
        </div>

        {/* Row 2: Location Search Bar with Autocomplete Dropdown */}
        <div className="relative">
          <div className="relative flex items-center bg-slate-50/90 hover:bg-slate-50 rounded-xl border border-slate-200 h-10 px-3 transition-colors focus-within:ring-2 focus-within:ring-teal-600 focus-within:border-transparent focus-within:bg-white">
            <div className="flex items-center text-slate-400 mr-2">
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
              ) : (
                <Search className="w-3.5 h-3.5 text-slate-500" />
              )}
            </div>

            <input
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={() => {
                if (results.length > 0 || parsedCoord || query.length === 0) {
                  setIsOpen(true);
                }
              }}
              placeholder="Search city, region or lat, lon..."
              className="flex-1 bg-transparent border-none text-slate-800 placeholder-slate-400 text-xs sm:text-sm font-medium focus:outline-none"
              aria-label="Search location or coordinates"
            />

            {query.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition mr-1"
                title="Clear search input"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="h-4 w-px bg-slate-200 mx-1" />

            {/* Current Location GPS target button */}
            <button
              type="button"
              onClick={() => {
                if ('geolocation' in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const lat = Math.round(pos.coords.latitude * 10000) / 10000;
                      const lon = Math.round(pos.coords.longitude * 10000) / 10000;
                      handleSelectCoords({ latitude: lat, longitude: lon });
                    },
                    () => {
                      // Fallback to Mumbai if geolocation denied
                      handleSelectPreset(QUICK_PRESETS[0]);
                    }
                  );
                }
              }}
              className="p-1 text-teal-700 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition"
              title="Use current device location"
              aria-label="Detect current location"
            >
              <Navigation className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dropdown Menu: Search Results or Quick Presets */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200/90 overflow-hidden z-50 max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-150">
              {/* Direct Coordinate Option */}
              {parsedCoord && (
                <button
                  type="button"
                  onClick={() => handleSelectCoords(parsedCoord)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-teal-50/60 flex items-center gap-2.5 transition"
                >
                  <Navigation className="w-4 h-4 text-teal-700 shrink-0" />
                  <div className="flex-1 truncate">
                    <span className="text-xs font-bold text-slate-900">Target Coordinates: </span>
                    <span className="text-[11px] font-mono text-teal-700">
                      {parsedCoord.latitude.toFixed(4)}°N, {parsedCoord.longitude.toFixed(4)}°E
                    </span>
                  </div>
                </button>
              )}

              {/* Autocomplete Geocoding Results */}
              {results.length > 0 &&
                results.map((item) => (
                  <button
                    key={`${item.id}-${item.latitude}-${item.longitude}`}
                    type="button"
                    onClick={() => handleSelectGeocoded(item)}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between transition group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-slate-900 group-hover:text-teal-900 truncate">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate">
                        {item.admin1 ? `${item.admin1}, ` : ''}{item.country}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 pl-2">
                      {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}°
                    </span>
                  </button>
                ))}

              {/* Error state */}
              {errorMessage && (
                <div className="px-3.5 py-2 text-xs text-rose-600 bg-rose-50/60">
                  {errorMessage}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Row 3: Hazard Filter Chips & Threshold Pill */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {/* Heatwave Chip */}
          <button
            type="button"
            onClick={() => onHazardChange('heatwave')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs transition whitespace-nowrap ${
              selectedHazard === 'heatwave'
                ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold ring-1 ring-amber-300'
                : 'bg-slate-50 hover:bg-white border-slate-200 text-slate-700'
            }`}
            aria-pressed={selectedHazard === 'heatwave'}
          >
            <Flame
              className={`w-3.5 h-3.5 ${
                selectedHazard === 'heatwave' ? 'text-amber-600' : 'text-amber-500'
              }`}
            />
            <span>Heatwave</span>
            {selectedHazard === 'heatwave' && <Check className="w-3 h-3 text-amber-700 ml-0.5" />}
          </button>

          {/* Drought Chip */}
          <button
            type="button"
            onClick={() => onHazardChange('drought')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs transition whitespace-nowrap ${
              selectedHazard === 'drought'
                ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold ring-1 ring-amber-300'
                : 'bg-slate-50 hover:bg-white border-slate-200 text-slate-700'
            }`}
            aria-pressed={selectedHazard === 'drought'}
          >
            <CloudSun
              className={`w-3.5 h-3.5 ${
                selectedHazard === 'drought' ? 'text-amber-600' : 'text-amber-500'
              }`}
            />
            <span>Drought</span>
            {selectedHazard === 'drought' && <Check className="w-3 h-3 text-amber-700 ml-0.5" />}
          </button>

          {/* Heavy Rainfall Chip */}
          <button
            type="button"
            onClick={() => onHazardChange('heavy_rainfall')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs transition whitespace-nowrap ${
              selectedHazard === 'heavy_rainfall'
                ? 'bg-teal-50 border-teal-300 text-teal-900 font-semibold ring-1 ring-teal-300'
                : 'bg-slate-50 hover:bg-white border-slate-200 text-slate-700'
            }`}
            aria-pressed={selectedHazard === 'heavy_rainfall'}
          >
            <CloudRain
              className={`w-3.5 h-3.5 ${
                selectedHazard === 'heavy_rainfall' ? 'text-teal-700' : 'text-teal-600'
              }`}
            />
            <span>Heavy rainfall</span>
            {selectedHazard === 'heavy_rainfall' && <Check className="w-3 h-3 text-teal-800 ml-0.5" />}
          </button>

          {/* Operational Threshold Pill Indicator (Clickable to toggle scientific controls) */}
          {thresholdPercentile !== undefined && (
            <button
              type="button"
              onClick={onToggleControls}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-mono shadow-xs border border-slate-700 shrink-0 whitespace-nowrap transition cursor-pointer"
              title="Active verified operational climate threshold. Click to adjust scientific controls."
            >
              <span className="text-teal-300 font-semibold">
                {thresholdPercentile}th %ile
              </span>
              {thresholdValue !== undefined && (
                <span className="text-slate-200">
                  ({thresholdValue.toFixed(1)} {thresholdUnit})
                </span>
              )}
            </button>
          )}

          {/* Temporal Window Pill (Clickable to toggle controls) */}
          {startYear !== undefined && endYear !== undefined && (
            <button
              type="button"
              onClick={onToggleControls}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono border border-slate-300 shrink-0 whitespace-nowrap transition"
              title="Observation window. Click to adjust start and end years."
            >
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>{startYear}–{endYear}</span>
            </button>
          )}
        </div>

        {/* Row 4: Location Shortcut Chips (Curated Observatories) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
          <span className="text-[10px] font-mono uppercase text-slate-500 shrink-0 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
            <span className="hidden sm:inline">Reference Stations:</span>
          </span>
          {SUPPORTED_OBSERVATORIES.map((obs) => {
            const isMatch =
              selectedPoint &&
              Math.abs(selectedPoint.latitude - obs.latitude) < 0.05 &&
              Math.abs(selectedPoint.longitude - obs.longitude) < 0.05;
            return (
              <button
                key={obs.name}
                type="button"
                onClick={() => handleSelectStation(obs)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-mono shrink-0 transition-all border ${
                  isMatch
                    ? 'bg-teal-700 text-white border-teal-800 shadow-xs font-semibold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title={`${obs.name}, ${obs.country} (${obs.climateZone})`}
              >
                {obs.name}
              </button>
            );
          })}
        </div>

        {/* Row 5: Primary Scientific Controls Option (Below Reference Stations) */}
        {onToggleControls && (
          <div className="pt-1.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onToggleControls}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition shadow-xs group ${
                isControlsOpen
                  ? 'bg-teal-700 text-white border-teal-800 ring-1 ring-teal-600'
                  : 'bg-slate-50 hover:bg-slate-100/90 text-slate-800 border-slate-200 hover:border-slate-300'
              }`}
              title={isControlsOpen ? 'Collapse analysis controls' : 'Expand scientific analysis controls'}
              aria-expanded={isControlsOpen}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`p-1 rounded-lg transition-transform ${
                    isControlsOpen
                      ? 'bg-teal-800 text-teal-100'
                      : 'bg-white text-teal-700 border border-slate-200 shadow-2xs group-hover:scale-105'
                  }`}
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                  ) : (
                    <Sliders className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5 leading-tight">
                    <span className="font-bold text-xs">Scientific Analysis Controls</span>
                    {isDirty && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Unapplied Changes
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] block ${isControlsOpen ? 'text-teal-100' : 'text-slate-500'}`}>
                    Configure operational thresholds, baseline periods & sampling
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[11px] font-semibold shrink-0">
                <span>{isControlsOpen ? 'Hide' : 'Configure'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isControlsOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>
          </div>
        )}

        {/* Expandable Scientific Analysis Controls Panel */}
        {isControlsOpen && controlsProps && (
          <AnalysisControlsPanel
            isOpen={isControlsOpen}
            onClose={onToggleControls || (() => {})}
            {...controlsProps}
          />
        )}
      </div>
    </div>
  );
};

