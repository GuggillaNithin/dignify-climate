import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  Calendar,
  Activity,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { D3HazardTrendChart } from './D3HazardTrendChart';
import type { TrendAnalysisResult, HazardEventItem, HazardDefinitionsSummary } from '../types/api';

interface TrendAnalysisViewProps {
  trendData?: TrendAnalysisResult | null;
  eventsList?: HazardEventItem[] | null;
  definitionsSummary?: HazardDefinitionsSummary | null;
  selectedYear?: number | null;
  onYearSelect?: (year: number) => void;
}

export const TrendAnalysisView: React.FC<TrendAnalysisViewProps> = ({
  trendData,
  eventsList,
  definitionsSummary,
  selectedYear,
  onYearSelect,
}) => {
  const [showMethodologyDetails, setShowMethodologyDetails] = useState<boolean>(false);
  const [chartEngine, setChartEngine] = useState<'d3' | 'recharts'>('d3');

  if (!trendData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-pulse" />
        <p className="text-sm font-medium text-slate-300">Awaiting Analysis Execution</p>
        <p className="text-xs text-slate-500 mt-1">
          Execute a point or bounding-box climate analysis to compute OLS regression, Mann–Kendall monotonic trends, and multi-year window comparisons.
        </p>
      </div>
    );
  }

  const {
    is_calculated,
    diagnostic_message,
    total_years,
    valid_years_count,
    excluded_years,
    primary_metric_name,
    metric_units,
    ols_regression,
    mann_kendall,
    window_comparison,
    rolling_series,
    trend_direction,
    is_statistically_significant,
    magnitude_summary,
    scientific_caution,
    methodology_version,
  } = trendData;

  // Chart data merging rolling series and fitted regression line
  const fittedMap = new Map<number, number>();
  if (ols_regression?.fitted_values) {
    ols_regression.fitted_values.forEach((f) => fittedMap.set(f.year, f.fitted));
  }

  const chartData = rolling_series.map((pt) => ({
    year: pt.year,
    observed: pt.is_valid ? pt.observed_value : null,
    fitted: fittedMap.has(pt.year) ? (fittedMap.get(pt.year) ?? null) : null,
    rolling: pt.rolling_mean,
    isValid: pt.is_valid,
  }));

  // Trend direction badge configuration
  const getDirectionBadge = () => {
    if (!is_calculated) {
      return {
        label: 'Insufficient Data',
        color: 'text-amber-400 bg-amber-950/40 border-amber-800/60',
        icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      };
    }
    if (trend_direction === 'increasing') {
      return {
        label: is_statistically_significant ? 'Statistically Significant Increase' : 'Upward Slope (p ≥ 0.05)',
        color: 'text-rose-400 bg-rose-950/40 border-rose-800/60',
        icon: <TrendingUp className="w-4 h-4 text-rose-400" />,
      };
    }
    if (trend_direction === 'decreasing') {
      return {
        label: is_statistically_significant ? 'Statistically Significant Decrease' : 'Downward Slope (p ≥ 0.05)',
        color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60',
        icon: <TrendingDown className="w-4 h-4 text-emerald-400" />,
      };
    }
    return {
      label: 'No Significant Trend',
      color: 'text-slate-300 bg-slate-800/60 border-slate-700/60',
      icon: <Minus className="w-4 h-4 text-slate-400" />,
    };
  };

  const badge = getDirectionBadge();

  return (
    <div className="space-y-6">
      {/* Header & Status Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                Annual Trend Analysis & Statistical Inference
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic OLS ordinary least-squares, non-parametric Mann–Kendall test with tie adjustments, and multi-year window comparisons.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${badge.color}`}
            >
              {badge.icon}
              {badge.label}
            </span>
            <button
              onClick={() => setShowMethodologyDetails(!showMethodologyDetails)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
              title="Methodology & Caveats"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Diagnostic alert if insufficient data */}
        {!is_calculated && (
          <div className="mt-4 p-3 rounded-lg bg-amber-950/30 border border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold">Trend Tests Withheld: Minimum Sample Gating</p>
              <p className="text-amber-200/80 mt-0.5">{diagnostic_message}</p>
            </div>
          </div>
        )}

        {/* 4 Statistical Metrics KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {/* Card 1: Rate of Change */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">OLS Trend Rate</span>
            <div className="text-lg font-bold text-slate-100 font-mono">
              {ols_regression ? magnitude_summary.split(' ')[0] + ' ' + metric_units + '/yr' : 'N/A'}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              {ols_regression ? `Decadal: ${(ols_regression.slope_per_year * 10).toFixed(1)} ${metric_units}/decade` : 'Min 5 valid years required'}
            </span>
          </div>

          {/* Card 2: Mann-Kendall Test */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">Mann–Kendall Monotonic</span>
            <div className="text-lg font-bold text-cyan-400 font-mono">
              {mann_kendall ? (
                <span>&tau; = {mann_kendall.tau.toFixed(2)}</span>
              ) : (
                'N/A'
              )}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              {mann_kendall
                ? `p = ${mann_kendall.p_value.toFixed(4)} | Sen's: ${mann_kendall.sens_slope.toFixed(2)}/yr`
                : 'Non-parametric monotonic rank'}
            </span>
          </div>

          {/* Card 3: Multi-Year Window Comparison */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">Window Comparison</span>
            <div className="text-lg font-bold font-mono">
              {window_comparison?.percentage_change !== null && window_comparison?.percentage_change !== undefined ? (
                <span className={window_comparison.percentage_change >= 0 ? 'text-rose-400 flex items-center gap-1' : 'text-emerald-400 flex items-center gap-1'}>
                  {window_comparison.percentage_change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {window_comparison.percentage_change > 0 ? `+${window_comparison.percentage_change}%` : `${window_comparison.percentage_change}%`}
                </span>
              ) : window_comparison ? (
                <span className="text-amber-400 text-sm font-semibold">Withheld (Baseline &le; 0.1)</span>
              ) : (
                <span className="text-slate-500">N/A</span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              {window_comparison
                ? `Baseline ${window_comparison.early_window_mean} &rarr; Recent ${window_comparison.late_window_mean} (${window_comparison.absolute_change > 0 ? '+' : ''}${window_comparison.absolute_change} ${metric_units})`
                : 'Multi-year mean window comparison'}
            </span>
          </div>

          {/* Card 4: Model Quality / R-squared */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">Goodness of Fit (R&sup2;)</span>
            <div className="text-lg font-bold text-amber-400 font-mono">
              {ols_regression ? `R² = ${(ols_regression.r_squared * 100).toFixed(1)}%` : 'N/A'}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              {ols_regression
                ? `p = ${ols_regression.p_value.toFixed(4)} | N = ${valid_years_count} yrs`
                : `Total: ${total_years} yrs (Valid: ${valid_years_count})`}
            </span>
          </div>
        </div>

        {/* Operational Threshold & Statistical Significance Sensitivity Note */}
        <div className="mt-4 p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-xs font-mono flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-slate-500 uppercase text-[10px]">Active Threshold:</span>
            <span className="font-semibold text-amber-300">
              {definitionsSummary?.threshold_percentile !== undefined ? `${definitionsSummary.threshold_percentile}th %ile` : 'Configured %ile'}
              {definitionsSummary?.threshold_value !== undefined && ` (${definitionsSummary.threshold_value} ${definitionsSummary?.threshold_unit ?? '°C'})`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-sans italic leading-tight">
            <strong>Sensitivity Disclosure:</strong> {definitionsSummary?.significance_sensitivity_note || 'Statistical significance (p-value) is conditional on the configured operational threshold; altering the percentile threshold alters qualifying exceedance frequency and may change trend significance.'}
          </p>
        </div>

        {/* Methodology & Scientific Honesty Drawer */}
        {showMethodologyDetails && (
          <div className="mt-5 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-3">
            <div className="flex items-center justify-between font-bold text-slate-200">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Info className="w-4 h-4" />
                Statistical Methodology & Scientific Transparency
              </span>
              <span className="text-[11px] font-mono text-slate-500">{methodology_version}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <h4 className="font-semibold text-slate-200">1. Non-Parametric Primacy</h4>
                <p className="text-slate-400 leading-relaxed">
                  Climate hazard metrics often display non-normal, skewed, or zero-inflated distributions. Dygnify prioritizes the Mann–Kendall test with tie adjustments and Theil–Sen robust slope estimation over OLS to avoid vulnerability to extreme outlier years.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-slate-200">2. Multi-Year Comparison Windows</h4>
                <p className="text-slate-400 leading-relaxed">
                  Percentage changes are computed by comparing multi-year mean windows (first k years vs. last k years, k &le; 5), never fragile single endpoint years. If early baseline is 0.0 or near-zero (&lt;0.1), percentage change is strictly withheld to prevent runaway division artifacts.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-slate-200">3. Incomplete Year Policy</h4>
                <p className="text-slate-400 leading-relaxed">
                  Calendar years with &lt;90% daily valid data or &lt;75% spatial grid coverage are excluded from regression and rank metrics to prevent synthetic artifacts. Excluded years: {excluded_years.length > 0 ? excluded_years.join(', ') : 'None'}.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-semibold text-slate-200">4. Autocorrelation & Multiple Testing</h4>
                <p className="text-slate-400 leading-relaxed">
                  Serial autocorrelation (such as multi-year climate oscillations like ENSO, PDO) can artificially deflate nominal p-values. Reported significance reflects empirical monotonic association, not physical or causal attribution.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/40 text-amber-300 text-[11px] leading-relaxed">
              <strong>Mandatory Scientific Caution:</strong> {scientific_caution}
            </div>
          </div>
        )}
      </div>

      {/* Visualizations: D3 Interactive SVG (Default) or Recharts */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              Annual Hazard Trajectory & Linear Trend Fit
            </h3>
            <span className="text-xs text-slate-400">
              Metric: {primary_metric_name} ({metric_units}) &bull; Rolling average: 3-year centered window
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Chart Engine Switcher: D3 Interactive SVG vs Recharts */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setChartEngine('d3')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition ${
                  chartEngine === 'd3'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="D3.js SVG analytical visualization with scales, gradients, and interactive tooltips"
              >
                D3 Interactive SVG
              </button>
              <button
                type="button"
                onClick={() => setChartEngine('recharts')}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition ${
                  chartEngine === 'recharts'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Recharts standard container"
              >
                Recharts View
              </button>
            </div>
          </div>
        </div>

        {/* Primary D3.js Analytical SVG Chart */}
        {chartEngine === 'd3' ? (
          <D3HazardTrendChart
            data={chartData}
            metricName={primary_metric_name}
            metricUnits={metric_units}
            olsSlope={ols_regression?.slope_per_year}
            olsPValue={ols_regression?.p_value}
            selectedYear={selectedYear}
            onYearSelect={onYearSelect}
            thresholdValue={definitionsSummary?.threshold_value}
            thresholdLabel={
              definitionsSummary?.threshold_value !== undefined
                ? `Threshold: ${definitionsSummary.threshold_value} ${definitionsSummary.threshold_unit || metric_units}`
                : undefined
            }
          />
        ) : (
          /* Recharts Fallback Container */
          <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="year"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                unit={` ${metric_units}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const dataPoint = payload[0].payload;
                    return (
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 shadow-xl text-xs font-mono space-y-1.5">
                        <div className="font-bold text-slate-200 border-b border-slate-800 pb-1">
                          Year {label}
                        </div>
                        <div className="flex items-center justify-between gap-4 text-orange-300">
                          <span>Observed:</span>
                          <span className="font-bold">
                            {dataPoint.observed !== null ? `${dataPoint.observed} ${metric_units}` : 'Incomplete / Excluded'}
                          </span>
                        </div>
                        {dataPoint.fitted !== null && (
                          <div className="flex items-center justify-between gap-4 text-amber-300">
                            <span>OLS Fitted:</span>
                            <span className="font-bold">{dataPoint.fitted} {metric_units}</span>
                          </div>
                        )}
                        {dataPoint.rolling !== null && (
                          <div className="flex items-center justify-between gap-4 text-cyan-300">
                            <span>3-Yr Rolling:</span>
                            <span className="font-bold">{dataPoint.rolling} {metric_units}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                          {dataPoint.isValid ? 'Certified valid calendar year' : 'Excluded from trend regression (<90% data)'}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Observed Points as Distinct Bars */}
              <Bar
                dataKey="observed"
                name="Observed Annual"
                fill="#f97316"
                fillOpacity={0.65}
                stroke="#ea580c"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
              {/* OLS Linear Regression Line: Distinct Dashed Line */}
              {ols_regression && (
                <Line
                  type="linear"
                  dataKey="fitted"
                  name="OLS Fitted Line"
                  stroke="#facc15"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={false}
                />
              )}
              {/* 3-Year Rolling Average Line */}
              <Line
                type="monotone"
                dataKey="rolling"
                name="3-Yr Rolling Mean"
                stroke="#06b6d4"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#06b6d4' }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

        {/* Statistical Parameters Legend Table */}
        {ols_regression && mann_kendall && (
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2 rounded bg-slate-950/40 border border-slate-800/60">
              <span className="text-slate-500 text-[10px] block">OLS 95% Confidence</span>
              <span className="text-slate-200">
                [{ols_regression.confidence_interval_95[0]}, {ols_regression.confidence_interval_95[1]}]
              </span>
            </div>
            <div className="p-2 rounded bg-slate-950/40 border border-slate-800/60">
              <span className="text-slate-500 text-[10px] block">Standard Error</span>
              <span className="text-slate-200">&plusmn;{ols_regression.stderr} {metric_units}/yr</span>
            </div>
            <div className="p-2 rounded bg-slate-950/40 border border-slate-800/60">
              <span className="text-slate-500 text-[10px] block">Kendall S / Variance</span>
              <span className="text-slate-200">
                S = {mann_kendall.s_statistic} &bull; Var = {mann_kendall.variance_s}
              </span>
            </div>
            <div className="p-2 rounded bg-slate-950/40 border border-slate-800/60">
              <span className="text-slate-500 text-[10px] block">Tied Groups Handled</span>
              <span className="text-slate-200">
                {mann_kendall.tied_groups_count > 0 ? `${mann_kendall.tied_groups_count} tied group(s)` : 'No ties'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Qualifying Event List Drawer / Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Qualifying Hazard Events Audit
            </h3>
          </div>
          <div className="flex items-center gap-2.5">
            {definitionsSummary?.threshold_value !== undefined && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/50 text-amber-300">
                Threshold: &gt; {definitionsSummary.threshold_value} {definitionsSummary.threshold_unit ?? '°C'} ({definitionsSummary.threshold_percentile ?? ''}th %ile)
              </span>
            )}
            <span className="text-xs font-mono text-slate-400">
              {eventsList ? `${eventsList.length} qualifying event(s)` : 'No events'}
            </span>
          </div>
        </div>

        {eventsList && eventsList.length > 0 ? (
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px]">
                <tr>
                  <th className="py-2 px-3">Start Date</th>
                  <th className="py-2 px-3">End Date</th>
                  <th className="py-2 px-3">Duration</th>
                  <th className="py-2 px-3">Mean Value</th>
                  <th className="py-2 px-3">Max Value</th>
                  <th className="py-2 px-3">Exceedance Intensity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {eventsList.map((ev, idx) => (
                  <tr key={`${ev.start_date}-${idx}`} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-semibold text-slate-200">{ev.start_date}</td>
                    <td className="py-2 px-3 text-slate-300">{ev.end_date}</td>
                    <td className="py-2 px-3 text-cyan-300 font-semibold">{ev.duration_days} days</td>
                    <td className="py-2 px-3 text-orange-300">{ev.mean_value.toFixed(2)}</td>
                    <td className="py-2 px-3 text-rose-300">{ev.max_value.toFixed(2)}</td>
                    <td className="py-2 px-3 text-amber-300 font-semibold">{ev.intensity_metric.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-3 text-center">
            No qualifying extreme events observed exceeding threshold{definitionsSummary?.threshold_value !== undefined ? ` (${definitionsSummary.threshold_value} ${definitionsSummary.threshold_unit ?? '°C'})` : ''} in selected period.
          </p>
        )}
      </div>
    </div>
  );
};
