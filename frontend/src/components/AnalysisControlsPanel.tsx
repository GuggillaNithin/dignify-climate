import React from 'react';
import {
  Sliders,
  Calendar,
  Flame,
  CloudSun,
  CloudRain,
  MapPin,
  Maximize2,
  RotateCcw,
  Play,
  Check,
  AlertCircle,
  Info,
  X,
  Loader2,
} from 'lucide-react';
import type {
  PointCoordinate,
  BoundingBox,
  AnalysisResponse,
} from '../types/api';
import type { HazardType } from './DashboardShell';

export interface AnalysisControlsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  locationName: string;

  // Draft parameters
  draftSpatialMode: 'point' | 'bounding_box';
  onDraftSpatialModeChange: (mode: 'point' | 'bounding_box') => void;
  draftPoint: PointCoordinate;
  onDraftPointChange: (point: PointCoordinate) => void;
  draftBounds: BoundingBox;
  onDraftBoundsChange: (bounds: BoundingBox) => void;
  draftSampleDensity: number;
  onDraftSampleDensityChange: (density: number) => void;
  draftHazard: HazardType;
  onDraftHazardChange: (hazard: HazardType) => void;
  draftStartYear: number;
  onDraftStartYearChange: (yr: number) => void;
  draftEndYear: number;
  onDraftEndYearChange: (yr: number) => void;
  draftPercentile: number;
  onDraftPercentileChange: (p: number) => void;
  draftMinConsecutiveDays: number;
  onDraftMinConsecutiveDaysChange: (d: number) => void;
  draftMinSpatialCoveragePct: number;
  onDraftMinSpatialCoveragePctChange: (pct: number) => void;

  // Applied values & execution state
  appliedPercentile: number;
  appliedStartYear: number;
  appliedEndYear: number;
  appliedHazard: HazardType;
  isDirty: boolean;
  isAnalyzing: boolean;
  analysisResult: AnalysisResponse | null;
  analysisError: string | null;

  // Actions
  onApplyAnalysis: () => void;
  onResetToDefaults: () => void;
  onOpenAnalysisDrawer?: () => void;
}

