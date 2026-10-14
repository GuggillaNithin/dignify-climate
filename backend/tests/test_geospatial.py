"""Comprehensive unit and integration tests for geospatial bounding-box sampling, antimeridian handling, and regional aggregation."""
import pytest
from fastapi.testclient import TestClient

from app.domain.geospatial import (
    BoundingBox,
    GeospatialSampler,
    PointCoordinate,
    RegionalAggregator,
    SampledGridPoint,
)
from app.domain.models import AnnualHazardMetric, BaselineConfig, HazardAnalysisResult
from app.main import app

client = TestClient(app)


# ==============================================================================
# 1. GEOSPATIAL DOMAIN TESTS: COORDINATES & BOUNDS VALIDATION
# ==============================================================================

def test_point_coordinate_validation():
    """Verify coordinate bounds [-90, 90] and [-180, 180]."""
    # Valid coordinates
    p1 = PointCoordinate(latitude=35.6895, longitude=139.6917)
    assert p1.grid_key == "35.69_139.69"

    p2 = PointCoordinate(latitude=-90.0, longitude=-180.0)
    assert p2.latitude == -90.0

    # Invalid latitude
    with pytest.raises(ValueError, match="Latitude 95.0 out of bounds"):
        PointCoordinate(latitude=95.0, longitude=0.0)

    # Invalid longitude
    with pytest.raises(ValueError, match="Longitude -190.0 out of bounds"):
        PointCoordinate(latitude=0.0, longitude=-190.0)


def test_bounding_box_validation_and_oversized_guards():
    """Verify south < north, maximum latitude span (10°), and longitude span (15°)."""
    # Valid box
    box = BoundingBox(south=10.0, north=15.0, west=20.0, east=25.0)
    assert box.latitude_span == 5.0
    assert box.longitude_span == 5.0
    assert not box.crosses_antimeridian

    # South >= North
    with pytest.raises(ValueError, match="South latitude.*must be strictly less than North latitude"):
        BoundingBox(south=20.0, north=10.0, west=0.0, east=5.0)

    # Oversized latitude span (> 10°)
    with pytest.raises(ValueError, match="Latitude span of 12.00° exceeds the maximum limit of 10.0°"):
        BoundingBox(south=0.0, north=12.0, west=0.0, east=5.0)

    # Oversized longitude span (> 15°)
    with pytest.raises(ValueError, match="Longitude span of 20.00° exceeds the maximum limit of 15.0°"):
        BoundingBox(south=0.0, north=5.0, west=0.0, east=20.0)


def test_bounding_box_antimeridian_crossing():
    """Verify bounding box crossing the ±180° antimeridian (e.g. Fiji/Samoa region)."""
    # West = 175.0, East = -175.0 (span = 10.0°)
    box = BoundingBox(south=-20.0, north=-15.0, west=175.0, east=-175.0)
    assert box.crosses_antimeridian
    assert box.longitude_span == 10.0
    assert box.latitude_span == 5.0

    # Sampling across antimeridian
    samples = GeospatialSampler.sample_bounding_box(box, max_points=4)
    assert len(samples) >= 4
    # Check that points span both sides of 180°
    lons = [p.longitude for p in samples]
    assert any(l > 0 for l in lons)
    assert any(l < 0 for l in lons)


def test_geospatial_sampler_bounded_grid_and_cosine_weights():
    """Verify grid sampling adheres to max_points and cosine weights normalize to 1.0."""
    box = BoundingBox(south=30.0, north=34.0, west=130.0, east=134.0)
    samples = GeospatialSampler.sample_bounding_box(box, max_points=9)

    assert 1 <= len(samples) <= 9
    total_norm_weight = sum(p.normalized_weight for p in samples)
    assert pytest.approx(total_norm_weight, abs=0.01) == 1.0

    # Ensure higher latitude points have smaller cosine weights than lower latitude points
    min_lat_point = min(samples, key=lambda p: p.latitude)
    max_lat_point = max(samples, key=lambda p: p.latitude)
    assert min_lat_point.cosine_weight > max_lat_point.cosine_weight


# ==============================================================================
# 2. REGIONAL AGGREGATION & COVERAGE THRESHOLD TESTS
# ==============================================================================

def _make_dummy_hazard_result(hazard_days: int, is_comparable: bool = True) -> HazardAnalysisResult:
    metric = AnnualHazardMetric(
        year=2022,
        total_calendar_days=365,
        valid_observed_days=365 if is_comparable else 200,
        missing_days=0 if is_comparable else 165,
        coverage_pct=100.0 if is_comparable else 54.8,
        is_comparable=is_comparable,
        event_count=2,
        hazard_days=hazard_days,
        primary_metric=hazard_days,
        mean_event_duration=3.0,
        max_event_duration=3,
        cumulative_intensity=15.0,
    )
    return HazardAnalysisResult(
        hazard_type="heatwave",
        threshold_value=32.0,
        threshold_unit="°C",
        threshold_percentile=95.0,
        baseline_config=BaselineConfig(),
        total_series_days=365,
        total_valid_days=365,
        total_missing_days=0,
        overall_coverage_pct=100.0,
        events=[],
        annual_metrics=[metric],
        definitions_summary={"hazard": "heatwave"},
    )


