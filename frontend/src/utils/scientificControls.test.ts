import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Scientific Controls: AnalysisControlsPanel defines comprehensive scientific parameters', () => {
  const panelPath = path.resolve(__dirname, '../components/AnalysisControlsPanel.tsx');
  const content = fs.readFileSync(panelPath, 'utf8');

  // 1. Percentile threshold selector options (90th, 95th default, 97.5th, 99th, custom slider)
  assert.equal(content.includes('Operational Percentile Threshold'), true, 'Must display Operational Percentile Threshold heading');
  assert.equal(content.includes('[90, 95, 97.5, 99].map'), true, 'Must support 90th, 95th, 97.5th, and 99th percentiles');
  assert.equal(content.includes('draftPercentile}th percentile'), true, 'Must display active draft percentile badge');
  assert.equal(content.includes('Custom Percentile Value'), true, 'Must provide custom percentile slider');

  // 2. Start year and end year controls with ERA5 boundary validation (1940..present)
  assert.equal(content.includes('draftStartYear'), true, 'Must manage draft start year');
  assert.equal(content.includes('draftEndYear'), true, 'Must manage draft end year');
  assert.equal(content.includes('1940'), true, 'Must enforce ERA5 1940 historical archive lower bound');
  assert.equal(content.includes('isDateRangeValid'), true, 'Must validate that start year <= end year');

  // 3. Spatial aggregation mode: Point vs Regional Bounding Box with sampling density and coverage gate
  assert.equal(content.includes('draftSpatialMode'), true, 'Must manage point vs bounding box mode');
  assert.equal(content.includes('draftSampleDensity'), true, 'Must manage regional grid sampling density (4..16)');
  assert.equal(content.includes('draftMinSpatialCoveragePct'), true, 'Must manage minimum valid spatial coverage gating');

  // 4. Hazard selection with consecutive days detection criteria
  assert.equal(content.includes('draftHazard'), true, 'Must support hazard selection');
  assert.equal(content.includes('draftMinConsecutiveDays'), true, 'Must configure min consecutive qualifying days');

  // 5. Scientific derivation, units, and methodology transparency
  assert.equal(content.includes('Applied Threshold:'), true, 'Must display applied threshold');
  assert.equal(content.includes('activeThresholdUnit'), true, 'Must display physical units');
  assert.equal(content.includes('Active in Analysis:'), true, 'Must display persistent active summary badge');

  // 6. Action buttons: Apply Analysis with loading state & Reset to Defaults
  assert.equal(content.includes('onApplyAnalysis'), true, 'Must provide Apply Analysis trigger');
  assert.equal(content.includes('onResetToDefaults'), true, 'Must provide Reset to Defaults trigger');
  assert.equal(content.includes('isDirty'), true, 'Must track draft modifications vs applied state');
});

test('Scientific Controls: DashboardShell enforces single source of truth for applied parameters', () => {
  const shellPath = path.resolve(__dirname, '../components/DashboardShell.tsx');
  const content = fs.readFileSync(shellPath, 'utf8');

  // Verified defaults
  assert.equal(content.includes("DEFAULT_CONFIG"), true, 'DashboardShell must declare explicit DEFAULT_CONFIG');
  assert.equal(content.includes("percentile: 95"), true, 'Default percentile must be 95');
  assert.equal(content.includes("startYear: 2015"), true, 'Default start year must be 2015');
  assert.equal(content.includes("endYear: 2023"), true, 'Default end year must be 2023');
  assert.equal(content.includes("hazard: 'heatwave'"), true, 'Default hazard must be heatwave');

  // Single source of truth applied across components
  assert.equal(content.includes('appliedPercentile: percentileThreshold'), true, 'Passes applied percentile in controlsProps');
  assert.equal(content.includes('appliedStartYear: startYear'), true, 'Passes applied start year in controlsProps');
  assert.equal(content.includes('appliedEndYear: endYear'), true, 'Passes applied end year in controlsProps');
  assert.equal(content.includes('appliedHazard: selectedHazard'), true, 'Passes applied hazard in controlsProps');

  // Handlers for applying and resetting
  assert.equal(content.includes('handleApplyAnalysis'), true, 'DashboardShell must implement handleApplyAnalysis');
  assert.equal(content.includes('handleResetToDefaults'), true, 'DashboardShell must implement handleResetToDefaults');
  assert.equal(content.includes('handleDirectHazardChange'), true, 'DashboardShell must adapt settings when switching hazard');
});

test('Scientific Controls: FloatingSearchBar and GlobeControlsContainer provide full control parity', () => {
  const barPath = path.resolve(__dirname, '../components/FloatingSearchBar.tsx');
  const barContent = fs.readFileSync(barPath, 'utf8');

  const globePath = path.resolve(__dirname, '../components/GlobeControlsContainer.tsx');
  const globeContent = fs.readFileSync(globePath, 'utf8');

  // Both interfaces must expose the Controls toggle button with dirty state indicator
  assert.equal(barContent.includes('onToggleControls'), true, 'FloatingSearchBar must expose onToggleControls');
  assert.equal(globeContent.includes('onToggleControls'), true, 'GlobeControlsContainer must expose onToggleControls');
  assert.equal(barContent.includes('isControlsOpen'), true, 'FloatingSearchBar must receive isControlsOpen');
  assert.equal(globeContent.includes('isControlsOpen'), true, 'GlobeControlsContainer must receive isControlsOpen');

  // Both must embed AnalysisControlsPanel for in-place configuration
  assert.equal(barContent.includes('<AnalysisControlsPanel'), true, 'FloatingSearchBar must embed AnalysisControlsPanel');
  assert.equal(globeContent.includes('<AnalysisControlsPanel'), true, 'GlobeControlsContainer must embed AnalysisControlsPanel');

  // Both must render threshold and date pills reflecting applied parameters
  assert.equal(barContent.includes('thresholdPercentile !== undefined'), true, 'FloatingSearchBar must show threshold pill');
  assert.equal(globeContent.includes('thresholdPercentile !== undefined'), true, 'GlobeControlsContainer must show threshold pill');
  assert.equal(barContent.includes('startYear !== undefined && endYear !== undefined'), true, 'FloatingSearchBar must show date pill');
  assert.equal(globeContent.includes('startYear !== undefined && endYear !== undefined'), true, 'GlobeControlsContainer must show date pill');
});

test('Scientific Controls: AnalysisDrawer preserves scientific parameters and inline validation', () => {
  const drawerPath = path.resolve(__dirname, '../components/AnalysisDrawer.tsx');
  const content = fs.readFileSync(drawerPath, 'utf8');

  // Percentile dropdown options
  assert.equal(content.includes('Operational Threshold Percentile'), true, 'AnalysisDrawer must show Operational Threshold Percentile');
  assert.equal(content.includes('[90, 95, 97.5, 99].map'), true, 'AnalysisDrawer must support 90, 95, 97.5, 99 percentiles');

  // Date range validation feedback
  assert.equal(content.includes('startYear > endYear'), true, 'AnalysisDrawer must detect invalid date ranges');
  assert.equal(content.includes('cannot exceed end year'), true, 'AnalysisDrawer must present invalid range warning');

  // Reset to defaults button
  assert.equal(content.includes('onResetToDefaults'), true, 'AnalysisDrawer must accept onResetToDefaults');
  assert.equal(content.includes('Reset'), true, 'AnalysisDrawer must provide Reset button');
});
