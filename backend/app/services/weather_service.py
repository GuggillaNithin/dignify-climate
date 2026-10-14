"""Orchestrator service uniting Open-Meteo ingestion, caching, and provenance metadata."""
from datetime import datetime, timezone
from typing import Dict, List, Optional
from app.db.repositories.weather_repo import WeatherRepository, weather_repo
from app.schemas.weather import (
    WeatherDailyObservation,
    WeatherMetadata,
    WeatherSeriesResponse,
)
from app.services.weather_provider import OpenMeteoProvider, open_meteo_provider


class WeatherService:
    """Manages weather observation retrieval with range caching and metadata provenance."""

    def __init__(
        self,
        provider: Optional[OpenMeteoProvider] = None,
        repo: Optional[WeatherRepository] = None,
    ):
        self.provider = provider or open_meteo_provider
        self.repo = repo or weather_repo

    @staticmethod
    def compute_grid_key(latitude: float, longitude: float) -> str:
        """Normalize coordinates to standard 0.1° ERA5 model grid key."""
        return f"{round(latitude, 2):.2f}_{round(longitude, 2):.2f}"

    async def get_weather_series(
        self,
        latitude: float,
        longitude: float,
        start_date: str,
        end_date: str,
    ) -> WeatherSeriesResponse:
        """Retrieve daily observations, leveraging cached ranges and fetching missing sub-ranges."""
        grid_lat = round(latitude, 2)
        grid_lon = round(longitude, 2)
        grid_key = self.compute_grid_key(latitude, longitude)

        # 1. Inspect existing cache
        cached_docs = await self.repo.get_cached_observations(
            grid_key=grid_key,
            start_date=start_date,
            end_date=end_date,
        )
        existing_dates = {doc["date"] for doc in cached_docs}

        # 2. Identify missing date intervals
        missing_ranges = self.repo.compute_missing_date_ranges(
            start_date=start_date,
            end_date=end_date,
            existing_dates=existing_dates,
        )

        all_observations_dict: Dict[str, dict] = {
            doc["date"]: {
                "date": doc["date"],
                "temperature_max": doc.get("temperature_max"),
                "precipitation": doc.get("precipitation"),
            }
            for doc in cached_docs
        }

        elevation: Optional[float] = None
        timezone_str = "UTC"
        was_cached = len(missing_ranges) == 0

        # 3. Fetch missing ranges if needed
        if missing_ranges:
            for sub_start, sub_end in missing_ranges:
                upstream_result = await self.provider.fetch_historical_daily(
                    latitude=latitude,
                    longitude=longitude,
                    start_date=sub_start,
                    end_date=sub_end,
                )
                elevation = upstream_result.get("elevation")
                timezone_str = upstream_result.get("timezone", "UTC")
                new_obs = upstream_result.get("observations", [])

                # Persist to repository
                await self.repo.save_observations(
                    grid_key=grid_key,
                    observations=new_obs,
                    grid_latitude=upstream_result.get("grid_latitude", grid_lat),
                    grid_longitude=upstream_result.get("grid_longitude", grid_lon),
                )

                for obs in new_obs:
                    all_observations_dict[obs["date"]] = obs

        # 4. Sort observations chronologically
        sorted_dates = sorted(all_observations_dict.keys())
        daily_observations = [
            WeatherDailyObservation(
                date=d,
                temperature_max=all_observations_dict[d]["temperature_max"],
                precipitation=all_observations_dict[d]["precipitation"],
            )
            for d in sorted_dates
        ]

        # 5. Calculate data quality and completeness metrics
        total_days = len(daily_observations)
        valid_temp = sum(1 for o in daily_observations if o.temperature_max is not None)
        missing_temp = total_days - valid_temp
        valid_precip = sum(1 for o in daily_observations if o.precipitation is not None)
        missing_precip = total_days - valid_precip

        # Determine cache source provenance
        if was_cached:
            cache_source = "mongodb" if self.repo.is_mongo_available() else "in_memory"
        else:
            cache_source = "upstream_fetched"

        metadata = WeatherMetadata(
            source="Open-Meteo Historical Weather API",
            dataset="ECMWF ERA5 / ERA5-Land Reanalysis",
            attribution="Weather data by Open-Meteo.com under CC-BY 4.0",
            spatial_resolution="~0.1° (~11 km)",
            retrieved_at=datetime.now(timezone.utc).isoformat(),
            cached=was_cached,
            cache_source=cache_source,
            grid_latitude=grid_lat,
            grid_longitude=grid_lon,
            total_days=total_days,
            valid_temperature_days=valid_temp,
            missing_temperature_days=missing_temp,
            valid_precipitation_days=valid_precip,
            missing_precipitation_days=missing_precip,
        )

        return WeatherSeriesResponse(
            latitude=latitude,
            longitude=longitude,
            elevation=elevation,
            timezone=timezone_str,
            temperature_unit="°C",
            precipitation_unit="mm",
            metadata=metadata,
            daily=daily_observations,
        )


weather_service = WeatherService()
