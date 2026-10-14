import React from 'react';
import { Database, Server, CheckCircle2, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import type { ConnectionState, HealthResponse } from '../types/api';

interface SystemInfoViewProps {
  connectionState: ConnectionState;
  healthData: HealthResponse | null;
  errorMessage: string | null;
  apiBaseUrl: string;
  onRefreshHealth: () => void;
  onBackToMap?: () => void;
}

export const SystemInfoView: React.FC<SystemInfoViewProps> = ({
  connectionState,
  healthData,
  errorMessage,
  apiBaseUrl,
  onRefreshHealth,
  onBackToMap,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 font-sans">
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

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800">
              <Server className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">API Diagnostics & System Topology</h1>
              <p className="text-xs text-slate-500">Real-time telemetry from FastAPI backend and upstream services</p>
            </div>
          </div>
          <button
            onClick={onRefreshHealth}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-semibold self-start sm:self-center transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${connectionState === 'checking' ? 'animate-spin text-teal-700' : ''}`} />
            <span>Poll Health Status</span>
          </button>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <span className="text-[11px] font-mono uppercase text-slate-500 block mb-1">FastAPI Backend</span>
            <div className="flex items-center gap-2">
              {connectionState === 'connected' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">Operational</span>
                </>
              ) : connectionState === 'checking' ? (
                <>
                  <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" />
                  <span className="text-sm font-semibold text-amber-800">Checking...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span className="text-sm font-semibold text-rose-800">Unreachable</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-mono truncate">{apiBaseUrl}</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <span className="text-[11px] font-mono uppercase text-slate-500 block mb-1">MongoDB Atlas</span>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-teal-700" />
              <span className="text-sm font-semibold text-slate-800">
                {healthData?.services.database ? healthData.services.database.toUpperCase() : 'CONFIGURED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-mono">Async Motor Driver</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <span className="text-[11px] font-mono uppercase text-slate-500 block mb-1">Open-Meteo Provider</span>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-800">ERA5 Historical Archive</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-mono">CC-BY 4.0 Attribution</p>
          </div>
        </div>
      </div>

      {/* Health Payload Inspection */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Live Health Response Payload</h2>
        {healthData ? (
          <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-800 overflow-x-auto leading-relaxed">
            {JSON.stringify(healthData, null, 2)}
          </pre>
        ) : (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-700 font-mono">
            No health response received. Server error: {errorMessage || 'Connection refused.'}
          </div>
        )}
      </div>

      {/* Available Endpoints Contract */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">API Route Registry</h2>
        <div className="divide-y divide-slate-100 text-xs">
          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-200">GET</span>
              <span className="font-mono text-slate-800">/</span>
            </div>
            <span className="text-slate-500">Root metadata and data provenance</span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-200">GET</span>
              <span className="font-mono text-slate-800">/api/v1/health</span>
            </div>
            <span className="text-slate-500">Application health, uptime, and subservices</span>
          </div>
          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-200">GET</span>
              <span className="font-mono text-slate-800">/docs</span>
            </div>
            <span className="text-slate-500">FastAPI Swagger interactive OpenAPI documentation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
