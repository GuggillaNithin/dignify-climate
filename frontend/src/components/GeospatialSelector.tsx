import React, { useState, useEffect, useRef } from 'react';
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
  Search,
  MapPin,
  Maximize2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Navigation,
  Layers,
} from 'lucide-react';
import type {
  PointCoordinate,
  BoundingBox,
  GeocodingResult,
  SampledGridPoint,
} from '../types/api';
import { searchPlaces } from '../api/client';

interface GeospatialSelectorProps {
  mode: 'point' | 'bounding_box';
  onModeChange: (mode: 'point' | 'bounding_box') => void;
  point: PointCoordinate;
  onPointChange: (point: PointCoordinate) => void;
  bounds: BoundingBox;
  onBoundsChange: (bounds: BoundingBox) => void;
  sampleDensity: number;
  onSampleDensityChange: (density: number) => void;
  sampledPoints?: SampledGridPoint[];
  disabled?: boolean;
}

// Preset regions for rapid verification & testing
const PRESET_LOCATIONS = [
  { name: 'Tokyo, Japan', lat: 35.6895, lon: 139.6917, span: 0.5 },
  { name: 'London, UK', lat: 51.5074, lon: -0.1278, span: 0.5 },
  { name: 'Phoenix, US (Arid)', lat: 33.4484, lon: -112.0740, span: 0.8 },
  { name: 'Rome, Italy (Med)', lat: 41.9028, lon: 12.4964, span: 0.6 },
  { name: 'Nairobi, Kenya', lat: -1.2921, lon: 36.8219, span: 0.6 },
  { name: 'Fiji (Antimeridian)', lat: -17.7134, lon: 178.0650, span: 1.0 },
];

// Leaflet custom marker icons using SVG/CSS
const createPointMarkerIcon = () =>
  L.divIcon({
    className: 'custom-point-marker',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;">
        <div style="position: absolute; width: 28px; height: 28px; background: rgba(56, 189, 248, 0.4); border-radius: 9999px; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: 14px; height: 14px; background: #38bdf8; border: 2px solid #ffffff; border-radius: 9999px; box-shadow: 0 0 12px #38bdf8;"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const createGridSampleIcon = (weight: number) =>
  L.divIcon({
    className: 'grid-sample-marker',
    html: `
      <div title="Sampled cell (area weight: ${(weight * 100).toFixed(1)}%)" style="width: 10px; height: 10px; background: #fbbf24; border: 1.5px solid #0f172a; border-radius: 9999px; box-shadow: 0 0 6px #fbbf24;"></div>
    `,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });

// Map Controller component to handle programmatic pans
function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

// Map Click Handler for Point selection
function MapClickHandler({
  mode,
  onPointSelect,
  onBoundsCenter,
}: {
  mode: 'point' | 'bounding_box';
  onPointSelect: (pt: PointCoordinate) => void;
  onBoundsCenter: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      const lat = Math.round(e.latlng.lat * 10000) / 10000;
      const lon = Math.round(e.latlng.lng * 10000) / 10000;

      // Bound check
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        if (mode === 'point') {
          onPointSelect({ latitude: lat, longitude: lon });
        } else {
          // In bounding box mode, clicking repositions box center
          onBoundsCenter(lat, lon);
        }
      }
    },
  });
  return null;
}

