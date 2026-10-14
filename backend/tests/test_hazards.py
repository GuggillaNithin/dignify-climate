"""Deterministic unit tests for climate hazard domain logic: Heatwave, Drought Proxy, Heavy Rainfall."""
from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient

from app.domain.heatwave import detect_heatwaves
from app.domain.drought import detect_drought_proxy
from app.domain.rainfall import detect_heavy_rainfall
from app.domain.methodology import get_methodology_registry
from app.domain.timeseries import TimeseriesValidator
from app.main import app

client = TestClient(app)


# ==============================================================================
# Helper generators for deterministic synthetic test fixtures
# ==============================================================================

def make_daily_series(start_date: str, values: list) -> list:
    """Generate (YYYY-MM-DD, value) tuples for a continuous daily sequence."""
    d = date.fromisoformat(start_date)
    series = []
    for val in values:
        series.append((d.isoformat(), val))
        d += timedelta(days=1)
    return series


# ==============================================================================
# 1. HEATWAVE TESTS
# ==============================================================================

def test_heatwave_exact_consecutive_run_rule():
    """Verify >=3 consecutive days qualify, while 2 days do not."""
    # 40 base days at 20.0, 2 hot days at 35.0 (no event), 10 base days, 3 hot days at 35.0 (event), 10 base days
    # Total 65 days; 90th percentile is 20.0; hot days at 35.0 strictly exceed threshold
    temps = [20.0] * 40 + [35.0, 35.0] + [20.0] * 10 + [35.0, 35.0, 35.0] + [20.0] * 10
    series = make_daily_series("2020-06-01", temps)

    result = detect_heatwaves(series, percentile=90.0)

    # Only the 3-day sequence qualifies as a heatwave event
    assert len(result.events) == 1
    event = result.events[0]
    assert event.duration_days == 3
    assert event.daily_values == [35.0, 35.0, 35.0]
    assert event.mean_value == 35.0
    assert event.max_value == 35.0
    assert event.intensity_metric == round((35.0 - result.threshold_value) * 3, 2)


def test_heatwave_threshold_tie_does_not_qualify():
    """Verify that a value exactly equal to threshold does NOT qualify (strictly >)."""
    # Constant series of 30.0 °C. The 99th percentile will be 30.0 °C.
    # Because 30.0 is not strictly > 30.0, zero events are triggered.
    tie_series = [("2020-01-01", 30.0), ("2020-01-02", 30.0), ("2020-01-03", 30.0)]
    result = detect_heatwaves(tie_series, percentile=99.0)
    assert len(result.events) == 0


def test_heatwave_missing_date_breaks_run():
    """Verify missing calendar date breaks streak and is never bridged."""
    # 2 hot days, 1 MISSING date (temporal gap), 2 hot days
    # Even though there are 4 hot days total, the gap prevents forming a 3-consecutive-day event.
    series = [
        ("2020-07-01", 35.0),
        ("2020-07-02", 35.0),
        # 2020-07-03 is MISSING
        ("2020-07-04", 35.0),
        ("2020-07-05", 35.0),
        ("2020-07-06", 20.0),
        ("2020-07-07", 20.0),
    ]
    result = detect_heatwaves(series, percentile=50.0)
    assert len(result.events) == 0
    assert result.total_missing_days >= 1


def test_heatwave_nan_value_breaks_run():
    """Verify NaN / None in daily values breaks run immediately."""
    # 2 hot days, None, 2 hot days
    series = [
        ("2020-07-01", 35.0),
        ("2020-07-02", 35.0),
        ("2020-07-03", None),
        ("2020-07-04", 35.0),
        ("2020-07-05", 35.0),
        ("2020-07-06", 20.0),
    ]
    result = detect_heatwaves(series, percentile=50.0)
    assert len(result.events) == 0


