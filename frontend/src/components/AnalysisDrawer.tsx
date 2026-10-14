import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Download,
  FileText,
  Sliders,
  AlertTriangle,
  TrendingUp,
  Minus,
  CheckCircle2,
  AlertCircle,
  Database,
  BarChart3,
  Loader2,
  Sparkles,
  RotateCcw,
  Maximize2,
  Minimize2,
  GripVertical,
} from 'lucide-react';
import type {
  AnalysisResponse,
  PointCoordinate,
  BoundingBox,
  WeatherSeriesResponse,
} from '../types/api';
import type { HazardType } from './DashboardShell';
import { TrendAnalysisView } from './TrendAnalysisView';

interface AnalysisDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  locationName: string;
  spatialMode: 'point' | 'bounding_box';
  targetPoint: PointCoordinate;
  targetBounds: BoundingBox;
  selectedHazard: HazardType;
  startYear: number;
  endYear: number;
  percentileThreshold: number;
  minConsecutiveDays: number;
  minSpatialCoveragePct: number;
  sampleDensity: number;
  onSpatialModeChange: (mode: 'point' | 'bounding_box') => void;
  onHazardChange: (hazard: HazardType) => void;
  onStartYearChange: (yr: number) => void;
  onEndYearChange: (yr: number) => void;
  onPercentileChange: (p: number) => void;
  onMinConsecutiveDaysChange: (d: number) => void;
  isAnalyzing: boolean;
  analysisResult: AnalysisResponse | null;
  analysisError: string | null;
  onRunAnalysis: () => void;
  onResetToDefaults?: () => void;
  onExportAnnualCSV: () => void;
  onExportEventsCSV: () => void;
  onExportPDF: () => void;
  exportingType: 'annual_csv' | 'events_csv' | 'pdf' | null;
  exportError: string | null;
  onInspectWeatherStream: () => void;
  weatherData: WeatherSeriesResponse | null;
  isIngestingWeather: boolean;
  onOpenAIDrawer: () => void;
}

