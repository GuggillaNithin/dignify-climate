# Dygnify — UI Scientific Control Restoration Report

**Role:** Senior Frontend & Geospatial Systems Engineer  
**Date:** October 2026  
**Application:** Dygnify — Climate Hazard Intelligence & Geospatial Analytics  
**Commit Scope:** Full restoration of scientific and statistical analysis controls across the Google Maps/GIS-inspired workspace and 3D Climate Sphere.

---

## 1. Executive Summary & Inventory

Following the recent visual redesign to a Google Maps–inspired map-first interface, several core empirical controls essential to climate hazard detection, scientific reproducibility, and reviewer evaluation were omitted from the primary viewport.

This restoration reinstates all previously supported scientific parameters into a dedicated, floating, collapsible **Analysis Controls** panel (`AnalysisControlsPanel.tsx`) and bidirectional synchronizer (`DashboardShell.tsx`), without altering the clean Google Maps / Leaflet canvas or Three.js 3D Sphere aesthetics.

### Scientific Control Inventory & Audit Matrix

| Scientific Control | Pre-Redesign State | Post-Redesign Issue | Restored Status & UI Placement | Synchronized API Contract |
| :--- | :--- | :--- | :--- | :--- |
| **Percentile Threshold Selector** | Present (`90`, `95`, `97.5`, `99`, custom) | Removed from main bar; only static badge shown | **Fully Restored**: 4 preset chips (`90`, `95`, `97.5`, `99`), continuous custom slider (`80%..99.9%`), dynamic derived threshold display (`34.2 °C` vs `36.0 °C`), and physical units | `percentile: float` (e.g., `95.0`, `99.0`) |
| **Start & End Year Selectors** | Present (`1940..2024`) | Removed from header; static range label | **Fully Restored**: Numeric inputs with ERA5 archive bounds (min 1940, max current year), calendar year span indicator, inline validation (`startYear <= endYear`) | `start_date: "YYYY-01-01"`, `end_date: "YYYY-12-31"` |
| **Spatial Aggregation Mode** | Present (Point vs Bounding Box) | Hardcoded to point mode in quick-search | **Fully Restored**: Point (nearest ~11 km ERA5 cell) vs Regional Bounding Box with North/South/West/East inputs, sampled cell density slider (4..16), and minimum spatial coverage gate | `mode: "point" \| "bounding_box"`, `sample_density: int`, `min_spatial_coverage_pct: float` |
| **Hazard Selector** | Present (Heatwave, Drought, Rainfall) | Quick chips present but didn't adjust detection criteria | **Fully Restored**: Chips in floating search bar and Controls panel; automatically adapts default duration criteria (3d for heatwave, 14d for drought, 1d for rain) | `hazard_type: "heatwave" \| "drought" \| "heavy_rainfall"` |
| **Duration / Consecutive Days** | Present | Hidden in collapsed secondary drawer | **Fully Restored**: Quick preset buttons in Controls panel adapting dynamically per hazard type | `min_consecutive_days: int` |
| **Apply Analysis Trigger** | Present | Missing; auto-requesting or inaccessible | **Fully Restored**: Explicit primary button with pending draft detection (`isDirty`), loading state (`isAnalyzing`), and validation guard | Submits payload only upon user action |
| **Reset to Defaults** | Present | Omitted during redesign | **Fully Restored**: Restores baseline defaults (Mumbai, Heatwave, 95th percentile, 2015–2023, point mode) | Submits baseline request and resets draft state |
| **Report Export Actions** | Present | Present in drawer, absent from quick panel | **Preserved & Integrated**: Direct link from panel to detailed drawer containing Annual CSV, Events CSV, and PDF Report | Unchanged verified endpoints |

---

## 2. Restored Components Architecture & UI Placement

### 2.1 The Compact Floating Scientific Controls Panel (`AnalysisControlsPanel.tsx`)
A new, accessible, glassmorphic floating panel anchored directly beneath the search bar:
- **Location & Spatial Mode:** Switch between single ERA5 cell (`PointCoordinate`) and Bounding Box regional area (`BoundingBox`). Allows fine-grained latitude/longitude adjustments, regional sampled grid point density slider (4..16 cells), and minimum spatial valid data coverage gating (50%..95%).
- **Hazard Selection:** Direct hazard toggle between **Heatwave**, **Drought**, and **Heavy Rainfall**.
- **Percentile Threshold Selector:** Provides quick chips for `90th`, `95th` (Standard Climate Default), `97.5th`, and `99th` (Extreme Anomalies), as well as a continuous slider (`80.0%..99.9%`). Displays the derived physical threshold with units (e.g. `34.2 °C` at 95th %ile vs `36.0 °C` at 99th %ile for Mumbai, or `mm` for rainfall) and methodology explanations.
- **Analysis Observation Window:** Allows configuring `Start Year` (validated $\ge 1940$) and `End Year` (validated $\le \text{Current Year}$). Enforces $Start \le End$, displaying real-time calendar year span.
- **Event Detection Criteria:** Dynamic consecutive qualifying days selector (2, 3, 5 days for Heatwave; 7, 14, 21 days for Drought; 1, 2, 3 days for Heavy Rainfall).
- **Execution Bar:** High-visibility **Apply Analysis** button that highlights whenever draft parameters diverge from applied settings (`isDirty`), alongside a **Reset Defaults** action.

