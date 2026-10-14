import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Workspace Architecture: App.tsx establishes 3-Mode workspace switcher (Explore, Analyze, Deep Analysis)', () => {
  const appPath = path.resolve(__dirname, '../App.tsx');
  const content = fs.readFileSync(appPath, 'utf8');

  // Verify 3 distinct modes defined and supported
  assert.equal(content.includes("type WorkspaceMode"), true, 'Must import WorkspaceMode type');
  assert.equal(content.includes("workspaceMode === 'explore'"), true, 'Must handle Explore mode');
  assert.equal(content.includes("workspaceMode === 'analyze'"), true, 'Must handle Analyze mode');
  assert.equal(content.includes("workspaceMode === 'deep-analysis'"), true, 'Must handle Deep Analysis mode');

  // Verify Header Mode Switcher segmented control
  assert.equal(content.includes("aria-label=\"Workspace Modes\""), true, 'Must render accessible Workspace Modes toolbar');
  assert.equal(content.includes("handleModeChange('explore')"), true, 'Must provide switch to Explore');
  assert.equal(content.includes("handleModeChange('analyze')"), true, 'Must provide switch to Analyze');
  assert.equal(content.includes("handleModeChange('deep-analysis')"), true, 'Must provide switch to Deep Analysis');

  // Verify synchronization with DashboardShell
  assert.equal(content.includes("workspaceMode={workspaceMode}"), true, 'Must pass workspaceMode to DashboardShell');
  assert.equal(content.includes("onWorkspaceModeChange="), true, 'Must sync workspaceMode changes from DashboardShell');
});

test('Workspace Architecture: DashboardShell defaults to Explore mode and manages Analyze & Deep Analysis states', () => {
  const shellPath = path.resolve(__dirname, '../components/DashboardShell.tsx');
  const content = fs.readFileSync(shellPath, 'utf8');

  // Default mode
  assert.equal(content.includes("workspaceModeProp || 'explore'"), true, 'Must default to explore mode');

  // Conditional DeepAnalysisView rendering
  assert.equal(content.includes("activeWorkspaceMode === 'deep-analysis'"), true, 'Must branch to DeepAnalysisView when in deep-analysis mode');
  assert.equal(content.includes("<DeepAnalysisView"), true, 'Must instantiate DeepAnalysisView component');
  assert.equal(content.includes("onBackToMap={() => setWorkspaceMode('explore')}"), true, 'Must wire return to map action');

  // Drawer and mode synchronization
  assert.equal(content.includes("setWorkspaceMode('analyze')"), true, 'Must enter analyze mode when drawer is opened');
  assert.equal(content.includes("onOpenDeepAnalysis"), true, 'Must wire onOpenDeepAnalysis in AnalysisDrawer and LocationSummaryCard');
});

test('Workspace Architecture: AnalysisDrawer provides 5 structured tabs and resizable drawer layout', () => {
  const drawerPath = path.resolve(__dirname, '../components/AnalysisDrawer.tsx');
  const content = fs.readFileSync(drawerPath, 'utf8');

  // 5 required tabs
  assert.equal(content.includes("setActiveTab('overview')"), true, 'Must include Overview tab');
  assert.equal(content.includes("setActiveTab('charts')"), true, 'Must include Charts tab');
  assert.equal(content.includes("setActiveTab('events')"), true, 'Must include Events tab');
  assert.equal(content.includes("setActiveTab('statistics')"), true, 'Must include Statistics tab');
  assert.equal(content.includes("setActiveTab('quality')"), true, 'Must include Data Quality tab');

  // Resizable drawer
  assert.equal(content.includes("width"), true, 'Must manage dynamic drawer width');
  assert.equal(content.includes("handleMouseDown"), true, 'Must provide drag handle resizing');
  assert.equal(content.includes("onOpenDeepAnalysis"), true, 'Must provide trigger to expand to Deep Analysis mode');

  // Sticky export footer
  assert.equal(content.includes("onExportAnnualCSV"), true, 'Must preserve Annual CSV export');
  assert.equal(content.includes("onExportEventsCSV"), true, 'Must preserve Events CSV export');
  assert.equal(content.includes("onExportPDF"), true, 'Must preserve PDF report export');
});

