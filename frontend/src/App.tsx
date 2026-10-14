import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe2,
  ExternalLink,
  RefreshCw,
  Database,
  Menu,
  BookOpen,
} from 'lucide-react';
import { DashboardShell, type DashboardShellRef } from './components/DashboardShell';
import { NavigationRail, type NavigationRoute } from './components/NavigationRail';
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

  // Responsive Navigation Rail state (60px collapsed by default, expandable to 240px)
  const [isNavExpanded, setIsNavExpanded] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [activeNavRoute, setActiveNavRoute] = useState<NavigationRoute>('explore');

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

  // Handle route selection from left navigation rail
  const handleNavSelect = (routeId: NavigationRoute) => {
    setActiveNavRoute(routeId);

    if (routeId === 'explore') {
      setActiveTab('dashboard');
      dashboardRef.current?.closeDrawers();
    } else if (routeId === 'analysis') {
      setActiveTab('dashboard');
      dashboardRef.current?.openAnalysisDrawer();
    } else if (routeId === 'assistant') {
      setActiveTab('dashboard');
      dashboardRef.current?.openAIDrawer();
    } else if (routeId === 'layers') {
      setActiveTab('dashboard');
      dashboardRef.current?.toggleBasemap();
    } else if (routeId === 'reports') {
      setActiveTab('dashboard');
      dashboardRef.current?.openAnalysisDrawer();
    } else if (routeId === 'methodology') {
      setActiveTab('methodology');
    } else if (routeId === 'system') {
      setActiveTab('system');
    }
  };

  const handleToggleNavRail = () => {
    // If mobile, toggle overlay drawer; if desktop, toggle expansion
    if (window.innerWidth < 768) {
      setIsMobileNavOpen((prev) => !prev);
    } else {
      setIsNavExpanded((prev) => !prev);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-800 font-sans overflow-hidden select-none">
      {/* 1. Compact Google Maps-Style Top Navigation Header */}
      <header className="h-14 bg-white border-b border-slate-200/90 px-3 sm:px-4 flex items-center justify-between shrink-0 z-40 shadow-xs">
        {/* Left: Hamburger & Brand */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={handleToggleNavRail}
            className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-teal-600"
            title={isNavExpanded ? 'Collapse navigation rail' : 'Expand navigation rail'}
            aria-label="Toggle navigation rail"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={() => handleNavSelect('explore')}
            className="flex items-center gap-2.5 cursor-pointer group"
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

          {/* Methodology Shortcut */}
          <button
            type="button"
            onClick={() => handleNavSelect('methodology')}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition hidden sm:flex items-center justify-center"
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

      {/* 3. Main Workspace: Compact Navigation Rail + Full-Viewport Map */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Compact Navigation Rail (60px default -> 240px expanded) */}
        <NavigationRail
          activeRoute={activeNavRoute}
          onRouteChange={handleNavSelect}
          isExpanded={isNavExpanded}
          onToggleExpand={() => setIsNavExpanded(!isNavExpanded)}
          isMobileOpen={isMobileNavOpen}
          onMobileClose={() => setIsMobileNavOpen(false)}
        />

        {/* Main Body Area */}
        <main className="flex-1 relative overflow-hidden h-full">
          {activeTab === 'dashboard' && (
            <DashboardShell
              ref={dashboardRef}
              connectionState={connectionState}
              onOpenMethodology={() => handleNavSelect('methodology')}
              onToggleNavRail={handleToggleNavRail}
              isNavExpanded={isNavExpanded}
              onActiveDrawerChange={(drawer) => {
                if (drawer === 'analysis') setActiveNavRoute('analysis');
                else if (drawer === 'assistant') setActiveNavRoute('assistant');
                else setActiveNavRoute('explore');
              }}
            />
          )}

          {activeTab === 'methodology' && (
            <div className="h-full overflow-y-auto bg-slate-50">
              <MethodologyView onBackToMap={() => handleNavSelect('explore')} />
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
                onBackToMap={() => handleNavSelect('explore')}
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
