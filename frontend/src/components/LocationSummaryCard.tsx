import React from 'react';
import {
  MapPin,
  Flame,
  CloudSun,
  CloudRain,
  ChevronRight,
  Sparkles,
  BarChart3,
  Loader2,
  Calendar,
  Database,
} from 'lucide-react';
import type { PointCoordinate, AnalysisResponse } from '../types/api';
import type { HazardType } from './DashboardShell';

interface LocationSummaryCardProps {
  locationName: string;
  coordinates: PointCoordinate;
  selectedHazard: HazardType;
  startYear: number;
  endYear: number;
  isAnalyzing: boolean;
  analysisResult: AnalysisResponse | null;
  onOpenAnalysisDrawer: () => void;
  onRunAnalysis: () => void;
  onOpenAIDrawer: () => void;
}

export const LocationSummaryCard: React.FC<LocationSummaryCardProps> = ({
  locationName,
  coordinates,
  selectedHazard,
  startYear,
  endYear,
  isAnalyzing,
  analysisResult,
  onOpenAnalysisDrawer,
  onRunAnalysis,
  onOpenAIDrawer,
}) => {
  const getHazardLabel = () => {
    if (selectedHazard === 'heatwave') return 'Heatwave';
    if (selectedHazard === 'drought') return 'Drought';
    return 'Heavy Rainfall';
  };

  const getHazardIcon = () => {
    if (selectedHazard === 'heatwave') return <Flame className="w-3.5 h-3.5 text-amber-500" />;
    if (selectedHazard === 'drought') return <CloudSun className="w-3.5 h-3.5 text-amber-500" />;
    return <CloudRain className="w-3.5 h-3.5 text-teal-600" />;
  };

  const validYears = analysisResult?.annual_series.filter((y) => y.is_available) || [];
  const avgDays =
    validYears.length > 0
      ? (
          validYears.reduce((acc, y) => acc + (y.weighted_hazard_days || 0), 0) /
          validYears.length
        ).toFixed(1)
      : null;

  return (
    <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 w-72 sm:w-84 md:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden pointer-events-auto transition-all hover:shadow-2xl">
      {/* Card Header & Location Name */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-teal-600" />
            Selected Location
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {coordinates.latitude.toFixed(2)}°N, {coordinates.longitude.toFixed(2)}°E
          </span>
        </div>

        <h3 className="text-base font-bold text-slate-900 truncate" title={locationName}>
          {locationName || 'Mumbai, India'}
        </h3>

        {/* Temporal Span & Data Source Metadata */}
        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 font-medium">
            <Calendar className="w-3 h-3 text-slate-400" />
            {startYear}–{endYear}
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-teal-800 font-mono font-medium">
            <Database className="w-3 h-3 text-teal-600" />
            ECMWF ERA5
          </span>
        </div>

        {/* Mini Hazard & Metric Summary Pill */}
        <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white shadow-xs border border-slate-200 flex items-center justify-center">
              {getHazardIcon()}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">{getHazardLabel()}</div>
              <div className="text-[10px] text-slate-500">
                {analysisResult
                  ? `${analysisResult.events_list?.length ?? 0} events identified`
                  : 'Analysis ready'}
              </div>
            </div>
          </div>

          {avgDays !== null ? (
            <div className="text-right">
              <div className="text-xs font-bold font-mono text-slate-900">
                {avgDays} d/yr
              </div>
              <div className="text-[10px] text-slate-500">annual mean</div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRunAnalysis}
              disabled={isAnalyzing}
              className="px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium transition flex items-center gap-1 shadow-xs"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Computing...</span>
                </>
              ) : (
                <span>Analyze</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenAnalysisDrawer}
          className="flex-1 py-1.5 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 transition flex items-center justify-center gap-1 shadow-xs"
        >
          <BarChart3 className="w-3.5 h-3.5 text-teal-700" />
          <span>View Analysis</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={onOpenAIDrawer}
          className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 transition flex items-center justify-center shrink-0 shadow-xs"
          title="Open AI Climate Assistant"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="w-4 h-4 text-teal-700" />
        </button>
      </div>
    </div>
  );
};
