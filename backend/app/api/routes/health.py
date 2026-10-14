"""Health check and diagnostic endpoints."""
import time
from datetime import datetime, timezone
from fastapi import APIRouter
from app.core.config import settings
from app.db.mongodb import db_manager
from app.schemas.health import HealthResponse, HealthServicesStatus

router = APIRouter()
START_TIME = time.time()


@router.get("", response_model=HealthResponse, summary="Service health status")
async def get_health() -> HealthResponse:
    """Return runtime service health, uptime, and configured sub-service statuses."""
    uptime = round(time.time() - START_TIME, 2)
    mongo_ok = await db_manager.is_healthy()
    return HealthResponse(
        status="ok",
        project=settings.PROJECT_NAME,
        version=settings.PROJECT_VERSION,
        environment=settings.ENVIRONMENT,
        timestamp=datetime.now(timezone.utc).isoformat(),
        uptime_seconds=uptime,
        services=HealthServicesStatus(
            api="healthy",
            database="connected" if mongo_ok else "degraded_in_memory",
            weather_provider="configured" if settings.OPEN_METEO_ARCHIVE_URL else "disabled",
        ),
    )
