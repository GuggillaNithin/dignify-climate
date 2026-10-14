# Dygnify — Scientific Validation & End-to-End Audit Report

**Target Subject:** Dygnify — Climate Hazard Trend Analyzer  
**Location Audited:** Mumbai, India (19.08° N, 72.88° E; ERA5 Grid Cell 19.086115° N, 72.852910° E)  
**Hazard:** Heatwave  
**Observation Window:** 2015-01-01 through 2023-12-31 (9 Calendar Years / 3,287 Days)  
**Audit Date:** 2026-10-12  
**Auditor Roles:** Senior Python Backend Engineer, Climate Data Scientist, QA Automation Engineer, Statistical Validation Specialist  

---

## 1. Executive Verdict

### **VERDICT: PASS WITH WARNINGS**

**Verdict Summary:**
- **Mathematical & Algorithmic Exactness (PASS):** All four reported qualifying heatwave events, their durations, mean values, maximum values, and cumulative intensities were independently calculated and confirmed from the raw daily records with 100% agreement. All statistical parameters reported on the dashboard (OLS slope $+0.6167$, $R^2 = 0.5404$, OLS $p = 0.02403$, Mann–Kendall $S = 17$, $\text{Var}(S) = 63.67$, $\tau = +0.6183$, Mann–Kendall $p = 0.04494$, Sen's slope $+0.4643$, early baseline mean $0.0$, recent window mean $4.333$) were independently reproduced from first principles.
- **Data Completeness & Provenance (PASS):** The database queried contains exactly 3,287 distinct calendar days across 2015–2023, matching the exact astronomical calendar day count (including leap years 2016 and 2020). There are 0 duplicate dates, 0 missing dates, and 0 invalid/unphysical temperatures. A fresh external API retrieval against Open-Meteo ERA5 for a 31-day sample window (2021-03-01 through 2021-03-31) matched the stored database records with 100% agreement (31/31).
- **Caveat & Methodology Warnings (WARNINGS):**
  1. **Threshold Discrepancy (Severity: MEDIUM):** The reported dashboard results were generated using `percentile = 99.0` (exploratory threshold $36.00^\circ\text{C}$), rather than the repository default `percentile = 95.0` (threshold $34.20^\circ\text{C}$). At the 95th percentile, Mumbai has 17 heatwave events and 88 heatwave days, yielding a non-significant Mann–Kendall trend ($p = 0.0763$). The statistical significance ($p < 0.05$) reported by the dashboard is sensitive to the operational percentile chosen.
  2. **Misleading Spatial Labeling (Severity: LOW):** In single-point mode, the UI and API response format label the metric as "Weighted Annual Mean". Because a single point receives area weight $1.0$, no multi-grid spatial weighting occurred.
  3. **AI Fact-Grounded Badge (Severity: LOW):** The frontend displays a static badge `Fact-Grounded (100%)` in JSX, which is not backed by a dynamic programmatic verification score.
  4. **Climate Attribution Limits (Severity: MEDIUM):** A 9-year record ($N = 9$, $\text{df} = 7$) with a 6-year run of zero events (2015–2020) followed by 2021–2023 activity produces low nominal $p$-values due to step-like leverage. This empirical trend does not establish anthropogenic climate change attribution, which requires multi-model detection and attribution (D&A) studies.

---

## 2. Environment and Test Commands

### 2.1 Environment Configuration
- **Operating System:** Windows 11 (64-bit)
- **Python Runtime:** Python 3.13.13
- **Test Framework:** pytest 8.3.5 with plugins `anyio-4.15.1`, `asyncio-0.25.3`
- **Application Server:** FastAPI, Uvicorn, Motor 3.7.0, Pydantic v2
- **Database:** MongoDB Atlas (authenticated TLS connection, active)
- **Frontend Stack:** React 19.2.8, TypeScript 6.0.2, Vite 8.3.0, Oxlint 1.81.0

### 2.2 Test & Audit Execution Commands
```powershell
# 1. Baseline Test Suite Execution (Backend)
.\.venv\Scripts\pytest -v

# 2. Frontend Test Suite Execution
npm test

# 3. Frontend Static Analysis & Lint
npm run lint

# 4. Automated Audit Regression Suite Execution
.\.venv\Scripts\pytest -v tests\test_audit_validation.py

# 5. Full Combined Suite Execution with Output Logging
.\.venv\Scripts\pytest -v > ..\audit_evidence\pytest_execution.log
```
**Outcome:** 96 of 96 backend tests passed (exit code 0); 6 of 6 frontend tests passed (exit code 0).

---

## 3. Repository Files and Functions Inspected

| Component | File Path | Functions / Classes Inspected |
|---|---|---|
| **Domain Logic** | `backend/app/domain/heatwave.py` | `detect_heatwaves`, `compute_temperature_threshold`, `_create_heatwave_event_record`, `_aggregate_heatwave_annual_metrics` |
| **Statistical Analysis** | `backend/app/domain/trends.py` | `TrendAnalyzer.analyze_annual_series`, `_compute_ols_regression`, `_compute_mann_kendall`, `_compute_window_comparison`, `_compute_rolling_averages` |
| **Timeseries Ingestion** | `backend/app/domain/timeseries.py` | `TimeseriesValidator.align_continuous_daily_series`, `sanitize_temperature`, `get_days_in_year` |
| **Weather Ingestion** | `backend/app/services/weather_provider.py` | `OpenMeteoProvider.fetch_historical_daily`, `_validate_and_normalize_payload` |
| **Weather Orchestration** | `backend/app/services/weather_service.py` | `WeatherService.get_weather_series`, `compute_grid_key` |
| **Database Repositories** | `backend/app/db/repositories/weather_repo.py`<br>`backend/app/db/repositories/analysis_repo.py` | `WeatherRepository.get_cached_observations`, `save_observations`<br>`AnalysisRepository.save_analysis`, `get_by_cache_key` |
| **API Endpoints** | `backend/app/api/routes/analysis.py`<br>`backend/app/api/routes/summary.py`<br>`backend/app/api/routes/health.py` | `analyze_climate_hazard`, `export_analysis_annual_csv`, `export_analysis_pdf`, `generate_summary_for_analysis_id` |
| **AI Narrative Generation** | `backend/app/services/groq_service.py`<br>`backend/app/domain/summary_fallback.py` | `GroqService.build_compact_payload`, `compute_analysis_hash`, `generate_summary`, `SummaryFallbackGenerator.generate` |
| **Frontend Presentation** | `frontend/src/components/DashboardShell.tsx`<br>`frontend/src/components/AIBriefingCard.tsx` | `DashboardShell` state handlers, `AIBriefingCard` rendering, badge labeling |

---

## 4. Data Provenance and Completeness Audit

### 4.1 Traceability Path
1. **Request Formulation:** An `AnalysisRequest` specifies `mode='point'`, coordinate `(19.076, 72.8777)`, `start_date='2015-01-01'`, `end_date='2023-12-31'`, and `hazard_type='heatwave'`.
2. **Grid Cell Normalization:** Coordinates are rounded to standard 0.1° ERA5 model grid key: `19.08_72.88`.
3. **Repository Lookup:** `weather_repo.get_cached_observations` inspects MongoDB collection `weather_daily` for `{grid_key: '19.08_72.88', date: {$gte: '2015-01-01', $lte: '2023-12-31'}}`.
4. **Upstream Ingestion:** If dates are missing, `weather_provider.fetch_historical_daily` queries Open-Meteo Historical Weather Archive (`https://archive-api.open-meteo.com/v1/archive`) with parameters `latitude=19.08`, `longitude=72.88`, `daily=temperature_2m_max,precipitation_sum`, `timezone=UTC`.
5. **Persistence:** Responses are validated for chronological ordering, sanitized against physical bounds ($-80^\circ\text{C} \le T \le 65^\circ\text{C}$), and upserted via `UpdateOne` bulk writes into `weather_daily`.
6. **Provenance Attribution:** Dataset is accredited to *ECMWF ERA5 / ERA5-Land Reanalysis* via *Open-Meteo.com under CC-BY 4.0*.

### 4.2 Data Completeness Metrics
- **Target Coordinate:** Requested $(19.076^\circ\text{ N}, 72.8777^\circ\text{ E})$; Open-Meteo returned ERA5 cell center: $(19.086115^\circ\text{ N}, 72.852910^\circ\text{ E})$, elevation $9.0\text{ m}$.
- **Expected Calendar Day Count:**
  - Standard years (365 days): 2015, 2017, 2018, 2019, 2021, 2022, 2023 ($7 \times 365 = 2,555$).
  - Leap years (366 days): 2016, 2020 ($2 \times 366 = 732$).
  - Total expected calendar days: **3,287 days**.
- **Unique Records in MongoDB:** Exactly **3,287** documents queried.
- **First Date:** `2015-01-01`
- **Last Date:** `2023-12-31`
- **Duplicate Dates:** **0**
- **Missing Dates / Date Gaps:** **0**
- **Unphysical / Null Values:** **0**
- **Temporal Completeness:** **100.0%**
- **Fresh Source Verification:** An independent HTTP query to Open-Meteo for `2021-03-01` to `2021-03-31` returned identical daily maximum temperatures for all 31 days (agreement rate 31/31, 100%).
- **Cache Key Integrity:** The cache key is computed as `hashlib.sha256(json.dumps(payload, sort_keys=True)).hexdigest()`, including `mode`, `point`, `bounds`, `hazard_type`, `start_date`, `end_date`, `percentile`, and `min_consecutive_days`. A cache hit cannot return data from a different coordinate, date range, or hazard.

---

## 5. Heatwave Methodology Audit

### 5.1 Production Operational Definition
In `backend/app/domain/heatwave.py`:
- **Variable:** `temperature_2m_max` (daily maximum 2m air temperature in °C).
- **Run Length Rule:** At least 3 consecutive valid days where $T_{\max} > \text{threshold}$.
- **Exceedance Criterion:** Strict inequality ($T_{\max} > \text{threshold}$). A day with temperature exactly equal to the threshold does not qualify.
- **Missing Data Policy:** Non-finite values (`None`, `NaN`, `Inf`) or missing calendar dates immediately break any active streak. Gaps are never interpolated or bridged.
- **Calendar Year Boundary Policy:** An event spanning Dec 31 to Jan 1 attributes each daily exceedance and hazard day to the physical calendar year in which it fell. The discrete event count is assigned to the start year.
- **Threshold Calculation:**
  - If `baseline_start_year` and `baseline_end_year` are provided with $\ge 8$ years of valid data, the percentile is computed over that reference window.
  - If not specified, it falls back to an **exploratory threshold** computed over all valid days in the input series (here, 2015–2023).

### 5.2 Critical Methodology Finding: Percentile Selection
The dashboard values correspond to `percentile = 99.0` ($36.00^\circ\text{C}$), whereas the application schema and UI default is `percentile = 95.0` ($34.20^\circ\text{C}$).
- **At 99th Percentile ($36.00^\circ\text{C}$):** Exactly 4 events and 13 heatwave days occur. The Mann–Kendall test reports $p = 0.04494$ (statistically significant at $\alpha = 0.05$).
- **At 95th Percentile ($34.20^\circ\text{C}$):** Exactly 17 events and 88 heatwave days occur. The Mann–Kendall test reports $p = 0.07633$ (**not** statistically significant at $\alpha = 0.05$).

**Scientific Limitation:** The project currently uses an exploratory threshold across only 9 years of data without seasonal adjustment (applying $36^\circ\text{C}$ uniformly across winter and monsoon). Under WMO/IPCC guidelines, climatological baselines require a 30-year reference window (e.g., 1991–2020) and calendar-day-centered moving windows (e.g., 5-day or 15-day window) to adjust for seasonal cycles.

---

## 6. Independent Event Comparison Table

An independent Python implementation was constructed from first principles (without importing or calling `detect_heatwaves` or any helper in `app.domain.heatwave`). Both implementations were evaluated against Mumbai's 3,287 validated daily observations at the 99th percentile threshold ($36.00^\circ\text{C}$):

| Event # | Start Date | End Date | Duration | Daily Temperatures (°C) | Mean Temp (°C) | Max Temp (°C) | Threshold (°C) | Daily Exceedances (°C) | Intensity (°C-days) | Status |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1** | 2021-03-03 | 2021-03-05 | 3 days | `[36.3, 36.4, 36.6]` | 36.43 | 36.60 | 36.00 | `[0.3, 0.4, 0.6]` | 1.30 | **CONFIRMED** |
| **2** | 2021-03-25 | 2021-03-27 | 3 days | `[38.3, 36.6, 38.6]` | 37.83 | 38.60 | 36.00 | `[2.3, 0.6, 2.6]` | 5.50 | **CONFIRMED** |
| **3** | 2022-04-21 | 2022-04-23 | 3 days | `[38.4, 36.4, 37.1]` | 37.30 | 38.40 | 36.00 | `[2.4, 0.4, 1.1]` | 3.90 | **CONFIRMED** |
| **4** | 2023-03-11 | 2023-03-14 | 4 days | `[36.8, 37.7, 37.4, 36.6]` | 37.12 | 37.70 | 36.00 | `[0.8, 1.7, 1.4, 0.6]` | 4.50 | **CONFIRMED** |

**Differences between Production and Independent Calculation:** **0 differences**. Every date, duration, mean, maximum, and intensity metric matches to the exact hundredth.

---

## 7. Annual Metric Reconciliation Table

| Year | Calendar Days | Valid Days | Missing Days | Coverage % | Heatwave Days (Claimed) | Heatwave Days (Independent) | Events (Claimed) | Events (Independent) | Cumulative Intensity (°C-days) |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **2015** | 365 | 365 | 0 | 100.0% | 0 | 0 | 0 | 0 | 0.0 |
| **2016** | 366 (leap) | 366 | 0 | 100.0% | 0 | 0 | 0 | 0 | 0.0 |
| **2017** | 365 | 365 | 0 | 100.0% | 0 | 0 | 0 | 0 | 0.0 |
| **2018** | 365 | 365 | 0 | 100.0% | 0 | 0 | 0 | 0 | 0.0 |
| **2019** | 365 | 365 | 0 | 100.0% | 0 | 0 | 0 | 0 | 0.0 |
| **2020** | 366 (leap) | 366 | 0 | 100.0% | 0 | 0 | 0 | 0 | 0.0 |
| **2021** | 365 | 365 | 0 | 100.0% | 6 | 6 | 2 | 2 | 6.8 |
| **2022** | 365 | 365 | 0 | 100.0% | 3 | 3 | 1 | 1 | 3.9 |
| **2023** | 365 | 365 | 0 | 100.0% | 4 | 4 | 1 | 1 | 4.5 |
| **Total** | **3,287** | **3,287** | **0** | **100.0%** | **13** | **13** | **4** | **4** | **15.2** |

### Annual Aggregates Reconciliation
- **Total Heatwave Days:** Claimed = 13, Independent = 13 (**MATCH**)
- **Total Qualifying Events:** Claimed = 4, Independent = 4 (**MATCH**)
- **Mean Annual Days:** $13 / 9 \approx 1.4444$ days/year (**MATCH**)
- **Mean Annual Events:** $4 / 9 \approx 0.4444$ events/year (**MATCH**)
- **Peak Year:** 2021 (6 days) (**MATCH**)
- **Early Window (2015–2017) Mean:** $0.000$ days (**MATCH**)
- **Recent Window (2021–2023) Mean:** $(6 + 3 + 4)/3 = 4.3333$ days (**MATCH**)
- **Absolute Window Difference:** $+4.3333$ days (**MATCH**)
- **Percentage Change:** Mathematically undefined (division by zero); correctly withheld (**MATCH**)

---

## 8. Statistical Comparison Table: Dashboard vs Independent Result vs Verdict

Input series: Annual heatwave days $Y = [0, 0, 0, 0, 0, 0, 6, 3, 4]$ across years $X = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]$ ($N = 9$, $\text{df} = 7$).

