Dygnify
Climate Hazard Trend Analyzer
AI-assisted development prompt pack • Vercel + Render deployment
Purpose: a structured prompt document for building a review-ready full-stack climate hazard analysis application for the Dygnify Ventures case study. Use the prompts sequentially in Google Antigravity. Each stage has explicit acceptance criteria so generated code is implemented, tested, and verified rather than merely described.
Core rule: scientific calculations must be deterministic Python code. The LLM may explain computed evidence, but must never invent climate measurements, calculate authoritative metrics in prose, or substitute generated data for real observations. Clearly label reanalysis data, assumptions, missing data, and uncertainty.
1. Product scope and success criteria
Product concept: Dygnify — a premium climate-intelligence dashboard with a functional interactive globe, map-based region selection, historical analysis, three hazards, transparent statistical methods, AI-generated evidence summaries, and exports.
•	Heatwave: daily maximum temperature above a documented local percentile threshold for at least 3 consecutive valid days.
•	Drought: implement a clearly documented meteorological drought proxy using precipitation anomalies or a Standardized Precipitation Index (SPI) only if the selected time scale and data volume support a defensible implementation. Do not call a simple rainfall deficit SPI.
•	Heavy rainfall: daily precipitation above a documented percentile threshold, with event-day counts and event intensity. State whether consecutive wet days are grouped as one event.
•	Trend analysis: annual metric series, ordinary least-squares regression slope, and a Mann–Kendall trend test with Kendall tau and p-value when valid. Document limitations and avoid causal claims.
•	Map selection: city search and clickable Leaflet map, plus validated coordinate / bounding-box input. A box must sample multiple points or clearly state that it represents a single point; do not pretend one coordinate is a regional average.
•	Exports: CSV for annual metrics/events and a readable PDF report including region, period, data source, definitions, chart/summary, trend methods, coverage, and limitations.
•	AI summary: server-side Groq call receives only computed metrics and metadata. Include deterministic fallback and output validation.
•	NoSQL: MongoDB Atlas collections for weather observations, analyses, regions/cache metadata, and AI summaries.
•	Deployment: React frontend on Vercel; FastAPI backend on Render; MongoDB Atlas database; secrets configured in hosting dashboards.
2. Recommended architecture
terrascope-ai/
  frontend/
    src/
      components/       # dashboard cards, filters, charts, globe, map, export UI
      pages/            # dashboard, methodology
      api/              # typed API client
      hooks/
      types/
      styles/
    package.json
    vercel.json
  backend/
    app/
      main.py
      api/routes/        # health, regions, analysis, summaries, exports
      core/              # settings, validation, logging, rate limits
      services/          # weather provider, cache, analysis, AI summary, exports
      domain/            # hazard algorithms and trend methods
      db/                # MongoDB client/repositories
      schemas/           # Pydantic request/response schemas
    tests/
    requirements.txt
    render.yaml
    .env.example
  README.md
  .gitignore
Keep domain algorithms independent of FastAPI and MongoDB. The same pure functions should be testable from unit tests without network access.
3. Prompt 0 — master project instruction
Paste this first into Antigravity. Then use each phase prompt below in order.
You are a senior full-stack engineer with climate-data engineering and application-security experience.
Build Dygnify, a production-minded but time-boxed full-stack climate hazard trend analyzer for a developer hiring case study.

MANDATORY STACK
- Frontend: React + TypeScript + Vite, Tailwind CSS, shadcn/ui or accessible equivalent, Recharts, react-globe.gl or react-three-fiber/Three.js, React Leaflet + Leaflet.
- Backend: Python 3.11+, FastAPI, Pydantic, HTTPX, NumPy, Pandas, SciPy, statsmodels or a correctly implemented Mann–Kendall method, pytest.
- Database: MongoDB Atlas via a maintained async/sync MongoDB Python driver. Choose one approach and use it consistently.
- Weather source: Open-Meteo Historical Weather API; use documented variables, units, date limits, and attribution. Never fabricate observations.
- AI: Groq API called only from the backend. AI summaries are optional enhancement, never source of scientific metrics.
- Deployment: Vercel frontend, Render backend, MongoDB Atlas.
- Exports: CSV and PDF.

