"""Geocoding service with in-memory caching and attribution to Open-Meteo Geocoding API."""
import logging
from typing import Any, Dict, List
import httpx

logger = logging.getLogger(__name__)

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"


class GeocodingService:
    """Provides validated place-name search with attribution and caching."""

    def __init__(self):
        self._cache: Dict[str, List[Dict[str, Any]]] = {}

    async def search(self, query: str, count: int = 6) -> Dict[str, Any]:
        """Search locations by place name with attribution."""
        clean_query = query.strip().lower()
        if not clean_query or len(clean_query) < 2:
            return {
                "results": [],
                "attribution": "Location search powered by Open-Meteo Geocoding API under CC-BY 4.0",
                "cached": False,
            }

        cache_key = f"{clean_query}_{count}"
        if cache_key in self._cache:
            return {
                "results": self._cache[cache_key],
                "attribution": "Location search powered by Open-Meteo Geocoding API under CC-BY 4.0",
                "cached": True,
            }

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(
                    GEOCODING_URL,
                    params={
                        "name": query.strip(),
                        "count": min(count, 10),
                        "language": "en",
                        "format": "json",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    raw_results = data.get("results", [])
                    results = [
                        {
                            "id": r.get("id"),
                            "name": r.get("name"),
                            "latitude": round(float(r.get("latitude")), 4),
                            "longitude": round(float(r.get("longitude")), 4),
                            "country": r.get("country", ""),
                            "country_code": r.get("country_code", ""),
                            "admin1": r.get("admin1", ""),
                            "timezone": r.get("timezone", "UTC"),
                        }
                        for r in raw_results
                    ]
                    # Cache in memory
                    self._cache[cache_key] = results
                    return {
                        "results": results,
                        "attribution": "Location search powered by Open-Meteo Geocoding API under CC-BY 4.0",
                        "cached": False,
                    }
                else:
                    logger.warning("Upstream geocoding returned HTTP %d: %s", resp.status_code, resp.text)
        except Exception as exc:
            logger.warning("Geocoding lookup failed for query '%s': %s", query, exc)

        return {
            "results": [],
            "attribution": "Location search powered by Open-Meteo Geocoding API under CC-BY 4.0",
            "cached": False,
        }


geocoding_service = GeocodingService()
