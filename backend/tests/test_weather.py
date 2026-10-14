"""Unit and integration tests for weather ingestion, validation, provider retries, and caching."""
import asyncio
import json
from unittest.mock import AsyncMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.errors import AppException
from app.db.repositories.weather_repo import WeatherRepository
from app.main import app
from app.schemas.weather import WeatherQueryRequest
from app.services.weather_provider import OpenMeteoProvider
from app.services.weather_service import WeatherService

client = TestClient(app)

MOCK_OPEN_METEO_PAYLOAD = {
    "latitude": 35.7,
    "longitude": 139.7,
    "generationtime_ms": 1.25,
    "utc_offset_seconds": 0,
    "timezone": "UTC",
    "timezone_abbreviation": "UTC",
    "elevation": 40.0,
    "daily_units": {
        "time": "iso8601",
        "temperature_2m_max": "°C",
        "precipitation_sum": "mm",
    },
    "daily": {
        "time": ["2023-07-01", "2023-07-02", "2023-07-03"],
        "temperature_2m_max": [31.5, 33.2, None],
        "precipitation_sum": [0.0, 14.5, 2.1],
    },
}


# ==============================================================================
# 1. Validation Tests (Date Bounds, Coordinates, Limits)
# ==============================================================================

def test_query_validation_invalid_latitude():
    """Verify latitude outside [-90, 90] is rejected with 422."""
    res = client.post(
        "/api/v1/weather/query",
        json={
            "latitude": 95.0,
            "longitude": 139.7,
            "start_date": "2020-01-01",
            "end_date": "2020-01-10",
        },
    )
    assert res.status_code == 422
    data = res.json()
    assert data["error"] == "VALIDATION_ERROR"


def test_query_validation_invalid_longitude():
    """Verify longitude outside [-180, 180] is rejected with 422."""
    res = client.post(
        "/api/v1/weather/query",
        json={
            "latitude": 35.7,
            "longitude": 185.0,
            "start_date": "2020-01-01",
            "end_date": "2020-01-10",
        },
    )
    assert res.status_code == 422


def test_query_validation_start_after_end_date():
    """Verify reversed dates (start > end) are rejected with 422."""
    res = client.post(
        "/api/v1/weather/query",
        json={
            "latitude": 35.7,
            "longitude": 139.7,
            "start_date": "2023-01-10",
            "end_date": "2023-01-01",
        },
    )
    assert res.status_code == 422
    data = res.json()
    assert any("start_date" in str(d) for d in data.get("details", []))


def test_query_validation_pre_1940_date():
    """Verify date prior to historical ERA5 archive limit (1940) is rejected."""
    res = client.post(
        "/api/v1/weather/query",
        json={
            "latitude": 35.7,
            "longitude": 139.7,
            "start_date": "1930-01-01",
            "end_date": "1935-01-01",
        },
    )
    assert res.status_code == 422


def test_query_validation_future_date():
    """Verify future date is rejected."""
    res = client.post(
        "/api/v1/weather/query",
        json={
            "latitude": 35.7,
            "longitude": 139.7,
            "start_date": "2020-01-01",
            "end_date": "2099-01-01",
        },
    )
    assert res.status_code == 422


# ==============================================================================
# 2. Open-Meteo Provider Normalization & Error Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_provider_normalizes_valid_payload():
    """Verify provider parses dates, floats, nulls, and grid metadata correctly."""
    def mock_handler(request: httpx.Request):
        return httpx.Response(200, json=MOCK_OPEN_METEO_PAYLOAD)

    transport = httpx.MockTransport(mock_handler)
    mock_client = httpx.AsyncClient(transport=transport)
    provider = OpenMeteoProvider(client=mock_client)

    result = await provider.fetch_historical_daily(
        latitude=35.68,
        longitude=139.76,
        start_date="2023-07-01",
        end_date="2023-07-03",
    )

    assert result["grid_latitude"] == 35.7
    assert result["grid_longitude"] == 139.7
    assert len(result["observations"]) == 3

    obs = result["observations"]
    assert obs[0] == {"date": "2023-07-01", "temperature_max": 31.5, "precipitation": 0.0}
    assert obs[1] == {"date": "2023-07-02", "temperature_max": 33.2, "precipitation": 14.5}
    # None value representation:
    assert obs[2]["date"] == "2023-07-03"
    assert obs[2]["temperature_max"] is None
    assert obs[2]["precipitation"] == 2.1

    await provider.close()


