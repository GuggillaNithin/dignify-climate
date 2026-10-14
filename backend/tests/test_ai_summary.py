"""Comprehensive unit and integration tests for AI-generated climate explanations and deterministic fallback."""
import json
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.repositories.analysis_repo import analysis_repo
from app.domain.summary_fallback import SummaryFallbackGenerator
from app.main import app
from app.schemas.summary import AISummaryRequest, AISummaryResponse, AISummarySchema
from app.services.groq_service import GroqService, groq_service

client = TestClient(app)

SAMPLE_ANALYSIS_DICT = {
    "analysis_id": "test_anl_heatwave_001",
    "mode": "point",
    "hazard_type": "heatwave",
    "spatial_metadata": {
        "mode": "point",
        "representation_text": "Single ERA5 grid cell (lat: 28.61, lon: 77.23)",
        "sample_count": 1,
        "area_weighting_method": "Single cell unit weight",
        "point": {"latitude": 28.61, "longitude": 77.23},
        "resolution": "~0.1° (~11 km) ERA5 grid cell",
    },
    "sampled_points": [
        {
            "latitude": 28.61,
            "longitude": 77.23,
            "grid_key": "28.61_77.23",
            "cosine_weight": 0.8779,
            "normalized_weight": 1.0,
        }
    ],
    "annual_series": [
        {
            "year": 1980 + i,
            "is_available": True,
            "spatial_coverage_pct": 100.0,
            "valid_points_count": 1,
            "total_points_count": 1,
            "weighted_hazard_days": 5.0 + (i * 0.3),
            "weighted_event_count": 1.0 + (i * 0.05),
            "weighted_primary_metric": 41.5 + (i * 0.04),
            "weighted_intensity": 2.1,
            "coverage_status": "certified",
        }
        for i in range(40)
    ],
    "trends": {
        "is_calculated": True,
        "total_years": 40,
        "valid_years_count": 40,
        "excluded_years": [],
        "primary_metric_name": "heatwave_days",
        "metric_units": "days",
        "ols_regression": {
            "slope_per_year": 0.3012,
            "intercept": 4.95,
            "r_squared": 0.684,
            "p_value": 0.00012,
            "stderr": 0.032,
            "confidence_interval_95": [0.236, 0.366],
            "sample_count": 40,
            "fitted_values": [],
        },
        "mann_kendall": {
            "tau": 0.642,
            "s_statistic": 501,
            "variance_s": 7320.0,
            "z_statistic": 5.84,
            "p_value": 0.00001,
            "sens_slope": 0.298,
            "sample_size": 40,
            "tied_groups_count": 2,
        },
        "window_comparison": {
            "early_window_years": [1980, 1981, 1982, 1983, 1984],
            "early_window_mean": 5.6,
            "late_window_years": [2015, 2016, 2017, 2018, 2019],
            "late_window_mean": 16.7,
            "absolute_change": 11.1,
            "percentage_change": 198.2,
            "percentage_change_status": "calculated",
        },
        "rolling_series": [],
        "trend_direction": "increasing",
        "is_statistically_significant": True,
        "magnitude_summary": "+0.301 days/year (p=0.0001)",
        "scientific_caution": "Autocorrelation may affect p-values.",
    },
    "definitions_summary": {
        "hazard_type": "heatwave",
        "threshold_rule": "95th percentile of daily max temperature",
        "run_length_rule": "3 or more consecutive days",
    },
    "created_at": "2026-10-11T00:00:00Z",
}


# ==============================================================================
# 1. SUMMARY FALLBACK GENERATOR TESTS
# ==============================================================================

def test_summary_fallback_generator_statistically_significant():
    """Verify deterministic fallback produces rigorous structured summary for significant trend."""
    service = GroqService()
    payload = service.build_compact_payload(SAMPLE_ANALYSIS_DICT)

    fallback = SummaryFallbackGenerator.generate(payload, fallback_reason="Test fallback")

    # Check Pydantic validation
    assert isinstance(fallback, AISummarySchema)
    assert len(fallback.headline) > 10
    assert "statistically significant" in fallback.headline.lower() or "0.30" in fallback.headline
    assert len(fallback.observed_patterns) >= 2
    assert "40 valid observation years" in fallback.observed_patterns[0]
    assert "0.3012" in fallback.trend_interpretation or "0.301" in fallback.trend_interpretation
    assert len(fallback.caveats) >= 3
    assert any("autocorrelation" in c.lower() for c in fallback.caveats)
    assert "40 valid years out of 40 requested" in fallback.data_quality_note


