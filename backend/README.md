# Dygnify - Backend Service

High-performance, deterministic climate hazard trend analyzer API built with Python 3.11+, FastAPI, Pydantic, HTTPX, NumPy, Pandas, SciPy, and statsmodels.

## Features (Phase 1)
- FastAPI application with structured error models and Pydantic configuration.
- Health check endpoints: `/api/v1/health` and `/health`.
- Service metadata endpoint with provenance and Open-Meteo attribution: `/`.
- Robust CORS origin allowlist configured for local and production frontends.
- Pre-configured dependency stack for deterministic statistical analysis and async MongoDB persistence.

## Prerequisites
- Python 3.11+ (Python 3.13 supported)
- pip / virtualenv

## Local Setup

### 1. Environment Configuration
Copy `.env.example` to `.env`:
```bash
# Windows PowerShell
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

### 2. Create Virtual Environment & Install Dependencies
```bash
# Windows PowerShell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Run Tests
```bash
pytest
```

### 4. Run Development Server
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Interactive Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health Check: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)