@pytest.mark.asyncio
async def test_provider_rejects_corrupted_length_mismatch():
    """Verify provider raises AppException when time and values array lengths mismatch."""
    corrupted_payload = {
        "daily": {
            "time": ["2023-07-01", "2023-07-02"],
            "temperature_2m_max": [31.5],  # Length mismatch: 1 vs 2
            "precipitation_sum": [0.0, 5.0],
        }
    }

    def mock_handler(request: httpx.Request):
        return httpx.Response(200, json=corrupted_payload)

    transport = httpx.MockTransport(mock_handler)
    mock_client = httpx.AsyncClient(transport=transport)
    provider = OpenMeteoProvider(client=mock_client)

    with pytest.raises(AppException) as exc_info:
        await provider.fetch_historical_daily(35.7, 139.7, "2023-07-01", "2023-07-02")
    assert exc_info.value.error == "PROVIDER_PAYLOAD_CORRUPT"

    await provider.close()


@pytest.mark.asyncio
async def test_provider_rejects_unsorted_dates():
    """Verify provider raises AppException when dates are not chronologically ascending."""
    unsorted_payload = {
        "daily": {
            "time": ["2023-07-02", "2023-07-01"],  # Out of order
            "temperature_2m_max": [31.5, 30.0],
            "precipitation_sum": [0.0, 5.0],
        }
    }

    def mock_handler(request: httpx.Request):
        return httpx.Response(200, json=unsorted_payload)

    transport = httpx.MockTransport(mock_handler)
    mock_client = httpx.AsyncClient(transport=transport)
    provider = OpenMeteoProvider(client=mock_client)

    with pytest.raises(AppException) as exc_info:
        await provider.fetch_historical_daily(35.7, 139.7, "2023-07-01", "2023-07-02")
    assert exc_info.value.error == "PROVIDER_PAYLOAD_UNSORTED"

    await provider.close()


@pytest.mark.asyncio
async def test_provider_bounded_retry_on_rate_limit():
    """Verify provider retries on 429 and succeeds when second request returns 200."""
    call_count = 0

    def mock_handler(request: httpx.Request):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return httpx.Response(429, json={"error": True, "reason": "Hourly limit"})
        return httpx.Response(200, json=MOCK_OPEN_METEO_PAYLOAD)

    transport = httpx.MockTransport(mock_handler)
    mock_client = httpx.AsyncClient(transport=transport)
    provider = OpenMeteoProvider(client=mock_client)

    with patch("asyncio.sleep", new_callable=AsyncMock):
        result = await provider.fetch_historical_daily(35.7, 139.7, "2023-07-01", "2023-07-03")

    assert call_count == 2
    assert len(result["observations"]) == 3

    await provider.close()


@pytest.mark.asyncio
async def test_provider_handles_upstream_400_bad_request():
    """Verify provider maps upstream 400 into structured AppException."""
    def mock_handler(request: httpx.Request):
        return httpx.Response(400, json={"error": True, "reason": "Latitude out of bounds"})

    transport = httpx.MockTransport(mock_handler)
    mock_client = httpx.AsyncClient(transport=transport)
    provider = OpenMeteoProvider(client=mock_client)

    with pytest.raises(AppException) as exc_info:
        await provider.fetch_historical_daily(35.7, 139.7, "2023-07-01", "2023-07-03")
    assert exc_info.value.status_code == 400
    assert exc_info.value.error == "PROVIDER_BAD_REQUEST"

    await provider.close()


# ==============================================================================
# 3. Weather Service & Caching Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_weather_service_caching_and_provenance():
    """Verify initial fetch is cached, and subsequent request is served from cache without provider call."""
    provider_calls = 0

    def mock_handler(request: httpx.Request):
        nonlocal provider_calls
        provider_calls += 1
        return httpx.Response(200, json=MOCK_OPEN_METEO_PAYLOAD)

    transport = httpx.MockTransport(mock_handler)
    mock_client = httpx.AsyncClient(transport=transport)
    test_provider = OpenMeteoProvider(client=mock_client)
    test_repo = WeatherRepository()
    service = WeatherService(provider=test_provider, repo=test_repo)

    # 1. First query: cache miss -> provider fetched
    res1 = await service.get_weather_series(
        latitude=35.6895,
        longitude=139.6917,
        start_date="2023-07-01",
        end_date="2023-07-03",
    )

    assert provider_calls == 1
    assert res1.metadata.cached is False
    assert res1.metadata.cache_source == "upstream_fetched"
    assert res1.metadata.total_days == 3
    assert res1.metadata.valid_temperature_days == 2
    assert res1.metadata.missing_temperature_days == 1
    assert res1.metadata.attribution == "Weather data by Open-Meteo.com under CC-BY 4.0"

    # 2. Second query: identical range -> served from cache
    res2 = await service.get_weather_series(
        latitude=35.6895,
        longitude=139.6917,
        start_date="2023-07-01",
        end_date="2023-07-03",
    )

    assert provider_calls == 1  # Provider was NOT called again
    assert res2.metadata.cached is True
    assert res2.metadata.cache_source in ("mongodb", "in_memory")
    assert len(res2.daily) == 3

    await test_provider.close()