| Metric / Parameter | Dashboard Reported Value | Independent Calculation (Exact) | Independent Calculation (Rounded) | Discrepancy / Root Cause | Verdict |
|---|:---:|:---:|:---:|---|:---:|
| **Sample Size ($N$)** | 9 | 9 | 9 | None | **CONFIRMED** |
| **Degrees of Freedom ($\text{df}$)** | 7 | 7 | 7 | None | **CONFIRMED** |
| **OLS Slope** | $+0.6167\text{ days/yr}$ | $0.616667\text{ days/yr}$ | $+0.6167\text{ days/yr}$ | None | **CONFIRMED** |
| **OLS Intercept** | $-1243.6056$ | $-1243.605556$ | $-1243.6056$ | None | **CONFIRMED** |
| **OLS $R^2$** | $0.5404$ | $0.540395$ | $0.5404$ | None | **CONFIRMED** |
| **OLS Standard Error** | $0.2150$ | $0.214950$ | $0.2150$ | None | **CONFIRMED** |
| **OLS $p$-value** | $0.02403$ | $0.024031$ | $0.02403$ | None | **CONFIRMED** |
| **OLS 95% Confidence Interval** | `[0.1083, 1.1251]` | `[0.1084, 1.1249]` (raw)<br>`[0.1083, 1.1251]` (pre-rounded) | `[0.1083, 1.1251]` | In `trends.py`, CI was computed from pre-rounded slope ($0.6167$) and SE ($0.2150$). | **CONFIRMED (ROUNDING CONVENTION)** |
| **Mann–Kendall $S$** | $17$ | $17$ | $17$ | None | **CONFIRMED** |
| **MK Tied Groups** | $1\text{ group of }t=6$ | $1\text{ group of }t=6$ | $1\text{ group of }t=6$ | Six zeros (2015–2020) | **CONFIRMED** |
| **MK Variance of $S$** | $63.67$ | $63.666667$ | $63.67$ | None | **CONFIRMED** |
| **MK Continuity-Corrected $Z$** | $2.0052$ | $2.005196$ | $2.0052$ | None | **CONFIRMED** |
| **MK Two-Tailed $p$-value** | $0.04494$ | $0.044941$ | $0.04494$ | None | **CONFIRMED** |
| **Kendall's $\tau_b$** | $+0.6183$ | $0.618284$ | $+0.6183$ | None | **CONFIRMED** |
| **Theil–Sen's Slope** | $+0.4643\text{ days/yr}$ | $0.464286\text{ days/yr}$ | $+0.4643\text{ days/yr}$ | Median of 36 pairwise slopes | **CONFIRMED** |
| **Early Window Mean** | $0.0\text{ days}$ | $0.0000\text{ days}$ | $0.0\text{ days}$ | None | **CONFIRMED** |
| **Recent Window Mean** | $4.333\text{ days}$ | $4.3333\text{ days}$ | $4.333\text{ days}$ | None | **CONFIRMED** |
| **Window Absolute Shift** | $+4.333\text{ days}$ | $+4.3333\text{ days}$ | $+4.333\text{ days}$ | None | **CONFIRMED** |
| **Window Percentage Shift** | *Withheld* | *Undefined* | *Withheld* | Zero baseline division guarded | **CONFIRMED** |

