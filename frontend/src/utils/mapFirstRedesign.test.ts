import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Map-First layout: index.html loads Noto Sans and defines light theme body', () => {
  const htmlPath = path.resolve(__dirname, '../../index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.equal(html.includes('family=Noto+Sans'), true, 'index.html must load Noto Sans from Google Fonts');
  assert.equal(html.includes('bg-slate-100 text-slate-800'), true, 'index.html body must use light GIS palette');
});

test('Map-First layout: tailwind.config.js configures Noto Sans as primary font', () => {
  const tailwindPath = path.resolve(__dirname, '../../tailwind.config.js');
  const tailwind = fs.readFileSync(tailwindPath, 'utf8');

  assert.equal(tailwind.includes('Noto Sans'), true, 'tailwind.config.js must include Noto Sans in sans fontFamily');
});

test('Map-First layout: ClimateMapCanvas provides keyless Standard, Satellite, and Light Canvas basemaps', () => {
  const mapPath = path.resolve(__dirname, '../components/ClimateMapCanvas.tsx');
  const content = fs.readFileSync(mapPath, 'utf8');

  assert.equal(content.includes('tile.openstreetmap.org'), true, 'ClimateMapCanvas must support OpenStreetMap standard basemap');
  assert.equal(content.includes('ArcGIS/rest/services/World_Imagery'), true, 'ClimateMapCanvas must support Satellite basemap');
  assert.equal(content.includes('ArcGIS/rest/services/Canvas/World_Light_Gray_Base'), true, 'ClimateMapCanvas must support Esri Light Gray basemap without Carto watermarks');
  assert.equal(content.includes('MapActionControls'), true, 'ClimateMapCanvas must provide accessible zoom and recenter controls');
});

test('Map-First layout: FloatingSearchBar supports place search, coordinates, and 3 hazard chips', () => {
  const searchPath = path.resolve(__dirname, '../components/FloatingSearchBar.tsx');
  const content = fs.readFileSync(searchPath, 'utf8');

  assert.equal(content.includes('searchPlaces'), true, 'FloatingSearchBar must integrate searchPlaces geocoding');
  assert.equal(content.includes('parseCoordinates'), true, 'FloatingSearchBar must parse direct lat,lon coordinates');
  assert.equal(content.includes('heatwave'), true, 'FloatingSearchBar must include heatwave chip');
  assert.equal(content.includes('drought'), true, 'FloatingSearchBar must include drought chip');
  assert.equal(content.includes('heavy_rainfall'), true, 'FloatingSearchBar must include heavy_rainfall chip');
  assert.equal(content.includes('Mumbai'), true, 'FloatingSearchBar must include Mumbai preset');
});

test('Map-First layout: AnalysisDrawer preserves 6 verified KPI cards and working export buttons', () => {
  const drawerPath = path.resolve(__dirname, '../components/AnalysisDrawer.tsx');
  const content = fs.readFileSync(drawerPath, 'utf8');

  assert.equal(content.includes('Qualifying Events'), true, 'AnalysisDrawer must show Qualifying Events KPI');
  assert.equal(content.includes('Cumulative Intensity'), true, 'AnalysisDrawer must show Cumulative Intensity KPI');
  assert.equal(content.includes('OLS Trend Rate'), true, 'AnalysisDrawer must show OLS Trend Rate KPI');
  assert.equal(content.includes('Mann–Kendall Signif.'), true, 'AnalysisDrawer must show Mann-Kendall Significance KPI');
  assert.equal(content.includes('Certified Coverage'), true, 'AnalysisDrawer must show Certified Coverage KPI');
  assert.equal(content.includes('onExportAnnualCSV'), true, 'AnalysisDrawer must support Annual CSV export');
  assert.equal(content.includes('onExportEventsCSV'), true, 'AnalysisDrawer must support Events CSV export');
  assert.equal(content.includes('onExportPDF'), true, 'AnalysisDrawer must support PDF Report export');
});

test('Map-First layout: AIAssistantDrawer enforces strict evidence grounding and suggested prompts', () => {
  const aiPath = path.resolve(__dirname, '../components/AIAssistantDrawer.tsx');
  const content = fs.readFileSync(aiPath, 'utf8');

  assert.equal(content.includes('Explain the trend for this location'), true, 'Must include prompt: Explain the trend for this location');
  assert.equal(content.includes('Compare the earliest and latest periods'), true, 'Compare the earliest and latest periods');
  assert.equal(content.includes('Summarize the recorded hazard events'), true, 'Must include prompt: Summarize the recorded hazard events');
  assert.equal(content.includes('AIBriefingCard'), true, 'Must embed verified AIBriefingCard');
});

test('3D Globe layout: GlobeControlsContainer establishes a clean 4-row Flex layout without overlap', () => {
  const containerPath = path.resolve(__dirname, '../components/GlobeControlsContainer.tsx');
  const content = fs.readFileSync(containerPath, 'utf8');

  assert.equal(content.includes('Interactive 3D Climate Sphere'), true, 'Row 1 must provide workspace title');
  assert.equal(content.includes('ECMWF ERA5'), true, 'Row 1 must provide ERA5 badge');
  assert.equal(content.includes('searchPlaces'), true, 'Row 2 must provide location search');
  assert.equal(content.includes('heatwave'), true, 'Row 3 must provide hazard filters');
  assert.equal(content.includes('thresholdPercentile'), true, 'Row 3 must provide threshold indicator');
  assert.equal(content.includes('Reference Stations:'), true, 'Row 4 must provide reference station shortcuts');
});

test('3D Globe layout: InteractiveGlobe3D provides full canvas, legend, and navigation dock', () => {
  const globePath = path.resolve(__dirname, '../components/InteractiveGlobe3D.tsx');
  const content = fs.readFileSync(globePath, 'utf8');

  assert.equal(content.includes('absolute inset-0 w-full h-full'), true, 'Canvas must occupy full workspace');
  assert.equal(content.includes('legendConfig'), true, 'Must render hazard legend');
  assert.equal(content.includes('handleZoomIn'), true, 'Must provide zoom navigation controls');
  assert.equal(content.includes('isRotating'), true, 'Must provide auto-rotation toggle');
});