ENGINEERING RULES
1. First inspect the repository and current state. Do not overwrite working code blindly.
2. Implement the smallest complete vertical slice, then expand. After every phase, run commands/tests and report actual outcomes.
3. Do not return pseudocode or TODO placeholders for required features. Implement working code.
4. No hard-coded demo metrics presented as real. If mock data is used in tests or design previews, label it as synthetic and keep it out of production results.
5. Use deterministic, independently tested Python for all thresholds, event detection, aggregation, regressions, and statistical tests.
6. Document every climate definition, baseline, missing-data rule, spatial resolution, units, and limitation in the UI and README.
7. Never treat missing observations as non-hazard days or bridge a missing-data gap when counting consecutive events.
8. Validate every request; limit date spans, region area, grid point count, request sizes, and external API timeouts.
9. Protect secrets; use environment variables and provide .env.example without secrets. Never expose Groq/MongoDB credentials to the frontend.
10. Implement caching, indexes, bounded retries, timeouts, structured errors, CORS allowlist, and rate limiting.
11. Include accessible labels, responsive layout, loading/empty/error states, and useful user feedback.
12. Do not claim causation from trend association. Do not present a percentage change if the baseline denominator is zero or unstable.
13. Add tests for scientific edge cases, validation, provider failures, cache hits, and API contracts.
14. Keep deployment instructions accurate for Vercel and Render. Verify build/start commands and health endpoints.
15. Never claim a feature or test passes unless you ran it and observed the result.

VISUAL DIRECTION
Premium scientific dashboard: deep navy/charcoal background, restrained cyan information accents, orange-red hazard palette, clear typography, strong spacing, subtle borders, no excessive glassmorphism. Make the globe visually distinctive but keep charts and methodology easy to inspect. Mobile layout must remain usable.

Start by summarizing the existing repository, proposed phases, and risks. Then implement Phase 1 only. Do not try to generate the entire application in one pass.
4. Prompt 1 — repository foundation and health checks
Implement Phase 1: repository scaffold and local developer experience.

Tasks:
- Create the frontend and backend structure described in the master prompt.
- Frontend: Vite React TypeScript, Tailwind, routing if useful, a premium responsive dashboard shell, typed API client, environment variable VITE_API_BASE_URL.
- Backend: FastAPI app with /api/v1/health and / root metadata; Pydantic settings loaded from environment; CORS allowlist; structured error responses.
- Add frontend and backend README setup instructions, .gitignore, .env.example files, pinned/compatible dependencies, and basic smoke tests.
- Add a visible API connection status and meaningful loading/error UI.
- Do not implement fake climate data or fake statistics.
- Ensure frontend can run with backend unavailable and shows an explicit connection error, not fake results.
- Add backend test for health endpoint and frontend production build.

Run backend tests and frontend build. Fix errors. Report exact commands, files created, test counts, and anything not verified. Do not proceed to data ingestion until both apps start locally.
5. Prompt 2 — weather provider and MongoDB caching
Implement Phase 2: real weather ingestion and MongoDB persistence.

Use the official Open-Meteo Historical Weather API documentation. Retrieve daily maximum temperature and precipitation for a validated coordinate and date range. Respect API availability and date constraints; return a clear validation error if a requested range is unsupported. Keep provider URL fixed in server code; never accept arbitrary URLs from users.

Requirements:
- Create a typed provider service using HTTPX, timeouts, bounded retries with exponential backoff/jitter, and clear upstream error handling.
- Normalize dates to ISO YYYY-MM-DD; normalize units; represent missing values as null; validate response shape, date order, and lengths.
- Store raw normalized daily observations with source/dataset identifier, coordinates or grid-cell identity, variable units, retrieval time, and provenance.
- MongoDB collections: weather_daily, analyses, regions (or cache metadata), ai_summaries. Create indexes for location/grid key + date + dataset and unique cache keys where appropriate.
- Reuse cached observations and fetch only missing date ranges where feasible. Avoid duplicate concurrent downloads for the same cache key.
- If MongoDB is unavailable, do not silently claim the result is cached; choose and document whether analysis fails closed or runs in an explicit non-persistent degraded mode.
- Add bounded request limits, maximum date span, and region grid-point limits.
- Tests must use mocked HTTP responses and a test database/repository abstraction; do not depend on live external APIs.
- Add provider attribution and dataset/resolution metadata to responses.

