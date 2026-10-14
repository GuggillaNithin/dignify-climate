"""Pydantic schemas for weather observation ingestion, validation, and serialization."""
from datetime import date, datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class WeatherQueryRequest(BaseModel):
    """Validated parameters for weather observation queries."""

    latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Target latitude in decimal degrees (-90.0 to 90.0)",
        examples=[35.6895],
    )
    longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="Target longitude in decimal degrees (-180.0 to 180.0)",
        examples=[139.6917],
    )
    start_date: str = Field(
        ...,
        description="Start date in ISO YYYY-MM-DD format (must be >= 1940-01-01)",
        examples=["1980-01-01"],
    )
    end_date: str = Field(
        ...,
        description="End date in ISO YYYY-MM-DD format (must be <= today)",
        examples=["2023-12-31"],
    )

    @field_validator("start_date", "end_date")
    @classmethod
    def validate_iso_date(cls, v: str) -> str:
        try:
            parsed = datetime.strptime(v, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError(f"Invalid date format '{v}'. Expected ISO YYYY-MM-DD.")
        
        # Check historical ERA5 boundary (Open-Meteo archive starts ~1940)
        min_date = date(1940, 1, 1)
        if parsed < min_date:
            raise ValueError(f"Date {v} precedes the historical archive limit of {min_date.isoformat()}.")
        
        today = date.today()
        if parsed > today:
            raise ValueError(f"Date {v} is in the future. Observations can only be queried up to today.")
        
        return v

    @model_validator(mode="after")
    def validate_date_range(self) -> "WeatherQueryRequest":
        start = datetime.strptime(self.start_date, "%Y-%m-%d").date()
        end = datetime.strptime(self.end_date, "%Y-%m-%d").date()

        if start > end:
            raise ValueError(
                f"start_date ({self.start_date}) cannot be after end_date ({self.end_date})."
            )

        # Enforce maximum bounded span (75 years = ~27,400 days)
        span_days = (end - start).days
        max_days = 365 * 75
        if span_days > max_days:
            raise ValueError(
                f"Requested span of {span_days} days exceeds the maximum permitted limit of {max_days} days (~75 years)."
            )

        return self


class WeatherDailyObservation(BaseModel):
    """Normalized daily observation record."""

    date: str = Field(..., description="Observation date in ISO format YYYY-MM-DD")
    temperature_max: Optional[float] = Field(
        None,
        description="Daily maximum 2m air temperature in °C. None if observation is missing.",
    )
    precipitation: Optional[float] = Field(
        None,
        description="Daily sum of precipitation in mm. None if observation is missing.",
    )


class WeatherMetadata(BaseModel):
    """Complete provenance and data governance metadata."""

    source: str = Field(
        default="Open-Meteo Historical Weather API",
        description="Atmospheric data provider",
    )
    dataset: str = Field(
        default="ECMWF ERA5 / ERA5-Land Reanalysis",
        description="Underlying reanalysis numerical model",
    )
    attribution: str = Field(
        default="Weather data by Open-Meteo.com under CC-BY 4.0",
        description="Required attribution statement",
    )
    spatial_resolution: str = Field(
        default="~0.1° (~11 km)",
        description="Spatial grid cell resolution of ERA5 archive",
    )
    retrieved_at: str = Field(
        ...,
        description="UTC timestamp when records were retrieved or cached",
    )
    cached: bool = Field(
        ...,
        description="True if record was served from cache",
    )
    cache_source: Literal["mongodb", "in_memory", "upstream_fetched"] = Field(
        ...,
        description="Provenance of the cached or fetched observations",
    )
    grid_latitude: float = Field(
        ...,
        description="Nearest ERA5 model grid point latitude",
    )
    grid_longitude: float = Field(
        ...,
        description="Nearest ERA5 model grid point longitude",
    )
    total_days: int = Field(
        ...,
        description="Total chronological calendar days in series",
    )
    valid_temperature_days: int = Field(
        ...,
        description="Count of valid non-null daily maximum temperature values",
    )
    missing_temperature_days: int = Field(
        ...,
        description="Count of missing daily maximum temperature values",
    )
    valid_precipitation_days: int = Field(
        ...,
        description="Count of valid non-null daily precipitation values",
    )
    missing_precipitation_days: int = Field(
        ...,
        description="Count of missing daily precipitation values",
    )


class WeatherSeriesResponse(BaseModel):
    """Standardized API response for weather observations."""

    latitude: float
    longitude: float
    elevation: Optional[float] = None
    timezone: str = "UTC"
    temperature_unit: str = "°C"
    precipitation_unit: str = "mm"
    metadata: WeatherMetadata
    daily: List[WeatherDailyObservation]
