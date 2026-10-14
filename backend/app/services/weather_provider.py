"""Typed Open-Meteo Historical Weather API provider with bounded retries and jitter."""
import asyncio
import logging
import math
import random
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings
from app.core.errors import AppException

logger = logging.getLogger(__name__)


class OpenMeteoProvider:
    """Retrieves and validates daily atmospheric observations from Open-Meteo."""

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self._injected_client = client
        self._client = client
        self._client_loop = None
        self._in_flight_locks: Dict[str, asyncio.Lock] = {}
        self._global_lock: Optional[asyncio.Lock] = None
        self._locks_loop = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._injected_client is not None:
            return self._injected_client

        cur_loop = asyncio.get_running_loop()
        if (
            self._client is None
            or self._client.is_closed
            or self._client_loop is not cur_loop
        ):
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(settings.PROVIDER_TIMEOUT_SECONDS, connect=5.0),
                headers={
                    "User-Agent": "Dygnify-AI-Client/0.1.0 (Climate Risk Research)",
                    "Accept": "application/json",
                },
            )
            self._client_loop = cur_loop
        return self._client

    async def _get_lock_for_key(self, lock_key: str) -> asyncio.Lock:
        cur_loop = asyncio.get_running_loop()
        if self._global_lock is None or self._locks_loop is not cur_loop:
            self._global_lock = asyncio.Lock()
            self._in_flight_locks = {}
            self._locks_loop = cur_loop

        async with self._global_lock:
            if lock_key not in self._in_flight_locks:
                self._in_flight_locks[lock_key] = asyncio.Lock()
            return self._in_flight_locks[lock_key]

    async def fetch_historical_daily(
        self,
        latitude: float,
        longitude: float,
        start_date: str,
        end_date: str,
    ) -> Dict[str, Any]:
        """Fetch daily max temperature and precipitation from Open-Meteo with retries and locking."""
        lock_key = f"{round(latitude, 2)}_{round(longitude, 2)}_{start_date}_{end_date}"
        lock = await self._get_lock_for_key(lock_key)

        async with lock:
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "start_date": start_date,
                "end_date": end_date,
                "daily": "temperature_2m_max,precipitation_sum",
                "timezone": "UTC",
            }

            client = await self._get_client()
            last_exception: Optional[Exception] = None
            max_retries = settings.PROVIDER_MAX_RETRIES

            for attempt in range(max_retries):
                try:
                    response = await client.get(
                        settings.OPEN_METEO_ARCHIVE_URL,
                        params=params,
                    )

                    # Upstream error handling
                    if response.status_code == 400:
                        error_detail = "Bad request to weather provider."
                        try:
                            err_json = response.json()
                            error_detail = err_json.get("reason", error_detail)
                        except Exception:
                            pass
                        raise AppException(
                            status_code=400,
                            error="PROVIDER_BAD_REQUEST",
                            message=f"Open-Meteo rejected parameters: {error_detail}",
                        )

                    if response.status_code == 429:
                        if attempt < max_retries - 1:
                            delay = (2 ** attempt) * 0.5 + random.uniform(0.1, 0.3)
                            logger.warning(
                                "Rate limited by Open-Meteo. Backing off for %.2fs (attempt %d/%d)",
                                delay, attempt + 1, max_retries,
                            )
                            await asyncio.sleep(delay)
                            continue
                        raise AppException(
                            status_code=429,
                            error="PROVIDER_RATE_LIMITED",
                            message="Upstream Open-Meteo rate limit exceeded. Please retry shortly.",
                        )

                    if response.status_code in (500, 502, 503, 504):
                        if attempt < max_retries - 1:
                            delay = (2 ** attempt) * 0.5 + random.uniform(0.1, 0.3)
                            logger.warning(
                                "Open-Meteo server error %d. Retrying in %.2fs (attempt %d/%d)",
                                response.status_code, delay, attempt + 1, max_retries,
                            )
                            await asyncio.sleep(delay)
                            continue
                        raise AppException(
                            status_code=502,
                            error="PROVIDER_SERVICE_UNAVAILABLE",
                            message=f"Open-Meteo server returned HTTP {response.status_code}.",
                        )

                    response.raise_for_status()
                    data = response.json()
                    return self._validate_and_normalize_payload(data)

                except (httpx.TimeoutException, httpx.NetworkError) as net_err:
                    last_exception = net_err
                    if attempt < max_retries - 1:
                        delay = (2 ** attempt) * 0.5 + random.uniform(0.1, 0.3)
                        logger.warning(
                            "Network error contacting Open-Meteo (%s). Retrying in %.2fs",
                            str(net_err), delay,
                        )
                        await asyncio.sleep(delay)
                    else:
                        raise AppException(
                            status_code=504,
                            error="PROVIDER_TIMEOUT",
                            message="Timed out communicating with Open-Meteo Historical Archive.",
                        )

            if last_exception:
                raise AppException(
                    status_code=502,
                    error="PROVIDER_COMMUNICATION_ERROR",
                    message=f"Could not reach Open-Meteo provider: {str(last_exception)}",
                )

            raise AppException(
                status_code=500,
                error="PROVIDER_UNKNOWN_ERROR",
                message="Unknown error querying weather provider.",
            )

    def _validate_and_normalize_payload(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """Validate response shape, date order, and sanitize observations."""
        if not isinstance(raw, dict) or "daily" not in raw:
            raise AppException(
                status_code=502,
                error="PROVIDER_PAYLOAD_INVALID",
                message="Missing 'daily' observation container in Open-Meteo response.",
            )

        daily = raw["daily"]
        times = daily.get("time", [])
        temps = daily.get("temperature_2m_max", [])
        precips = daily.get("precipitation_sum", [])

        # Validate array lengths match
        if not (len(times) == len(temps) == len(precips)):
            raise AppException(
                status_code=502,
                error="PROVIDER_PAYLOAD_CORRUPT",
                message=f"Array length mismatch: time={len(times)}, temp={len(temps)}, precip={len(precips)}.",
            )

        # Validate chronological order
        for i in range(len(times) - 1):
            if times[i] >= times[i + 1]:
                raise AppException(
                    status_code=502,
                    error="PROVIDER_PAYLOAD_UNSORTED",
                    message=f"Observation dates are not strictly ascending: {times[i]} followed by {times[i+1]}.",
                )

        normalized_observations: List[Dict[str, Any]] = []
        for d_str, t_val, p_val in zip(times, temps, precips):
            # Sanitize None / NaN to null
            clean_t = None
            if t_val is not None:
                try:
                    f_val = float(t_val)
                    if not (math.isnan(f_val) or math.isinf(f_val)):
                        clean_t = round(f_val, 2)
                except (ValueError, TypeError):
                    clean_t = None

            clean_p = None
            if p_val is not None:
                try:
                    f_val = float(p_val)
                    if not (math.isnan(f_val) or math.isinf(f_val)):
                        clean_p = max(0.0, round(f_val, 2))
                except (ValueError, TypeError):
                    clean_p = None

            normalized_observations.append({
                "date": d_str,
                "temperature_max": clean_t,
                "precipitation": clean_p,
            })

        return {
            "grid_latitude": raw.get("latitude", 0.0),
            "grid_longitude": raw.get("longitude", 0.0),
            "elevation": raw.get("elevation"),
            "timezone": raw.get("timezone", "UTC"),
            "observations": normalized_observations,
        }

    async def close(self) -> None:
        """Close underlying HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()


open_meteo_provider = OpenMeteoProvider()
