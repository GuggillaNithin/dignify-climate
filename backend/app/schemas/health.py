"""Health and system status schemas."""
from typing import Dict
from pydantic import BaseModel, Field


class HealthServicesStatus(BaseModel):
    api: str = "healthy"
    database: str = Field(default="unconfigured", description="MongoDB connection state")
    weather_provider: str = Field(default="configured", description="Open-Meteo endpoint status")


class HealthResponse(BaseModel):
    status: str = "ok"
    project: str
    version: str
    environment: str
    timestamp: str
    uptime_seconds: float
    services: HealthServicesStatus