Run tests and show an example response schema. Never add synthetic records to the production database.
6. Prompt 3 — deterministic climate hazard algorithms
Implement Phase 3: tested climate hazard domain logic as pure Python functions.

Define and document the methodology before coding. Implement all three required hazards:

A. HEATWAVE
- Daily maximum temperature threshold based on a documented percentile (default 95th).
- Use an explicit baseline configuration. If using a fixed climatological baseline, state its years and require adequate valid samples; otherwise label a full-analysis-period threshold as exploratory.
- Qualifying event = at least 3 consecutive valid days strictly above threshold (or another rule clearly documented and consistently tested).
- Missing dates/values break runs; never treat them as cool days or bridge gaps.
- Output event start/end, duration, daily values, mean event temperature, exceedance intensity, annual event count, annual event days, mean/max duration.

B. DROUGHT
- Implement a transparent meteorological precipitation-deficit indicator. Prefer SPI only if correctly implemented with a defensible monthly time series, appropriate distribution fitting, and adequate calibration data. If time is constrained, use a documented rolling precipitation anomaly/deficit proxy and name it exactly that—not SPI.
- Define accumulation window, reference baseline, minimum coverage, drought threshold, missing-data behavior, event grouping, annual metrics, and units.
- Avoid claiming agricultural/ecological drought without soil moisture or vegetation evidence.

C. HEAVY RAINFALL
- Use daily precipitation percentile threshold calculated from a documented reference period and sample definition; consider wet-day-only percentile and state the wet-day cutoff.
- Define an event as threshold-exceeding day(s), with an explicit consecutive-day grouping rule.
- Output event dates/duration, event total/max daily precipitation, annual event count, heavy-rainfall days, and annual maximum daily precipitation.

For every hazard:
- Validate chronological uniqueness and daily frequency.
- Never silently drop bad rows. Report missingness and invalid/outlier policy; do not remove valid extremes merely because they are extreme.
- Produce annual metric series with coverage metadata.
- Add regression and Mann–Kendall tests in the next phase; do not calculate stats on insufficient or non-comparable years.
- Write deterministic pytest tests including exact boundary cases, missing dates, NaNs, leap days, threshold ties, short series, and event runs crossing calendar-year boundaries.
- Add a methodology page/endpoint returning definitions and assumptions.

Do not proceed until tests pass. Provide a short explanation of each algorithm and its assumptions.
7. Prompt 4 — regional sampling and map selection
Implement Phase 4: region selection with Leaflet and geospatial aggregation.

Frontend:
- Search locations by place name using a geocoding provider with attribution and usage limits.
- Show a Leaflet map; allow click-to-select coordinates and draw/select a bounding box using an appropriate Leaflet drawing tool.
- Provide accessible coordinate inputs as an alternative.
- Display the selected point/bounds, sample count, and an explanation of what area the analysis represents.
- Keep all coordinates and bounding boxes validated on both client and server.

Backend:
- Point mode: analyse the selected coordinate/grid cell.
- Bounding-box mode: sample a bounded set of grid points inside the box; aggregate annual regional metrics from per-point results using documented spatial weighting/coverage rules. Do not label one central point as a regional mean.
- Limit box size and maximum sampled grid points. Normalize/round coordinates only according to a documented provider grid/cache strategy.
- For each year, report valid grid-point coverage; mark years below a configured coverage threshold as unavailable rather than quietly biasing results.
- Store region metadata and sample definitions in MongoDB.
- Add tests for coordinate bounds, antimeridian boxes if supported, oversized regions, empty samples, and coverage thresholds.

Integrate map selection with the analysis request and ensure selecting a region changes real backend results.
8. Prompt 5 — trend statistics and honest insights
Implement Phase 5: annual trend analysis and statistically honest insight summaries.

