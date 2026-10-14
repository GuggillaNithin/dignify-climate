import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Rectangle,
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
} from 'lucide-react';
import type {
  PointCoordinate,
  BoundingBox,
  SampledGridPoint,
} from '../types/api';

export type BasemapType = 'positron' | 'satellite' | 'street';

interface ClimateMapCanvasProps {
  selectedPoint: PointCoordinate;
  onPointSelect: (pt: PointCoordinate) => void;
  mode: 'point' | 'bounding_box';
  selectedBounds?: BoundingBox | null;
  onBoundsChange?: (bounds: BoundingBox) => void;
  sampledPoints?: SampledGridPoint[];
  basemap: BasemapType;
  onBasemapChange: (basemap: BasemapType) => void;
  locationName?: string;
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

// Grid Sample Cell Icon for multi-cell regional sampling
const createGridSampleIcon = (weight: number, key: string) =>
  L.divIcon({
    className: 'grid-sample-marker',
    html: `
      <div title="ERA5 Cell ${key} (Weight: ${(weight * 100).toFixed(1)}%)" 
           style="width: 12px; height: 12px; background: #0f766e; border: 2px solid #ffffff; border-radius: 9999px; box-shadow: 0 2px 5px rgba(0,0,0,0.35);">
      </div>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
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

// Floating Basemap Switcher Pill (Google Maps bottom-right Layers button)
function BasemapToggle({
  basemap,
  onChange,
}: {
  basemap: BasemapType;
  onChange: (b: BasemapType) => void;
}) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="absolute right-4 bottom-44 z-[1000] flex flex-col items-end">
      {showOptions && (
        <div className="mb-2 p-1.5 bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 transition">
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
  mode,
  selectedBounds,
  onBoundsChange,
  sampledPoints = [],
  basemap,
  onBasemapChange,
  locationName,
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    selectedPoint.latitude,
    selectedPoint.longitude,
  ]);
  const [mapZoom, setMapZoom] = useState<number>(8);

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

        {/* Single Point Analysis Marker */}
        {mode === 'point' && (
          <Marker
            position={[selectedPoint.latitude, selectedPoint.longitude]}
            icon={createLightPointMarkerIcon(locationName)}
          />
        )}

        {/* Bounding Box Mode: Rectangle & Sampled Points */}
        {mode === 'bounding_box' && selectedBounds && (
          <>
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
                fillOpacity: 0.1,
              }}
            />

            {sampledPoints.map((sp) => (
              <Marker
                key={sp.grid_key}
                position={[sp.latitude, sp.longitude]}
                icon={createGridSampleIcon(sp.normalized_weight, sp.grid_key)}
              />
            ))}
          </>
        )}
      </MapContainer>

      {/* Floating Action Controls */}
      <MapActionControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRecenter={handleRecenter}
        onReset={handleReset}
      />

      {/* Floating Basemap Switcher */}
      <BasemapToggle basemap={basemap} onChange={onBasemapChange} />
    </div>
  );
};
