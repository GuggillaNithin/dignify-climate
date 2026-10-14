import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Rectangle,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Plus,
  Minus,
  Crosshair,
  RotateCcw,
  Layers,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import type {
  PointCoordinate,
  BoundingBox,
  SampledGridPoint,
  RegionalAnnualMetric,
} from '../types/api';
import {
  SUPPORTED_OBSERVATORIES,
  getHazardMarkerColor,
  getHazardLegendConfig,
  type SupportedObservatory,
} from '../utils/globeTextures';
import type { HazardType } from './DashboardShell';

export type BasemapType = 'positron' | 'satellite' | 'street';

export interface ClimateMapCanvasProps {
  selectedPoint: PointCoordinate;
  onPointSelect: (pt: PointCoordinate) => void;
  onLocationSelect?: (loc: { name: string; point: PointCoordinate }) => void;
  mode: 'point' | 'bounding_box';
  selectedBounds?: BoundingBox | null;
  onBoundsChange?: (bounds: BoundingBox) => void;
  sampledPoints?: SampledGridPoint[];
  annualSeries?: RegionalAnnualMetric[];
  selectedYear?: number | null;
  onYearSelect?: (year: number) => void;
  hazardType?: HazardType;
  percentileThreshold?: number;
  startYear?: number;
  endYear?: number;
  basemap: BasemapType;
  onBasemapChange: (basemap: BasemapType) => void;
  locationName?: string;
  showHazardOverlay?: boolean;
  onToggleHazardOverlay?: () => void;
}

// Custom Leaflet Point Marker SVG Icon
const createLightPointMarkerIcon = (label?: string) =>
  L.divIcon({
    className: 'custom-point-marker',
    html: `
      <div style="position: relative; width: 36px; height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; pointer-events: auto;">
        <!-- Pulsing radar ground wave -->
        <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 28px; height: 14px; background: rgba(15, 118, 110, 0.4); border-radius: 9999px; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; pointer-events: none;"></div>
        
        <!-- Google Maps-style Pin Icon -->
        <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35)); position: relative; z-index: 2;">
          <path d="M16 0C7.16344 0 0 7.16344 0 16C0 26.5 14.5 38.8 15.36 39.52C15.73 39.83 16.27 39.83 16.64 39.52C17.5 38.8 32 26.5 32 16C32 7.16344 24.8366 0 16 0Z" fill="#0f766e" stroke="#ffffff" stroke-width="2"/>
          <circle cx="16" cy="15" r="5.5" fill="#ffffff"/>
          <circle cx="16" cy="15" r="2.5" fill="#0f766e"/>
        </svg>

        <!-- Location Name Label Pill -->
        ${
          label
            ? `<div style="position: absolute; bottom: 44px; left: 50%; transform: translateX(-50%); white-space: nowrap; background: #0f172a; color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.25); pointer-events: none; z-index: 3;">${label}</div>`
            : ''
        }
      </div>
    `,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
  });