---

## 9. Intensity and Weighted-Mean Audit

### 9.1 Cumulative Intensity Verification
- **Definition:** Cumulative intensity is computed as the sum of positive daily temperature exceedances above the threshold during qualifying events:
  $$\text{Intensity} = \sum_{d \in \text{streak}} (T_{\max}(d) - \text{threshold})$$
- **Units:** Degree-days exceedance ($^\circ\text{C-days}$).
- **Event Intensity Reconciliation:**
  - Event 1: $(36.3 - 36.0) + (36.4 - 36.0) + (36.6 - 36.0) = 0.3 + 0.4 + 0.6 = 1.30^\circ\text{C-days}$
  - Event 2: $(38.3 - 36.0) + (36.6 - 36.0) + (38.6 - 36.0) = 2.3 + 0.6 + 2.6 = 5.50^\circ\text{C-days}$
  - Event 3: $(38.4 - 36.0) + (36.4 - 36.0) + (37.1 - 36.0) = 2.4 + 0.4 + 1.1 = 3.90^\circ\text{C-days}$
  - Event 4: $(36.8 - 36.0) + (37.7 - 36.0) + (37.4 - 36.0) + (36.6 - 36.0) = 0.8 + 1.7 + 1.4 + 0.6 = 4.50^\circ\text{C-days}$