export const AnalysisDrawer: React.FC<AnalysisDrawerProps> = ({
  isOpen,
  onClose,
  locationName,
  spatialMode,
  targetPoint,
  targetBounds,
  selectedHazard,
  startYear,
  endYear,
  percentileThreshold,
  minConsecutiveDays,
  onHazardChange,
  onStartYearChange,
  onEndYearChange,
  onPercentileChange,
  onMinConsecutiveDaysChange,
  isAnalyzing,
  analysisResult,
  analysisError,
  onRunAnalysis,
  onResetToDefaults,
  onExportAnnualCSV,
  onExportEventsCSV,
  onExportPDF,
  exportingType,
  exportError,
  onInspectWeatherStream,
  weatherData,
  isIngestingWeather,
  onOpenAIDrawer,
}) => {
  const [showParamControls, setShowParamControls] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Draggable drawer width state with persistence
  const [width, setWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dygnify_analysis_drawer_width') || localStorage.getItem('terrascope_analysis_drawer_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 360 && parsed <= 1200) {
          return parsed;
        }
      }
      return 540;
    }
    return 540;
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  // Handle pointer/touch dragging to resize width
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const windowWidth = window.innerWidth;
      const minW = Math.min(360, windowWidth);
      const maxW = Math.max(minW, Math.min(1150, windowWidth - 48));
      const newWidth = Math.max(minW, Math.min(maxW, windowWidth - clientX));

      setWidth(newWidth);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      try {
        localStorage.setItem('dygnify_analysis_drawer_width', widthRef.current.toString());
      } catch {
        // Ignore storage exceptions
      }
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('touchcancel', handlePointerUp);

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('touchcancel', handlePointerUp);
    };
  }, [isDragging]);

  const handleStartDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleToggleExpand = () => {
    setWidth((prev) => {
      const next = prev >= 760 ? 540 : 860;
      try {
        localStorage.setItem('dygnify_analysis_drawer_width', next.toString());
      } catch {
        // Ignore storage exceptions
      }
      return next;
    });
  };

  if (!isOpen) return null;

  // Primary metric label
  const getPrimaryMetricLabel = () => {
    if (selectedHazard === 'heatwave') return 'Mean Heatwave Days';
    if (selectedHazard === 'drought') return 'Drought Deficit Days';
    return 'Heavy Rainfall Days';
  };

  // High-level aggregates
  const validYearsList = analysisResult?.annual_series.filter((y) => y.is_available) || [];
  const certifiedPct =
    analysisResult && analysisResult.annual_series.length > 0
      ? Math.round((validYearsList.length / analysisResult.annual_series.length) * 100)
      : 0;

  const totalEventsCount = analysisResult?.events_list ? analysisResult.events_list.length : 0;
  const avgDaysPerYear =
    validYearsList.length > 0
      ? (
          validYearsList.reduce((acc, y) => acc + (y.weighted_hazard_days || 0), 0) /
          validYearsList.length
        ).toFixed(1)
      : '--';

  const totalIntensity =
    analysisResult?.events_list && analysisResult.events_list.length > 0
      ? analysisResult.events_list.reduce((acc, e) => acc + e.intensity_metric, 0).toFixed(1)
      : '--';

  return (
    <aside
      aria-label="Climate analysis panel"
      style={{
        width: typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : `${width}px`,
        maxWidth: '100vw',
      }}
      className={`fixed inset-y-0 right-0 z-[9990] bg-white border-l border-slate-200/90 shadow-2xl flex flex-col pointer-events-auto font-sans overflow-hidden ${
        isDragging ? 'select-none transition-none' : 'transition-[width] duration-150 ease-out'
      }`}
    >
      {/* Draggable Left Edge Resize Handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize analysis drawer width"
        onMouseDown={handleStartDrag}
        onTouchStart={handleStartDrag}
        onDoubleClick={handleToggleExpand}
        className={`absolute top-0 bottom-0 left-0 w-3 -translate-x-1.5 cursor-col-resize z-50 flex items-center justify-center select-none group touch-none ${
          isDragging ? 'bg-teal-600/20' : 'hover:bg-teal-600/10'
        }`}
        title="Drag left/right to resize drawer width (Double-click to toggle wide view)"
      >
        <div
          className={`rounded-full transition-all duration-150 flex items-center justify-center ${
            isDragging
              ? 'h-16 w-2 bg-teal-700 shadow-md ring-2 ring-teal-500/40'
              : 'h-10 w-1 bg-slate-300 group-hover:bg-teal-600 group-hover:h-14 group-hover:w-1.5'
          }`}
        >
          <GripVertical
            className={`w-3 h-3 text-slate-400 group-hover:text-teal-700 transition ${
              isDragging ? 'text-white' : ''
            }`}
          />
        </div>

        {/* Live width tooltip indicator while dragging */}
        {isDragging && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-mono shadow-xl pointer-events-none whitespace-nowrap z-50">
            {Math.round(width)}px
          </div>
        )}
      </div>

      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 shrink-0">
            <BarChart3 className="w-5 h-5 text-teal-700" />
          </div>
          <div className="min-w-0 truncate">
            <h2 className="text-sm font-bold text-slate-900 leading-tight truncate">
              {locationName || 'Mumbai, India'}
            </h2>
            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5 truncate">
              <span className="truncate">
                {spatialMode === 'point'
                  ? `${targetPoint.latitude.toFixed(2)}°N, ${targetPoint.longitude.toFixed(2)}°E`
                  : `Bounds: [${targetBounds.south}°S to ${targetBounds.north}°N]`}
              </span>
              <span>•</span>
              <span className="text-teal-700 font-semibold uppercase shrink-0">{selectedHazard}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleToggleExpand}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition hidden sm:flex items-center justify-center"
            title={width >= 760 ? 'Shrink drawer width (540px)' : 'Expand drawer width (860px)'}
            aria-label={width >= 760 ? 'Shrink drawer' : 'Expand drawer'}
          >
            {width >= 760 ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onOpenAIDrawer}
            className="p-2 rounded-lg text-teal-800 hover:bg-teal-50 transition"
            title="Open AI Briefing Assistant"
            aria-label="Open AI Assistant"
          >
            <Sparkles className="w-4 h-4 text-teal-700" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition"
            title="Close analysis drawer"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Drawer Body Scroll Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-800">
        {/* Run Analysis & Quick Parameters Bar */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowParamControls(!showParamControls)}
              className="text-xs font-semibold text-slate-700 hover:text-teal-800 transition flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-teal-700" />
              <span>{showParamControls ? 'Hide Parameters' : 'Adjust Parameters'}</span>
            </button>

            <span className="text-[11px] font-mono text-slate-500">
              {startYear}–{endYear} ({endYear - startYear + 1} yrs)
            </span>
          </div>

          {showParamControls && (
            <div className="pt-2 border-t border-slate-200 space-y-3 text-xs">
              {/* Climate Hazard Type */}
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  Climate Hazard
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onHazardChange('heatwave')}
                    className={`py-1 rounded text-xs font-medium transition ${
                      selectedHazard === 'heatwave'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Heatwave
                  </button>
                  <button
                    type="button"
                    onClick={() => onHazardChange('drought')}
                    className={`py-1 rounded text-xs font-medium transition ${
                      selectedHazard === 'drought'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Drought
                  </button>
                  <button
                    type="button"
                    onClick={() => onHazardChange('heavy_rainfall')}
                    className={`py-1 rounded text-xs font-medium transition ${
                      selectedHazard === 'heavy_rainfall'
                        ? 'bg-teal-100 text-teal-900 border border-teal-300 font-bold shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Rainfall
                  </button>
                </div>
              </div>

              {/* Year Selectors */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Start Year (≥ 1940)
                  </label>
                  <input
                    type="number"
                    min="1940"
                    max={endYear}
                    value={startYear}
                    onChange={(e) => onStartYearChange(parseInt(e.target.value) || 2015)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:ring-1 focus:ring-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    End Year (≤ {new Date().getFullYear()})
                  </label>
                  <input
                    type="number"
                    min={startYear}
                    max={new Date().getFullYear()}
                    value={endYear}
                    onChange={(e) => onEndYearChange(parseInt(e.target.value) || 2023)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:ring-1 focus:ring-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Date validation alert */}
              {startYear > endYear && (
                <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Start year ({startYear}) cannot exceed end year ({endYear}).</span>
                </div>
              )}

              {/* Threshold Percentile */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-slate-600 block">
                    Operational Threshold Percentile
                  </label>
                  <span className="text-[10px] font-mono text-teal-800 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                    {percentileThreshold}th %ile
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[90, 95, 97.5, 99].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => onPercentileChange(pct)}
                      className={`py-1 rounded text-xs font-mono font-medium transition ${
                        percentileThreshold === pct
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {pct}th %ile
                    </button>
                  ))}
                </div>

                {/* Derived Threshold Display */}
                {analysisResult && (
                  <div className="text-[11px] bg-slate-100/80 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-500">Derived Threshold:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {analysisResult.definitions_summary?.threshold_percentile ?? percentileThreshold}th %ile
                      {analysisResult.definitions_summary?.threshold_value !== undefined && (
                        <span>
                          {' '}({analysisResult.definitions_summary.threshold_value} {analysisResult.definitions_summary.threshold_unit || '°C'})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Min Consecutive Days */}
              {selectedHazard !== 'drought' && (
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Min Qualifying Duration
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[2, 3, 5].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => onMinConsecutiveDaysChange(d)}
                        className={`py-1 rounded text-xs font-mono font-medium transition ${
                          minConsecutiveDays === d
                            ? 'bg-teal-700 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {d} days
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons: Run Analysis & Reset to Defaults */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRunAnalysis}
              disabled={isAnalyzing || startYear > endYear}
              className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition shadow-xs ${
                isAnalyzing || startYear > endYear
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-teal-700 hover:bg-teal-800 text-white'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Computing Reanalysis & Trends...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Climate Hazard Analysis</span>
                </>
              )}
            </button>

            {onResetToDefaults && (
              <button
                type="button"
                onClick={onResetToDefaults}
                disabled={isAnalyzing}
                className="py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1 shadow-xs"
                title="Reset parameters to application defaults"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Error Alert with Retry */}
        {analysisError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <p className="leading-relaxed">{analysisError}</p>
            </div>
            <button
              onClick={onRunAnalysis}
              className="px-2.5 py-1 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold text-[11px] shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Partial Data Advisory */}
        {analysisResult &&
          analysisResult.trends?.excluded_years &&
          analysisResult.trends.excluded_years.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Partial Data Advisory: </span>
                Calendar years ({analysisResult.trends.excluded_years.join(', ')}) did not meet the &ge;90% daily data threshold and were excluded from trend metrics to avoid statistical bias.
              </div>
            </div>
          )}

        {/* Active Analysis & Threshold Transparency Header */}
        {analysisResult && (
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Active Analysis: {analysisResult.hazard_type.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {analysisResult.mode === 'point'
                  ? 'Single ERA5 Grid Cell'
                  : 'Spatially Weighted'}
              </span>
            </div>

            <p className="text-[11px] text-slate-600">
              {analysisResult.spatial_metadata?.representation_text}
            </p>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="text-slate-600 text-[11px]">Operational Threshold:</span>
              <span className="font-bold text-amber-700">
                {analysisResult.definitions_summary?.threshold_percentile ??
                  analysisResult.point_results?.[0]?.threshold_percentile ??
                  percentileThreshold}
                th Percentile
                {(analysisResult.definitions_summary?.threshold_value !== undefined ||
                  analysisResult.point_results?.[0]?.threshold_value !== undefined) && (
                  <span className="text-slate-700">
                    {' '}(
                    {analysisResult.definitions_summary?.threshold_value ??
                      analysisResult.point_results?.[0]?.threshold_value}{' '}
                    {analysisResult.definitions_summary?.threshold_unit ??
                      analysisResult.point_results?.[0]?.threshold_unit ??
                      '°C'}
                    )
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* 6-Card Verified KPI Grid */}
        <div className={`grid gap-2.5 ${width >= 720 ? 'grid-cols-3' : width < 380 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {/* KPI 1: Events Count */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
              Qualifying Events
            </span>
            <div className="text-lg font-bold text-amber-600 font-mono">
              {analysisResult ? `${totalEventsCount} events` : '--'}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {analysisResult
                ? `Duration ≥ ${minConsecutiveDays} consecutive days`
                : 'Awaiting Run'}
            </span>
          </div>

          {/* KPI 2: Hazard Days (regional mean) */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1 truncate">
              {getPrimaryMetricLabel()}
            </span>
            <div className="text-lg font-bold text-slate-900 font-mono">
              {analysisResult ? `${avgDaysPerYear} d/yr` : '--'}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
              {analysisResult?.mode === 'point'
                ? 'Annual Mean — Single ERA5 Grid Cell'
                : 'Spatially Weighted Regional Mean'}
            </span>
          </div>

          {/* KPI 3: Intensity Exceedance */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
              Cumulative Intensity
            </span>
            <div className="text-lg font-bold text-amber-700 font-mono">
              {analysisResult ? `${totalIntensity}` : '--'}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {selectedHazard === 'heatwave'
                ? 'Degree-days exceedance'
                : 'Cumulative deficit'}
            </span>
          </div>

          {/* KPI 4: Trend Slope */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
              OLS Trend Rate
            </span>
            <div className="text-lg font-bold text-teal-700 font-mono">
              {analysisResult?.trends?.ols_regression
                ? `${analysisResult.trends.ols_regression.slope_per_year > 0 ? '+' : ''}${analysisResult.trends.ols_regression.slope_per_year.toFixed(2)}/yr`
                : '--'}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {analysisResult?.trends?.ols_regression
                ? `${(analysisResult.trends.ols_regression.slope_per_year * 10).toFixed(1)}/decade`
                : 'Requires ≥ 5 valid years'}
            </span>
          </div>

          {/* KPI 5: Significance Status */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
              Mann–Kendall Signif.
            </span>
            <div className="text-sm font-bold font-mono">
              {analysisResult?.trends ? (
                analysisResult.trends.is_statistically_significant ? (
                  <span className="text-rose-600 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    p &lt; 0.05
                  </span>
                ) : (
                  <span className="text-slate-700 flex items-center gap-1">
                    <Minus className="w-3.5 h-3.5 text-slate-400" />
                    Not Sig (p &ge; 0.05)
                  </span>
                )
              ) : (
                <span className="text-slate-400">--</span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
              {analysisResult?.trends?.mann_kendall
                ? `τ = ${analysisResult.trends.mann_kendall.tau.toFixed(2)} | p = ${analysisResult.trends.mann_kendall.p_value.toFixed(4)}`
                : 'Non-parametric monotonic rank'}
            </span>
          </div>

          {/* KPI 6: Data Coverage */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
              Certified Coverage
            </span>
            <div className="text-lg font-bold text-teal-800 font-mono">
              {analysisResult ? `${certifiedPct}%` : '--'}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {analysisResult
                ? `${validYearsList.length} of ${analysisResult.annual_series.length} valid years`
                : 'Coverage Gated'}
            </span>
          </div>
        </div>

        {/* Phase 5: Recharts Annual Trend Analysis & Event Audit */}
        {analysisResult && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <TrendAnalysisView
              trendData={analysisResult.trends}
              eventsList={analysisResult.events_list}
              definitionsSummary={analysisResult.definitions_summary}
              selectedYear={selectedYear}
              onYearSelect={setSelectedYear}
            />
          </div>
        )}

        {/* Regional Annual Hazard Series Table */}
        {analysisResult && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-teal-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  {analysisResult.mode === 'point'
                    ? 'Annual Metric Series — Single ERA5 Grid Cell'
                    : 'Spatially Weighted Regional Annual Metric Series'}
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-[11px] bg-slate-50">
                    <th className="py-2 px-2.5">Year</th>
                    <th className="py-2 px-2.5">Coverage</th>
                    <th className="py-2 px-2.5">
                      {analysisResult.mode === 'point'
                        ? 'Annual Hazard Days'
                        : 'Spatially Weighted Days'}
                    </th>
                    <th className="py-2 px-2.5">Events</th>
                    <th className="py-2 px-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysisResult.annual_series.map((yr) => (
                    <tr
                      key={yr.year}
                      className={`hover:bg-slate-50 transition-colors ${
                        selectedYear === yr.year ? 'bg-teal-50/50 font-bold' : ''
                      }`}
                      onClick={() => setSelectedYear(yr.year)}
                    >
                      <td className="py-1.5 px-2.5 text-slate-900">{yr.year}</td>
                      <td className="py-1.5 px-2.5 text-teal-700">
                        {yr.spatial_coverage_pct.toFixed(0)}%
                      </td>
                      <td className="py-1.5 px-2.5 text-amber-700 font-semibold">
                        {yr.weighted_hazard_days !== null
                          ? `${yr.weighted_hazard_days.toFixed(1)} d`
                          : '--'}
                      </td>
                      <td className="py-1.5 px-2.5 text-slate-700">
                        {yr.weighted_event_count !== null
                          ? yr.weighted_event_count.toFixed(1)
                          : '--'}
                      </td>
                      <td className="py-1.5 px-2.5">
                        {yr.is_available ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Certified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            <AlertCircle className="w-3 h-3" /> Incomplete
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Daily Stream Inspection Trigger */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-teal-700" />
              Daily Raw Reanalysis Stream
            </span>
            <button
              type="button"
              onClick={onInspectWeatherStream}
              disabled={isIngestingWeather}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-medium text-slate-700 transition flex items-center gap-1 shadow-xs"
            >
              {isIngestingWeather ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-teal-700" />
                  <span>Fetching...</span>
                </>
              ) : (
                <span>Inspect Daily Values</span>
              )}
            </button>
          </div>

          {weatherData && (
            <div className="overflow-x-auto max-h-40 border border-slate-200 rounded-lg bg-white mt-2">
              <table className="w-full text-left text-[11px] font-mono">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                    <th className="py-1.5 px-2">Date</th>
                    <th className="py-1.5 px-2">Tmax (°C)</th>
                    <th className="py-1.5 px-2">Precip (mm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {weatherData.daily.slice(0, 15).map((d) => (
                    <tr key={d.date} className="hover:bg-slate-50">
                      <td className="py-1 px-2 text-slate-800">{d.date}</td>
                      <td className="py-1 px-2 text-amber-700">
                        {d.temperature_max !== null ? `${d.temperature_max.toFixed(1)}°C` : '--'}
                      </td>
                      <td className="py-1 px-2 text-teal-700">
                        {d.precipitation !== null ? `${d.precipitation.toFixed(1)} mm` : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Drawer Sticky Footer: Working Export Center */}
      <div className="p-4 border-t border-slate-200 bg-white shrink-0 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
          <span>Verified Exports</span>
          {exportError && <span className="text-rose-600 font-normal">{exportError}</span>}
        </div>

        <div className={`grid gap-2 ${width < 440 ? 'grid-cols-1' : 'grid-cols-3'}`}>
          <button
            type="button"
            onClick={onExportAnnualCSV}
            disabled={!analysisResult || exportingType !== null}
            className={`py-2 px-2.5 rounded-xl border text-xs font-mono font-medium transition flex items-center justify-center gap-1.5 shadow-xs ${
              analysisResult && exportingType === null
                ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 hover:border-teal-600'
                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title="Download verified annual metrics CSV"
          >
            <FileText className="w-3.5 h-3.5 text-teal-700" />
            <span className="truncate">
              {exportingType === 'annual_csv' ? 'Exporting...' : 'Annual CSV'}
            </span>
          </button>

          <button
            type="button"
            onClick={onExportEventsCSV}
            disabled={!analysisResult || exportingType !== null}
            className={`py-2 px-2.5 rounded-xl border text-xs font-mono font-medium transition flex items-center justify-center gap-1.5 shadow-xs ${
              analysisResult && exportingType === null
                ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 hover:border-teal-600'
                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title="Download individual extreme events CSV"
          >
            <FileText className="w-3.5 h-3.5 text-teal-700" />
            <span className="truncate">
              {exportingType === 'events_csv' ? 'Exporting...' : 'Events CSV'}
            </span>
          </button>

          <button
            type="button"
            onClick={onExportPDF}
            disabled={!analysisResult || exportingType !== null}
            className={`py-2 px-2.5 rounded-xl border text-xs font-mono font-medium transition flex items-center justify-center gap-1.5 shadow-xs ${
              analysisResult && exportingType === null
                ? 'bg-teal-700 hover:bg-teal-800 border-teal-700 text-white'
                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title="Generate server-side verified PDF summary report"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="truncate">
              {exportingType === 'pdf' ? 'Building...' : 'PDF Report'}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};