def test_summary_fallback_generator_non_significant():
    """Verify deterministic fallback correctly flags non-significant trend."""
    service = GroqService()
    mod_analysis = json.loads(json.dumps(SAMPLE_ANALYSIS_DICT))
    mod_analysis["trends"]["is_statistically_significant"] = False
    mod_analysis["trends"]["ols_regression"]["p_value"] = 0.421
    mod_analysis["trends"]["mann_kendall"]["p_value"] = 0.380
    mod_analysis["trends"]["trend_direction"] = "stable"

    payload = service.build_compact_payload(mod_analysis)
    fallback = SummaryFallbackGenerator.generate(payload)

    assert "no statistically significant" in fallback.headline.lower()
    assert "does not reject the null hypothesis" in fallback.trend_interpretation


def test_summary_fallback_generator_uncalculated_trends():
    """Verify fallback handles cases where trends could not be calculated."""
    service = GroqService()
    mod_analysis = json.loads(json.dumps(SAMPLE_ANALYSIS_DICT))
    mod_analysis["trends"] = {
        "is_calculated": False,
        "diagnostic_message": "Fewer than 5 valid annual observations.",
        "excluded_years": [],
    }

    payload = service.build_compact_payload(mod_analysis)
    fallback = SummaryFallbackGenerator.generate(payload)

    assert "Analysis of historical" in fallback.headline
    assert "Trend statistics were not evaluated" in fallback.trend_interpretation


# ==============================================================================
# 2. GROQ SERVICE TESTS (MOCKING UPSTREAM GROQ RESPONSES)
# ==============================================================================