- **Total Sum:** $1.3 + 5.5 + 3.9 + 4.5 = 15.20^\circ\text{C-days}$. The dashboard reports **15.2 degree-days**, which exactly matches the sum.

### 9.2 "Weighted Annual Mean" Audit
- **Implementation Finding:** In `AnalysisService._analyze_point`, the point analysis is adapted into `RegionalAnnualMetricSchema` with `weighted_hazard_days = float(m.hazard_days)` and `weight = 1.0`.
- **Finding:** In point mode, there is only one grid cell. No cosine-latitude spherical area weighting or spatial averaging across multiple cells took place.
- **Recommendation:** Rename the UI metric in point mode from `Weighted Annual Mean` to `Annual Mean (Single Cell ERA5)` to avoid misleading users into assuming spatial aggregation took place.

---

## 10. API, AI, Frontend, and Export Verification

### 10.1 Live API Endpoints Audit
- `GET /api/v1/health`: Returns HTTP 200 with `{status: "ok", services: {api: "healthy", database: "connected", weather_provider: "configured"}}`.
- `POST /api/v1/analysis`: Correctly validates coordinate bounds ($-90 \le \text{lat} \le 90$), validates chronological dates, and returns complete analysis schema.
- `GET /api/v1/analysis/{analysis_id}`: Returns HTTP 200 with stored analysis payload matching MongoDB document.
- `POST /api/v1/analysis/{analysis_id}/summary`: Returns structured summary with cached provenance. Force refresh (`?force_refresh=true`) bypassed cache and regenerated via Groq/fallback.
- Error Handling: Invalid latitude ($95.0^\circ$) returned HTTP 422; reversed dates (`start_date > end_date`) returned HTTP 422; non-existent analysis ID returned HTTP 404.