Requirements:
- Fit ordinary least-squares regression to annual metrics against calendar year; return slope per year, intercept, R-squared, sample count, and a confidence interval/p-value if correctly implemented.
- Implement the Mann–Kendall test with Kendall tau, S statistic or equivalent, p-value, sample size, and a documented handling strategy for ties and autocorrelation. Prefer a well-maintained library if dependency and license are appropriate; otherwise implement and test the algorithm carefully.
- Do not calculate tests on too few valid years; define minimum sample size. Exclude or mark incomplete years using a documented rule.
- Clearly distinguish statistical significance, estimated trend magnitude, and causation. Include a note that autocorrelation and multiple testing may affect p-values.
- Compute percentage change using a clearly defined comparison of multi-year mean windows, not single endpoint years. Return null plus a reason if baseline is zero, negative where inappropriate, or unstable.
- Add rolling average only when the window and edge behavior are explicit.
- API response must include annual points, event list, regression metrics, Mann–Kendall metrics, comparison windows, coverage, and methodology version.
- Unit tests: increasing, decreasing, no-trend/tied, short, missing-year, constant, and near-zero-baseline series.
- Charts must show observed annual points and fitted regression line distinctly, with units and a methodology tooltip.

Run tests and give an example response generated from a test fixture clearly labeled synthetic. Never use that fixture as a real production result.
9. Prompt 6 — premium dashboard, 3D globe and charts
Implement Phase 6: complete frontend visual experience connected to real APIs.

Use React + TypeScript, Tailwind, accessible components, Recharts, React Leaflet, and react-globe.gl or a compatible Three.js globe library. Verify package APIs and browser compatibility before implementation.

Layout:
- Top bar: Dygnify, Explore, Methodology, Data Sources, API status.
- Filter panel: location search, click-to-select map, bounding box, hazard selector (Heatwave default, Drought, Heavy rainfall), date range, threshold options where methodologically valid, Analyze button.
- Main visual: interactive 3D globe with click-selectable supported locations, selected-region highlight, legend, rotate/zoom controls, and a year slider only when backed by data.
- Do not present a global continuous raster if the backend only has one or a few points. Use honest point markers or a limited sampled layer until real gridded data is available.
- KPI cards: events, hazard days, intensity, trend slope, significance status, data coverage.
- Charts: annual metric, fitted trend line, optional rolling mean; tooltips include year, value, units, source and coverage.
- Event table with dates, duration and intensity.
- AI climate briefing card with methodology/caveat section.
- Export CSV/PDF buttons.
- Provide loading skeletons, no-data, partial-data, provider-error, rate-limit and retry states.
- Responsive design, keyboard-accessible controls, reduced-motion support, descriptive labels, proper chart contrast.
- Use only actual backend results. Keep synthetic test fixtures out of the production bundle.
- Add a README screenshot checklist and test/build the production frontend.

Make the globe visually strong but keep the analysis readable and usable without WebGL; provide a 2D map fallback.
10. Prompt 7 — Groq AI briefing with guardrails
Implement Phase 7: AI-generated climate explanations via Groq.

- Call Groq only from FastAPI. Read GROQ_API_KEY and model configuration from server environment variables.
- Send a compact, validated JSON payload containing already-computed annual metrics, trend statistics, comparison windows, region, date range, data source, definitions, missingness, and limitations.
- System instruction: act as a cautious climate-data analyst; only describe values in the payload; do not invent values, locations, causes, confidence, sources, or recommendations. If evidence is insufficient, say so.
- Require structured output using a Pydantic response schema with: headline, observed_patterns, trend_interpretation, caveats, data_quality_note. Validate the output before returning it.
- Never let the LLM calculate authoritative event counts or trend statistics.
- Add deterministic template-based fallback if provider is unavailable, times out, returns invalid JSON, or exceeds rate limits.
- Cache summaries by analysis hash + model + prompt version. Apply request limits and rate limits.
- Do not send secrets or unnecessary user information to the model. Do not expose raw provider errors.
- UI must label the summary as AI-generated and show source/methodology.
- Test mocked valid/invalid outputs, timeout, quota failure, and fallback behaviour.
11. Prompt 8 — CSV and PDF export
Implement Phase 8: robust CSV and PDF exports from the same validated analysis result.

