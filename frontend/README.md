# Dygnify - Frontend Client

Scientific dashboard interface built with React 19, TypeScript, Vite, Tailwind CSS, and Lucide icons.

## Features (Phase 1)
- Premium dark scientific UI with deep navy/charcoal backgrounds, cyan accents, and hazard color tokens.
- Real-time backend connectivity telemetry with graceful degraded states (no fake numbers when disconnected).
- Interactive navigation tabs:
  - **Dashboard:** Parameter controls (Heatwave, Drought Proxy, Heavy Rainfall), geospatial canvas shell, honest KPI placeholders, trend chart shell, and AI evidence synthesis card.
  - **Methodology:** Complete documentation of scientific definitions, run rules, and limitations.
  - **System & APIs:** Live endpoint registry and telemetry payload inspector.
- Typed API client targeting `VITE_API_BASE_URL`.

## Local Setup

### 1. Environment Configuration
Copy `.env.example` to `.env`:
```bash
# Windows PowerShell
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production
```bash
npm run build
```
Verify the production build output in `dist/`.