// Programmatic map movement controller
function MapController({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

// Map Click Handler for selecting coordinates
function MapInteractionListener({
  mode,
  onPointSelect,
  bounds,
  onBoundsChange,
}: {
  mode: 'point' | 'bounding_box';
  onPointSelect: (pt: PointCoordinate) => void;
  bounds?: BoundingBox | null;
  onBoundsChange?: (bounds: BoundingBox) => void;
}) {
  useMapEvents({
    click(e) {
      const lat = Math.round(e.latlng.lat * 10000) / 10000;
      const lon = Math.round(e.latlng.lng * 10000) / 10000;

      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        if (mode === 'point') {
          onPointSelect({ latitude: lat, longitude: lon });
        } else if (bounds && onBoundsChange) {
          const latSpan = Math.max(0.2, bounds.north - bounds.south);
          const lonSpan = Math.max(0.2, bounds.east - bounds.west);
          const halfLat = latSpan / 2.0;
          const halfLon = lonSpan / 2.0;
          onBoundsChange({
            south: Math.max(-90, Math.round((lat - halfLat) * 100) / 100),
            north: Math.min(90, Math.round((lat + halfLat) * 100) / 100),
            west: Math.max(-180, Math.round((lon - halfLon) * 100) / 100),
            east: Math.min(180, Math.round((lon + halfLon) * 100) / 100),
          });
        }
      }
    },
  });
  return null;
}

// Custom Floating Zoom and Recenter Controls (Google Maps Style)
function MapActionControls({
  onZoomIn,
  onZoomOut,
  onRecenter,
  onReset,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  onReset: () => void;
}) {
  return (
    <div className="absolute right-4 bottom-8 z-[1000] flex flex-col gap-2">
      {/* Recenter & Reset */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden flex flex-col">
        <button
          type="button"
          onClick={onRecenter}
          className="p-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition flex items-center justify-center border-b border-slate-100"
          title="Recenter on selected location"
          aria-label="Recenter on selected location"
        >
          <Crosshair className="w-4 h-4 text-teal-700" />
        </button>
        <button
          type="button"
          onClick={onReset}
          className="p-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition flex items-center justify-center"
          title="Reset to global view"
          aria-label="Reset to global view"
        >
          <RotateCcw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Zoom In & Out */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden flex flex-col">
        <button
          type="button"
          onClick={onZoomIn}
          className="p-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition flex items-center justify-center border-b border-slate-100"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="p-2 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition flex items-center justify-center"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Floating Basemap & Hazard Overlay Switcher
function BasemapToggle({
  basemap,
  onChange,
  overlayVisible,
  onToggleOverlay,
}: {
  basemap: BasemapType;
  onChange: (b: BasemapType) => void;
  overlayVisible: boolean;
  onToggleOverlay: () => void;
}) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="absolute right-4 bottom-44 z-[1000] flex flex-col items-end gap-2">
      {/* Quick Hazard Layer Toggle Button */}
      <button
        type="button"
        onClick={onToggleOverlay}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-md text-xs font-medium border transition ${
          overlayVisible
            ? 'bg-teal-700 text-white border-teal-800 shadow-teal-900/20'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
        }`}
        title={overlayVisible ? 'Hide hazard geographic overlay' : 'Show hazard geographic overlay'}
      >
        {overlayVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        <span>Hazard Overlay</span>
      </button>

      {showOptions && (
        <div className="p-1.5 bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 transition">
          <button
            type="button"
            onClick={() => {
              onChange('street');
              setShowOptions(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              basemap === 'street'
                ? 'bg-teal-50 text-teal-900 font-semibold border border-teal-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Default Map
          </button>
          <button
            type="button"
            onClick={() => {
              onChange('satellite');
              setShowOptions(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              basemap === 'satellite'
                ? 'bg-teal-50 text-teal-900 font-semibold border border-teal-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => {
              onChange('positron');
              setShowOptions(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              basemap === 'positron'
                ? 'bg-teal-50 text-teal-900 font-semibold border border-teal-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Light Canvas
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowOptions(!showOptions)}
        className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-md text-xs font-medium text-slate-800 transition focus:outline-none focus:ring-2 focus:ring-teal-500"
        title="Change basemap style"
      >
        <Layers className="w-4 h-4 text-teal-700" />
        <span className="capitalize">
          {basemap === 'street' ? 'Default Map' : basemap === 'positron' ? 'Light Canvas' : 'Satellite'}
        </span>
      </button>
    </div>
  );
}

export const ClimateMapCanvas: React.FC<ClimateMapCanvasProps> = ({
  selectedPoint,
  onPointSelect,
  onLocationSelect,
  mode,
  selectedBounds,
  onBoundsChange,
  sampledPoints = [],
  annualSeries = [],
  selectedYear = null,
  onYearSelect: _onYearSelect,
  hazardType = 'heatwave',
  percentileThreshold: _percentileThreshold = 95,
  startYear: _startYear,
  endYear: _endYear,
  basemap,
  onBasemapChange,
  locationName,
  showHazardOverlay = true,
  onToggleHazardOverlay,
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    selectedPoint.latitude,
    selectedPoint.longitude,
  ]);
  const [mapZoom, setMapZoom] = useState<number>(8);
  const [internalOverlayVisible, setInternalOverlayVisible] = useState<boolean>(showHazardOverlay);
  const [legendOpen, setLegendOpen] = useState<boolean>(true);

  const overlayVisible = onToggleHazardOverlay ? showHazardOverlay : internalOverlayVisible;
  const toggleOverlay = onToggleHazardOverlay || (() => setInternalOverlayVisible((v) => !v));

  // Sync center when selectedPoint updates
  useEffect(() => {
    setMapCenter([selectedPoint.latitude, selectedPoint.longitude]);
  }, [selectedPoint.latitude, selectedPoint.longitude]);

  const handleZoomIn = () => setMapZoom((z) => Math.min(18, z + 1));
  const handleZoomOut = () => setMapZoom((z) => Math.max(2, z - 1));
  const handleRecenter = () => {
    setMapCenter([selectedPoint.latitude, selectedPoint.longitude]);
    setMapZoom(8);
  };
  const handleReset = () => {
    setMapCenter([20, 0]);
    setMapZoom(3);
  };

  const legendConfig = getHazardLegendConfig(hazardType);

  // Helper to extract baseline observatory metric value
  const getObservatoryMetric = (obs: SupportedObservatory) => {
    if (hazardType === 'heatwave') {
      return { value: obs.baselineHeatwaveDays, formatted: `${obs.baselineHeatwaveDays.toFixed(1)} days/yr` };
    }
    if (hazardType === 'drought') {
      return { value: obs.baselineDroughtDeficitDays, formatted: `${obs.baselineDroughtDeficitDays.toFixed(1)} deficit days/yr` };
    }
    return { value: obs.baselineHeavyRainDays, formatted: `${obs.baselineHeavyRainDays.toFixed(1)} extreme days/yr` };
  };

  // Find active year metric series for sampled grid cells
  const currentYearSeries = annualSeries?.find((s) => s.year === selectedYear);

  return (
    <div className="relative w-full h-full select-none overflow-hidden z-0" style={{ isolation: 'isolate' }}>
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        scrollWheelZoom={true}
      >
        <MapController center={mapCenter} zoom={mapZoom} />
        <MapInteractionListener
          mode={mode}
          onPointSelect={onPointSelect}
          bounds={selectedBounds}
          onBoundsChange={onBoundsChange}
        />

        {/* 1. OpenStreetMap Standard Basemap (100% Keyless, rich detail) */}
        {basemap === 'street' && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        )}

        {/* 2. Esri World Imagery (Satellite) */}
        {basemap === 'satellite' && (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={18}
          />
        )}

        {/* 3. Esri World Light Gray Canvas: Clean Minimal GIS Basemap (100% Keyless, no Carto watermark) */}
        {basemap === 'positron' && (
          <>
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
          </>
        )}

        {/* 4. Global Scientific Climate Observatories Overlay (Synchronized with 3D Globe) */}
        {overlayVisible &&
          SUPPORTED_OBSERVATORIES.map((obs) => {
            const metric = getObservatoryMetric(obs);
            const color = getHazardMarkerColor(hazardType, metric.value);
            const isSelectedStation =
              Math.abs(selectedPoint.latitude - obs.latitude) < 0.08 &&
              Math.abs(selectedPoint.longitude - obs.longitude) < 0.08;

            return (
              <React.Fragment key={`obs-${obs.name}`}>
                {/* Outer halo ring */}
                <CircleMarker
                  center={[obs.latitude, obs.longitude]}
                  radius={isSelectedStation ? 16 : 10}
                  pathOptions={{
                    color: isSelectedStation ? '#f59e0b' : color,
                    fillColor: isSelectedStation ? '#f59e0b' : color,
                    fillOpacity: isSelectedStation ? 0.45 : 0.22,
                    weight: isSelectedStation ? 2 : 1,
                  }}
                />

                {/* Core dot */}
                <CircleMarker
                  center={[obs.latitude, obs.longitude]}
                  radius={isSelectedStation ? 6.5 : 5}
                  pathOptions={{
                    color: '#ffffff',
                    fillColor: color,
                    fillOpacity: 1,
                    weight: 2,
                  }}
                  eventHandlers={{
                    click: () => {
                      if (onLocationSelect) {
                        onLocationSelect({
                          name: `${obs.name}, ${obs.country}`,
                          point: { latitude: obs.latitude, longitude: obs.longitude },
                        });
                      } else {
                        onPointSelect({ latitude: obs.latitude, longitude: obs.longitude });
                      }
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -8]} opacity={0.98} sticky>
                    <div className="p-1 font-sans text-xs">
                      <div className="font-bold text-slate-900 flex items-center justify-between gap-2">
                        <span>
                          {obs.name}, {obs.country}
                        </span>
                        <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                          Observatory
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {obs.climateZone} • {obs.description}
                      </div>
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-medium text-slate-600 capitalize">
                          {hazardType.replace('_', ' ')}:
                        </span>
                        <span className="text-xs font-mono font-bold" style={{ color }}>
                          {metric.formatted}
                        </span>
                      </div>
                      <div className="text-[10px] text-teal-700 mt-1 font-medium">
                        Click station to load as analysis site
                      </div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              </React.Fragment>
            );
          })}

        {/* 5. ERA5 Deterministic 0.25° Grid Cells Hazard Overlay (Multi-Cell Regional Sampling) */}
        {overlayVisible &&
          sampledPoints &&
          sampledPoints.length > 0 &&
          sampledPoints.map((sp) => {
            // Exact ERA5 0.25° x 0.25° spatial grid cell bounds
            const bounds: [[number, number], [number, number]] = [
              [sp.latitude - 0.125, sp.longitude - 0.125],
              [sp.latitude + 0.125, sp.longitude + 0.125],
            ];

            const contribution = currentYearSeries?.point_contributions?.find(
              (pc) => pc.grid_key === sp.grid_key
            );
            const hasData = contribution && contribution.is_valid && contribution.hazard_days !== null;
            const isInvalid = contribution && !contribution.is_valid;
            const val = contribution?.hazard_days ?? contribution?.primary_metric;

            const cellColor =
              hasData && val !== null && val !== undefined
                ? getHazardMarkerColor(hazardType, val)
                : isInvalid
                ? '#64748b'
                : '#0891b2';

            return (
              <Rectangle
                key={`grid-cell-${sp.grid_key}`}
                bounds={bounds}
                pathOptions={{
                  color: cellColor,
                  fillColor: cellColor,
                  fillOpacity: hasData ? 0.45 : isInvalid ? 0.15 : 0.2,
                  weight: isInvalid ? 1 : 1.5,
                  dashArray: isInvalid ? '4, 4' : undefined,
                }}
                eventHandlers={{
                  click: () => {
                    onPointSelect({ latitude: sp.latitude, longitude: sp.longitude });
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={0.98} sticky>
                  <div className="p-1 font-sans text-xs">
                    <div className="font-bold text-slate-900 flex items-center justify-between gap-2">
                      <span>ERA5 Cell {sp.grid_key}</span>
                      <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-teal-50 text-teal-800 font-semibold border border-teal-200">
                        0.25° Grid
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {sp.latitude.toFixed(2)}°N, {sp.longitude.toFixed(2)}°E • Area Weight: {(sp.normalized_weight * 100).toFixed(1)}%
                    </div>
                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-medium text-slate-600">
                        {selectedYear ? `Year ${selectedYear} Metric:` : 'Annual Hazard Value:'}
                      </span>
                      {hasData && val !== null && val !== undefined ? (
                        <span className="text-xs font-mono font-bold" style={{ color: cellColor }}>
                          {val.toFixed(1)} {legendConfig.units}
                        </span>
                      ) : isInvalid ? (
                        <span className="text-[11px] text-rose-600 font-semibold">
                          Missing / Excluded by Filter
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Run analysis to calculate
                        </span>
                      )}
                    </div>
                    {contribution?.event_count !== undefined && contribution.event_count !== null && (
                      <div className="text-[10px] text-slate-500">
                        Consecutive Events: {contribution.event_count}
                      </div>
                    )}
                    <div className="text-[10px] text-teal-700 mt-0.5 font-medium">Click to select cell</div>
                  </div>
                </Tooltip>
              </Rectangle>
            );
          })}

        {/* 6. Single Point Analysis Target Marker */}
        {mode === 'point' && (
          <Marker
            position={[selectedPoint.latitude, selectedPoint.longitude]}
            icon={createLightPointMarkerIcon(locationName)}
          />
        )}

        {/* 7. Bounding Box Mode Outline */}
        {mode === 'bounding_box' && selectedBounds && (
          <Rectangle
            bounds={[
              [selectedBounds.south, selectedBounds.west],
              [selectedBounds.north, selectedBounds.east],
            ]}
            pathOptions={{
              color: '#0891b2',
              weight: 2,
              dashArray: '5, 5',
              fillColor: '#0891b2',
              fillOpacity: 0.05,
            }}
          />
        )}
      </MapContainer>

      {/* 8. Synchronized 2D Map Hazard Legend (Top-Right, matching 3D globe layout & contract) */}
      {overlayVisible && (
        <div className="absolute top-16 sm:top-18 right-3 sm:right-4 z-[1000] bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg text-xs font-sans transition-all max-w-[240px] overflow-hidden">
          <div
            onClick={() => setLegendOpen(!legendOpen)}
            className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
              <Info className="w-3.5 h-3.5 text-teal-700" />
              <span>{legendConfig.title} Scale</span>
              {selectedYear && (
                <span className="text-[10px] font-mono font-normal text-teal-700 bg-teal-50 px-1 py-0.2 rounded border border-teal-200">
                  {selectedYear}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400">{legendOpen ? '▲' : '▼'}</span>
          </div>

          {legendOpen && (
            <div className="p-3 space-y-2.5">
              <div className="text-[11px] text-slate-500 leading-tight">
                {legendConfig.metricName} <span className="font-semibold text-slate-700">({legendConfig.units})</span>
              </div>

              {/* Swatch items */}
              <div className="space-y-1.5 pt-0.5">
                {legendConfig.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shadow-xs shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-slate-700 truncate">{item.label}</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[10px] shrink-0">{item.rangeText}</span>
                  </div>
                ))}

                {/* No-data representation */}
                <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 border border-dashed border-slate-500 shrink-0" />
                    <span className="text-slate-500 truncate">No observation</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[10px]">Excluded</span>
                </div>

                {/* Active study site indicator */}
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-700 border border-white shadow-xs shrink-0" />
                    <span className="text-teal-800 font-semibold truncate">Study Location</span>
                  </div>
                  <span className="text-teal-700 font-mono text-[10px]">Target</span>
                </div>
              </div>

              {/* Spatial Resolution Context */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>ECMWF ERA5</span>
                <span>0.25° (~25 km)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Action Controls */}
      <MapActionControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRecenter={handleRecenter}
        onReset={handleReset}
      />

      {/* Floating Basemap & Hazard Overlay Switcher */}
      <BasemapToggle
        basemap={basemap}
        onChange={onBasemapChange}
        overlayVisible={overlayVisible}
        onToggleOverlay={toggleOverlay}
      />
    </div>
  );
};

