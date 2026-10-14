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
  Search,
  ArrowRight,
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
  onInspectWeatherStream?: () => void;
  weatherData?: WeatherSeriesResponse | null;
  isIngestingWeather?: boolean;
  onOpenAIDrawer?: () => void;
  onOpenDeepAnalysis?: () => void;
}

export type DrawerTab = 'overview' | 'charts' | 'events' | 'statistics' | 'quality';

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
  onOpenDeepAnalysis,
}) => {
  const [showParamControls, setShowParamControls] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const [eventSearchQuery, setEventSearchQuery] = useState<string>('');

  // Draggable drawer width state with persistence
  const [width, setWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved =
        localStorage.getItem('dygnify_analysis_drawer_width') ||
        localStorage.getItem('terrascope_analysis_drawer_width');
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

  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);
  const widthRef = useRef(width);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  // Handle drag mousemove and mouseup on window
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = startXRef.current - e.clientX;
      const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, 380), window.innerWidth - 60);
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        try {
          localStorage.setItem('dygnify_analysis_drawer_width', widthRef.current.toString());
        } catch {
          // ignore
        }
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  };

  const handleToggleExpand = () => {
    setWidth((prev) => (prev >= 760 ? 540 : 860));
  };

  // Filtered events list
  const eventsList = analysisResult?.events_list || [];
  const filteredEvents = eventsList.filter((ev) => {
    if (!eventSearchQuery.trim()) return true;
    return ev.start_date.includes(eventSearchQuery) || ev.end_date.includes(eventSearchQuery);
  });

  // Coverage calculation
  const validYearsList = analysisResult?.annual_series.filter((y) => y.is_available) || [];
  const certifiedPct =
    analysisResult && analysisResult.annual_series.length > 0
      ? Math.round((validYearsList.length / analysisResult.annual_series.length) * 100)
      : 100;

  return (
    <aside
      style={{
        width: typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : `${width}px`,
        maxWidth: '100vw',
      }}
      className={`fixed top-14 bottom-0 right-0 bg-white border-l border-slate-200/90 shadow-2xl z-40 transition-transform duration-300 ease-out flex flex-col font-sans select-text ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-label="Scientific Analysis Drawer"
    >
      {/* Drag handle on left edge */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute left-0 top-0 bottom-0 w-2.5 -translate-x-1/2 cursor-col-resize z-50 flex items-center justify-center transition-colors group ${
          isDragging ? 'bg-teal-600/30' : 'hover:bg-teal-600/20'
        }`}
        title="Drag to resize drawer width"
      >
        <div className="w-1 h-8 rounded-full bg-slate-300 group-hover:bg-teal-600 transition-colors flex items-center justify-center">
          <GripVertical className="w-2.5 h-2.5 text-slate-500 opacity-0 group-hover:opacity-100" />
        </div>

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
          {onOpenDeepAnalysis && (
            <button
              type="button"
              onClick={onOpenDeepAnalysis}
              className="px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 transition flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              title="Expand to Full-Width Deep Analysis Workspace"
              aria-label="Deep Analysis"
            >
              <TrendingUp className="w-3.5 h-3.5 text-teal-700" />
              <span>Deep Analysis</span>
            </button>
          )}
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

      {/* 5 Drawer Tabs: Overview, Charts, Events, Statistics, Data Quality */}
      <div className="flex items-center px-4 border-b border-slate-200 bg-slate-50/50 gap-1 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-teal-700 text-teal-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('charts')}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === 'charts'
              ? 'border-teal-700 text-teal-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Charts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === 'events'
              ? 'border-teal-700 text-teal-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Events ({eventsList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('statistics')}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === 'statistics'
              ? 'border-teal-700 text-teal-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Statistics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('quality')}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === 'quality'
              ? 'border-teal-700 text-teal-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Data Quality
        </button>
      </div>

      {/* Drawer Body Scroll Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-800">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
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
                        Start Year (&ge; 1940)
                      </label>
                      <input
                        type="number"
                        min="1940"
                        max={endYear}
                        value={startYear}
                        onChange={(e) => onStartYearChange(parseInt(e.target.value, 10) || 1940)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:ring-1 focus:ring-teal-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-600 block mb-1">
                        End Year (&le; 2026)
                      </label>
                      <input
                        type="number"
                        min={startYear}
                        max={2026}
                        value={endYear}
                        onChange={(e) => onEndYearChange(parseInt(e.target.value, 10) || 2023)}
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

                  {/* Operational Threshold Percentile */}
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
                            &ge; {d} days
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons: Run Analysis & Reset */}
              <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
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
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Computing Reanalysis...</span>
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
              </div>
            )}

            {/* 6 Responsive KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {/* KPI 1: Qualifying Events */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                  Qualifying Events
                </span>
                <div className="text-lg font-bold text-slate-900 font-mono">
                  {analysisResult ? `${eventsList.length}` : '--'}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
                  &ge; {minConsecutiveDays} consecutive days
                </span>
              </div>

              {/* KPI 2: Cumulative Intensity */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                  Cumulative Intensity
                </span>
                <div className="text-lg font-bold text-amber-700 font-mono">
                  {analysisResult?.annual_series
                    ? `${analysisResult.annual_series
                        .reduce((acc, y) => acc + (y.weighted_intensity || 0), 0)
                        .toFixed(1)}`
                    : '--'}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
                  Exceedance integral sum
                </span>
              </div>

              {/* KPI 3: OLS Trend Rate */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                  OLS Trend Rate
                </span>
                <div className="text-lg font-bold font-mono">
                  {analysisResult?.trends?.ols_regression ? (
                    <span
                      className={
                        analysisResult.trends.ols_regression.slope_per_year > 0
                          ? 'text-rose-600 flex items-center gap-0.5'
                          : 'text-emerald-700 flex items-center gap-0.5'
                      }
                    >
                      {analysisResult.trends.ols_regression.slope_per_year > 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingUp className="w-3.5 h-3.5 rotate-180" />
                      )}
                      {analysisResult.trends.ols_regression.slope_per_year > 0 ? '+' : ''}
                      {analysisResult.trends.ols_regression.slope_per_year.toFixed(2)}
                      <span className="text-[11px] text-slate-500 font-normal">/yr</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">--</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
                  {analysisResult?.trends?.ols_regression
                    ? `p = ${analysisResult.trends.ols_regression.p_value.toFixed(4)}`
                    : 'Regression slope'}
                </span>
              </div>

              {/* KPI 4: Window Comparison */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                  Window Comparison
                </span>
                <div className="text-lg font-bold font-mono">
                  {analysisResult?.trends?.window_comparison?.percentage_change !== null &&
                  analysisResult?.trends?.window_comparison?.percentage_change !== undefined ? (
                    <span
                      className={
                        analysisResult.trends.window_comparison.percentage_change >= 0
                          ? 'text-rose-600'
                          : 'text-emerald-700'
                      }
                    >
                      {analysisResult.trends.window_comparison.percentage_change > 0 ? '+' : ''}
                      {analysisResult.trends.window_comparison.percentage_change}%
                    </span>
                  ) : analysisResult?.trends?.window_comparison ? (
                    <span className="text-amber-700 text-xs font-semibold">Withheld (&le;0.1)</span>
                  ) : (
                    <span className="text-slate-400">--</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
                  Multi-year mean shift
                </span>
              </div>

              {/* KPI 5: Mann-Kendall Significance */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">
                  Mann–Kendall Signif.
                </span>
                <div className="text-sm font-bold font-mono">
                  {analysisResult?.trends ? (
                    analysisResult.trends.is_statistically_significant ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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

              {/* KPI 6: Certified Coverage */}
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

            {/* Quick Deep Analysis Promo Card */}
            {onOpenDeepAnalysis && (
              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-teal-950 block">Need a full-screen scientific workspace?</span>
                  <span className="text-teal-800/80 text-[11px]">
                    Access large multi-series charts, detailed statistical models, and complete event logs.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenDeepAnalysis}
                  className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shrink-0 flex items-center gap-1 shadow-xs"
                >
                  <span>Deep Analysis</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CHARTS */}
        {activeTab === 'charts' && (
          <div className="space-y-4">
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
                            {yr.weighted_event_count !== null ? yr.weighted_event_count : '--'}
                          </td>
                          <td className="py-1.5 px-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                yr.is_available
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {yr.is_available ? 'Valid' : 'Excluded'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: EVENTS */}
        {activeTab === 'events' && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Qualifying Extreme Hazard Events Audit
                </h3>
                <span className="text-[11px] text-slate-500">
                  Total events: {eventsList.length} • Certified &ge; {minConsecutiveDays} consecutive days
                </span>
              </div>

              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by date..."
                  value={eventSearchQuery}
                  onChange={(e) => setEventSearchQuery(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-[11px] bg-slate-50 sticky top-0">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Start Date</th>
                    <th className="py-2 px-2">End Date</th>
                    <th className="py-2 px-2">Duration</th>
                    <th className="py-2 px-2">Mean Intensity</th>
                    <th className="py-2 px-2">Peak Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEvents.map((ev, idx) => (
                    <tr key={`${ev.start_date}-${idx}`} className="hover:bg-slate-50 text-slate-800">
                      <td className="py-1.5 px-2 text-slate-400">{idx + 1}</td>
                      <td className="py-1.5 px-2 font-semibold text-slate-900">{ev.start_date}</td>
                      <td className="py-1.5 px-2 font-semibold text-slate-900">{ev.end_date}</td>
                      <td className="py-1.5 px-2 text-amber-700">{ev.duration_days} days</td>
                      <td className="py-1.5 px-2 text-slate-700">
                        {ev.mean_value !== undefined ? ev.mean_value.toFixed(1) : '--'}
                      </td>
                      <td className="py-1.5 px-2 text-rose-700 font-semibold">
                        {ev.max_value !== undefined ? ev.max_value.toFixed(1) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: STATISTICS */}
        {activeTab === 'statistics' && (
          <div className="space-y-4">
            {analysisResult?.trends && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Statistical Trend Model Details
                </h3>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] block">OLS Slope per Year</span>
                    <span className="font-bold text-slate-900">
                      {analysisResult.trends.ols_regression
                        ? `${analysisResult.trends.ols_regression.slope_per_year.toFixed(3)}/yr`
                        : '--'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] block">OLS R-Squared</span>
                    <span className="font-bold text-amber-700">
                      {analysisResult.trends.ols_regression
                        ? `${(analysisResult.trends.ols_regression.r_squared * 100).toFixed(1)}%`
                        : '--'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] block">OLS p-value</span>
                    <span className="font-bold text-teal-800">
                      {analysisResult.trends.ols_regression
                        ? analysisResult.trends.ols_regression.p_value.toFixed(4)
                        : '--'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] block">Mann–Kendall Tau</span>
                    <span className="font-bold text-teal-800">
                      {analysisResult.trends.mann_kendall
                        ? analysisResult.trends.mann_kendall.tau.toFixed(3)
                        : '--'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-800">Scientific Caution: </strong>
                  {analysisResult.trends.scientific_caution}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: DATA QUALITY */}
        {activeTab === 'quality' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Atmospheric Model Provenance & Data Quality
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Atmospheric data is retrieved from ECMWF ERA5 Reanalysis via Open-Meteo with ~0.1° (~11 km) resolution.
              </p>

              {onInspectWeatherStream && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onInspectWeatherStream}
                    disabled={isIngestingWeather}
                    className="py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Database className="w-3.5 h-3.5 text-teal-700" />
                    <span>{isIngestingWeather ? 'Inspecting Cache...' : 'Verify Raw ERA5 Weather Cache'}</span>
                  </button>

                  {weatherData && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700 space-y-1">
                      <div>Observed Days: {weatherData.daily.length}</div>
                      <div>Source: {weatherData.metadata.source}</div>
                      <div>Retrieved At: {weatherData.metadata.retrieved_at}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
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

        {/* Deep Analysis Fullscreen Link */}
        {onOpenDeepAnalysis && (
          <button
            type="button"
            onClick={onOpenDeepAnalysis}
            className="w-full pt-1 text-center text-xs font-semibold text-teal-700 hover:text-teal-900 transition flex items-center justify-center gap-1"
          >
            <span>Open Dedicated Deep Analysis Workspace</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        )}
      </div>
    </aside>
  );
};
