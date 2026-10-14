from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import api_router, health
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.db.mongodb import db_manager
from app.services.weather_provider import open_meteo_provider


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycles."""
    # Startup: attempt database connection and index initialization
    await db_manager.connect()
    yield
    # Shutdown: clean up connections
    await db_manager.close()
    await open_meteo_provider.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Scientific Climate Hazard Trend Analyzer API with deterministic algorithms and provenance.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Exception handlers
register_exception_handlers(app)

# Include API v1 routes
app.include_router(api_router, prefix=settings.API_V1_STR)

# Top-level health route for cloud load balancers / Render health checks
app.include_router(health.router, prefix="/health", include_in_schema=False)


@app.get("/", summary="Root API metadata", tags=["system"])
async def root_metadata():
    """Return API metadata, links to documentation, and service identity."""
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs_url": "/docs",
        "health_check": f"{settings.API_V1_STR}/health",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "attribution": "Weather data powered by Open-Meteo Historical Weather API (CC-BY 4.0)",
    }
