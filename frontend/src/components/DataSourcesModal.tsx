import React from 'react';
import { Database, X, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface DataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataSourcesModal: React.FC<DataSourcesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-slate-800 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-800">
              <Database className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Atmospheric Data Sources & Provenance</h2>
              <p className="text-xs text-slate-500">
                Authoritative reanalysis models, licensing, and spatial resolution standards.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Core Sources Breakdown */}
        <div className="space-y-4 text-xs">
          {/* Source 1: Open-Meteo */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-teal-900">Open-Meteo Historical Weather API</span>
              <a
                href="https://open-meteo.com/en/docs/historical-weather-api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono text-teal-700 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Documentation</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Provides daily maximum surface temperature (<code>temperature_2m_max</code>) and daily total precipitation (<code>precipitation_sum</code>) directly from atmospheric model archives without extrapolation or synthetic gap-filling.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 font-mono text-[11px] text-slate-500">
              <div>&bull; License: <span className="text-slate-800 font-semibold">CC-BY 4.0</span></div>
              <div>&bull; Archive Range: <span className="text-slate-800 font-semibold">1940 to present</span></div>
            </div>
          </div>

          {/* Source 2: ECMWF ERA5 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-amber-900">ECMWF ERA5 / ERA5-Land Reanalysis</span>
              <span className="text-[10px] font-mono text-amber-800 uppercase px-2 py-0.5 rounded bg-amber-100 border border-amber-200 font-bold">
                Gold Standard Reanalysis
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              The European Centre for Medium-Range Weather Forecasts (ECMWF) fifth generation global atmospheric reanalysis. Combines physical model dynamics with billions of historical land, buoy, satellite, and radiosonde observations.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 font-mono text-[11px] text-slate-500">
              <div>&bull; Spatial Resolution: <span className="text-slate-800 font-semibold">~0.1° (~11 km)</span></div>
              <div>&bull; Time Step: <span className="text-slate-800 font-semibold">Daily Max / Sum</span></div>
            </div>
          </div>

          {/* Climatological Baseline Standard */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="font-bold text-sm text-emerald-900">Climatological Reference Baselines</span>
            <p className="text-slate-600 leading-relaxed">
              Dygnify supports the standard 30-year WMO climatological reference window (1991–2020). When a query spans a custom range without fixed baseline years specified, the system explicitly labels the threshold as <span className="text-amber-800 font-mono font-semibold">"Exploratory threshold computed over full observation period"</span> to maintain scientific honesty.
            </p>
          </div>

          {/* Provenance & MongoDB Caching */}
          <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 text-[11px] text-teal-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-teal-950">Data Governance & Caching: </span>
              Every queried coordinate is normalized to the 0.1° ERA5 model grid key and cached in MongoDB Atlas collections (<code>weather_daily</code>, <code>analyses</code>, <code>regions</code>). Range cache diffing retrieves only missing sub-intervals and tracks full provenance metadata.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs text-slate-500">
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified ERA5 Atmospheric Archive
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