export const AnalysisControlsPanel: React.FC<AnalysisControlsPanelProps> = ({
  isOpen,
  onClose,
  locationName,
  draftSpatialMode,
  onDraftSpatialModeChange,
  draftPoint,
  onDraftPointChange,
  draftBounds,
  onDraftBoundsChange,
  draftSampleDensity,
  onDraftSampleDensityChange,
  draftHazard,
  onDraftHazardChange,
  draftStartYear,
  onDraftStartYearChange,
  draftEndYear,
  onDraftEndYearChange,
  draftPercentile,
  onDraftPercentileChange,
  draftMinConsecutiveDays,
  onDraftMinConsecutiveDaysChange,
  draftMinSpatialCoveragePct,
  onDraftMinSpatialCoveragePctChange,
  appliedPercentile,
  appliedStartYear,
  appliedEndYear,
  appliedHazard,
  isDirty,
  isAnalyzing,
  analysisResult,
  analysisError,
  onApplyAnalysis,
  onResetToDefaults,
  onOpenAnalysisDrawer,
}) => {
  if (!isOpen) return null;

  // Validation
  const currentYear = new Date().getFullYear();
  const isDateRangeValid =
    draftStartYear <= draftEndYear &&
    draftStartYear >= 1940 &&
    draftEndYear <= currentYear;

  const dateValidationError =
    draftStartYear > draftEndYear
      ? `Start year (${draftStartYear}) cannot exceed end year (${draftEndYear}).`
      : draftStartYear < 1940
      ? `Start year (${draftStartYear}) precedes the ERA5 archive limit (1940).`
      : draftEndYear > currentYear
      ? `End year (${draftEndYear}) cannot exceed current year (${currentYear}).`
      : null;

  // Derived threshold display from active response or definitions
  const activeThresholdValue =
    analysisResult?.definitions_summary?.threshold_value ??
    analysisResult?.point_results?.[0]?.threshold_value;

  const activeThresholdUnit =
    analysisResult?.definitions_summary?.threshold_unit ??
    analysisResult?.point_results?.[0]?.threshold_unit ??
    (draftHazard === 'heavy_rainfall' ? 'mm' : draftHazard === 'drought' ? 'deficit' : '°C');

  const activeThresholdPercentile =
    analysisResult?.definitions_summary?.threshold_percentile ??
    analysisResult?.point_results?.[0]?.threshold_percentile ??
    appliedPercentile;

  return (
    <div
      role="region"
      aria-label="Scientific Analysis Controls"
      className="mt-2 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xl p-4 sm:p-5 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[calc(100vh-370px)] sm:max-h-[calc(100vh-390px)] min-h-[220px] overflow-y-auto space-y-4 font-sans select-text pb-6"
    >
      {/* 1. Header Bar: Title, Draft/Applied Status Badge, Close */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800">
            <Sliders className="w-4 h-4 text-teal-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                Analysis Controls
              </h3>
              {isDirty ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Draft changes pending
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <Check className="w-3 h-3 text-emerald-600" />
                  Applied & Verified
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
              Empirical climate thresholds, observation window & hazard parameters
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          title="Close analysis controls panel"
          aria-label="Close controls panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Active Baseline Status Banner */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 flex items-center justify-between text-[11px] text-slate-600">
        <span className="font-medium text-slate-500">Active in Analysis:</span>
        <div className="flex items-center gap-2 font-mono text-slate-700">
          <span className="capitalize font-semibold text-teal-800">{appliedHazard.replace('_', ' ')}</span>
          <span>•</span>
          <span className="font-semibold">{appliedPercentile}th %ile</span>
          <span>•</span>
          <span className="font-semibold">{appliedStartYear}–{appliedEndYear}</span>
        </div>
      </div>

      {/* 2. Location & Spatial Mode Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-teal-700" />
            <span>Target Location & Spatial Aggregation</span>
          </label>
          <span className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">
            {locationName}
          </span>
        </div>

        {/* Spatial Mode Selector: Single Point vs Bounding Box */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => onDraftSpatialModeChange('point')}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              draftSpatialMode === 'point'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Single ERA5 Cell (~11 km)</span>
          </button>
          <button
            type="button"
            onClick={() => onDraftSpatialModeChange('bounding_box')}
            className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              draftSpatialMode === 'bounding_box'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Regional Bounding Box</span>
          </button>
        </div>

        {/* Coordinate Inputs */}
        {draftSpatialMode === 'point' ? (
          <div className="grid grid-cols-2 gap-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                Latitude (-90° to 90°)
              </label>
              <input
                type="number"
                step="0.0001"
                min="-90"
                max="90"
                value={draftPoint.latitude}
                onChange={(e) =>
                  onDraftPointChange({
                    ...draftPoint,
                    latitude: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800 focus:ring-1 focus:ring-teal-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                Longitude (-180° to 180°)
              </label>
              <input
                type="number"
                step="0.0001"
                min="-180"
                max="180"
                value={draftPoint.longitude}
                onChange={(e) =>
                  onDraftPointChange({
                    ...draftPoint,
                    longitude: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800 focus:ring-1 focus:ring-teal-600 focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200">
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              <div>
                <label className="block text-[9px] font-medium text-slate-500 mb-0.5">North</label>
                <input
                  type="number"
                  step="0.01"
                  value={draftBounds.north}
                  onChange={(e) =>
                    onDraftBoundsChange({ ...draftBounds, north: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[9px] font-medium text-slate-500 mb-0.5">South</label>
                <input
                  type="number"
                  step="0.01"
                  value={draftBounds.south}
                  onChange={(e) =>
                    onDraftBoundsChange({ ...draftBounds, south: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[9px] font-medium text-slate-500 mb-0.5">West</label>
                <input
                  type="number"
                  step="0.01"
                  value={draftBounds.west}
                  onChange={(e) =>
                    onDraftBoundsChange({ ...draftBounds, west: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[9px] font-medium text-slate-500 mb-0.5">East</label>
                <input
                  type="number"
                  step="0.01"
                  value={draftBounds.east}
                  onChange={(e) =>
                    onDraftBoundsChange({ ...draftBounds, east: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-mono text-slate-800"
                />
              </div>
            </div>

            {/* Regional Sample Density Slider */}
            <div className="pt-1.5 border-t border-slate-200">
              <div className="flex justify-between items-center text-[10px] text-slate-600 mb-1">
                <span>Sampled Grid Points:</span>
                <span className="font-mono font-bold text-teal-800">{draftSampleDensity} cells</span>
              </div>
              <input
                type="range"
                min="4"
                max="16"
                step="1"
                value={draftSampleDensity}
                onChange={(e) => onDraftSampleDensityChange(parseInt(e.target.value, 10))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>4 (2×2)</span>
                <span>9 (3×3)</span>
                <span>16 (4×4)</span>
              </div>
            </div>

            {/* Minimum Spatial Coverage Slider */}
            <div className="pt-1.5 border-t border-slate-200">
              <div className="flex justify-between items-center text-[10px] text-slate-600 mb-1">
                <span>Min Spatial Coverage Gate:</span>
                <span className="font-mono font-bold text-teal-800">{draftMinSpatialCoveragePct}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={draftMinSpatialCoveragePct}
                onChange={(e) => onDraftMinSpatialCoveragePctChange(parseInt(e.target.value, 10))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>50%</span>
                <span>75% (default)</span>
                <span>95%</span>
              </div>
            </div>
          </div>
        )}

        <p className="text-[10px] text-slate-500 italic">
          {draftSpatialMode === 'point'
            ? 'Single coordinate represents the nearest ~11 km ERA5 cell. No municipal interpolation applied.'
            : 'Regional bounding box evaluated with spherical cosine-latitude area weighting.'}
        </p>
      </div>

      {/* 3. Climate Hazard Selection */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <span>Climate Hazard</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => onDraftHazardChange('heatwave')}
            className={`py-2 px-2 rounded-xl text-xs font-semibold transition border flex flex-col items-center gap-1 ${
              draftHazard === 'heatwave'
                ? 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-300 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-600" />
            <span>Heatwave</span>
          </button>
          <button
            type="button"
            onClick={() => onDraftHazardChange('drought')}
            className={`py-2 px-2 rounded-xl text-xs font-semibold transition border flex flex-col items-center gap-1 ${
              draftHazard === 'drought'
                ? 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-300 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <CloudSun className="w-4 h-4 text-amber-600" />
            <span>Drought</span>
          </button>
          <button
            type="button"
            onClick={() => onDraftHazardChange('heavy_rainfall')}
            className={`py-2 px-2 rounded-xl text-xs font-semibold transition border flex flex-col items-center gap-1 ${
              draftHazard === 'heavy_rainfall'
                ? 'bg-teal-50 text-teal-900 border-teal-300 ring-1 ring-teal-300 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <CloudRain className="w-4 h-4 text-teal-700" />
            <span>Rainfall</span>
          </button>
        </div>
      </div>

      {/* 4. Operational Percentile Threshold Selector */}
      <div className="space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <span>Operational Percentile Threshold</span>
          </label>
          <span className="text-[11px] font-mono font-bold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded border border-teal-200">
            {draftPercentile}th percentile
          </span>
        </div>

        {/* Percentile Option Chips */}
        <div className="grid grid-cols-4 gap-1.5">
          {[90, 95, 97.5, 99].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => onDraftPercentileChange(pct)}
              className={`py-1.5 rounded-lg text-xs font-mono font-semibold transition border ${
                draftPercentile === pct
                  ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {pct}th %ile
            </button>
          ))}
        </div>

        {/* Custom Percentile Value Slider */}
        <div className="pt-1.5 border-t border-slate-200/80">
          <div className="flex justify-between items-center text-[10px] text-slate-600 mb-1">
            <span>Custom Percentile Value:</span>
            <span className="font-mono font-bold text-teal-800">{draftPercentile}%</span>
          </div>
          <input
            type="range"
            min="80"
            max="99.9"
            step="0.5"
            value={draftPercentile}
            onChange={(e) => onDraftPercentileChange(parseFloat(e.target.value))}
            className="w-full accent-teal-700 cursor-pointer"
            aria-label="Custom Percentile Value"
          />
        </div>

        {/* Derived Threshold Display */}
        <div className="mt-1 flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200">
          <span className="text-slate-500 font-medium">Applied Threshold:</span>
          <span className="font-mono font-bold text-slate-900">
            {activeThresholdPercentile}th %ile
            {activeThresholdValue !== undefined && activeThresholdValue !== null
              ? ` (${typeof activeThresholdValue === 'number' ? activeThresholdValue.toFixed(1) : activeThresholdValue} ${activeThresholdUnit})`
              : ''}
          </span>
        </div>

        {/* Methodology explanation note */}
        <div className="text-[10px] text-slate-500 leading-relaxed flex items-start gap-1.5 pt-0.5">
          <Info className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
          <span>
            {draftHazard === 'heatwave' &&
              'Daily maximum temperature exceeding this percentile triggers heatwave event criteria. At 99th %ile, Mumbai records 4 events (36.0 °C, p=0.0449); at 95th %ile, it records 17 events (34.2 °C, p=0.0269).'}
            {draftHazard === 'drought' &&
              'Deficit ratio relative to climatological norm. Days where rolling 90-day precipitation falls below this threshold qualify as deficit days.'}
            {draftHazard === 'heavy_rainfall' &&
              'Calculated strictly from valid wet days (precipitation ≥ 1.0 mm). Daily rainfall above this threshold qualifies as an extreme storm day.'}
          </span>
        </div>
      </div>

      {/* 5. Analysis Observation Window (Start Year & End Year) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-teal-700" />
            <span>Analysis Observation Window</span>
          </label>
          <span className="text-[10px] font-mono text-slate-500">
            {draftEndYear - draftStartYear + 1} calendar years
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
              Start Year (≥ 1940)
            </label>
            <input
              type="number"
              min="1940"
              max={draftEndYear}
              value={draftStartYear}
              onChange={(e) => onDraftStartYearChange(parseInt(e.target.value, 10) || 2015)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:ring-1 focus:ring-teal-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
              End Year (≤ {currentYear})
            </label>
            <input
              type="number"
              min={draftStartYear}
              max={currentYear}
              value={draftEndYear}
              onChange={(e) => onDraftEndYearChange(parseInt(e.target.value, 10) || 2023)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:ring-1 focus:ring-teal-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Quick Year Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400 font-medium">Presets:</span>
          <button
            type="button"
            onClick={() => {
              onDraftStartYearChange(2015);
              onDraftEndYearChange(2023);
            }}
            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
          >
            2015–2023 (Audit)
          </button>
          <button
            type="button"
            onClick={() => {
              onDraftStartYearChange(2010);
              onDraftEndYearChange(2023);
            }}
            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
          >
            2010–2023 (14y)
          </button>
          <button
            type="button"
            onClick={() => {
              onDraftStartYearChange(2000);
              onDraftEndYearChange(2023);
            }}
            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
          >
            2000–2023 (24y)
          </button>
        </div>

        {/* Validation Warning Alert */}
        {dateValidationError && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{dateValidationError}</span>
          </div>
        )}
      </div>

      {/* 6. Hazard-Specific Criteria */}
      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
          Detection Run Criteria
        </label>

        {draftHazard === 'heatwave' && (
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs text-slate-600">
              <span className="text-[11px]">Min Qualifying Duration:</span>
              <span className="font-mono font-bold text-slate-800">{draftMinConsecutiveDays} consecutive days</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[2, 3, 5].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDraftMinConsecutiveDaysChange(d)}
                  className={`py-1 rounded text-xs font-mono font-semibold transition border ${
                    draftMinConsecutiveDays === d
                      ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {d} days {d === 3 ? '(Default)' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {draftHazard === 'drought' && (
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs text-slate-600">
              <span className="text-[11px]">Min Deficit Streak:</span>
              <span className="font-mono font-bold text-slate-800">{draftMinConsecutiveDays} consecutive days</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[7, 14, 21].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDraftMinConsecutiveDaysChange(d)}
                  className={`py-1 rounded text-xs font-mono font-semibold transition border ${
                    draftMinConsecutiveDays === d
                      ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {d} days {d === 14 ? '(Default)' : ''}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 pt-0.5">
              Evaluated using 90-day seasonal rolling accumulation window (50% deficit cutoff).
            </p>
          </div>
        )}

        {draftHazard === 'heavy_rainfall' && (
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs text-slate-600">
              <span className="text-[11px]">Storm Run Grouping:</span>
              <span className="font-mono font-bold text-slate-800">{draftMinConsecutiveDays} day(s)</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDraftMinConsecutiveDaysChange(d)}
                  className={`py-1 rounded text-xs font-mono font-semibold transition border ${
                    draftMinConsecutiveDays === d
                      ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {d} day(s) {d === 1 ? '(Default)' : ''}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 pt-0.5">
              WMO standard wet day cutoff: Precipitation ≥ 1.0 mm/day.
            </p>
          </div>
        )}
      </div>

      {/* Error Banner if Analysis Failed */}
      {analysisError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{analysisError}</div>
        </div>
      )}

      {/* 7. Action Footer: Apply Analysis & Reset to Defaults */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={onApplyAnalysis}
          disabled={!isDateRangeValid || isAnalyzing}
          className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition shadow-xs ${
            !isDateRangeValid || isAnalyzing
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : isDirty
              ? 'bg-teal-700 hover:bg-teal-800 text-white ring-2 ring-teal-600/30'
              : 'bg-teal-700 hover:bg-teal-800 text-white'
          }`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Computing Reanalysis...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isDirty ? 'Apply Analysis' : 'Re-run Analysis'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onResetToDefaults}
          disabled={isAnalyzing}
          className="py-2.5 px-3.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5"
          title="Reset parameters to application defaults"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Optional Link to Full Drawer */}
      {onOpenAnalysisDrawer && (
        <button
          type="button"
          onClick={onOpenAnalysisDrawer}
          className="w-full text-center text-[11px] font-semibold text-teal-700 hover:text-teal-900 transition pt-1"
        >
          Open Detailed Charts, Tables & Report Export →
        </button>
      )}
    </div>
  );
};
