import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe2,
  ExternalLink,
  RefreshCw,
  Database,
  BookOpen,
  Map,
  SlidersHorizontal,
  TrendingUp,
  Server,
  Bot,
} from 'lucide-react';
import {
  DashboardShell,
  type DashboardShellRef,
  type WorkspaceMode,
} from './components/DashboardShell';
import { MethodologyView } from './components/MethodologyView';
import { SystemInfoView } from './components/SystemInfoView';
import { DataSourcesModal } from './components/DataSourcesModal';
import { StatusBanner } from './components/StatusBanner';
import { checkBackendHealth, getApiBaseUrl } from './api/client';
import type { ConnectionState, HealthResponse } from './types/api';

export function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'methodology' | 'system'>('dashboard');
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState<boolean>(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('explore');

  // Ref to DashboardShell for drawer and layer triggers
  const dashboardRef = useRef<DashboardShellRef>(null);

  const apiBaseUrl = getApiBaseUrl();

  const handleCheckHealth = useCallback(async () => {
    setConnectionState('checking');
    const result = await checkBackendHealth(5000);
    if (result.data) {
      setHealthData(result.data);
      setErrorMessage(null);
      setConnectionState('connected');
    } else {
      setHealthData(null);
      setErrorMessage(result.error);
      setConnectionState('disconnected');
    }
  }, []);

  useEffect(() => {
    handleCheckHealth();
  }, [handleCheckHealth]);

  // Handle 3-Mode workspace switcher (Explore | Analyze | Deep Analysis)
  const handleModeChange = (mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
    setActiveTab('dashboard');
    if (mode === 'explore') {
      dashboardRef.current?.closeDrawers();
      dashboardRef.current?.setWorkspaceMode('explore');
    } else if (mode === 'analyze') {
      dashboardRef.current?.openAnalysisDrawer();
      dashboardRef.current?.setWorkspaceMode('analyze');
    } else if (mode === 'deep-analysis') {
      dashboardRef.current?.setWorkspaceMode('deep-analysis');
    }
  };

  const handleOpenExplore = () => {
    setActiveTab('dashboard');
    setWorkspaceMode('explore');
    dashboardRef.current?.closeDrawers();
    dashboardRef.current?.setWorkspaceMode('explore');
  };

  const handleOpenAIDrawer = () => {
    setActiveTab('dashboard');
    dashboardRef.current?.openAIDrawer();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-800 font-sans overflow-hidden select-none">
      {/* 1. Compact Google Maps-Style Top Navigation Header */}
      <header className="h-14 bg-white border-b border-slate-200/90 px-3 sm:px-4 flex items-center justify-between shrink-0 z-40 shadow-xs">
        {/* Left: Brand */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div
            onClick={handleOpenExplore}
            className="flex items-center gap-2.5 cursor-pointer group"
            role="button"
            tabIndex={0}
            title="Return to Explore map"
          >
            <div className="w-8 h-8 rounded-xl bg-teal-700 flex items-center justify-center text-white shadow-xs group-hover:bg-teal-800 transition">
              <Globe2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-slate-900">
                  Dygnify <span className="text-teal-700">AI</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-none hidden sm:block">
                Climate intelligence workspace
              </p>
            </div>
          </div>
        </div>

        {/* Center: 3-Mode Workspace Switcher (Explore | Analyze | Deep Analysis) */}
        <nav className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/90 shadow-xs" aria-label="Workspace Modes">
          <button
            type="button"
            onClick={() => handleModeChange('explore')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              workspaceMode === 'explore'
                ? 'bg-white text-teal-800 shadow-xs border border-slate-200/90'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
            title="Explore Mode: Map-first geographic exploration"
          >
            <Map className="w-3.5 h-3.5 text-teal-700" />
            <span className="hidden sm:inline">Explore</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('analyze')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              workspaceMode === 'analyze'
                ? 'bg-white text-teal-800 shadow-xs border border-slate-200/90'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
            title="Analyze Mode: Map with analytical results drawer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-teal-700" />
            <span className="hidden sm:inline">Analyze</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('deep-analysis')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              workspaceMode === 'deep-analysis'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
            title="Deep Analysis Mode: Dedicated full-width scientific workspace"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Deep Analysis</span>
          </button>
        </nav>

        {/* Right: ERA5 Data Provenance Badge & Backend Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* ERA5 Data Badge (opens data sources modal) */}
          <button
            type="button"
            onClick={() => setIsDataSourcesOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 hover:bg-teal-100/80 border border-teal-200/80 text-teal-800 text-xs font-medium transition shadow-xs"
            title="Atmospheric reanalysis model provenance & licensing"
          >
            <Database className="w-3.5 h-3.5 text-teal-700" />
            <span className="font-semibold">ERA5 data</span>
          </button>

          {/* Backend Connection Status Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-mono">
            {connectionState === 'checking' && (
              <>
                <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
                <span className="text-amber-700 hidden md:inline text-[11px]">Connecting...</span>
              </>
            )}
            {connectionState === 'connected' && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-slate-700 text-[11px] font-sans font-medium hidden sm:inline">
                  Connected
                </span>
              </>
            )}
            {connectionState === 'disconnected' && (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-rose-700 text-[11px] font-sans font-medium hidden sm:inline">
                  Offline
                </span>
                <button
                  type="button"
                  onClick={handleCheckHealth}
                  className="text-slate-400 hover:text-slate-700"
                  title="Retry backend connection"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </>
            )}
          </div>

          {/* AI Assistant Quick Toggle */}
          <button
            type="button"
            onClick={handleOpenAIDrawer}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition"
            title="Open AI Climate Assistant"
          >
            <Bot className="w-3.5 h-3.5 text-teal-700" />
            <span className="hidden sm:inline">AI Briefing</span>
          </button>

          {/* Data Sources Provenance Modal Button */}
          <button
            type="button"
            onClick={() => setIsDataSourcesOpen(true)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition hidden sm:flex items-center justify-center"
            title="Data Sources & Observation Stations"
            aria-label="View data sources"
          >
            <Database className="w-4 h-4" />
          </button>

          {/* System Info Shortcut */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'system' ? 'dashboard' : 'system')}
            className={`p-1.5 rounded-xl transition hidden sm:flex items-center justify-center ${
              activeTab === 'system'
                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="System Status & Health Diagnostics"
            aria-label="View system info"
          >
            <Server className="w-4 h-4" />
          </button>

          {/* Methodology Shortcut */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'methodology' ? 'dashboard' : 'methodology')}
            className={`p-1.5 rounded-xl transition hidden sm:flex items-center justify-center ${
              activeTab === 'methodology'
                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="Scientific methodology documentation"
            aria-label="View methodology"
          >
            <BookOpen className="w-4 h-4" />
          </button>

          {/* OpenAPI Docs Link */}
          <a
            href={`${apiBaseUrl}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition hidden md:flex items-center justify-center"
            title="Open FastAPI interactive Swagger docs"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* 2. Connection Alert Banner (if disconnected) */}
      <StatusBanner
        connectionState={connectionState}
        errorMessage={errorMessage}
        apiBaseUrl={apiBaseUrl}
        onRetry={handleCheckHealth}
      />

      {/* 3. Main Workspace: Full-Viewport Map and Scientific Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Body Area */}
        <main className="flex-1 relative overflow-hidden h-full">
          {activeTab === 'dashboard' && (
            <DashboardShell
              ref={dashboardRef}
              connectionState={connectionState}
              onOpenMethodology={() => setActiveTab('methodology')}
              workspaceMode={workspaceMode}
              onWorkspaceModeChange={(mode) => {
                setWorkspaceMode(mode);
              }}
              onActiveDrawerChange={(drawer) => {
                if (drawer === 'analysis') {
                  setWorkspaceMode('analyze');
                } else if (drawer === 'assistant') {
                  // assistant drawer active
                } else {
                  if (workspaceMode !== 'deep-analysis') {
                    setWorkspaceMode('explore');
                  }
                }
              }}
            />
          )}

          {activeTab === 'methodology' && (
            <div className="h-full overflow-y-auto bg-slate-50">
              <MethodologyView onBackToMap={handleOpenExplore} />
            </div>
          )}

          {activeTab === 'system' && (
            <div className="h-full overflow-y-auto bg-slate-50">
              <SystemInfoView
                connectionState={connectionState}
                healthData={healthData}
                errorMessage={errorMessage}
                apiBaseUrl={apiBaseUrl}
                onRefreshHealth={handleCheckHealth}
                onBackToMap={handleOpenExplore}
              />
            </div>
          )}
        </main>
      </div>

      {/* Data Sources Provenance Modal */}
      <DataSourcesModal
        isOpen={isDataSourcesOpen}
        onClose={() => setIsDataSourcesOpen(false)}
      />
    </div>
  );
}

export default App;