export const GeospatialSelector: React.FC<GeospatialSelectorProps> = ({
  mode,
  onModeChange,
  point,
  onPointChange,
  bounds,
  onBoundsChange,
  sampleDensity,
  onSampleDensityChange,
  sampledPoints = [],
  disabled = false,
}) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [attributionText, setAttributionText] = useState('Open-Meteo Geocoding');
  const [basemapLayer, setBasemapLayer] = useState<'dark' | 'satellite' | 'street'>('dark');
  const searchTimeoutRef = useRef<number | null>(null);

  // Map center state
  const [mapCenter, setMapCenter] = useState<[number, number]>([point.latitude, point.longitude]);
  const [mapZoom, setMapZoom] = useState<number>(7);

  // Manual inputs validation
  const [validationError, setValidationError] = useState<string | null>(null);

  // Debounced geocoding search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(async () => {
      setIsSearching(true);
      const res = await searchPlaces(searchQuery.trim(), 6);
      setIsSearching(false);
      if (res.data) {
        setSearchResults(res.data.results);
        setAttributionText(res.data.attribution);
        setShowDropdown(true);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Handle place selection
  const handleSelectPlace = (place: GeocodingResult) => {
    setSearchQuery(`${place.name}, ${place.country}`);
    setShowDropdown(false);

    if (mode === 'point') {
      onPointChange({ latitude: place.latitude, longitude: place.longitude });
    } else {
      // Create a default ~0.5° box around place
      const halfSpan = 0.35;
      onBoundsChange({
        south: Math.max(-90, Math.round((place.latitude - halfSpan) * 100) / 100),
        north: Math.min(90, Math.round((place.latitude + halfSpan) * 100) / 100),
        west: Math.max(-180, Math.round((place.longitude - halfSpan) * 100) / 100),
        east: Math.min(180, Math.round((place.longitude + halfSpan) * 100) / 100),
      });
    }

    setMapCenter([place.latitude, place.longitude]);
    setMapZoom(8);
  };

  // Handle Preset selection
  const handleSelectPreset = (preset: typeof PRESET_LOCATIONS[0]) => {
    if (mode === 'point') {
      onPointChange({ latitude: preset.lat, longitude: preset.lon });
    } else {
      const half = preset.span / 2.0;
      onBoundsChange({
        south: Math.max(-90, Math.round((preset.lat - half) * 100) / 100),
        north: Math.min(90, Math.round((preset.lat + half) * 100) / 100),
        west: Math.round((preset.lon - half) * 100) / 100,
        east: Math.round((preset.lon + half) * 100) / 100,
      });
    }
    setMapCenter([preset.lat, preset.lon]);
    setMapZoom(7);
  };

  // Center bounding box on map click
  const handleBoundsCenter = (lat: number, lon: number) => {
    const latSpan = Math.max(0.2, bounds.north - bounds.south);
    const lonSpan = Math.max(0.2, bounds.east - bounds.west);
    const halfLat = latSpan / 2.0;
    const halfLon = lonSpan / 2.0;

    const newBounds: BoundingBox = {
      south: Math.max(-90, Math.round((lat - halfLat) * 100) / 100),
      north: Math.min(90, Math.round((lat + halfLat) * 100) / 100),
      west: Math.max(-180, Math.round((lon - halfLon) * 100) / 100),
      east: Math.min(180, Math.round((lon + halfLon) * 100) / 100),
    };
    onBoundsChange(newBounds);
    setMapCenter([lat, lon]);
  };

  // Validate manual inputs
  const validateCoordinateInputs = () => {
    if (mode === 'point') {
      if (point.latitude < -90 || point.latitude > 90) {
        return 'Latitude must be between -90.0° and 90.0°.';
      }
      if (point.longitude < -180 || point.longitude > 180) {
        return 'Longitude must be between -180.0° and 180.0°.';
      }
    } else {
      if (bounds.south >= bounds.north) {
        return 'South latitude must be strictly less than North latitude.';
      }
      const latSpan = bounds.north - bounds.south;
      if (latSpan > 10.0) {
        return `Latitude span (${latSpan.toFixed(2)}°) exceeds the 10.0° maximum limit.`;
      }
      const lonSpan = bounds.west > bounds.east
        ? (180 - bounds.west + bounds.east - (-180))
        : (bounds.east - bounds.west);
      if (lonSpan > 15.0) {
        return `Longitude span (${lonSpan.toFixed(2)}°) exceeds the 15.0° maximum limit.`;
      }
    }
    return null;
  };

  useEffect(() => {
    setValidationError(validateCoordinateInputs());
  }, [point, bounds, mode]);

  // Derived representation text
  const representationText =
    mode === 'point'
      ? `Single coordinate represents the nearest ~11 km ERA5 grid cell (${point.latitude.toFixed(2)}°, ${point.longitude.toFixed(2)}°). Not an interpolated municipal average.`
      : `Regional domain bounded by [S: ${bounds.south.toFixed(2)}°, N: ${bounds.north.toFixed(2)}°, W: ${bounds.west.toFixed(2)}°, E: ${bounds.east.toFixed(2)}°] sampled across ${sampleDensity} grid points with cosine-latitude spherical area weighting. Years with <75% coverage will be gated as unavailable.`;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-cyan-400" />
            Geospatial Target & Regional Sampling
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select an exact ERA5 grid cell or sample a regional bounding box with cosine area weighting.
          </p>
        </div>

        {/* Mode Toggle Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onModeChange('point')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              mode === 'point'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Single Point (~11km)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onModeChange('bounding_box')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              mode === 'bounding_box'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Bounding Box (Regional Grid)
          </button>
        </div>
      </div>

      {/* Geocoding Location Search */}
      <div className="relative mb-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search place name (e.g. Tokyo, London, Nairobi, Phoenix)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-cyan-400 animate-pulse">
                Searching...
              </span>
            )}
          </div>
        </div>

        {/* Dropdown Results */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
            {searchResults.map((res) => (
              <button
                key={res.id}
                type="button"
                onClick={() => handleSelectPlace(res)}
                className="w-full text-left px-3.5 py-2 text-xs hover:bg-slate-800/80 border-b border-slate-800/60 last:border-b-0 transition-colors flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-slate-200">{res.name}</span>
                  <span className="text-slate-400 ml-1.5">
                    {res.admin1 ? `${res.admin1}, ` : ''}
                    {res.country}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-cyan-400">
                  {res.latitude.toFixed(2)}°, {res.longitude.toFixed(2)}°
                </span>
              </button>
            ))}
            <div className="px-3 py-1.5 bg-slate-950/90 text-[10px] text-slate-500 text-right">
              {attributionText}
            </div>
          </div>
        )}
      </div>

      {/* Preset Quick Selectors */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4 text-xs">
        <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
          <Layers className="w-3 h-3 text-cyan-400" /> Presets:
        </span>
        {PRESET_LOCATIONS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => handleSelectPreset(preset)}
            className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700/80 text-[11px] text-slate-300 border border-slate-700/60 transition-colors"
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Main Grid: Interactive Map & Coordinate Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Leaflet Map (2 Cols) */}
        <div className="lg:col-span-2 relative h-72 md:h-80 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
          {/* Basemap Layer Switcher Pill */}
          <div className="absolute top-2 right-2 z-[1000] flex items-center bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg p-0.5 text-[10px] font-mono shadow-xl">
            <button
              type="button"
              onClick={() => setBasemapLayer('dark')}
              className={`px-2 py-0.5 rounded transition ${
                basemapLayer === 'dark'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => setBasemapLayer('satellite')}
              className={`px-2 py-0.5 rounded transition ${
                basemapLayer === 'satellite'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Satellite
            </button>
            <button
              type="button"
              onClick={() => setBasemapLayer('street')}
              className={`px-2 py-0.5 rounded transition ${
                basemapLayer === 'street'
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Street
            </button>
          </div>

          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={true}
          >
            <MapViewController center={mapCenter} zoom={mapZoom} />
            <MapClickHandler
              mode={mode}
              onPointSelect={(p) => onPointChange(p)}
              onBoundsCenter={handleBoundsCenter}
            />

            {/* High-Quality Keyless Basemaps (No Carto API key watermark) */}
            {basemapLayer === 'dark' && (
              <>
                <TileLayer
                  attribution='&copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={16}
                />
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={16}
                />
              </>
            )}

            {basemapLayer === 'satellite' && (
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={18}
              />
            )}

            {basemapLayer === 'street' && (
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
            )}

            {/* Point Mode Marker */}
            {mode === 'point' && (
              <Marker
                position={[point.latitude, point.longitude]}
                icon={createPointMarkerIcon()}
              />
            )}

            {/* Bounding Box Mode Rectangle Overlay */}
            {mode === 'bounding_box' && (
              <>
                <Rectangle
                  bounds={[
                    [bounds.south, bounds.west],
                    [bounds.north, bounds.east],
                  ]}
                  pathOptions={{
                    color: '#fbbf24',
                    weight: 2,
                    dashArray: '4, 4',
                    fillColor: '#fbbf24',
                    fillOpacity: 0.12,
                  }}
                />

                {/* Sampled Grid Points Indicators */}
                {sampledPoints.map((sp) => (
                  <Marker
                    key={sp.grid_key}
                    position={[sp.latitude, sp.longitude]}
                    icon={createGridSampleIcon(sp.normalized_weight)}
                  />
                ))}
              </>
            )}
          </MapContainer>

          {/* Map Overlay Badge */}
          <div className="absolute top-2 right-2 z-[400] bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-md text-[11px] text-slate-300 font-mono shadow">
            {mode === 'point' ? (
              <span>Point: {point.latitude.toFixed(2)}°, {point.longitude.toFixed(2)}°</span>
            ) : (
              <span>
                Box: {bounds.south.toFixed(2)}° to {bounds.north.toFixed(2)}° N ({sampleDensity} cells)
              </span>
            )}
          </div>
        </div>

        {/* Accessible Coordinate Inputs & Controls (1 Col) */}
        <div className="flex flex-col justify-between bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
              {mode === 'point' ? 'Coordinate Values' : 'Bounding Box Boundaries'}
            </h3>

            {mode === 'point' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Latitude (-90.0° to 90.0°)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="-90"
                    max="90"
                    value={point.latitude}
                    onChange={(e) =>
                      onPointChange({
                        ...point,
                        latitude: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Longitude (-180.0° to 180.0°)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="-180"
                    max="180"
                    value={point.longitude}
                    onChange={(e) =>
                      onPointChange({
                        ...point,
                        longitude: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">North (Lat)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={bounds.north}
                      onChange={(e) =>
                        onBoundsChange({ ...bounds, north: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">South (Lat)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={bounds.south}
                      onChange={(e) =>
                        onBoundsChange({ ...bounds, south: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">West (Lon)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={bounds.west}
                      onChange={(e) =>
                        onBoundsChange({ ...bounds, west: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">East (Lon)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={bounds.east}
                      onChange={(e) =>
                        onBoundsChange({ ...bounds, east: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                    />
                  </div>
                </div>

                {/* Sample Grid Density Slider */}
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex justify-between items-center text-[11px] mb-1">
                    <span className="text-slate-400">Sampled Grid Points:</span>
                    <span className="text-amber-400 font-mono font-semibold">{sampleDensity} cells</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="16"
                    step="1"
                    value={sampleDensity}
                    onChange={(e) => onSampleDensityChange(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>4 (2x2)</span>
                    <span>9 (3x3)</span>
                    <span>16 (4x4)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Validation Error Message */}
            {validationError && (
              <div className="mt-2.5 p-2 rounded bg-red-950/60 border border-red-800/80 text-[11px] text-red-300 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* Quick status summary */}
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>ERA5 Reanalysis Grid (~0.1° resolution)</span>
          </div>
        </div>
      </div>

      {/* Honest Scientific Area Representation Disclosure */}
      <div className="mt-4 p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-300">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-slate-100">Scientific Geospatial Disclosure: </span>
          {representationText}
        </div>
      </div>
    </div>
  );
};
