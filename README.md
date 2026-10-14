# Dygnify — Climate Hazard Trend Analyzer

[![Backend Tests](https://img.shields.io/badge/pytest-81%20passed-emerald)](file:///c:/Users/Maple%20Edge/Downloads/nitin%20workspace/Terrascope/backend/tests/test_exports.py)
[![Frontend Build](https://img.shields.io/badge/vite%20build-passing-cyan)](file:///c:/Users/Maple%20Edge/Downloads/nitin%20workspace/Terrascope/frontend/dist)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-teal)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)

> **Dygnify** is a production-minded climate hazard trend analyzer built for the Dygnify Ventures developer case study. It provides deterministic empirical analysis of historical heatwaves, meteorological droughts, and heavy precipitation using verified Open-Meteo ERA5 reanalysis data, non-parametric Mann–Kendall trend statistics, interactive geospatial visualizers, and guarded AI evidence summaries.

---

## 1. Core Scientific & Engineering Principles

1. **Deterministic Statistical Computation:** All thresholds, run-lengths, OLS regressions, and Mann–Kendall tests run in pure, testable Python 3 routines (`scipy`, `statsmodels`, `pandas`, `numpy`).
2. **Never Fabricate Climate Metrics:** The LLM (via Groq API) acts exclusively as an evidence synthesizer over computed facts. It is never invoked to invent metrics, guess temperatures, or compute authoritative indicators in prose.
3. **No Bridging Missing Observations:** Missing dates break consecutive hazard runs immediately. Incomplete years (>10% missing data) are flagged and excluded from annual trend regressions.
4. **Honest Geospatial Representation:** Single-point analyses represent the nearest ERA5 grid point (~11 km) and are not mislabeled as regional averages. Bounding box queries sample bounded grids with transparent spatial weights.
5. **No Blind Causation Claims:** Statistical trend correlation does not prove anthropogenic or localized physical causation. Caveats and sample sizes are rendered with every statistical output.

---

## 2. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Leaflet & React Leaflet, Recharts, WebGL Globe (`react-globe.gl` / Three.js) |
| **Backend** | Python 3.11+ (Python 3.13 verified), FastAPI, Pydantic v2, HTTPX, NumPy, Pandas, SciPy, statsmodels, PyTest |
| **Database** | MongoDB Atlas via Async Driver (`motor` / `pymongo`) |
| **Weather Source**| [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api) (ECMWF ERA5 / ERA5-Land, CC-BY 4.0) |
| **AI Briefing** | Groq API (`llama-3.3-70b-versatile`) called server-side with structured Pydantic schemas and deterministic fallback |
| **Deployment** | Vercel (Frontend), Render (FastAPI Backend), MongoDB Atlas |
| **Exports** | Audited CSV & Server-side PDF report summaries |

---

## 3. Project Architecture

```
Dygnify/
├── .gitignore
├── README.md
├── Documentation.md         # Case study master instructions & specifications
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application & middleware configuration
│   │   ├── api/
│   │   │   └── routes/      # health, weather, analysis, geocoding, methodology
│   │   ├── core/            # config, structured errors, rate limits
│   │   ├── domain/          # pure deterministic hazard & geospatial domain logic
│   │   │   ├── models.py    # dataclasses for hazard results, events, and metrics
│   │   │   ├── timeseries.py# continuous calendar alignment & outlier auditing
│   │   │   ├── heatwave.py  # 95th percentile, ≥3 consecutive days strictly above
│   │   │   ├── drought.py   # 90-day rolling precipitation deficit proxy (not SPI)
│   │   │   ├── rainfall.py  # wet-day percentile, consecutive storm grouping, Rx1day
│   │   │   ├── geospatial.py# bounding-box grid sampling, antimeridian, cosine weighting
│   │   │   └── methodology.py # methodology registry and assumptions catalog
│   │   ├── services/        # weather provider, geocoding, analysis orchestrator
│   │   ├── db/              # MongoDB async motor client & repositories
│   │   └── schemas/         # Pydantic request & response contracts
│   ├── tests/               # pytest test suite (47 tests passing)
│   ├── requirements.txt     # pinned backend dependencies
│   ├── render.yaml          # Render web service blueprint
│   ├── pytest.ini           # test runner configuration
│   └── .env.example         # safe environment template
└── frontend/
    ├── src/
    │   ├── api/             # typed API client with health, geocoding & analysis
    │   ├── components/      # GeospatialSelector, Header, DashboardShell, MethodologyView
    │   ├── types/           # TypeScript API interfaces
    │   ├── App.tsx          # root navigation & telemetry state
    │   └── index.css        # Tailwind & Leaflet scientific design tokens
    ├── package.json
    ├── tailwind.config.js
    ├── vercel.json          # Vercel deployment configuration
    └── .env.example
```

---

## 4. Proposed Execution Phases

- [x] **Phase 1: Repository Foundation & Health Checks (Completed)**
  - Scaffold frontend (Vite React TS + Tailwind) and backend (FastAPI + Pydantic + PyTest).
  - Configured CORS allowlist, structured error models, and health diagnostics.
  - Implemented live backend connection detection and honest UI states when offline.
  - Verified with 4 passing pytest tests and a successful production build.
- [x] **Phase 2: Weather Ingestion & MongoDB Atlas Caching (Completed)**
  - Typed HTTPX Open-Meteo client with exponential backoff, jitter, timeouts, and concurrency deduplication.
  - Async MongoDB collections: `weather_daily`, `analyses`, `regions`, `ai_summaries` with compound unique indexes.
  - Date normalization (ISO YYYY-MM-DD), unit normalization (°C, mm), null sanitization, and chronological order enforcement.
  - Range cache diffing: automatically queries only missing sub-intervals and merges with cached days.
  - Degraded mode: fallback in-memory caching when MongoDB is unreachable, reporting `cache_source: "in_memory"`.
  - 18 automated tests passing (health checks + provider + validation + cache hits + endpoints).
- [x] **Phase 3: Deterministic Climate Hazard Algorithms (Completed)**
  - Pure Python functions for all three core climate hazards, completely independent of DB or web framework:
    - **Heatwave:** Daily maximum temperature 95th percentile threshold (fixed baseline or labeled exploratory); qualifying events require $\ge 3$ consecutive valid days strictly exceeding threshold; missing dates/NaNs immediately break streaks and are never bridged; exact multi-year event spanning attributes hazard days to respective calendar years.
    - **Meteorological Drought Proxy:** Transparent 90-day rolling precipitation deficit relative to seasonal day-of-year baseline norms; guarded against division-by-zero in hyper-arid zones; strictly designated "Rolling Precipitation Deficit Proxy" and not mislabeled as SPI or agricultural/ecological drought.
    - **Heavy Rainfall:** 95th percentile threshold calculated strictly on wet days ($P \ge 1.0\text{ mm}$); consecutive qualifying days grouped into multi-day storm events; annual Rx1day (maximum 1-day precipitation) tracked.
  - Continuous timeline alignment and physical outlier auditing in `TimeseriesValidator`.
  - Public methodology endpoint: `GET /api/v1/methodology` returning authoritative definitions, scientific disclaimers, and unit contracts.
  - Comprehensive unit test suite covering exact run rules, threshold ties, temporal gaps, NaNs, leap years, year boundaries, short series, and physical outlier guards (37 tests passing).
- [x] **Phase 5: Trend Statistics & Non-Parametric Tests (Completed)**
  - **Ordinary Least-Squares (OLS) Regression:** Evaluates annual hazard metric progression against calendar years; computes slope per year & per decade, intercept, $R^2$, standard error, Student's $t$ 95% confidence intervals, two-tailed $p$-value, and chronological fitted regression values.
  - **Non-Parametric Mann–Kendall Test:** Primary monotonic authority with exact $S$ statistic, tie-adjusted variance $\operatorname{Var}(S) = \frac{n(n-1)(2n+5) - \sum t(t-1)(2t+5)}{18}$, continuity-corrected $Z$ statistic, two-tailed $p$-value, Kendall's $\tau$, and Theil–Sen robust median slope.
  - **Sample Size Gating & Missing Year Rules:** Requires minimum $N \ge 5$ valid calendar years (`is_calculated: false` with explanatory diagnostics if insufficient). Incomplete years (<90% daily data or <75% spatial coverage) are tracked in `excluded_years` and omitted from regressions.
  - **Multi-Year Window Comparisons:** Compares multi-year mean windows ($k = \max(2, \min(5, \lfloor n/3 \rfloor))$) rather than single endpoint years to prevent noise artifacts. Strictly withholds relative percentage change with documented scientific reasons if the early baseline window is 0.0, negative, or near-zero ($<0.1$).
  - **Centered Rolling Averages:** Computes 3-year centered rolling means with explicit edge window handling and missing date omission.
  - **Interactive Recharts Visualization:** Renders `TrendAnalysisView` with observed annual bars, distinct dashed OLS fitted regression line, 3-year rolling average curve, interactive tooltips, methodology drawer, and qualifying event audit table.
  - **Scientific Honesty Caveats:** Explicitly separates empirical correlation from physical/anthropogenic causation; includes transparent disclaimers on serial autocorrelation (ENSO, NAO) and multiple testing inflation.
  - 57 automated backend tests passing across the entire test suite.
- [x] **Phase 6: Interactive 3D Globe & Recharts Dashboard (Completed)**
  - **Top Bar Experience:** Dygnify brand badge, Explore (console), Methodology (definitions registry), Data Sources (ECMWF ERA5 & Open-Meteo CC-BY 4.0 provenance modal), and real-time backend API telemetry status.
  - **Interactive 3D Earth Sphere (`InteractiveGlobe3D`):** Three.js WebGL canvas with atmospheric glow, latitude/longitude graticule, 12 clickable global reference observatories (Tokyo, London, SF, Cairo, Sydney, São Paulo, Mumbai, Nairobi, Nuuk, Singapore, Buenos Aires, Reykjavik), active study-site pulse marker, drag-to-rotate orbital controls, zoom in/out, and view reset.
  - **Honest Point Representation:** Explicitly prevents artificial global continuous rasters when observations are local/regional; renders discrete verified grid points and honest legend disclosures.
  - **Seamless 2D Leaflet Fallback:** Provides an instant toggle between 3D Globe and 2D Leaflet map, ensuring full accessibility and graceful fallback when WebGL hardware acceleration is disabled.
  - **Historical Timeline Scrubber:** Year slider synchronizes selected year across 3D Globe, 2D Map, and Recharts trajectory (rendered only when backed by actual analyzed data).
  - **6-Card Empirical KPI Grid:** Qualifying events count, mean hazard days/yr, cumulative exceedance intensity, OLS trend rate per decade, Mann–Kendall monotonic significance status, and certified spatial coverage percentage.
  - **AI Climate Evidence Briefing Card (`AIBriefingCard`):** Synthesizes empirical observations into a structured executive brief; displays model engine badge, 100% fact-grounding guarantee, physical attribution boundary caveats, and full prompt verification audit.
  - **Working Report Exports:** Client-side CSV export formatted with RFC 4180 escaping and spreadsheet formula injection defense; print-ready PDF summary view.
  - **Resilience States:** Animated shimmer loading skeletons during analysis execution, partial-data alerts for incomplete years, and provider-error retry triggers with automatic backoff.
- [x] **Phase 7: Groq AI Climate Explanations with Strict Scientific Guardrails (Completed)**
  - **Server-Side Groq Integration:** Groq API (`llama-3.3-70b-versatile`) called strictly from FastAPI backend. Secrets (`GROQ_API_KEY`) and model configurations are read from server environment variables and never exposed to the client.
  - **Zero-Fabrication Analyst Guardrail:** System prompt strictly instructs the model to act as a cautious climate-data analyst narrating pre-computed metrics. The LLM is never permitted to calculate authoritative event counts or trend statistics, invent numbers, extrapolate future projections, or fabricate causal attributions.
  - **Pydantic Structured Schema Validation:** Response strictly validates into `AISummarySchema` (`headline`, `observed_patterns`, `trend_interpretation`, `caveats`, `data_quality_note`). Any schema violation triggers immediate fallback.
  - **Deterministic Template-Based Fallback:** `SummaryFallbackGenerator` produces rigorous, scientifically defensible summaries when Groq is unconfigured, times out, hits rate limits (HTTP 429), fails authentication (HTTP 401), or returns malformed JSON.
  - **SHA-256 Analysis Caching:** Summaries are hashed by canonical sorted metrics payload + model + prompt version (`v1.0-cautious`) and persisted in MongoDB `ai_summaries` collection with dual in-memory fallback.
  - **Frontend Provenance & Transparency:** `AIBriefingCard` displays engine badges (`Groq Llama 3.3 70B` vs `Deterministic Template Engine`), fallback reason notifications, cache tags, fact-grounding certification, and on-demand regeneration button.
- [x] **Phase 8: Robust CSV and Server-Side PDF Reports (Completed)**
  - **Audited RFC 4180 Annual CSV:** Stable column order (`year`, `hazard_type`, `metric_name`, `weighted_hazard_days`, `weighted_event_count`, `weighted_primary_metric`, `weighted_intensity`, `units`, `spatial_coverage_pct`, `coverage_status`, `valid_points_count`, `total_points_count`, `mode`, `region_description`, `data_source`, `resolution`, `methodology_version`, `analysis_id`), UTF-8 encoded with Content-Disposition attachment headers.
  - **Individual Qualifying Events CSV:** Dedicated endpoint (`/export/events-csv`) exporting each verified extreme hazard event (start date, end date, duration days, mean/max exceedance, intensity metric, threshold rule).
  - **Spreadsheet Formula Injection Defense:** Strictly escapes text starting with `=`, `+`, `-`, `@`, `\t`, `\r` by prefixing a single quote (`'`), neutralizing CSV injection attacks in Excel, Google Sheets, and LibreOffice Calc while preserving numeric types.
  - **Server-Side ReportLab PDF Generator:** Concise, multi-section publication-quality report with executive metadata grid, OLS and Mann–Kendall statistical comparison tables, multi-year baseline window shifts, synthesized narrative briefing, methodological caveats & attribution limits, recent annual observation sample, and Open-Meteo CC-BY 4.0 provenance.
  - **Fallback Robustness:** PDF reports generate cleanly even if AI summaries are offline or unconfigured, utilizing the deterministic analytical synthesis.
  - **Frontend Export Center:** Connected 3-button export grid in `DashboardShell` (`Annual CSV`, `Events CSV`, `PDF Report`) with animated loading spinners, error alerts, and direct browser file downloads.
  - **Comprehensive Test Suite:** 11 new automated tests in `test_exports.py` verifying formula injection defense, column ordering, ReportLab magic bytes (`%PDF-`), non-empty payloads, and FastAPI endpoints (81 total tests passing).
- [ ] **Phase 9: Security, Rate-Limiting & Performance Hardening**
- [ ] **Phase 10: Production Deployment to Vercel & Render**
- [ ] **Phase 11: Final Documentation & Video Demo Script**

---

### Frontend Visual Screenshot & Verification Checklist

- [x] **Top Bar Navigation:** Brand header, Explore console, Methodology drawer, Data Sources provenance modal, and live API status badge.
- [x] **Interactive 3D Globe:** Atmospheric cyan glow, starfield particle field, 12 clickable global stations, drag orbital rotation, zoom controls, and reduced-motion support.
- [x] **2D Leaflet Regional Map:** Place search autocomplete, click-to-select point, click-to-center bounding box, sampled grid point markers, and coordinate number inputs.
- [x] **Filter Panel:** Hazard selector (Heatwave, Drought, Heavy rainfall), validated date range (1940-present), methodologically valid threshold options, and primary Analyze button.
- [x] **6-Card KPI Grid:** Events, Hazard Days, Intensity, OLS Trend Rate, Mann–Kendall Significance Status, and Certified Coverage.
- [x] **AI Climate Evidence Briefing:** Grounded synthesis narrative with Llama 3.3 70B badge, causation boundary caveat, and LLM verification audit drawer.
- [x] **Recharts Visualizer:** Observed annual bars, distinct dashed OLS fitted regression line, 3-year rolling average curve, and interactive tooltip with units and data source.
- [x] **Event Audit Table:** Qualifying events with exact start/end dates, duration, mean, max, and exceedance intensity.
- [x] **Export Center:** Working client-side CSV export with formula injection defense, and print-ready PDF summary view.
- [x] **Resilience States:** Animated loading skeletons, partial-data advisory banners, and error retry triggers.

---

## 5. Technical Risks & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **Upstream Open-Meteo Rate Limiting or Outages** | HTTPX bounded retries with jitter; MongoDB collection caching by coordinate grid key and date range. |
| **LLM Hallucinations / False Climate Claims** | Groq is called strictly backend-only. The prompt receives pre-computed numerical summaries; deterministic templates act as fallbacks. |
| **Gaps in Weather Time Series Skewing Trends** | Missing dates immediately reset hazard streaks. Incomplete years (>10% missing days) are excluded from trend calculations. |
| **MongoDB Atlas Network Unavailability** | Backend implements an explicit degraded non-persistent mode so analysis runs in memory without dropping requests silently. |
| **Misleading Regional Aggregations** | A single coordinate is explicitly labeled as a single point (~11 km cell). Bounding boxes sample bounded grid arrays with reported coverage percentage. |

---

## 6. Quickstart / Local Developer Setup

### Backend Setup (FastAPI)
```bash
# In backend directory
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# Linux / macOS
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run test suite
pytest

# Start development server on port 8000
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health API: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)

### Frontend Setup (React + Vite)
```bash
# In frontend directory
npm install

# Start Vite dev server on port 5173
npm run dev

# Run production build
npm run build
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
#   d i g n i f y - c l i m a t e  
 