def test_heatwave_crossing_calendar_year_boundary():
    """Verify event crossing Dec 31 / Jan 1 attributes event days to respective years."""
    # 2 days in 2020 (Dec 30, Dec 31) + 2 days in 2021 (Jan 1, Jan 2) = 4-day event
    crossing_series = [
        ("2020-12-28", 20.0),
        ("2020-12-29", 20.0),
        ("2020-12-30", 38.0),
        ("2020-12-31", 38.0),
        ("2021-01-01", 38.0),
        ("2021-01-02", 38.0),
        ("2021-01-03", 20.0),
        ("2021-01-04", 20.0),
    ]
    result = detect_heatwaves(crossing_series, percentile=50.0)

    assert len(result.events) == 1
    ev = result.events[0]
    assert ev.start_date == "2020-12-30"
    assert ev.end_date == "2021-01-02"
    assert ev.duration_days == 4

    # Check annual metrics breakdown
    metrics_by_year = {m.year: m for m in result.annual_metrics}
    assert 2020 in metrics_by_year
    assert 2021 in metrics_by_year

    # 2 days fell in 2020, 2 days fell in 2021
    assert metrics_by_year[2020].hazard_days == 2
    assert metrics_by_year[2021].hazard_days == 2
    # Event count is attributed to start year (2020)
    assert metrics_by_year[2020].event_count == 1
    assert metrics_by_year[2021].event_count == 0


def test_heatwave_leap_day_handling():
    """Verify Feb 29 leap day in 2020 is handled seamlessly."""
    # 2020 is a leap year (366 days)
    # 10 base days at 20.0, then 4 hot days across Feb 27–March 01 at 35.0
    temps = [20.0] * 10 + [35.0, 35.0, 35.0, 35.0] + [20.0] * 5
    series = make_daily_series("2020-02-17", temps)

    result = detect_heatwaves(series, percentile=60.0)
    assert len(result.events) == 1
    ev = result.events[0]
    assert ev.duration_days == 4
    assert ev.start_date == "2020-02-27"
    assert ev.end_date == "2020-03-01"


# ==============================================================================
# 2. METEOROLOGICAL DROUGHT PROXY TESTS
# ==============================================================================

def test_drought_proxy_detection():
    """Verify 90-day rolling deficit detects prolonged rainfall deficits."""
    # 120 wet days (10.0 mm/day = 900 mm in 90-day window)
    # followed by 100 dry days (0.0 mm/day = 90-day accumulation drops to 0 mm)
    # followed by 80 wet days (10.0 mm/day)
    precip = [10.0] * 120 + [0.0] * 100 + [10.0] * 80
    series = make_daily_series("2021-01-01", precip)

    result = detect_drought_proxy(
        series,
        window_days=90,
        deficit_threshold=0.50,
        min_consecutive_days=14,
    )

    assert result.hazard_type == "drought"
    assert "Rolling Precipitation Deficit Proxy" in result.definitions_summary["indicator_name"]
    assert len(result.events) >= 1
    ev = result.events[0]
    assert ev.duration_days >= 14
    assert ev.mean_value >= 0.50


def test_drought_proxy_missing_data_breaks_window():
    """Verify window with >10% missing days becomes invalid and breaks drought streak."""
    # Window of 90 days with 15 missing days (>10%)
    precip = [0.0] * 40 + [None] * 15 + [0.0] * 40
    series = make_daily_series("2021-01-01", precip)

    result = detect_drought_proxy(
        series,
        window_days=90,
        deficit_threshold=0.50,
        min_consecutive_days=14,
    )
    # Because of missing data in the window, no sustained 14-day event can be certified
    assert len(result.events) == 0


def test_drought_proxy_hyper_arid_guard():
    """Verify hyper-arid expected precipitation (< 5.0 mm) is guarded against zero division."""
    precip = [0.0] * 180
    series = make_daily_series("2021-01-01", precip)

    result = detect_drought_proxy(series, window_days=90)
    assert result.hazard_type == "drought"
    assert len(result.events) == 0


# ==============================================================================
# 3. HEAVY RAINFALL TESTS
# ==============================================================================

def test_heavy_rainfall_wet_day_cutoff():
    """Verify only wet days (>= 1.0 mm) enter the percentile calculation."""
    # 50 dry days (0.0 mm), 10 trace days (0.5 mm), 10 wet days (10.0 to 100.0 mm)
    precip = [0.0] * 50 + [0.5] * 10 + [10.0, 15.0, 20.0, 25.0, 30.0, 40.0, 50.0, 60.0, 80.0, 100.0]
    series = make_daily_series("2022-01-01", precip)

    result = detect_heavy_rainfall(series, percentile=90.0, wet_day_cutoff=1.0)
    # Threshold should be calculated strictly on wet days (>= 1.0 mm)
    assert result.threshold_value >= 60.0


