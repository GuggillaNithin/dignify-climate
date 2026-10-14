import React, { useState } from 'react';
import {
  Map,
  TrendingUp,
  Layers,
  FileText,
  Bot,
  Info,
  Server,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldCheck,
} from 'lucide-react';

export type NavigationRoute =
  | 'explore'
  | 'analysis'
  | 'layers'
  | 'reports'
  | 'assistant'
  | 'methodology'
  | 'system';

interface NavigationRailProps {
  activeRoute: NavigationRoute;
  onRouteChange: (route: NavigationRoute) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  hasActiveAnalysis?: boolean;
  onOpenAnalysisDrawer?: () => void;
  onOpenAIDrawer?: () => void;
  onOpenReportsDrawer?: () => void;
  onOpenLayersModal?: () => void;
  onOpenMethodology?: () => void;
  onOpenSystem?: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavItem {
  id: NavigationRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  onClick?: () => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeRoute,
  onRouteChange,
  isExpanded,
  onToggleExpand,
  hasActiveAnalysis = false,
  onOpenAnalysisDrawer,
  onOpenAIDrawer,
  onOpenReportsDrawer,
  onOpenLayersModal,
  onOpenMethodology,
  onOpenSystem,
  isMobileOpen = false,
  onMobileClose,
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const mainItems: NavItem[] = [
    {
      id: 'explore',
      label: 'Explore Map',
      icon: Map,
      onClick: () => onRouteChange('explore'),
    },
    {
      id: 'analysis',
      label: 'Climate Analysis',
      icon: TrendingUp,
      badge: hasActiveAnalysis ? 'Active' : undefined,
      onClick: () => {
        onRouteChange('analysis');
        if (onOpenAnalysisDrawer) onOpenAnalysisDrawer();
      },
    },
    {
      id: 'layers',
      label: 'Layers & Basemaps',
      icon: Layers,
      onClick: () => {
        onRouteChange('layers');
        if (onOpenLayersModal) onOpenLayersModal();
      },
    },
    {
      id: 'reports',
      label: 'Verified Reports',
      icon: FileText,
      onClick: () => {
        onRouteChange('reports');
        if (onOpenReportsDrawer) onOpenReportsDrawer();
      },
    },
    {
      id: 'assistant',
      label: 'AI Climate Assistant',
      icon: Bot,
      badge: 'Llama 3.3',
      onClick: () => {
        onRouteChange('assistant');
        if (onOpenAIDrawer) onOpenAIDrawer();
      },
    },
  ];

  const bottomItems: NavItem[] = [
    {
      id: 'methodology',
      label: 'Scientific Methods',
      icon: Info,
      onClick: () => {
        onRouteChange('methodology');
        if (onOpenMethodology) onOpenMethodology();
      },
    },
    {
      id: 'system',
      label: 'System & Backend',
      icon: Server,
      onClick: () => {
        onRouteChange('system');
        if (onOpenSystem) onOpenSystem();
      },
    },
  ];

  const renderNavButton = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activeRoute === item.id;

    return (
      <div key={item.id} className="relative group w-full">
        <button
          type="button"
          onClick={item.onClick}
          onMouseEnter={() => setHoveredItem(item.id)}
          onMouseLeave={() => setHoveredItem(null)}
          aria-label={item.label}
          aria-current={isActive ? 'page' : undefined}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-teal-500/50 ${isActive
              ? 'bg-teal-50 text-teal-900 font-semibold shadow-xs border-l-3 border-teal-600'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <div className="shrink-0 flex items-center justify-center">
            <Icon
              className={`w-5 h-5 transition-colors ${isActive ? 'text-teal-700' : 'text-slate-500 group-hover:text-slate-700'
                }`}
            />
          </div>

          {isExpanded && (
            <div className="flex-1 flex items-center justify-between overflow-hidden text-left truncate">
              <span className="truncate">{item.label}</span>
              {item.badge && (
                <span className="shrink-0 ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-semibold">
                  {item.badge}
                </span>
              )}
            </div>
          )}
        </button>

        {/* Collapsed Tooltip (shows on hover/focus when rail is narrow) */}
        {!isExpanded && hoveredItem === item.id && (
          <div
            role="tooltip"
            className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-[10000] px-2.5 py-1.5 rounded-md bg-slate-900 text-white text-[11px] font-medium whitespace-nowrap shadow-md pointer-events-none transition-opacity duration-150"
          >
            <span>{item.label}</span>
            {item.badge && (
              <span className="ml-1.5 text-[9px] font-mono px-1 py-0.2 rounded bg-teal-600 text-white">
                {item.badge}
              </span>
            )}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          role="presentation"
          onClick={onMobileClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9998] lg:hidden"
        />
      )}

      {/* Primary Navigation Rail Container */}
      <aside
        aria-label="Application navigation"
        className={`fixed top-0 bottom-0 left-0 z-[9999] bg-white border-r border-slate-200 shadow-xl flex flex-col justify-between transition-all duration-200 select-none ${isMobileOpen ? 'translate-x-0 w-64' : 'max-lg:-translate-x-full'
          } ${isExpanded ? 'lg:w-60' : 'lg:w-16'}`}
      >
        {/* Top Header & Brand Bar */}
        <div className="p-3 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onToggleExpand}
              className="flex items-center gap-2.5 text-left focus:outline-none focus:ring-2 focus:ring-teal-500 rounded p-1 hover:bg-slate-50 transition"
              title={isExpanded ? 'Collapse navigation rail' : 'Expand navigation rail'}
            >
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                D
              </div>
              {isExpanded && (
                <div className="overflow-hidden">
                  <div className="font-bold text-xs tracking-tight text-slate-900 truncate">
                    Dygnify
                  </div>
                  <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                    <span>Climate GIS</span>
                    <span className="inline-block w-1 h-1 rounded-full bg-emerald-500" />
                  </div>
                </div>
              )}
            </button>

            {/* Toggle Rail Button (Desktop) */}
            <button
              type="button"
              onClick={onToggleExpand}
              className="hidden lg:flex p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              aria-label={isExpanded ? 'Collapse rail' : 'Expand rail'}
              title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isExpanded ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {/* Close Button (Mobile) */}
            <button
              type="button"
              onClick={onMobileClose}
              className="lg:hidden p-1.5 rounded-md hover:bg-slate-100 text-slate-400"
              aria-label="Close mobile navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Middle: Main Functional Routes */}
        <div className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {mainItems.map(renderNavButton)}
        </div>

        {/* Bottom Section: Scientific Standards & System Info */}
        <div className="p-2 border-t border-slate-100 space-y-1">
          {bottomItems.map(renderNavButton)}

          {/* Quick Provenance Chip in Expanded View */}
          {isExpanded && (
            <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[10px] text-slate-500 leading-tight">
              <div className="flex items-center gap-1 font-semibold text-slate-700 mb-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                ECMWF ERA5
              </div>
              0.1° (~11 km) deterministic reanalysis
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
