# Dygnify — Map-First UI Redesign Implementation Plan

## 1. Architectural Overview & Design Philosophy

The current Dygnify interface uses a dark space theme with a top header and an embedded 3D globe / Leaflet toggle inside a dashboard grid.
The objective is to redesign the application into a **light, restrained, map-first climate intelligence workspace** inspired by Google Maps and professional GIS platforms (such as Jupiter Intelligence and Climate X):

* **Map-First Viewport:** The full browser window is the primary workspace, occupied by an interactive Leaflet map featuring high-contrast CartoDB Positron / OSM / Satellite basemaps.
* **Compact Left Navigation Rail:**
  - 60 px collapsed (icon-only with accessible tooltips/flyouts).
  - Expandable to 240 px (icon + label) on toggle or click.
  - Mobile overlay drawer.
  - Routes: **Explore Map**, **Climate Analysis**, **Layers**, **Reports**, **AI Assistant**, and **Settings / System Info**.
* **Floating Top Search & Hazard Filter Bar (Google Maps Style):**
  - Compact search box floating over map with debounced geocoding (`searchPlaces`), coordinate parsing, recent/preset locations, and locate-me button.
  - Clean hazard filter chips directly below: **Heatwave** (with active operational threshold chip), **Drought**, and **Heavy Rainfall**.
* **Floating Map Controls:**
  - Bottom-right: Zoom in (+), Zoom out (-), Reset view, Locate/Recenter.
  - Bottom-left: Basemap & Layers switcher pill (Positron, Satellite, Street).
* **Floating Location & Quick Summary Card:**
  - Floats bottom-left over the map showing active location (e.g. Mumbai, India), ERA5 grid coordinates, hazard type, observation span (2015–2023), and primary metric.
  - One-click trigger to open the **Full Climate Analysis Drawer**.
* **Right-Side Sliding Drawers (non-disruptive, map remains accessible):**
  - **Climate Analysis Drawer:** 6 verified KPI cards, Recharts annual trend trajectories, OLS/Mann-Kendall inference, threshold sensitivity disclosure, qualifying event audit table, CSV and PDF report exports.
  - **AI Climate Assistant Drawer:** Persistent assistant with "Python Metrics Supplied to AI" badge, Llama 3.3 70B / deterministic fallback briefing, interactive prompt chips ("Explain the trend for this location", "Compare earliest and latest periods", "Summarize recorded hazard events"), and grounded Q&A.
* **Collapsible Bottom Timeline Bar:**
  - Quick annual scrubber for the observation window (2015–2023), allowing interactive exploration of individual year hazard days and spatial coverage.
* **Global Typography & Light Design Token System:**
  - **Noto Sans** loaded from Google Fonts applied universally across all components.
  - Light-neutral palette: pure white `#ffffff`, light grey `#f8fafc`, borders `#e2e8f0` and `#cbd5e1`, text `#0f172a` and `#475569`, teal/cyan accents `#0891b2` and `#0e7490`.
  - Accessible focus rings, keyboard shortcuts, reduced-motion compliance, zero decorative clutter.

---

## 2. Component Structure & Migration Strategy

1. **Typography & Styling (`index.html`, `index.css`, `tailwind.config.js`):**
   - Import `Noto Sans` (300, 400, 500, 600, 700) and `JetBrains Mono`.
   - Update `tailwind.config.js` with `Noto Sans` as primary sans font.
   - Update `index.css` with light design tokens, crisp Leaflet styling overrides for light basemaps, and accessible focus states.
2. **Navigation Rail Component (`NavigationRail.tsx`):**
   - Compact 60 px width by default; expandable to 240 px with toggle.
   - Accessible tooltips, active tab indicator, badge counts.
   - Supports Explore Map, Climate Analysis, Layers, Reports, AI Assistant, Methodology, and Settings.
3. **Map Canvas Component (`ClimateMapCanvas.tsx`):**
   - Fullscreen Leaflet map using CartoDB Positron, Satellite, and Street basemaps.
   - Point marker for single ERA5 cell with pulse halo.
   - Bounding box dashed rectangle with cosine-weighted grid cell markers for regional mode.
   - Floating map controls (zoom, reset, locate).
4. **Floating Search & Hazard Filter Bar (`FloatingSearchBar.tsx`):**
   - Top floating search with geocoding autocomplete, clear button, and coordinate parsing.
   - Hazard selection chips (Heatwave, Drought, Heavy Rainfall) with active indicator.
   - Active threshold pill (e.g. `99th %ile (36.0 °C)`).
5. **Location Summary Card (`LocationSummaryCard.tsx`):**
   - Floating card at bottom-left showing target location, coords, analysis status, and button to view full analysis.
6. **Climate Analysis Drawer (`AnalysisDrawer.tsx`):**
   - Right-side sliding panel containing KPI cards, `TrendAnalysisView`, parameter tuning (date range, threshold, consecutive days), raw weather stream inspection, and working CSV/PDF export buttons.
7. **AI Assistant Drawer (`AIAssistantDrawer.tsx`):**
   - Right-side drawer housing the verified `AIBriefingCard` metrics, interactive suggestion prompts, and grounded scientific Q&A.
8. **Collapsible Timeline Bar (`TimelineScrubber.tsx`):**
   - Bottom floating bar with year-by-year scrubber and metric sparkline.
9. **Main Workspace Assembly (`WorkspaceShell.tsx` & `App.tsx`):**
   - Replaces the monolithic layout with the map-first architecture while preserving all verified API calls, state handlers, and calculation logic.

---

## 3. Verification & Testing

* Re-run `npm test` and `pytest backend/tests`.
* Ensure `transparency.test.ts` and `test_audit_validation.py` pass with 100% compliance.
* Run `npm run lint` (`oxlint`) and `npm run build` (`tsc -b && vite build`).
* Validate responsive behavior across desktop, tablet, and mobile breakpoints.