def test_heavy_rainfall_storm_consecutive_grouping():
    """Verify consecutive heavy rain days are grouped into a multi-day storm event."""
    # 30 base days at 2.0 mm, 2 storm days (60.0, 80.0 mm), 20 base days at 2.0 mm, 1 storm day (75.0 mm), 10 base days
    # Wet day threshold will be calculated on [2.0]*50 + [60, 80, 75].
    # At 85th percentile, threshold is ~2.0 mm; 60.0, 80.0, and 75.0 strictly exceed it.
    precip = [2.0] * 30 + [60.0, 80.0] + [2.0] * 20 + [75.0] + [2.0] * 10
    series = make_daily_series("2022-05-01", precip)

    result = detect_heavy_rainfall(series, percentile=85.0, wet_day_cutoff=1.0)

    # [60.0, 80.0] is grouped as 1 storm of 2 days, and [75.0] is 1 storm of 1 day
    assert len(result.events) >= 1
    multi_day_storms = [ev for ev in result.events if ev.duration_days == 2]
    assert len(multi_day_storms) == 1
    storm = multi_day_storms[0]
    assert storm.duration_days == 2
    assert storm.intensity_metric == 140.0  # 60.0 + 80.0
    assert storm.max_value == 80.0


def test_heavy_rainfall_rx1day_annual_metric():
    """Verify Rx1day (annual maximum 1-day precipitation) is accurately recorded."""
    # Year 2021 with max 65.0 mm; Year 2022 with max 95.0 mm
    series_2021 = make_daily_series("2021-06-01", [10.0, 65.0, 5.0, 20.0])
    series_2022 = make_daily_series("2022-06-01", [15.0, 95.0, 10.0, 30.0])
    series = series_2021 + series_2022

    result = detect_heavy_rainfall(series, percentile=50.0, wet_day_cutoff=1.0)
    metrics_by_year = {m.year: m for m in result.annual_metrics}

    assert metrics_by_year[2021].attributes["rx1day_max_daily_mm"] == 65.0
    assert metrics_by_year[2022].attributes["rx1day_max_daily_mm"] == 95.0


def test_heavy_rainfall_threshold_tie_does_not_qualify():
    """Verify that a precipitation value exactly equal to threshold does not qualify (strictly >)."""
    # 50 days at 20.0 mm. 95th percentile is 20.0 mm.
    # Because 20.0 is not strictly > 20.0, zero events are triggered.
    series = [("2022-01-01", 20.0)] * 50
    # Re-index dates
    daily = make_daily_series("2022-01-01", [20.0] * 50)
    result = detect_heavy_rainfall(daily, percentile=95.0, wet_day_cutoff=1.0)
    assert len(result.events) == 0


def test_heavy_rainfall_missing_date_and_nan_breaks_streak():
    """Verify temporal gaps and NaNs break multi-day storm groupings."""
    # 30 base days (2.0 mm), 2 storm days (60.0 mm), 1 missing date, 2 storm days (60.0 mm)
    # The missing date should separate them into two distinct 2-day events rather than one 4-day event.
    base = make_daily_series("2022-01-01", [2.0] * 30)
    part1 = [("2022-01-31", 60.0), ("2022-02-01", 60.0)]
    # 2022-02-02 is missing
    part2 = [("2022-02-03", 60.0), ("2022-02-04", 60.0)]
    part3 = make_daily_series("2022-02-05", [2.0] * 20)

    series = base + part1 + part2 + part3
    result = detect_heavy_rainfall(series, percentile=80.0, wet_day_cutoff=1.0)

    # Should detect 2 separate 2-day storm events, not one 4-day event
    storms = [ev for ev in result.events if ev.duration_days == 2]
    assert len(storms) == 2
    assert storms[0].end_date == "2022-02-01"
    assert storms[1].start_date == "2022-02-03"