### 10.2 Export Consistency Audit
- **RFC 4180 CSV Export:** `GET /api/v1/analysis/{id}/export/csv` returned 9 rows corresponding to the 9 years. Values for hazard days and events match the API response. All text cells beginning with formula injection characters (`=`, `+`, `-`, `@`) are sanitized with prefix `'`.
- **Events CSV Export:** `GET /api/v1/analysis/{id}/export/events-csv` returned 4 rows corresponding to the 4 verified events. Start dates, end dates, durations, and intensities match the API response.
- **PDF Report Export:** `GET /api/v1/analysis/{id}/export/pdf` generated a valid ReportLab document starting with `%PDF-` (6,727 bytes) containing the exact OLS, Mann–Kendall, and event tables.

### 10.3 AI Briefing Grounding Audit
The AI summary generated for Mumbai was audited sentence by sentence:
- Headline claims `~0.62 days per year (2015-2023)`: **GROUNDED** ($0.6167$).
- Observed patterns state `4 heatwave events and 13 hazard days`: **GROUNDED**.
- Stated annual mean of `0.44 events and 1.44 hazard days`: **GROUNDED**.
- Stated peak year `2021 with 6.0 hazard days`: **GROUNDED**.
- Stated early window $0.0$, late window $4.33$, absolute increase $+4.33$: **GROUNDED**.
- Caveats note single grid cell, 9-year record length, zero hazard days in baseline, potential autocorrelation, and explicit lack of causal climate attribution: **GROUNDED & CAUTIOUS**.
- **Static Badge Warning:** In `AIBriefingCard.tsx`, the tag `Fact-Grounded (100%)` is hardcoded in JSX rather than derived from an automated claim-checking algorithm.