test('Workspace Architecture: DeepAnalysisView provides full-width scientific workspace', () => {
  const deepPath = path.resolve(__dirname, '../components/DeepAnalysisView.tsx');
  const content = fs.readFileSync(deepPath, 'utf8');

  // Persistent context header & Return to map action
  assert.equal(content.includes("Return to Map"), true, 'Must feature Return to Map action');
  assert.equal(content.includes("Deep Scientific Workspace"), true, 'Must feature persistent context header');

  // 4 Top Summary KPI Cards
  assert.equal(content.includes("Qualifying Events"), true, 'Must display Qualifying Events KPI');
  assert.equal(content.includes("Cumulative Hazard Days"), true, 'Must display Hazard Days KPI');
  assert.equal(content.includes("OLS Trend Rate"), true, 'Must display Trend Slope KPI');
  assert.equal(content.includes("Certified Coverage"), true, 'Must display Observation Coverage KPI');

  // Large responsive D3 Chart integration
  assert.equal(content.includes("<D3HazardTrendChart"), true, 'Must embed D3HazardTrendChart');

  // Statistical diagnostics and Event table filtering
  assert.equal(content.includes("Mann–Kendall"), true, 'Must report Mann-Kendall statistics');
  assert.equal(content.includes("Ordinary Least Squares (OLS)"), true, 'Must report OLS regression metrics');
  assert.equal(content.includes("eventSearchQuery"), true, 'Must provide event log search/filtering');
  assert.equal(content.includes("minDurationFilter"), true, 'Must provide event duration filtering');

  // Integrated AI Assistant panel within same deep analysis component
  assert.equal(content.includes("<AIAssistantDrawer"), true, 'Must render AIAssistantDrawer directly within DeepAnalysisView without navigating away');
});

test('Workspace Architecture: TimelineScrubber and LocationSummaryCard avoid layout overlap', () => {
  const scrubberPath = path.resolve(__dirname, '../components/TimelineScrubber.tsx');
  const scrubberContent = fs.readFileSync(scrubberPath, 'utf8');

  const cardPath = path.resolve(__dirname, '../components/LocationSummaryCard.tsx');
  const cardContent = fs.readFileSync(cardPath, 'utf8');

  // TimelineScrubber docked at bottom center with collapse toggle
  assert.equal(scrubberContent.includes("bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2"), true, 'TimelineScrubber must be docked at bottom center');
  assert.equal(scrubberContent.includes("isCollapsed"), true, 'TimelineScrubber must have collapse toggle');

  // LocationSummaryCard docked at bottom left with minimize toggle and Deep Analysis launcher
  assert.equal(cardContent.includes("bottom-3 sm:bottom-4 left-3 sm:left-4"), true, 'LocationSummaryCard must be docked at bottom left');
  assert.equal(cardContent.includes("isMinimized"), true, 'LocationSummaryCard must have minimize toggle');
  assert.equal(cardContent.includes("onOpenDeepAnalysis"), true, 'LocationSummaryCard must support onOpenDeepAnalysis');

  // DashboardShell enforces recommended timeline behavior:
  // 3D globe shows timeline; 2D map hides timeline by default with optional toggle; Deep analysis uses D3 chart
  const shellPath = path.resolve(__dirname, '../components/DashboardShell.tsx');
  const shellContent = fs.readFileSync(shellPath, 'utf8');
  assert.equal(shellContent.includes("showMapTimeline, setShowMapTimeline] = useState<boolean>(false)"), true, '2D map mode must hide timeline by default');
  assert.equal(shellContent.includes("(visualMode === 'globe' || showMapTimeline)"), true, '3D globe must always show timeline; 2D map shows only when toggled');
});