def test_heavy_rainfall_crossing_year_boundary():
    """Verify multi-day storm crossing Dec 31 to Jan 1 correctly attributes days to respective years."""
    base = make_daily_series("2021-12-01", [2.0] * 29)
    # Dec 30, Dec 31, Jan 01, Jan 02 = 4-day storm
    storm_dates = [
        ("2021-12-30", 65.0),
        ("2021-12-31", 70.0),
        ("2022-01-01", 80.0),
        ("2022-01-02", 75.0),
    ]
    post = make_daily_series("2022-01-03", [2.0] * 30)
    series = base + storm_dates + post

    result = detect_heavy_rainfall(series, percentile=85.0, wet_day_cutoff=1.0)
    assert len(result.events) == 1
    ev = result.events[0]
    assert ev.duration_days == 4
    assert ev.start_date == "2021-12-30"
    assert ev.end_date == "2022-01-02"

    metrics_by_year = {m.year: m for m in result.annual_metrics}
    assert metrics_by_year[2021].hazard_days == 2
    assert metrics_by_year[2022].hazard_days == 2
    assert metrics_by_year[2021].event_count == 1
    assert metrics_by_year[2022].event_count == 0


def test_short_series_and_boundary_guards():
    """Verify short series and zero-observation series fail gracefully or return zero events."""
    with pytest.raises(ValueError, match="Input time series contains no data points"):
        detect_heatwaves([])

    with pytest.raises(ValueError, match="Input time series contains no data points"):
        detect_drought_proxy([])

    with pytest.raises(ValueError, match="Input time series contains no data points"):
        detect_heavy_rainfall([])

    # Short 2-day series for heatwave (below min_consecutive_days=3)
    short_temp = [("2022-01-01", 35.0), ("2022-01-02", 36.0)]
    hw_res = detect_heatwaves(short_temp, percentile=50.0, min_consecutive_days=3)
    assert len(hw_res.events) == 0

    # Short 10-day series for drought (below 90-day window)
    short_drought = make_daily_series("2022-01-01", [5.0] * 10)
    dr_res = detect_drought_proxy(short_drought, window_days=90)
    assert len(dr_res.events) == 0


def test_timeseries_chronological_uniqueness_and_outliers():
    """Verify duplicate dates raise error and physically impossible values are sanitized."""
    # Duplicate date detection
    dup_series = [("2022-01-01", 25.0), ("2022-01-01", 26.0)]
    with pytest.raises(ValueError, match="Duplicate date detected"):
        TimeseriesValidator.align_continuous_daily_series(dup_series, "temperature")

    # Physical outlier sanitization: -95°C and 120°C are rejected, 42°C is valid
    outlier_series = [
        ("2022-01-01", 120.0),
        ("2022-01-02", -95.0),
        ("2022-01-03", 42.0),
    ]
    aligned = TimeseriesValidator.align_continuous_daily_series(outlier_series, "temperature")
    assert aligned[0].value is None
    assert not aligned[0].is_valid
    assert aligned[1].value is None
    assert not aligned[1].is_valid
    assert aligned[2].value == 42.0
    assert aligned[2].is_valid


# ==============================================================================
# 4. METHODOLOGY API ENDPOINT TEST
# ==============================================================================

def test_methodology_registry_structure():
    """Verify methodology registry returns all required definitions, baselines, and caveats."""
    data = get_methodology_registry()
    assert "version" in data
    assert "hazards" in data
    assert "heatwave" in data["hazards"]
    assert "drought" in data["hazards"]
    assert "heavy_rainfall" in data["hazards"]
    assert "data_source" in data
    assert "missing_data_governance" in data

    # Verify drought disclaimer explicitly mentions not claiming agricultural drought
    drought_info = data["hazards"]["drought"]
    assert "Rolling Precipitation Deficit Proxy" in drought_info["indicator_name"]
    assert "agricultural" in drought_info["scientific_disclaimer"]


def test_api_methodology_endpoint():
    """Verify GET /api/v1/methodology returns 200 with complete registry."""
    res = client.get("/api/v1/methodology")
    assert res.status_code == 200
    data = res.json()
    assert "hazards" in data
    assert data["hazards"]["heatwave"]["units"] == "°C"
    assert data["hazards"]["heavy_rainfall"]["units"] == "mm"