---

## 11. Bugs Found, Severity, and Evidence

| Bug / Finding ID | Severity | Component | Description & Evidence |
|---|:---:|---|---|
| **BUG-01** | MEDIUM | Methodology / UI | **Percentile mismatch between default and reported analysis:** The dashboard reported results for `percentile = 99.0` (threshold $36.00^\circ\text{C}$), whereas the default slider in `DashboardShell.tsx` and API schema is `percentile = 95.0` (threshold $34.20^\circ\text{C}$). At 95th percentile, the trend is not statistically significant ($p = 0.0763$). |
| **BUG-02** | LOW | Statistics / Precision | **Pre-rounded intermediate floats in confidence interval:** In `trends.py`, lines 197–198 compute the 95% slope CI using already-rounded `slope` and `stderr` floats, introducing a minor rounding drift (`[0.1083, 1.1251]` vs exact unrounded `[0.1084, 1.1249]`). |
| **BUG-03** | LOW | UI Labeling | **Misleading "Weighted Annual Mean" label in point mode:** In single-point analysis, the weight is $1.0$. Displaying "Weighted Annual Mean" implies multi-cell spatial weighting. |
| **BUG-04** | LOW | Frontend Governance | **Static hardcoded fact-grounded tag:** `AIBriefingCard.tsx` renders `<span>Fact-Grounded (100%)</span>` statically, which can mislead users into assuming dynamic NLP verification took place. |

---

## 12. Code Changes Made

