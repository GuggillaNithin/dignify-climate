import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Download,
  FileText,
  Sparkles,
  Search,
} from 'lucide-react';
import type {
  AnalysisResponse,
  PointCoordinate,
  BoundingBox,
} from '../types/api';
import type { HazardType } from './DashboardShell';
import { D3HazardTrendChart } from './D3HazardTrendChart';
import { AIAssistantDrawer } from './AIAssistantDrawer';

export interface DeepAnalysisViewProps {
  locationName: string;
  spatialMode: 'point' | 'bounding_box';
  targetPoint: PointCoordinate;
  targetBounds: BoundingBox;
  selectedHazard: HazardType;
  startYear: number;
  endYear: number;
  percentileThreshold: number;
  minConsecutiveDays: number;
  analysisResult: AnalysisResponse | null;
  analysisError: string | null;
  isAnalyzing: boolean;
  onBackToMap: () => void;
  onRunAnalysis: () => void;
  onExportAnnualCSV: () => void;
  onExportEventsCSV: () => void;
  onExportPDF: () => void;
  exportingType: 'annual_csv' | 'events_csv' | 'pdf' | null;
  exportError: string | null;
  onOpenAIDrawer?: () => void;
}

export const DeepAnalysisView: React.FC<DeepAnalysisViewProps> = ({
  locationName,
  spatialMode,
  targetPoint,
  targetBounds,
  selectedHazard,
  startYear,
  endYear,
  percentileThreshold,
  minConsecutiveDays,
  analysisResult,
  analysisError,
  isAnalyzing,
  onBackToMap,
  onRunAnalysis,
  onExportAnnualCSV,
  onExportEventsCSV,
  onExportPDF,
  exportingType,
  exportError,
  onOpenAIDrawer,
}) => {
  const [selectedYear, setSelectedYear] = useState<number | null>(endYear);
  const [eventSearchQuery, setEventSearchQuery] = useState<string>('');
  const [minDurationFilter, setMinDurationFilter] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'trends' | 'events' | 'statistics' | 'provenance'>('trends');
  const [isAIPanelOpen, setIsAIPanelOpen] = useState<boolean>(false);

  const trends = analysisResult?.trends;
  const eventsList = useMemo(() => analysisResult?.events_list || [], [analysisResult?.events_list]);
  const definitions = analysisResult?.definitions_summary;

  // Chart data preparation
  const chartData = useMemo(() => {
    if (!trends?.rolling_series) return [];
    const fittedMap = new Map<number, number>();
    if (trends.ols_regression?.fitted_values) {
      trends.ols_regression.fitted_values.forEach((f) => fittedMap.set(f.year, f.fitted));
    }
    return trends.rolling_series.map((pt) => ({
      year: pt.year,
      observed: pt.is_valid ? pt.observed_value : null,
      fitted: fittedMap.has(pt.year) ? (fittedMap.get(pt.year) ?? null) : null,
      rolling: pt.rolling_mean,
      isValid: pt.is_valid,
    }));
  }, [trends]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return eventsList.filter((ev) => {
      const matchesSearch =
        eventSearchQuery === '' ||
        ev.start_date.includes(eventSearchQuery) ||
        ev.end_date.includes(eventSearchQuery);
      const matchesDuration = ev.duration_days >= minDurationFilter;
      return matchesSearch && matchesDuration;
    });
  }, [eventsList, eventSearchQuery, minDurationFilter]);

  // 4 Primary KPI metric values
  const totalEvents = eventsList.length;
  const totalHazardDays = useMemo(() => {
    if (!analysisResult?.annual_series) return 0;
    return analysisResult.annual_series.reduce(
      (acc, yr) => acc + (yr.weighted_hazard_days || 0),
      0
    );
  }, [analysisResult]);

  const olsSlope = trends?.ols_regression?.slope_per_year;
  const validYears = analysisResult?.annual_series.filter((y) => y.is_available).length || 0;
  const totalYears = analysisResult?.annual_series.length || 0;
  const dataCoveragePct = totalYears > 0 ? Math.round((validYears / totalYears) * 100) : 100;

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-900 text-slate-100 font-sans pb-16">
      {/* 1. Persistent Context Header */}
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Back button & Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToMap}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              title="Return to Interactive Map"
            >
              <ArrowLeft className="w-4 h-4 text-teal-400" />
              <span>Return to Map</span>
            </button>

            <div className="h-5 w-px bg-slate-800 hidden sm:block" />

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span className="text-teal-400">Deep Scientific Workspace:</span>
                  <span>{locationName}</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-teal-950 text-teal-300 border border-teal-800">
                  {selectedHazard.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                {spatialMode === 'point'
                  ? `ERA5 Cell (${targetPoint.latitude.toFixed(2)}°N, ${targetPoint.longitude.toFixed(2)}°E)`
                  : `Bounding Box [${targetBounds.south}°S to ${targetBounds.north}°N]`}
                {' • '}
                <span>Observation: {startYear}–{endYear} ({endYear - startYear + 1} yrs)</span>
              </p>
            </div>
          </div>

          {/* Right: Export Actions & AI Briefing */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsAIPanelOpen(true);
                onOpenAIDrawer?.();
              }}
              className="px-3 py-1.5 rounded-xl bg-teal-900/60 hover:bg-teal-800/80 border border-teal-700 text-teal-200 text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
              title="Open AI Climate Assistant & Verified Executive Briefing"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>AI Briefing</span>
            </button>

            <button
              type="button"
              onClick={onExportAnnualCSV}
              disabled={exportingType !== null || !analysisResult}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
              title="Download Annual Summary CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Annual CSV</span>
            </button>

            <button
              type="button"
              onClick={onExportEventsCSV}
              disabled={exportingType !== null || !analysisResult}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
              title="Download Event-Level CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Events CSV</span>
            </button>

            <button
              type="button"
              onClick={onExportPDF}
              disabled={exportingType !== null || !analysisResult}
              className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              title="Download Certified Executive PDF Report"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Report</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error Alert */}
        {analysisError && (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center justify-between gap-3">
            <span>{analysisError}</span>
            <button
              type="button"
              onClick={onRunAnalysis}
              className="px-3 py-1 rounded-lg bg-rose-800 hover:bg-rose-700 text-white font-bold"
            >
              Retry Analysis
            </button>
          </div>
        )}

        {/* Export Error Alert */}
        {exportError && (
          <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-xs">
            <span>Export note: {exportError}</span>
          </div>
        )}

        {/* Analyzing Progress State */}
        {isAnalyzing && (
          <div className="p-3.5 rounded-xl bg-teal-950/60 border border-teal-800 text-teal-200 text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span>Computing climate hazard indicators and statistical regression...</span>
          </div>
        )}

        {/* 2. Top Summary KPI Cards (4 Verified Metrics) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Detected Events */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 shadow-md">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
              Qualifying Events
            </span>
            <div className="text-2xl font-bold font-mono text-white">
              {analysisResult ? totalEvents : '--'}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              &ge; {minConsecutiveDays} consecutive qualifying days
            </span>
          </div>

          {/* Card 2: Total Hazard Days */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 shadow-md">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
              Cumulative Hazard Days
            </span>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {analysisResult ? `${Math.round(totalHazardDays)} days` : '--'}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              Annual avg: {analysisResult ? (totalHazardDays / (endYear - startYear + 1)).toFixed(1) : '--'} days/yr
            </span>
          </div>

          {/* Card 3: Trend Rate & Monotonic Status */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 shadow-md">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
              OLS Trend Rate
            </span>
            <div className="text-2xl font-bold font-mono flex items-center gap-1.5">
              {olsSlope !== undefined && olsSlope !== null ? (
                <>
                  <span className={olsSlope > 0 ? 'text-rose-400' : olsSlope < 0 ? 'text-emerald-400' : 'text-slate-300'}>
                    {olsSlope > 0 ? `+${olsSlope.toFixed(2)}` : olsSlope.toFixed(2)}
                  </span>
                  <span className="text-xs font-normal text-slate-400">days/yr</span>
                </>
              ) : (
                <span className="text-slate-500">--</span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              {trends?.mann_kendall
                ? `Mann-Kendall: p = ${trends.mann_kendall.p_value.toFixed(3)} (${trends.is_statistically_significant ? 'Significant' : 'Not Sig'})`
                : 'Min 5 valid years required'}
            </span>
          </div>

          {/* Card 4: Certified Coverage */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 shadow-md">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
              Certified Data Coverage
            </span>
            <div className="text-2xl font-bold font-mono text-teal-400">
              {analysisResult ? `${dataCoveragePct}%` : '--'}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              {validYears} of {totalYears} years meet &ge;90% completeness
            </span>
          </div>
        </section>

        {/* 3. Section Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('trends')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'trends'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            D3 Analytical Trends
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'events'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Event Audit Log ({eventsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('statistics')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'statistics'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Statistical Diagnostics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('provenance')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'provenance'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Model Provenance & Methods
          </button>
        </div>

        {/* 4. Tab Content 1: D3 Analytical Trends Visualization */}
        {activeTab === 'trends' && (
          <div className="space-y-4">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-teal-400" />
                    High-Fidelity D3.js Analytical Trajectory & Trend Fit
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Annual hazard days vs OLS linear regression fit vs 3-year rolling mean window.
                  </p>
                </div>

                <div className="text-xs font-mono text-slate-400 flex items-center gap-3">
                  <span>Operational Threshold:</span>
                  <span className="font-bold text-amber-300">
                    {definitions?.threshold_percentile ?? percentileThreshold}th %ile
                    {definitions?.threshold_value !== undefined && ` (${definitions.threshold_value} ${definitions.threshold_unit || '°C'})`}
                  </span>
                </div>
              </div>

              {/* D3 Hazard Trend Chart */}
              {chartData.length > 0 ? (
                <D3HazardTrendChart
                  data={chartData}
                  metricName={trends?.primary_metric_name || 'Annual Hazard Days'}
                  metricUnits={trends?.metric_units || 'days'}
                  olsSlope={trends?.ols_regression?.slope_per_year}
                  olsPValue={trends?.ols_regression?.p_value}
                  selectedYear={selectedYear}
                  onYearSelect={setSelectedYear}
                  thresholdValue={definitions?.threshold_value}
                  thresholdLabel={
                    definitions?.threshold_value !== undefined
                      ? `Threshold: ${definitions.threshold_value} ${definitions.threshold_unit || 'units'}`
                      : undefined
                  }
                />
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Awaiting analysis calculation...
                </div>
              )}
            </div>

            {/* Annual Series Table */}
            {analysisResult?.annual_series && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
                  Annual Metric Series ({analysisResult.annual_series.length} Calendar Years)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px] bg-slate-900/60">
                        <th className="py-2.5 px-3">Year</th>
                        <th className="py-2.5 px-3">Hazard Days</th>
                        <th className="py-2.5 px-3">Events</th>
                        <th className="py-2.5 px-3">Cumulative Intensity</th>
                        <th className="py-2.5 px-3">Data Coverage</th>
                        <th className="py-2.5 px-3">Validation Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {analysisResult.annual_series.map((yr) => (
                        <tr
                          key={yr.year}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            selectedYear === yr.year ? 'bg-teal-950/50 font-bold text-white' : 'text-slate-300'
                          }`}
                          onClick={() => setSelectedYear(yr.year)}
                        >
                          <td className="py-2 px-3 text-white">{yr.year}</td>
                          <td className="py-2 px-3 text-amber-400">
                            {yr.weighted_hazard_days !== null ? `${yr.weighted_hazard_days.toFixed(1)} d` : '--'}
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {yr.weighted_event_count !== null ? yr.weighted_event_count : '--'}
                          </td>
                          <td className="py-2 px-3 text-slate-400">
                            {yr.weighted_intensity !== null ? yr.weighted_intensity.toFixed(2) : '--'}
                          </td>
                          <td className="py-2 px-3 text-teal-400">
                            {yr.spatial_coverage_pct.toFixed(0)}%
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                yr.is_available
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}
                            >
                              {yr.is_available ? 'Certified Valid' : 'Incomplete (<90%)'}
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

        {/* 5. Tab Content 2: Event Audit Log */}
        {activeTab === 'events' && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Qualifying Climate Hazard Events Audit
                </h3>
                <p className="text-xs text-slate-400">
                  Total qualifying events: {eventsList.length} • Meeting strictly &ge; {minConsecutiveDays} consecutive days above operational threshold.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by date (YYYY-MM)..."
                    value={eventSearchQuery}
                    onChange={(e) => setEventSearchQuery(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                <select
                  value={minDurationFilter}
                  onChange={(e) => setMinDurationFilter(parseInt(e.target.value, 10))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:border-teal-500"
                >
                  <option value={0}>All Durations</option>
                  <option value={3}>&ge; 3 days</option>
                  <option value={5}>&ge; 5 days</option>
                  <option value={7}>&ge; 7 days</option>
                </select>
              </div>
            </div>

            {/* Events Table */}
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] bg-slate-900/60 sticky top-0">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Start Date</th>
                    <th className="py-2.5 px-3">End Date</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Mean Value</th>
                    <th className="py-2.5 px-3">Peak Value</th>
                    <th className="py-2.5 px-3">Intensity Metric</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredEvents.map((ev, idx) => (
                    <tr key={`${ev.start_date}-${idx}`} className="hover:bg-slate-800/40 text-slate-300">
                      <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 text-white font-bold">{ev.start_date}</td>
                      <td className="py-2 px-3 text-white font-bold">{ev.end_date}</td>
                      <td className="py-2 px-3 text-amber-400">{ev.duration_days} days</td>
                      <td className="py-2 px-3 text-slate-300">
                        {ev.mean_value !== undefined ? `${ev.mean_value.toFixed(2)}` : '--'}
                      </td>
                      <td className="py-2 px-3 text-rose-400">
                        {ev.max_value !== undefined ? `${ev.max_value.toFixed(2)}` : '--'}
                      </td>
                      <td className="py-2 px-3 text-cyan-400">
                        {ev.intensity_metric !== undefined ? `${ev.intensity_metric.toFixed(2)}` : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. Tab Content 3: Statistical Diagnostics */}
        {activeTab === 'statistics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OLS Regression */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                Ordinary Least Squares (OLS) Linear Regression
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Slope per Year</span>
                  <span className="text-sm font-bold text-white">
                    {trends?.ols_regression ? `${trends.ols_regression.slope_per_year.toFixed(3)} units/yr` : '--'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Goodness of Fit (R²)</span>
                  <span className="text-sm font-bold text-amber-400">
                    {trends?.ols_regression ? `${(trends.ols_regression.r_squared * 100).toFixed(1)}%` : '--'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">95% Confidence Interval</span>
                  <span className="text-xs font-bold text-slate-300">
                    {trends?.ols_regression
                      ? `[${trends.ols_regression.confidence_interval_95[0].toFixed(2)}, ${trends.ols_regression.confidence_interval_95[1].toFixed(2)}]`
                      : '--'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">p-value</span>
                  <span className="text-sm font-bold text-cyan-400">
                    {trends?.ols_regression ? trends.ols_regression.p_value.toFixed(4) : '--'}
                  </span>
                </div>
              </div>
            </div>

            {/* Mann-Kendall Monotonic Test */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-400" />
                Non-Parametric Mann–Kendall Monotonic Rank Test
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Kendall Tau (τ)</span>
                  <span className="text-sm font-bold text-teal-300">
                    {trends?.mann_kendall ? trends.mann_kendall.tau.toFixed(3) : '--'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Theil–Sen Robust Slope</span>
                  <span className="text-sm font-bold text-white">
                    {trends?.mann_kendall ? `${trends.mann_kendall.sens_slope.toFixed(2)} units/yr` : '--'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Monotonic p-value</span>
                  <span className="text-sm font-bold text-cyan-400">
                    {trends?.mann_kendall ? trends.mann_kendall.p_value.toFixed(4) : '--'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Significance Status</span>
                  <span className={`text-xs font-bold ${trends?.is_statistically_significant ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {trends?.is_statistically_significant ? 'Significant (p < 0.05)' : 'Not Significant (p ≥ 0.05)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7. Tab Content 4: Provenance & Methods */}
        {activeTab === 'provenance' && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 text-xs text-slate-300">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Atmospheric Model Provenance & Methodology Disclosures
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <span className="font-semibold text-teal-400 block">Reanalysis Provider</span>
                <p className="text-slate-400 leading-relaxed">
                  ECMWF ERA5 / ERA5-Land Reanalysis provided via the Open-Meteo Historical Weather API. Spatial resolution is approximately 0.1° (~11 km) on regular atmospheric model grid.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <span className="font-semibold text-teal-400 block">Spatial Aggregation Strategy</span>
                <p className="text-slate-400 leading-relaxed">
                  {analysisResult?.spatial_metadata?.representation_text ||
                    'Single ERA5 atmospheric grid cell centered at requested coordinate.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <span className="font-semibold text-teal-400 block">Incomplete Year Exclusion Policy</span>
                <p className="text-slate-400 leading-relaxed">
                  Calendar years with &lt;90% daily valid atmospheric observations are excluded from OLS and Mann-Kendall calculations to eliminate artificial bias.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <span className="font-semibold text-teal-400 block">Statistical Limitations</span>
                <p className="text-slate-400 leading-relaxed">
                  Reported monotonic trends reflect empirical associations in reanalysis data. Serial autocorrelation can impact nominal p-values; trends should not be interpreted as causal physical claims.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slide-out AI Climate Assistant Drawer within Deep Analysis */}
      <AIAssistantDrawer
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        locationName={locationName}
        analysisResult={analysisResult}
        onRunAnalysis={onRunAnalysis}
        isAnalyzing={isAnalyzing}
      />
    </div>
  );
};
