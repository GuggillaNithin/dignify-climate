"""API route for place name geocoding search with provider attribution."""
from fastapi import APIRouter, Query
from app.services.geocoding_service import geocoding_service

router = APIRouter(prefix="/geocoding", tags=["Geocoding"])


@router.get(
    "/search",
    summary="Search locations by place name",
    description="Resolves city or place names to coordinates using Open-Meteo Geocoding API with caching.",
)
async def search_places(
    q: str = Query(..., min_length=2, max_length=100, description="City or place name to search"),
    count: int = Query(default=6, ge=1, le=10, description="Max results to return"),
):
    return await geocoding_service.search(query=q, count=count)