CSV:
- Include annual metrics with year, hazard, units, region, source/dataset, coverage, and method version.
- Offer event-level CSV separately if straightforward.
- Use correct escaping, UTF-8, safe filenames, and stable column order.
- Prevent spreadsheet formula injection by escaping cells beginning with =, +, -, or @ where user-controlled text could be exported.

PDF:
- Generate a concise, readable report server-side using a maintained PDF library.
- Include title, selected region/geometry, period, data source, dataset/resolution, hazard definition, baseline/threshold, annual trend chart or table, regression and Mann–Kendall results, AI briefing if available, missingness/coverage, limitations, and generation time.
- Ensure a PDF can still be generated if AI summary is unavailable.
- Never export fabricated results; use the exact analysis record and validate ownership/identifier access where applicable.
- Add tests for CSV headers/escaping and PDF generation/non-empty bytes. Use appropriate content types and Content-Disposition headers.
- Connect export buttons to real endpoints and show errors clearly.
12. Prompt 9 — security, reliability and performance review
Perform a security and performance audit of the whole repository. Do not merely list suggestions—implement fixes and tests.

Check:
- Pydantic validation for all input; reject invalid coordinates, reversed dates, unsupported hazards, oversized boxes, excessive years, excessive points, and large request bodies.
- No arbitrary user-controlled URL fetching (prevent SSRF).
- CORS is an explicit production-origin allowlist; no wildcard with credentials.
- Secrets are server-side only; .env files ignored; no secrets in logs, errors, commits, source maps, or frontend bundles.
- MongoDB uses TLS/least privilege and restricted network access where deployment supports it.
- External HTTP calls use timeout, bounded retry, concurrency controls, and clear error handling.
- Rate limiting on analysis and AI endpoints; use a shared backend store if multiple instances are expected, otherwise document process-local limitations.
- Prevent repeated expensive analysis via caching, stable cache keys, indexes, and request deduplication.
- Set safe response sizes and avoid returning all daily rows when annual aggregates suffice.
- Avoid logging sensitive inputs or API keys.
- Check dependency versions and known critical vulnerabilities using available tools.
- Test provider timeout, malformed provider payload, DB outage, cache hit, invalid inputs, rate limit, and AI fallback.
- Add health/readiness endpoints; do not leak internal exception details to clients.
- Report each finding as fixed, not applicable, or remaining with reason. Run full tests and production build.
13. Prompt 10 — Vercel + Render deployment
Prepare this repository for production deployment: Vercel frontend + Render FastAPI backend + MongoDB Atlas.

Backend:
- Add render.yaml if appropriate, with correct rootDir, Python runtime/build command, start command (for example uvicorn app.main:app --host 0.0.0.0 --port $PORT), healthCheckPath, and environment variable names. Never commit secret values.
- Verify imports work from the configured root directory and all dependencies are in requirements.txt.
- Read MONGODB_URI, MONGODB_DATABASE, GROQ_API_KEY, FRONTEND_ORIGINS, and other settings from environment.
- Configure CORS for the exact deployed Vercel origin and local development origin via settings.
- Confirm /api/v1/health returns a safe health payload and does not reveal secrets or full database URI.
- Document MongoDB Atlas network access and credentials with least privilege; do not advise opening access more broadly than necessary without a warning.
Frontend:
- Configure VITE_API_BASE_URL to the deployed Render base URL, including any required API prefix consistently.
- Add Vercel configuration only if required by Vite; do not rewrite every route to index.html if it breaks API or static asset paths.
- Ensure environment variables are configured in Vercel and trigger a new deployment after changes.
- Verify no secret is bundled into frontend.
README deployment steps:
1. Create MongoDB Atlas database/user and configure network access.
2. Deploy backend to Render from backend directory/root setting; set environment variables; inspect build logs.
3. Verify Render health endpoint and API docs.
4. Deploy frontend to Vercel; set VITE_API_BASE_URL; redeploy.
5. Add exact frontend origin to backend CORS settings and redeploy backend.
6. Test an end-to-end real analysis, cache hit, AI fallback, and CSV/PDF export.
7. Document free-tier sleep/cold starts, quotas, and provider limits.
Do not claim deployment is successful unless the public endpoints were actually verified. Provide a checklist of manual dashboard steps the developer must complete.
14. Prompt 11 — final reviewer-grade README and demo
Create the final reviewer-ready README and 3–5 minute demo script.