1. **Created Automated Audit Regression Suite (`backend/tests/test_audit_validation.py`):**
   - Added 10 deterministic synthetic unit test fixtures covering all run-length edge cases.
   - Added independent statistical calculation regression tests for OLS, Mann–Kendall, Sen's slope, and window comparisons.
   - Added API validation and error handling tests.
   - Added export consistency and negative discrepancy sensitivity tests.
2. **Created Sanitized Evidence Files (`audit_evidence/`):**
   - `mumbai_independent_annual_series.csv`
   - `mumbai_independent_events.csv`
   - `independent_statistical_calculation_output.txt`
   - `sanitized_api_analysis_response.json`
   - `pytest_execution.log`
3. **Created Structured Machine-Readable Results (`audit_results.json`).**
4. **Preserved Working Architecture:** No production data was overwritten or modified; existing production endpoints remain fully operational.

---

## 13. Tests Executed and Exact Outcomes

| Test Category | File | Tests Run | Passed | Failed | Command | Exit Code |
|---|---|:---:|:---:|:---:|---|:---:|
| **Audit Regression Suite** | `tests/test_audit_validation.py` | 15 | 15 | 0 | `pytest tests/test_audit_validation.py` | 0 |
| **AI Summary & Grounding** | `tests/test_ai_summary.py` | 13 | 13 | 0 | `pytest tests/test_ai_summary.py` | 0 |
| **Export Services (CSV/PDF)** | `tests/test_exports.py` | 11 | 11 | 0 | `pytest tests/test_exports.py` | 0 |
| **Geospatial & Bounding Box** | `tests/test_geospatial.py` | 10 | 10 | 0 | `pytest tests/test_geospatial.py` | 0 |
| **Climate Hazard Logic** | `tests/test_hazards.py` | 19 | 19 | 0 | `pytest tests/test_hazards.py` | 0 |
| **API Health & Metadata** | `tests/test_health.py` | 4 | 4 | 0 | `pytest tests/test_health.py` | 0 |
| **Statistical Trends** | `tests/test_trends.py` | 10 | 10 | 0 | `pytest tests/test_trends.py` | 0 |
| **Weather Ingestion & Cache** | `tests/test_weather.py` | 14 | 14 | 0 | `pytest tests/test_weather.py` | 0 |
| **Frontend Utility Tests** | `src/utils/globeTextures.test.ts` | 6 | 6 | 0 | `npm test` | 0 |
| **Total Test Execution** | **Full Suite** | **102** | **102** | **0** | `pytest -v && npm test` | **0** |

---

## 14. Unresolved Questions and Limitations

1. **Threshold Transparency:** When a user inspects Mumbai on the dashboard, is it clearly communicated that the reported 4 events occurred at the 99th percentile ($36.0^\circ\text{C}$), whereas selecting the 95th percentile ($34.2^\circ\text{C}$) yields 17 events and a non-significant trend?
2. **Fixed Climatological Baseline:** The current analysis uses an exploratory percentile over the 9-year evaluation window itself. Would the product benefit from offering a standard WMO 1991–2020 reference baseline?
3. **Seasonal Adjustment:** The current threshold applies $36.0^\circ\text{C}$ all year round. In tropical coastal regions like Mumbai, heat stress is seasonally concentrated in pre-monsoon months (March–May) and post-monsoon months (October). A seasonally varying percentile threshold (e.g., using a 15-day centered rolling window across historical years) would be more climatologically defensible.

---

## 15. Recommended Next Steps

1. **Display Threshold Explicitly in Dashboard Header:** Ensure the active percentile and its computed degree threshold (e.g., `99th percentile = 36.0°C`) are prominently visible alongside the hazard title.
2. **Context-Aware Metric Labeling:** Update the annual metric label in `DashboardShell.tsx` and `RegionalAnnualMetricSchema`:
   - If `mode == 'point'`, label as `Annual Mean (Single ERA5 Cell)`.
   - If `mode == 'bounding_box'`, label as `Cosine-Weighted Regional Mean`.
3. **Compute Confidence Intervals with Unrounded Floats:** In `backend/app/domain/trends.py`, update `_compute_ols_regression` to compute `ci_lower` and `ci_upper` using raw `res.slope` and `res.stderr` before rounding, preventing rounding drift.
4. **Dynamic Verification Score for AI Briefings:** Replace the static `Fact-Grounded (100%)` badge with a client-side verification check that verifies every numeric token in the narrative against the API metrics payload before displaying a green check.
