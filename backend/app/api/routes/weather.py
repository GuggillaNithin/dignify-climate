"""Weather observation query endpoints."""
from fastapi import APIRouter, Query, status
from app.schemas.weather import WeatherQueryRequest, WeatherSeriesResponse
from app.services.weather_service import weather_service

router = APIRouter()


@router.post(
    "/query",
    response_model=WeatherSeriesResponse,
    status_code=status.HTTP_200_OK,
    summary="Query historical weather observations (POST)",
    description="Retrieve normalized daily maximum temperature and precipitation series for validated coordinates and date range.",
)
async def query_weather_post(
    request: WeatherQueryRequest,
) -> WeatherSeriesResponse:
    """Fetch or retrieve cached daily weather observations via JSON payload."""
    return await weather_service.get_weather_series(
        latitude=request.latitude,
        longitude=request.longitude,
        start_date=request.start_date,
        end_date=request.end_date,
    )


@router.get(
    "",
    response_model=WeatherSeriesResponse,
    status_code=status.HTTP_200_OK,
    summary="Query historical weather observations (GET)",
    description="Retrieve normalized daily maximum temperature and precipitation series using query parameters.",
)
async def query_weather_get(
    latitude: float = Query(
        ...,
        ge=-90.0,
        le=90.0,
        description="Target latitude in decimal degrees",
        examples=[35.6895],
    ),
    longitude: float = Query(
        ...,
        ge=-180.0,
        le=180.0,
        description="Target longitude in decimal degrees",
        examples=[139.6917],
    ),
    start_date: str = Query(
        ...,
        description="Start date in ISO format YYYY-MM-DD (must be >= 1940-01-01)",
        examples=["2020-01-01"],
    ),
    end_date: str = Query(
        ...,
        description="End date in ISO format YYYY-MM-DD (must be <= today)",
        examples=["2020-12-31"],
    ),
) -> WeatherSeriesResponse:
    """Fetch or retrieve cached daily weather observations via query parameters."""
    validated_req = WeatherQueryRequest(
        latitude=latitude,
        longitude=longitude,
        start_date=start_date,
        end_date=end_date,
    )
    return await weather_service.get_weather_series(
        latitude=validated_req.latitude,
        longitude=validated_req.longitude,
        start_date=validated_req.start_date,
        end_date=validated_req.end_date,
    )