def test_regional_aggregator_cosine_weighted_averaging():
    """Verify regional aggregation applies cosine-latitude spatial weights correctly."""
    # 2 sampled points: p1 (0° latitude, weight ~ 1.0), p2 (60° latitude, weight ~ 0.5)
    p1 = SampledGridPoint(latitude=0.0, longitude=10.0, grid_key="0.00_10.00", cosine_weight=1.0, normalized_weight=0.6667)
    p2 = SampledGridPoint(latitude=60.0, longitude=10.0, grid_key="60.00_10.00", cosine_weight=0.5, normalized_weight=0.3333)

    results = {
        "0.00_10.00": _make_dummy_hazard_result(hazard_days=10),
        "60.00_10.00": _make_dummy_hazard_result(hazard_days=4),
    }

    aggregated = RegionalAggregator.aggregate_points(
        sampled_points=[p1, p2],
        point_hazard_results=results,
        min_spatial_coverage_pct=75.0,
    )

    assert len(aggregated) == 1
    yr2022 = aggregated[0]
    assert yr2022.is_available
    # Expected weighted days: (0.6667 * 10 + 0.3333 * 4) / 1.0 = ~8.0
    assert 7.9 <= yr2022.weighted_hazard_days <= 8.1


def test_regional_aggregator_spatial_coverage_gating():
    """Verify year is marked unavailable if spatial point coverage drops below threshold."""
    # 4 grid points
    points = [
        SampledGridPoint(latitude=10.0, longitude=10.0, grid_key="p1", cosine_weight=1.0, normalized_weight=0.25),
        SampledGridPoint(latitude=10.0, longitude=11.0, grid_key="p2", cosine_weight=1.0, normalized_weight=0.25),
        SampledGridPoint(latitude=11.0, longitude=10.0, grid_key="p3", cosine_weight=1.0, normalized_weight=0.25),
        SampledGridPoint(latitude=11.0, longitude=11.0, grid_key="p4", cosine_weight=1.0, normalized_weight=0.25),
    ]

    # Only 2 out of 4 points have valid data (50% spatial coverage < 75% threshold)
    results = {
        "p1": _make_dummy_hazard_result(hazard_days=10, is_comparable=True),
        "p2": _make_dummy_hazard_result(hazard_days=10, is_comparable=True),
        "p3": _make_dummy_hazard_result(hazard_days=0, is_comparable=False),
        "p4": _make_dummy_hazard_result(hazard_days=0, is_comparable=False),
    }

    aggregated = RegionalAggregator.aggregate_points(
        sampled_points=points,
        point_hazard_results=results,
        min_spatial_coverage_pct=75.0,
    )

    yr2022 = aggregated[0]
    # Should be flagged unavailable rather than quietly biasing the regional mean
    assert not yr2022.is_available
    assert yr2022.weighted_hazard_days is None
    assert "Unavailable: spatial coverage 50.0%" in yr2022.coverage_status


# ==============================================================================
# 3. API INTEGRATION TESTS: /api/v1/analysis & /api/v1/geocoding
# ==============================================================================

def test_api_analysis_point_mode():
    """Verify POST /api/v1/analysis works in point mode."""
    payload = {
        "mode": "point",
        "point": {"latitude": 35.68, "longitude": 139.75},
        "hazard_type": "heatwave",
        "start_date": "2022-06-01",
        "end_date": "2022-09-30",
        "percentile": 90.0,
        "min_consecutive_days": 3,
    }
    res = client.post("/api/v1/analysis", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "point"
    assert data["hazard_type"] == "heatwave"
    assert "Single coordinate represents the nearest ~11 km ERA5" in data["spatial_metadata"]["representation_text"]
    assert len(data["sampled_points"]) == 1
    assert len(data["annual_series"]) >= 1


def test_api_analysis_bounding_box_mode():
    """Verify POST /api/v1/analysis works in bounding-box mode with spatial sampling."""
    payload = {
        "mode": "bounding_box",
        "bounds": {
            "south": 35.5,
            "north": 36.0,
            "west": 139.5,
            "east": 140.0,
        },
        "hazard_type": "heavy_rainfall",
        "start_date": "2022-06-01",
        "end_date": "2022-09-30",
        "percentile": 90.0,
        "sample_density": 4,
    }
    res = client.post("/api/v1/analysis", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "bounding_box"
    assert data["hazard_type"] == "heavy_rainfall"
    assert data["spatial_metadata"]["sample_count"] >= 1
    assert "cosine-latitude spherical area weighting" in data["spatial_metadata"]["representation_text"]
    assert len(data["annual_series"]) >= 1


def test_api_analysis_oversized_box_rejected():
    """Verify bounding box exceeding max latitude span (10°) is rejected with 422."""
    payload = {
        "mode": "bounding_box",
        "bounds": {
            "south": 10.0,
            "north": 25.0,  # 15° span > 10° limit
            "west": 10.0,
            "east": 15.0,
        },
        "hazard_type": "heatwave",
        "start_date": "2022-01-01",
        "end_date": "2022-06-01",
    }
    res = client.post("/api/v1/analysis", json=payload)
    assert res.status_code == 422


def test_api_geocoding_search():
    """Verify GET /api/v1/geocoding/search returns place matches with CC-BY attribution."""
    res = client.get("/api/v1/geocoding/search?q=Tokyo")
    assert res.status_code == 200
    data = res.json()
    assert "results" in data
    assert "Open-Meteo Geocoding API under CC-BY 4.0" in data["attribution"]
    if data["results"]:
        first = data["results"][0]
        assert "latitude" in first
        assert "longitude" in first