README must include:
- Problem statement and product overview.
- Screenshots with captions and live URLs.
- Features and implemented hazards.
- Architecture diagram (Mermaid is acceptable) and request/data flow.
- Local setup for Windows PowerShell and macOS/Linux.
- Environment variables with safe placeholders.
- Vercel, Render and MongoDB Atlas deployment steps.
- API endpoint table and sample schemas.
- Data-source links, attribution, units, spatial resolution and coverage.
- Exact heatwave, drought and heavy-rainfall definitions and baselines.
- Missing/outlier handling and incomplete-year policy.
- Regression and Mann–Kendall method, minimum sample size and limitations.
- Cache design, security controls and test commands/results.
- AI tools used and how they were used; distinguish development-time assistance from runtime Groq integration.
- Known limitations and next steps.
- No unsupported claims, fabricated performance numbers, fake metrics or unverifiable badges.

Demo script:
1. Select a real location and historical period.
2. Show data source and method settings.
3. Run analysis and explain one hazard event and annual chart.
4. Show trend slope and Mann–Kendall result with caveats.
5. Change hazard type and demonstrate updated metrics.
6. Select a region on the map/globe.
7. Generate AI briefing and explain that numbers come from deterministic analysis.
8. Export CSV and PDF.
9. Show health endpoint, tests and repository structure.
Make it clear what is implemented and what remains a limitation. Then run the full test suite and frontend build, report exact results, and list any outstanding defects.
15. Final acceptance checklist
•	☐ All three hazards run on real historical observations and have methodology documented.
•	☐ Heatwave consecutive-day logic and missing-date boundaries are tested.
•	☐ Drought metric is named honestly and does not overclaim SPI if SPI is not implemented.
•	☐ Heavy rainfall threshold and event grouping are documented and tested.
•	☐ Regression and Mann–Kendall outputs include sample size and limitations.
•	☐ City/coordinate and bounding-box selection produce correct, transparent spatial semantics.
•	☐ Globe/map visuals use real computed values and do not imply unsupported global coverage.
•	☐ MongoDB caching works and is tested; cache provenance/version is recorded.
•	☐ AI summary is backend-only, grounded in metrics, validated, cached and has a fallback.
•	☐ CSV and PDF export actual analysis results and pass tests.
•	☐ Security checks include validation, rate limiting, CORS, timeouts, secret handling and bounded workloads.
•	☐ Frontend production build and backend tests pass locally.
•	☐ Vercel and Render environment settings and public health/API endpoints are verified.
•	☐ README includes setup, architecture, data sources, methodology, assumptions, limitations and AI disclosures.
•	☐ No secrets, generated fake results, or unverified success claims in the public repository.
16. Recommended execution order
1.	Paste Prompt 0 into Antigravity and ask it to inspect the repository.
2.	Run Prompt 1 and verify both frontend and backend start.
3.	Run Prompt 2 and verify real API ingestion plus MongoDB cache tests.
4.	Run Prompt 3 and do not move on until hazard unit tests pass.
5.	Run Prompts 4 and 5 for geospatial selection and statistics.
6.	Run Prompt 6 for the dashboard and globe.
7.	Run Prompt 7 for Groq AI summaries.
8.	Run Prompt 8 for CSV/PDF exports.
9.	Run Prompt 9 security/performance audit.
10.	Run Prompt 10 deployment setup; manually configure the hosted services.
11.	Run Prompt 11 to finalize documentation and demo.
Important: Antigravity may need several iterations per phase. If a prompt is too large for one run, ask it to implement one numbered requirement at a time, run tests after each change, and inspect diffs before accepting changes.
