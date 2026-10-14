"""API routes package."""
from fastapi import APIRouter
from app.api.routes import analysis, geocoding, health, methodology, summary, weather

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(weather.router, prefix="/weather", tags=["weather"])
api_router.include_router(methodology.router, prefix="/methodology", tags=["methodology"])
api_router.include_router(analysis.router, tags=["analysis"])
api_router.include_router(summary.router, tags=["summary"])
api_router.include_router(geocoding.router, tags=["geocoding"])