### 2.2 Floating Search Bar & 3D Globe Parity (`FloatingSearchBar.tsx` & `GlobeControlsContainer.tsx`)
- Added an accessible **Controls** button with sliders icon, unapplied changes dot indicator, and loading spinner.
- Transformed the operational threshold pill (`95th %ile (34.2 °C)`) and temporal observation window pill (`2015–2023`) into clickable triggers that toggle the Scientific Analysis Controls panel.
- Maintained exact parity between the 2D Leaflet map interface and the Three.js 3D Globe interface.

### 2.3 Single Source of Truth Synchronization (`DashboardShell.tsx`)
Parameters are held in a unified state model:
1. **Draft State:** User modifications to years, coordinates, percentiles, or duration criteria are tracked in draft state (`draftPercentile`, `draftStartYear`, etc.).
2. **Applied State:** Reanalysis is triggered only when clicking **Apply Analysis** (or selecting quick hazard presets / location shortcuts). On API success, the response (`analysisResult`) and applied parameters (`percentileThreshold`, `startYear`, `endYear`, `selectedHazard`, etc.) are atomically committed.
3. **Consumers:** The committed state simultaneously drives:
   - Leaflet map overlays & 3D Globe markers.
   - Summary KPIs (Qualifying Events, Cumulative Intensity, OLS Trend, Mann-Kendall Significance, Certified Coverage).
   - Recharts annual trend chart and daily observation inspection.
   - Event Audit Table records.
   - AI Climate Assistant grounding context (`python_metrics_supplied`).
   - Exported Annual CSV, Events CSV, and PDF report metadata.

---

## 3. Backend Verification & Domain Parity

The backend domain calculation engines were verified and enhanced:
- In `backend/app/domain/rainfall.py` and `backend/app/domain/drought.py`, `definitions_summary` was enriched to supply `threshold_value`, `threshold_unit`, `threshold_percentile`, `threshold_rule`, and `hazard_indicator`, achieving full schema parity with `heatwave.py`.
- Verified API behavior on `http://127.0.0.1:8000/api/v1/analysis`:
  - **95th percentile Mumbai (2015–2023):** Derived threshold = `34.2 °C`, 17 qualifying events, Mann-Kendall $p = 0.02686$.
  - **99th percentile Mumbai (2015–2023):** Derived threshold = `36.0 °C`, 4 qualifying events, Mann-Kendall $p = 0.04494$.
  - **Date range filtering (2018–2022):** Returns exactly 5 annual records corresponding to [2018..2022].
  - **Date validation:** Requests with $Start > End$ receive HTTP 422 validation errors.

---

## 4. Test & Verification Results

### 4.1 Backend Pytest Suite
Ran the complete backend test suite:
```
============================= test session starts =============================
platform win32 -- Python 3.13.13, pytest-8.3.5, pluggy-1.6.0
rootdir: C:\Users\Maple Edge\Downloads\nitin workspace\Terrascope\backend
configfile: pytest.ini
plugins: anyio-4.15.1, asyncio-0.25.3
collected 100 items

tests\test_ai_summary.py .............                                   [ 13%]
tests\test_audit_validation.py ...................                       [ 32%]
tests\test_exports.py ...........                                        [ 43%]
tests\test_geospatial.py ..........                                      [ 53%]
tests\test_hazards.py ...................                                [ 72%]
tests\test_health.py ....                                                [ 76%]
tests\test_trends.py ..........                                          [ 86%]
tests\test_weather.py ..............                                     [100%]

============================ 100 passed in 12.38s =============================
```

