import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Bot,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  CheckCircle2,
  Info,
  RefreshCw,
  Cpu,
  Layers,
  Database,
} from 'lucide-react';
import type { AnalysisResponse, AISummaryResponse } from '../types/api';
import { generateClimateSummary } from '../api/client';

interface AIBriefingCardProps {
  analysis: AnalysisResponse;
}

export const AIBriefingCard: React.FC<AIBriefingCardProps> = ({ analysis }) => {
  const [summaryData, setSummaryData] = useState<AISummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPromptAudit, setShowPromptAudit] = useState<boolean>(false);
  const [showCaveats, setShowCaveats] = useState<boolean>(true);

  const fetchSummary = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);
      const res = await generateClimateSummary(analysis, forceRefresh);
      if (res.data) {
        setSummaryData(res.data);
      } else {
        setError(res.error || 'Failed to fetch AI climate summary.');
      }
      setLoading(false);
    },
    [analysis]
  );

  useEffect(() => {
    fetchSummary(false);
  }, [fetchSummary]);

  const {
    hazard_type,
    spatial_metadata,
    annual_series,
    trends,
    events_list,
  } = analysis;

  const safeEventsList = events_list || [];
  const validYears = annual_series.filter((y) => y.is_available);
  const coveragePct = Math.round(
    (validYears.length / Math.max(1, annual_series.length)) * 100
  );

  const isSig = trends?.is_statistically_significant || false;
  const slopeStr = trends?.ols_regression
    ? `${trends.ols_regression.slope_per_year > 0 ? '+' : ''}${trends.ols_regression.slope_per_year.toFixed(2)} ${trends.metric_units}/yr`
    : 'N/A';
  const decadeStr = trends?.ols_regression
    ? `${trends.ols_regression.slope_per_year > 0 ? '+' : ''}${(trends.ols_regression.slope_per_year * 10).toFixed(1)} ${trends.metric_units}/decade`
    : 'N/A';

  const windowComp = trends?.window_comparison;
  const maxDuration =
    safeEventsList.length > 0
      ? Math.max(...safeEventsList.map((e) => e.duration_days))
      : 0;

  const isFallback = summaryData?.provenance.is_fallback ?? false;
  const modelName =
    summaryData?.provenance.source === 'groq'
      ? 'Groq (Llama 3.3 70B Engine)'
      : 'Deterministic Template Engine';

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-cyan-500/30 rounded-xl p-6 shadow-xl relative overflow-hidden backdrop-blur">
      {/* Top Ambient Glow Accent */}
      <div className="absolute top-0 right-0 w-80 h-32 bg-cyan-500/10 blur-3xl pointer-events-none rounded-full" />

      {/* Header with AI Badge & Grounding Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                AI Climate Evidence Briefing
              </h3>

              {/* Engine Source Badge */}
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold flex items-center gap-1 ${
                  isFallback
                    ? 'bg-amber-950/60 border-amber-800/80 text-amber-300'
                    : 'bg-cyan-950/80 border-cyan-800/80 text-cyan-300'
                }`}
                title={summaryData?.provenance.fallback_reason || undefined}
              >
                {isFallback ? <Cpu className="w-3 h-3 text-amber-400" /> : <Bot className="w-3 h-3 text-cyan-400" />}
                {modelName}
              </span>

              {/* Cached Indicator */}
              {summaryData?.provenance.cached && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-400">
                  Cached
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-0.5">
              Strictly pre-computed Python metrics interpreted through cautious scientific system guardrails.
            </p>
          </div>
        </div>

        {/* Action Controls & Grounding Rating */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSummary(true)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
            title="Bypass cache and request fresh explanation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Regenerate</span>
          </button>

          <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded bg-slate-950 border border-emerald-800/60 text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Python Metrics Supplied to AI</span>
          </span>
        </div>
      </div>

      {/* Error Notice Banner if endpoint error occurred */}
      {error && !summaryData && (
        <div className="mt-3.5 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-[11px] text-rose-300 flex items-center gap-2 relative z-10">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error} Rendering client-side evidence synthesis below.</span>
        </div>
      )}

      {/* Fallback Notice Banner when active */}
      {isFallback && summaryData?.provenance.fallback_reason && (
        <div className="mt-3.5 p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300/90 flex items-center justify-between gap-2 relative z-10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Deterministic Fallback Active:</strong> {summaryData.provenance.fallback_reason}
            </span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-700/60 text-amber-200 shrink-0">
            Zero-Hallucination
          </span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !summaryData && (
        <div className="py-6 space-y-3 relative z-10 animate-pulse">
          <div className="h-4 bg-slate-800/70 rounded w-3/4"></div>
          <div className="h-3 bg-slate-800/50 rounded w-full"></div>
          <div className="h-3 bg-slate-800/50 rounded w-5/6"></div>
          <div className="h-3 bg-slate-800/40 rounded w-2/3"></div>
        </div>
      )}

      {/* Structured Synthesized Narrative */}
      {summaryData?.summary ? (
        <div className="py-4 space-y-4 text-xs leading-relaxed text-slate-300 relative z-10">
          {/* Headline */}
          <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-900/50 text-cyan-200 text-xs font-medium">
            <span className="font-semibold text-cyan-400">Headline: </span>
            {summaryData.summary.headline}
          </div>

          {/* Observed Patterns */}
          <div className="space-y-1.5">
            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Observed Empirical Patterns:</span>
            </div>
            <ul className="space-y-1.5 pl-4 list-disc marker:text-cyan-500 text-slate-300">
              {summaryData.summary.observed_patterns.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Trend Interpretation */}
          <div className="space-y-1">
            <strong className="text-slate-100 block">Statistical Trend Interpretation:</strong>
            <p className="text-slate-300 bg-slate-950/40 p-2.5 rounded border border-slate-800/70">
              {summaryData.summary.trend_interpretation}
            </p>
          </div>

          {/* Data Quality Note */}
          <div className="space-y-1">
            <strong className="text-slate-100 block">Data Completeness & Grid Quality:</strong>
            <p className="text-slate-400 italic text-[11px]">
              {summaryData.summary.data_quality_note}
            </p>
          </div>
        </div>
      ) : (
        /* Fallback when summary endpoint fails entirely */
        <div className="py-4 space-y-3.5 text-xs leading-relaxed text-slate-300 relative z-10">
          <p>
            <strong className="text-slate-100">1. Empirical Trend Direction: </strong>
            The historical {hazard_type.replace('_', ' ')} series evaluated over{' '}
            <span className="font-mono text-cyan-300">{annual_series.length} calendar years</span> (
            {spatial_metadata.resolution}) exhibits an estimated linear rate of{' '}
            <span className="font-mono font-semibold text-amber-300">{slopeStr}</span> ({decadeStr}).
            Non-parametric Mann–Kendall testing indicates{' '}
            {isSig ? (
              <span className="text-rose-400 font-semibold">
                statistically significant monotonic movement (p = {trends?.mann_kendall?.p_value.toFixed(4)}, &tau; = {trends?.mann_kendall?.tau.toFixed(2)})
              </span>
            ) : (
              <span className="text-slate-400 font-medium">
                no statistically significant monotonic movement at &alpha; = 0.05 level (p = {trends?.mann_kendall?.p_value.toFixed(4) ?? 'N/A'})
              </span>
            )}
            .
          </p>

          <p>
            <strong className="text-slate-100">2. Multi-Year Mean Baseline Shift: </strong>
            {windowComp ? (
              <span>
                Comparing the baseline window ({windowComp.early_window_years[0]}–
                {windowComp.early_window_years[windowComp.early_window_years.length - 1]}, mean{' '}
                {windowComp.early_window_mean} {trends?.metric_units}) against recent window (
                {windowComp.late_window_years[0]}–
                {windowComp.late_window_years[windowComp.late_window_years.length - 1]}, mean{' '}
                {windowComp.late_window_mean} {trends?.metric_units}) indicates absolute change of{' '}
                <span className="font-mono font-semibold text-cyan-300">
                  {windowComp.absolute_change > 0 ? '+' : ''}
                  {windowComp.absolute_change} {trends?.metric_units}
                </span>.
              </span>
            ) : (
              <span>Multi-year baseline comparison withheld due to insufficient valid years.</span>
            )}
          </p>

          <p>
            <strong className="text-slate-100">3. Qualifying Hazard Extremes: </strong>
            A total of{' '}
            <span className="font-mono font-semibold text-orange-400">{safeEventsList.length}</span> qualifying extreme event(s) recorded (longest streak: {maxDuration} days, spatial coverage: {coveragePct}%).
          </p>
        </div>
      )}

      {/* Grounding & Methodology Caveats Accordion */}
      <div className="pt-2 border-t border-slate-800/80 relative z-10">
        <button
          onClick={() => setShowCaveats(!showCaveats)}
          className="flex items-center justify-between w-full text-left py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
        >
          <span className="flex items-center gap-1.5 text-cyan-400">
            <Info className="w-3.5 h-3.5" />
            <span>Scientific Attribution & Methodological Caveats ({summaryData?.summary.caveats.length ?? 3})</span>
          </span>
          {showCaveats ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {showCaveats && (
          <div className="mt-2 p-3.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] text-slate-400 space-y-2 leading-relaxed">
            <div className="flex items-start gap-2 text-amber-300/90 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
              <span>Attribution Boundary: Empirical Observation vs Local Physical Causation</span>
            </div>

            {summaryData?.summary.caveats ? (
              <ul className="space-y-1.5 pl-3 list-disc marker:text-amber-400">
                {summaryData.summary.caveats.map((cav, cIdx) => (
                  <li key={cIdx}>{cav}</li>
                ))}
              </ul>
            ) : (
              <p>
                Statistical slope and Mann–Kendall rank tests characterize historical observations over the specified sampling window. They do <em>not</em> establish anthropogenic forcing or localized physical causation. Natural low-frequency oscillations induce serial autocorrelation that can deflate nominal p-values.
              </p>
            )}

            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60 text-[10px] text-slate-500">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Metrics origin: Pure Python algorithms over ECMWF ERA5 reanalysis (Open-Meteo CC-BY 4.0).</span>
            </div>
          </div>
        )}
      </div>

      {/* Prompt Audit Toggle */}
      <div className="pt-2 relative z-10">
        <button
          onClick={() => setShowPromptAudit(!showPromptAudit)}
          className="flex items-center gap-1 text-[11px] font-mono text-slate-500 hover:text-slate-300 transition"
        >
          <FileText className="w-3 h-3" />
          <span>{showPromptAudit ? 'Hide Audit Provenance' : 'View LLM Guardrail & Verification Audit'}</span>
        </button>

        {showPromptAudit && (
          <div className="mt-2 p-3 rounded bg-slate-950 font-mono text-[10px] text-slate-400 border border-slate-800 overflow-x-auto space-y-1.5">
            <div className="text-cyan-400 font-bold flex items-center gap-1.5">
              <Database className="w-3 h-3" />
              <span>PROVENANCE & AUDIT TRAIL</span>
            </div>
            <div>&bull; Analysis ID: <span className="text-slate-200">{analysis.analysis_id}</span></div>
            <div>&bull; SHA-256 Hash: <span className="text-slate-300">{summaryData?.provenance.analysis_hash || 'Ad-hoc calculation'}</span></div>
            <div>&bull; Engine Model: <span className="text-cyan-300">{summaryData?.provenance.model || 'deterministic-template'}</span></div>
            <div>&bull; Prompt Policy: <span className="text-emerald-400">ZERO_FABRICATION (v1.0-cautious)</span></div>
            <div>&bull; Cache Status: <span className="text-slate-300">{summaryData?.provenance.cached ? 'True (MongoDB)' : 'False (Direct Execution)'}</span></div>
            <div>&bull; Timestamp: <span className="text-slate-400">{summaryData?.provenance.created_at || new Date().toISOString()}</span></div>
          </div>
        )}
      </div>
    </div>
  );
};
