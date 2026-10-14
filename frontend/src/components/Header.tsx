import React from 'react';
import { 
  Globe2, 
  RefreshCw, 
  BookOpen, 
  Database,
  ExternalLink 
} from 'lucide-react';
import type { ConnectionState, HealthResponse } from '../types/api';

interface HeaderProps {
  connectionState: ConnectionState;
  healthData: HealthResponse | null;
  onRefreshHealth: () => void;
  activeTab: 'dashboard' | 'methodology' | 'system';
  setActiveTab: (tab: 'dashboard' | 'methodology' | 'system') => void;
  onOpenDataSources: () => void;
  apiBaseUrl: string;
}

export const Header: React.FC<HeaderProps> = ({
  connectionState,
  healthData,
  onRefreshHealth,
  activeTab,
  setActiveTab,
  onOpenDataSources,
  apiBaseUrl,
}) => {
  return (
    <header className="border-b border-space-700 bg-space-900/90 backdrop-blur sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-space-800 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Globe2 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">Dygnify<span className="text-cyan-400">AI</span></span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-space-800 border border-space-700 text-cyan-300">
                  v0.1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Climate Hazard Trend & Empirical Risk Analyzer</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-space-800 text-cyan-400 border border-space-700 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-space-850'
              }`}
            >
              Explore
            </button>
            <button
              onClick={() => setActiveTab('methodology')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'methodology'
                  ? 'bg-space-800 text-cyan-400 border border-space-700 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-space-850'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Methodology</span>
            </button>
            <button
              onClick={onOpenDataSources}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-space-850 transition-all"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Data Sources</span>
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'system'
                  ? 'bg-space-800 text-cyan-400 border border-space-700 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-space-850'
              }`}
            >
              <span className="hidden md:inline">Telemetry</span>
            </button>
          </nav>

          {/* Right Status Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-space-950/80 border border-space-700 rounded-full px-3 py-1.5 text-xs">
              {connectionState === 'checking' && (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span className="text-amber-300 font-mono hidden sm:inline">Pinging API...</span>
                </>
              )}
              {connectionState === 'connected' && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-400 font-medium">Backend Ready</span>
                  {healthData && (
                    <span className="text-slate-400 font-mono hidden lg:inline">
                      ({healthData.uptime_seconds.toFixed(0)}s up)
                    </span>
                  )}
                </>
              )}
              {connectionState === 'disconnected' && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  <span className="text-rose-400 font-medium">Backend Offline</span>
                  <button
                    onClick={onRefreshHealth}
                    title="Retry connection"
                    className="ml-1 text-slate-400 hover:text-white hover:rotate-180 transition-transform"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>

            {/* API Docs Link */}
            <a
              href={`${apiBaseUrl}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-cyan-400 transition-colors p-1.5 rounded-lg hover:bg-space-850 hidden sm:flex items-center gap-1 text-xs"
              title="FastAPI Interactive Swagger Docs"
            >
              <span className="font-mono">OpenAPI</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