### 4.2 Frontend Test Suite (`npm test`)
Ran Node native test runner across all test suites, including the newly added `src/utils/scientificControls.test.ts`:
```
> frontend@0.0.0 test
> node --test src/utils/globeTextures.test.ts src/utils/transparency.test.ts src/utils/mapFirstRedesign.test.ts src/utils/scientificControls.test.ts

✔ getHazardMarkerColor returns correct palette for heatwave (0.9177ms)
✔ getHazardMarkerColor returns correct palette for drought (0.1604ms)
✔ getHazardMarkerColor returns correct palette for heavy_rainfall (0.1258ms)
✔ getHazardMarkerColor handles unknown hazard gracefully (0.1145ms)
✔ getHazardLegendConfig returns scientific metadata and threshold swatches (0.2648ms)
✔ SUPPORTED_OBSERVATORIES contains valid geographic locations and baseline metrics (0.2647ms)
✔ Map-First layout: index.html loads Noto Sans and defines light theme body (1.5871ms)
✔ Map-First layout: tailwind.config.js configures Noto Sans as primary font (0.4463ms)
✔ Map-First layout: ClimateMapCanvas provides keyless Standard, Satellite, and Light Canvas basemaps (0.3906ms)
✔ Map-First layout: FloatingSearchBar supports place search, coordinates, and 3 hazard chips (0.4019ms)
✔ Map-First layout: AnalysisDrawer preserves 6 verified KPI cards and working export buttons (0.4811ms)
✔ Map-First layout: AIAssistantDrawer enforces strict evidence grounding and suggested prompts (1.3299ms)
✔ 3D Globe layout: GlobeControlsContainer establishes a clean 4-row Flex layout without overlap (0.441ms)
✔ 3D Globe layout: InteractiveGlobe3D provides full canvas, legend, and navigation dock (0.473ms)
✔ Scientific Controls: AnalysisControlsPanel defines comprehensive scientific parameters (1.3977ms)
✔ Scientific Controls: DashboardShell enforces single source of truth for applied parameters (0.553ms)
✔ Scientific Controls: FloatingSearchBar and GlobeControlsContainer provide full control parity (0.5443ms)
✔ Scientific Controls: AnalysisDrawer preserves scientific parameters and inline validation (1.6395ms)
✔ AI Evidence Badge displays Python Metrics Supplied to AI without numerical score (1.5255ms)
✔ Spatial metric labels distinguish point mode from multi-cell regional mode (0.6136ms)
✔ TrendAnalysisView includes operational threshold and sensitivity disclosure (0.5246ms)
ℹ tests 21
ℹ suites 0
ℹ pass 21
ℹ fail 0
```

### 4.3 Static Analysis & Production Build
- **Linter (`oxlint`):** `Found 0 errors` (15 minor React compiler advisory warnings).
- **TypeScript & Vite Build (`npm run build`):**
  ```
  vite v8.3.4 building client environment for production...
  ✓ 2542 modules transformed.
  dist/index.html                     1.14 kB │ gzip:   0.62 kB
  dist/assets/index-OUF3CYAv.css     59.71 kB │ gzip:  14.58 kB
  dist/assets/index-B09dAqWJ.js   1,497.12 kB │ gzip: 403.87 kB
  ✓ built in 3.81s
  ```

### 4.4 Interactive Browser Verification
Verified through end-to-end browser execution:
1. **Map-First Launch:** Verified initial load with active ECMWF connection.
2. **Controls Expansion:** Successfully toggled the floating controls panel via the Controls button and threshold pills.
3. **Threshold Sensitivity:** Modified threshold to 99th percentile and executed reanalysis. Observed instantaneous synchronization of the threshold pill, summary card, KPI metrics, charts, and event table.
4. **3D Globe Mode:** Switched into 3D Climate Sphere view, verifying identical controls accessibility.
5. **Detailed Drawer & AI:** Verified detailed statistics, chart rendering, and AI assistant evidence grounding.
6. **Artifact Capture:** Session recording generated at `file:///C:/Users/Maple%20Edge/.gemini/antigravity-ide/brain/b023a9e7-ae9a-48c0-955f-1f4b3716fc99/controls_restoration_1791902276275.webp` and verified screenshot captured.

---

## 5. Limitations & Notes
- **ERA5 Archive Boundary:** Historical data coverage begins in 1940. Selecting start years before 1940 is prevented by form validation.
- **Point vs Regional Mode:** Single coordinate analyses evaluate the nearest ~11 km ERA5 cell. Regional bounding box queries perform spherical cosine-latitude area weighting over the selected grid cells.
- **Scientific Attribution:** Trend tests (OLS rate and Mann-Kendall test) assess empirical historical shifts in reanalysis records and do not imply automated climate change attribution without formalized multi-model detection-and-attribution runs.
