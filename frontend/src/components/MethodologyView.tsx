import React from 'react';
import {
  Flame,
  CloudSun,
  CloudRain,
  TrendingUp,
  ShieldCheck,
  Database,
  ArrowLeft,
} from 'lucide-react';

interface MethodologyViewProps {
  onBackToMap?: () => void;
}

export const MethodologyView: React.FC<MethodologyViewProps> = ({ onBackToMap }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 font-sans">
      {/* Top Header / Back */}
      {onBackToMap && (
        <button
          type="button"
          onClick={onBackToMap}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-teal-900 hover:bg-slate-50 transition shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-teal-700" />
          <span>Back to Interactive Map</span>
        </button>
      )}

      {/* Overview */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800">
            <ShieldCheck className="w-5 h-5 text-teal-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Scientific Methodology & Governance</h1>
            <p className="text-xs text-slate-500">Documented standards, empirical definitions, and operational limits of Dygnify</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Dygnify executes all climate hazard calculations via deterministic Python 3 routines on verified historical observations. The LLM acts exclusively as an evidence synthesizer and never invents measurements, calculates authoritative statistics in prose, or substitutes synthetic data for empirical reanalysis.
        </p>
      </div>

      {/* Hazard Definitions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Heatwave */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <Flame className="w-4 h-4 text-amber-600" />
              </span>
              <h2 className="font-bold text-slate-900 text-base">Heatwave Hazard</h2>
            </div>
            <ul className="text-xs text-slate-600 space-y-2.5">
              <li>
                <strong className="text-slate-900">Threshold:</strong> Daily maximum temperature (<code className="font-mono text-teal-800 bg-slate-100 px-1 py-0.5 rounded">temperature_2m_max</code>) exceeding the local 95th percentile.
              </li>
              <li>
                <strong className="text-slate-900">Run Rule:</strong> Strictly ≥ 3 consecutive valid days above the threshold.
              </li>
              <li>
                <strong className="text-slate-900">Missing Data:</strong> Missing dates or invalid measurements immediately break consecutive sequences. Gaps are never bridged.
              </li>
              <li>
                <strong className="text-slate-900">Intensity:</strong> Exceedance degree-days calculated as sum of <code className="font-mono text-teal-800 bg-slate-100 px-1 py-0.5 rounded">(T_max - Threshold)</code>.
              </li>
            </ul>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
            Unit: °C / Consecutive Days
          </div>
        </div>

        {/* Drought */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <CloudSun className="w-4 h-4 text-amber-600" />
              </span>
              <h2 className="font-bold text-slate-900 text-base">Meteorological Drought Proxy</h2>
            </div>
            <ul className="text-xs text-slate-600 space-y-2.5">
              <li>
                <strong className="text-slate-900">Terminology:</strong> Designated honestly as a <em>rolling precipitation deficit proxy</em>.
              </li>
              <li>
                <strong className="text-slate-900">Window:</strong> 90-day rolling accumulation deficit compared against climatological baseline mean.
              </li>
              <li>
                <strong className="text-slate-900">Threshold:</strong> Cumulative rainfall deficit &gt; 50% below baseline seasonal norm.
              </li>
              <li>
                <strong className="text-slate-900">Boundaries:</strong> Does not claim agricultural or ecological drought without in-situ soil moisture sensors.
              </li>
            </ul>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
            Unit: mm deficit / Anomaly Ratio
          </div>
        </div>

        {/* Heavy Rainfall */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
                <CloudRain className="w-4 h-4 text-teal-600" />
              </span>
              <h2 className="font-bold text-slate-900 text-base">Heavy Precipitation</h2>
            </div>
            <ul className="text-xs text-slate-600 space-y-2.5">
              <li>
                <strong className="text-slate-900">Threshold:</strong> Daily precipitation (<code className="font-mono text-teal-800 bg-slate-100 px-1 py-0.5 rounded">precipitation_sum</code>) exceeding the local 95th wet-day percentile.
              </li>
              <li>
                <strong className="text-slate-900">Wet Day Cutoff:</strong> Days with precipitation ≥ 1.0 mm define the precipitation sample pool.
              </li>
              <li>
                <strong className="text-slate-900">Grouping:</strong> Consecutive extreme precipitation days grouped into multi-day storm events.
              </li>
              <li>
                <strong className="text-slate-900">Metrics:</strong> Event count, total volume (mm), and annual maximum single-day rainfall (Rx1day).
              </li>
            </ul>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
            Unit: mm / Event Duration
          </div>
        </div>
      </div>

      {/* Statistical Governance */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-teal-700" />
          <h2 className="font-bold text-slate-900 text-lg">Statistical Models & Limitations</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600">
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Mann-Kendall Trend Test</h3>
            <p className="leading-relaxed">
              We apply the non-parametric Mann-Kendall test to evaluate monotonic upward or downward trends across annual metric series. This method does not assume normally distributed data and accommodates non-linear step shifts.
            </p>
            <p className="leading-relaxed">
              <span className="text-teal-800 font-semibold">Minimum Sample:</span> Requires a minimum of 5 valid annual points. Incomplete years with &gt;10% missing daily data are excluded to prevent seasonal skew.
            </p>
          </div>
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Linear Regression & Causation Caveat</h3>
            <p className="leading-relaxed">
              Ordinary Least Squares (OLS) regression provides the trend slope per calendar year and coefficient of determination (R²).
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
              <strong>Caution:</strong> Statistical trend association does not demonstrate physical causation. Changes in observed hazard frequency may reflect regional multidecadal oscillations or atmospheric teleconnections.
            </div>
          </div>
        </div>
      </div>

      {/* Data Source & Provenance */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-5 h-5 text-teal-700" />
          <h2 className="font-bold text-slate-900 text-lg">Data Provenance & Spatial Resolution</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Historical daily atmospheric observations are acquired directly from the{' '}
          <a
            href="https://open-meteo.com/en/docs/historical-weather-api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-700 hover:underline font-mono font-semibold"
          >
            Open-Meteo Historical Weather API
          </a>{' '}
          (ECMWF ERA5 / ERA5-Land reanalysis). Spatial resolution is approximately 0.1° (~11 km) with daily aggregates. Single-point analyses represent the specific nearest grid coordinate and are not mislabeled as regional averages.
        </p>
      </div>
    </div>
  );
};
