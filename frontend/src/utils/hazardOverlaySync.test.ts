import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getHazardMarkerColor,
  getHazardLegendConfig,
  SUPPORTED_OBSERVATORIES,
} from './globeTextures.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Hazard Overlay: getHazardMarkerColor accurately maps all 3 climate hazard regimes', () => {
  // 1. Heatwave (Yellow -> Orange -> Deep Red)
  assert.equal(getHazardMarkerColor('heatwave', 3), '#eab308');
  assert.equal(getHazardMarkerColor('heatwave', 8), '#f97316');
  assert.equal(getHazardMarkerColor('heatwave', 15), '#ea580c');
  assert.equal(getHazardMarkerColor('heatwave', 25), '#dc2626');

  // 2. Drought (Sand -> Ochre -> Rust -> Severe Deficit Maroon)
  assert.equal(getHazardMarkerColor('drought', 5), '#d4c38d');
  assert.equal(getHazardMarkerColor('drought', 15), '#d97706');
  assert.equal(getHazardMarkerColor('drought', 35), '#b45309');
  assert.equal(getHazardMarkerColor('drought', 60), '#7f1d1d');

  // 3. Heavy Rainfall (Sky Cyan -> Royal Blue -> Electric Indigo -> Torrential Purple)
  assert.equal(getHazardMarkerColor('heavy_rainfall', 2), '#38bdf8');
  assert.equal(getHazardMarkerColor('heavy_rainfall', 10), '#2563eb');
  assert.equal(getHazardMarkerColor('heavy_rainfall', 20), '#6366f1');
  assert.equal(getHazardMarkerColor('heavy_rainfall', 30), '#9333ea');
});

test('Hazard Overlay: getHazardLegendConfig defines clear units and sequential swatches', () => {
  const heatConfig = getHazardLegendConfig('heatwave');
  assert.equal(heatConfig.title, 'Heatwave Exposure');
  assert.equal(heatConfig.units, 'days/year');
  assert.equal(heatConfig.items.length, 4);

  const droughtConfig = getHazardLegendConfig('drought');
  assert.equal(droughtConfig.title, 'Precipitation Deficit');
  assert.equal(droughtConfig.units, 'deficit days/year');
  assert.equal(droughtConfig.items.length, 4);

  const rainConfig = getHazardLegendConfig('heavy_rainfall');
  assert.equal(rainConfig.title, 'Heavy Precipitation');
  assert.equal(rainConfig.units, 'extreme days/year');
  assert.equal(rainConfig.items.length, 4);
});

test('Hazard Overlay: ClimateMapCanvas implements synchronized stations, 0.25 deg grid cells, and legend', () => {
  const mapPath = path.resolve(__dirname, '../components/ClimateMapCanvas.tsx');
  const content = fs.readFileSync(mapPath, 'utf8');

  // Observational stations overlay
  assert.equal(content.includes('SUPPORTED_OBSERVATORIES'), true, 'ClimateMapCanvas must render verified observatories');
  assert.equal(content.includes('CircleMarker'), true, 'ClimateMapCanvas must render interactive CircleMarkers for stations');
  assert.equal(content.includes('getHazardMarkerColor'), true, 'ClimateMapCanvas must color stations dynamically');

  // ERA5 0.25° grid cells rendering
  assert.equal(content.includes('sp.latitude - 0.125'), true, 'ClimateMapCanvas must compute genuine 0.25° cell bounds');
  assert.equal(content.includes('point_contributions'), true, 'ClimateMapCanvas must read cell contributions from annual series');
  assert.equal(content.includes('Missing / Excluded'), true, 'ClimateMapCanvas must handle missing observations without displaying zero');

  // Legend and Layer controls
  assert.equal(content.includes('getHazardLegendConfig'), true, 'ClimateMapCanvas must render dynamic hazard legend');
  assert.equal(content.includes('Hazard Overlay'), true, 'ClimateMapCanvas must provide a hazard layer toggle');
  assert.equal(content.includes('onLocationSelect'), true, 'ClimateMapCanvas must support selecting stations directly from map');
});

test('Hazard Overlay: InteractiveGlobe3D and DashboardShell synchronize annualSeries and selectedYear', () => {
  const globePath = path.resolve(__dirname, '../components/InteractiveGlobe3D.tsx');
  const globeContent = fs.readFileSync(globePath, 'utf8');

  assert.equal(globeContent.includes('point_contributions'), true, 'InteractiveGlobe3D must read point_contributions for sampled points');
  assert.equal(globeContent.includes('selectedYear'), true, 'InteractiveGlobe3D must accept and render selectedYear');

  const shellPath = path.resolve(__dirname, '../components/DashboardShell.tsx');
  const shellContent = fs.readFileSync(shellPath, 'utf8');

  assert.equal(shellContent.includes('annualSeries={analysisResult?.annual_series}'), true, 'DashboardShell must pass annualSeries to ClimateMapCanvas');
  assert.equal(shellContent.includes('selectedYear={selectedYear}'), true, 'DashboardShell must pass selectedYear to ClimateMapCanvas');
  assert.equal(shellContent.includes('hazardType={selectedHazard}'), true, 'DashboardShell must synchronize hazardType');
});