@pytest.mark.asyncio
async def test_groq_service_valid_response():
    """Verify successful Groq API response returns validated AISummaryResponse."""
    valid_groq_output = {
        "headline": "New Delhi Region: Verified increase in annual heatwave exposure.",
        "observed_patterns": [
            "Over 40 observation years (1980–2019), heatwave days expanded steadily.",
            "Historical peak occurred in 2019 with 16.7 heatwave days.",
        ],
        "trend_interpretation": "OLS regression confirms +0.301 days/year increase with Mann–Kendall tau of 0.642 (p < 0.001).",
        "caveats": [
            "Persistence in annual meteorological series may bias significance tests.",
            "Attribution to anthropogenic climate forcings requires multi-model detection analysis.",
        ],
        "data_quality_note": "Temporal completeness is 100% across 40 years from ERA5 reanalysis.",
    }

    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(valid_groq_output),
                }
            }
        ]
    }

    service = GroqService()
    with patch("app.core.config.settings.GROQ_API_KEY", "mock-groq-api-key"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        res = await service.generate_summary(SAMPLE_ANALYSIS_DICT, force_refresh=True)

        assert isinstance(res, AISummaryResponse)
        assert res.provenance.source == "groq"
        assert res.provenance.is_fallback is False
        assert res.summary.headline == valid_groq_output["headline"]
        assert len(res.summary.observed_patterns) == 2
        assert res.provenance.cached is False


@pytest.mark.asyncio
async def test_groq_service_malformed_json_fallback():
    """Verify invalid JSON from LLM triggers deterministic fallback gracefully."""
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": "Not valid JSON at all: Error 500 occurred in generation",
                }
            }
        ]
    }

    service = GroqService()
    with patch("app.core.config.settings.GROQ_API_KEY", "mock-groq-api-key"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        res = await service.generate_summary(SAMPLE_ANALYSIS_DICT, force_refresh=True)

        assert isinstance(res, AISummaryResponse)
        assert res.provenance.source == "deterministic_fallback"
        assert res.provenance.is_fallback is True
        assert "Invalid response schema returned by LLM" in res.provenance.fallback_reason
        assert len(res.summary.observed_patterns) >= 1


@pytest.mark.asyncio
async def test_groq_service_rate_limit_429_fallback():
    """Verify HTTP 429 rate limit triggers deterministic fallback without throwing 500."""
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 429
    mock_response.request = MagicMock()

    service = GroqService()
    with patch("app.core.config.settings.GROQ_API_KEY", "mock-groq-api-key"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        res = await service.generate_summary(SAMPLE_ANALYSIS_DICT, force_refresh=True)

        assert isinstance(res, AISummaryResponse)
        assert res.provenance.source == "deterministic_fallback"
        assert res.provenance.is_fallback is True
        assert "429" in res.provenance.fallback_reason


@pytest.mark.asyncio
async def test_groq_service_timeout_fallback():
    """Verify HTTP timeout triggers deterministic fallback gracefully."""
    service = GroqService()
    with patch("app.core.config.settings.GROQ_API_KEY", "mock-groq-api-key"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = httpx.TimeoutException("Connection timed out")

        res = await service.generate_summary(SAMPLE_ANALYSIS_DICT, force_refresh=True)

        assert isinstance(res, AISummaryResponse)
        assert res.provenance.source == "deterministic_fallback"
        assert res.provenance.is_fallback is True
        assert "timed out" in res.provenance.fallback_reason


@pytest.mark.asyncio
async def test_groq_service_missing_api_key():
    """Verify empty GROQ_API_KEY immediately uses deterministic fallback without network calls."""
    service = GroqService()
    with patch("app.core.config.settings.GROQ_API_KEY", ""), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:

        res = await service.generate_summary(SAMPLE_ANALYSIS_DICT, force_refresh=True)

        assert mock_post.call_count == 0
        assert res.provenance.source == "deterministic_fallback"
        assert res.provenance.is_fallback is True
        assert "not configured" in res.provenance.fallback_reason


@pytest.mark.asyncio
async def test_groq_service_cache_hit():
    """Verify second call with identical analysis payload hits cache."""
    service = GroqService()
    with patch("app.core.config.settings.GROQ_API_KEY", ""):
        # First call stores in cache
        res1 = await service.generate_summary(SAMPLE_ANALYSIS_DICT, force_refresh=True)
        assert res1.provenance.cached is False

        # Second call should retrieve from cache
        res2 = await service.generate_summary(SAMPLE_ANALYSIS_DICT, force_refresh=False)
        assert res2.provenance.cached is True
        assert res2.provenance.analysis_hash == res1.provenance.analysis_hash
        assert res2.summary.headline == res1.summary.headline


# ==============================================================================
# 3. FASTAPI ROUTE INTEGRATION TESTS
# ==============================================================================

def test_api_route_generate_summary_from_payload():
    """Verify POST /api/v1/analysis/summary with inline payload returns 200."""
    response = client.post(
        "/api/v1/analysis/summary?force_refresh=true",
        json={"analysis_result": SAMPLE_ANALYSIS_DICT},
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "provenance" in data
    assert "headline" in data["summary"]
    assert "observed_patterns" in data["summary"]
    assert "caveats" in data["summary"]
    assert "source" in data["provenance"]


def test_api_route_generate_summary_missing_fields_returns_400():
    """Verify POST /api/v1/analysis/summary without ID or payload returns 400."""
    response = client.post(
        "/api/v1/analysis/summary",
        json={},
    )
    assert response.status_code == 400


def test_api_route_generate_summary_nonexistent_id_returns_404():
    """Verify POST /api/v1/analysis/{analysis_id}/summary for unknown ID returns 404."""
    response = client.post(
        "/api/v1/analysis/nonexistent_id_9999/summary",
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_api_route_generate_summary_for_existing_analysis():
    """Verify POST /api/v1/analysis/{analysis_id}/summary succeeds when analysis is in repo."""
    test_id = "test_analysis_persisted_777"
    await analysis_repo.save_analysis(
        analysis_id=test_id,
        cache_key="cache_key_777",
        data={"response_data": SAMPLE_ANALYSIS_DICT},
    )

    response = client.post(f"/api/v1/analysis/{test_id}/summary?force_refresh=true")
    assert response.status_code == 200
    data = response.json()
    assert data["provenance"]["analysis_id"] == test_id
    assert "headline" in data["summary"]