@pytest.mark.asyncio
async def test_weather_service_partial_range_fetch():
    """Verify partial cache hit only queries Open-Meteo for the missing sub-range."""
    test_repo = WeatherRepository()
    grid_key = "35.70_139.70"

    # Pre-seed cache with dates July 1 and July 2
    await test_repo.save_observations(
        grid_key=grid_key,
        observations=[
            {"date": "2023-07-01", "temperature_max": 30.0, "precipitation": 0.0},
            {"date": "2023-07-02", "temperature_max": 31.0, "precipitation": 0.0},
        ],
        grid_latitude=35.7,
        grid_longitude=139.7,
    )

    queried_ranges = []

    def mock_handler(request: httpx.Request):
        url_params = str(request.url.query)
        queried_ranges.append(url_params)
        # Return July 3 to July 4 for missing interval
        return httpx.Response(
            200,
            json={
                "latitude": 35.7,
                "longitude": 139.7,
                "daily": {
                    "time": ["2023-07-03", "2023-07-04"],
                    "temperature_2m_max": [32.0, 33.0],
                    "precipitation_sum": [5.0, 0.0],
                },
            },
        )

    transport = httpx.MockTransport(mock_handler)
    mock_client = httpx.AsyncClient(transport=transport)
    test_provider = OpenMeteoProvider(client=mock_client)
    service = WeatherService(provider=test_provider, repo=test_repo)

    result = await service.get_weather_series(
        latitude=35.70,
        longitude=139.70,
        start_date="2023-07-01",
        end_date="2023-07-04",
    )

    # Provider should only have been asked for 2023-07-03 to 2023-07-04
    assert len(queried_ranges) == 1
    assert "start_date=2023-07-03" in queried_ranges[0]
    assert "end_date=2023-07-04" in queried_ranges[0]

    # Merged result contains all 4 consecutive days in order
    assert len(result.daily) == 4
    dates = [o.date for o in result.daily]
    assert dates == ["2023-07-01", "2023-07-02", "2023-07-03", "2023-07-04"]

    await test_provider.close()


# ==============================================================================
# 4. End-to-End FastAPI Route Integration Tests
# ==============================================================================

def test_api_weather_post_endpoint_success():
    """Verify POST /api/v1/weather/query returns 200 with full schema."""
    with patch(
        "app.services.weather_provider.open_meteo_provider.fetch_historical_daily",
        new_callable=AsyncMock,
    ) as mock_fetch:
        mock_fetch.return_value = {
            "grid_latitude": 35.7,
            "grid_longitude": 139.7,
            "elevation": 40.0,
            "timezone": "UTC",
            "observations": [
                {"date": "2023-07-01", "temperature_max": 31.5, "precipitation": 0.0},
                {"date": "2023-07-02", "temperature_max": 33.2, "precipitation": 12.0},
            ],
        }

        res = client.post(
            "/api/v1/weather/query",
            json={
                "latitude": 35.6895,
                "longitude": 139.6917,
                "start_date": "2023-07-01",
                "end_date": "2023-07-02",
            },
        )

        assert res.status_code == 200
        data = res.json()

        # Check response structure
        assert data["latitude"] == 35.6895
        assert data["longitude"] == 139.6917
        assert data["temperature_unit"] == "°C"
        assert data["precipitation_unit"] == "mm"
        assert len(data["daily"]) == 2

        # Check metadata & provenance
        meta = data["metadata"]
        assert meta["source"] == "Open-Meteo Historical Weather API"
        assert meta["dataset"] == "ECMWF ERA5 / ERA5-Land Reanalysis"
        assert meta["attribution"] == "Weather data by Open-Meteo.com under CC-BY 4.0"
        assert meta["spatial_resolution"] == "~0.1° (~11 km)"
        assert meta["total_days"] == 2
        assert meta["valid_temperature_days"] == 2
        assert meta["missing_temperature_days"] == 0


def test_api_weather_get_endpoint_success():
    """Verify GET /api/v1/weather returns 200 with query parameters."""
    with patch(
        "app.services.weather_provider.open_meteo_provider.fetch_historical_daily",
        new_callable=AsyncMock,
    ) as mock_fetch:
        mock_fetch.return_value = {
            "grid_latitude": 40.7,
            "grid_longitude": -74.0,
            "elevation": 10.0,
            "timezone": "UTC",
            "observations": [
                {"date": "2022-08-01", "temperature_max": 28.5, "precipitation": 1.2},
            ],
        }

        res = client.get(
            "/api/v1/weather?latitude=40.7128&longitude=-74.0060&start_date=2022-08-01&end_date=2022-08-01"
        )

        assert res.status_code == 200
        data = res.json()
        assert data["latitude"] == 40.7128
        assert data["longitude"] == -74.0060
        assert len(data["daily"]) == 1
        assert data["daily"][0]["date"] == "2022-08-01"
