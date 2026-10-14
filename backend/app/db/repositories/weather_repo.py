"""Weather repository supporting MongoDB Atlas and non-persistent in-memory fallback."""
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from pymongo import UpdateOne
from app.db.mongodb import db_manager


class WeatherRepository:
    """Repository handling weather observation persistence and cache retrieval."""

    def __init__(self):
        # In-memory storage for degraded mode: {grid_key: {date_str: doc}}
        self._in_memory_store: Dict[str, Dict[str, dict]] = {}

    def is_mongo_available(self) -> bool:
        """Return True if MongoDB connection is active."""
        return db_manager._is_connected and db_manager.db is not None

    async def get_cached_observations(
        self, grid_key: str, start_date: str, end_date: str
    ) -> List[dict]:
        """Fetch cached daily observations within the specified date range."""
        if self.is_mongo_available() and db_manager.db is not None:
            try:
                cursor = db_manager.db.weather_daily.find(
                    {
                        "grid_key": grid_key,
                        "date": {"$gte": start_date, "$lte": end_date},
                    },
                    {"_id": 0},
                ).sort("date", 1)
                return await cursor.to_list(length=None)
            except Exception:
                # If query fails, fall back to in-memory store
                pass

        # In-memory fallback
        grid_data = self._in_memory_store.get(grid_key, {})
        cached = [
            doc for date_str, doc in sorted(grid_data.items())
            if start_date <= date_str <= end_date
        ]
        return cached

    async def save_observations(
        self,
        grid_key: str,
        observations: List[dict],
        grid_latitude: float,
        grid_longitude: float,
        dataset: str = "ECMWF ERA5 / ERA5-Land",
    ) -> None:
        """Upsert observations into MongoDB and update in-memory cache."""
        now_iso = datetime.now(timezone.utc).isoformat()

        # Always update in-memory store for quick lookups
        if grid_key not in self._in_memory_store:
            self._in_memory_store[grid_key] = {}

        ops = []
        for obs in observations:
            doc = {
                "grid_key": grid_key,
                "grid_latitude": grid_latitude,
                "grid_longitude": grid_longitude,
                "date": obs["date"],
                "temperature_max": obs["temperature_max"],
                "precipitation": obs["precipitation"],
                "dataset": dataset,
                "retrieved_at": now_iso,
            }
            self._in_memory_store[grid_key][obs["date"]] = doc

            if self.is_mongo_available():
                ops.append(
                    UpdateOne(
                        {"grid_key": grid_key, "date": obs["date"]},
                        {"$set": doc},
                        upsert=True,
                    )
                )

        if self.is_mongo_available() and ops and db_manager.db is not None:
            try:
                await db_manager.db.weather_daily.bulk_write(ops, ordered=False)
                # Update region metadata
                await db_manager.db.regions.update_one(
                    {"grid_key": grid_key},
                    {
                        "$set": {
                            "grid_key": grid_key,
                            "grid_latitude": grid_latitude,
                            "grid_longitude": grid_longitude,
                            "last_updated": now_iso,
                            "dataset": dataset,
                        }
                    },
                    upsert=True,
                )
            except Exception:
                pass

    def compute_missing_date_ranges(
        self,
        start_date: str,
        end_date: str,
        existing_dates: set[str],
    ) -> List[Tuple[str, str]]:
        """Identify missing contiguous date ranges between start_date and end_date.
        
        Returns a list of (sub_start, sub_end) date pairs that must be fetched from upstream.
        """
        cur = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()

        missing_ranges: List[Tuple[str, str]] = []
        current_range_start: Optional[str] = None
        last_missing: Optional[str] = None

        while cur <= end:
            cur_str = cur.isoformat()
            if cur_str not in existing_dates:
                if current_range_start is None:
                    current_range_start = cur_str
                last_missing = cur_str
            else:
                if current_range_start is not None and last_missing is not None:
                    missing_ranges.append((current_range_start, last_missing))
                    current_range_start = None
                    last_missing = None
            cur += timedelta(days=1)

        if current_range_start is not None and last_missing is not None:
            missing_ranges.append((current_range_start, last_missing))

        return missing_ranges


weather_repo = WeatherRepository()
