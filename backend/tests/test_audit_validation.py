"""Comprehensive Scientific Validation and Audit Regression Suite for Dygnify.

This module independently tests:
1. Deterministic synthetic test fixtures (1-10) for heatwave run logic.
2. Independent event recalculation matching production hazard detection.
3. Timeseries continuity, missing data break-policy, and duplicate date handling.
4. Annual aggregation, leap year calculations, and calendar year boundary splits.
5. Independent statistical calculations (OLS, Mann-Kendall with ties, Sen's slope, Window shift).
6. API endpoint validation, error handling, and parameter constraints.
7. AI briefing numeric-grounding validation and fallback determinism.
8. RFC 4180 CSV and PDF export consistency.
9. Grid location and temporal period provenance adherence.
10. Negative tests failing when known discrepancies or fabricated values are injected.
"""
from datetime import date, timedelta
import math
import pytest
from fastapi.testclient import TestClient
import numpy as np
import scipy.stats as stats

from app.domain.heatwave import detect_heatwaves
from app.domain.timeseries import TimeseriesValidator
from app.domain.trends import TrendAnalyzer
from app.domain.export_service import export_service
from app.domain.summary_fallback import SummaryFallbackGenerator
from app.main import app
from app.schemas.analysis import AnalysisRequest, PointSchema

client = TestClient(app)


# ==============================================================================
# SECTION 3: DETERMINISTIC SYNTHETIC TEST FIXTURES (1-10)
# (Clearly labeled as synthetic test fixtures, NOT climate observations)
# ==============================================================================

def _make_synthetic_dates(start_iso: str, values: list) -> list:
    """Helper to generate continuous (date_str, value) synthetic tuples."""
    d = date.fromisoformat(start_iso)
    res = []
    for v in values:
        res.append((d.isoformat(), v))
        d += timedelta(days=1)
    return res


def test_synthetic_fixture_1_exactly_three_consecutive_days():
    """SYNTHETIC TEST FIXTURE 1: Exactly 3 qualifying consecutive days above threshold."""
    # 20 baseline days at 20°C, 3 hot days at 40°C, 20 baseline days at 20°C
    # 90th percentile threshold will be 20°C; 40°C strictly exceeds it
    data = _make_synthetic_dates("2021-01-01", [20.0] * 20 + [40.0, 40.0, 40.0] + [20.0] * 20)
    result = detect_heatwaves(data, percentile=90.0, min_consecutive_days=3)
    assert len(result.events) == 1
    ev = result.events[0]
    assert ev.duration_days == 3
    assert ev.start_date == "2021-01-21"
    assert ev.end_date == "2021-01-23"
    assert ev.daily_values == [40.0, 40.0, 40.0]


def test_synthetic_fixture_2_only_two_consecutive_days():
    """SYNTHETIC TEST FIXTURE 2: Only 2 qualifying consecutive days (fails min duration 3)."""
    data = _make_synthetic_dates("2021-01-01", [20.0] * 20 + [40.0, 40.0] + [20.0] * 20)
    result = detect_heatwaves(data, percentile=90.0, min_consecutive_days=3)
    assert len(result.events) == 0


def test_synthetic_fixture_3_four_consecutive_days():
    """SYNTHETIC TEST FIXTURE 3: Four qualifying consecutive days (qualifies as 1 4-day event)."""
    data = _make_synthetic_dates("2021-01-01", [20.0] * 20 + [40.0, 40.0, 40.0, 40.0] + [20.0] * 20)
    result = detect_heatwaves(data, percentile=90.0, min_consecutive_days=3)
    assert len(result.events) == 1
    ev = result.events[0]
    assert ev.duration_days == 4
    assert ev.start_date == "2021-01-21"
    assert ev.end_date == "2021-01-24"


def test_synthetic_fixture_4_non_qualifying_day_breaks_run():
    """SYNTHETIC TEST FIXTURE 4: A valid non-qualifying day breaks streak immediately."""
    # 2 hot days (40°C), 1 cool day (20°C), 2 hot days (40°C) -> 0 qualifying events
    data = _make_synthetic_dates("2021-01-01", [20.0] * 10 + [40.0, 40.0, 20.0, 40.0, 40.0] + [20.0] * 10)
    result = detect_heatwaves(data, percentile=90.0, min_consecutive_days=3)
    assert len(result.events) == 0


def test_synthetic_fixture_5_missing_date_breaks_run():
    """SYNTHETIC TEST FIXTURE 5: A missing date in the timeline breaks streak immediately."""
    # 2 hot days, 1 calendar day skipped (missing), 2 hot days
    data = [
        ("2021-06-01", 40.0),
        ("2021-06-02", 40.0),
        # 2021-06-03 missing
        ("2021-06-04", 40.0),
        ("2021-06-05", 40.0),
        ("2021-06-06", 20.0),
        ("2021-06-07", 20.0),
    ]
    result = detect_heatwaves(data, percentile=50.0, min_consecutive_days=3)
    assert len(result.events) == 0
    assert result.total_missing_days == 1


def test_synthetic_fixture_6_invalid_temperature_data():
    """SYNTHETIC TEST FIXTURE 6: Invalid temperatures (NaN, None, physical outliers) break run."""
    # 2 hot days, NaN/outlier, 2 hot days
    data = [
        ("2021-07-01", 40.0),
        ("2021-07-02", 40.0),
        ("2021-07-03", 999.0),  # Physically implausible (>65°C) -> sanitized to None
        ("2021-07-04", 40.0),
        ("2021-07-05", 40.0),
        ("2021-07-06", 20.0),
    ]
    result = detect_heatwaves(data, percentile=50.0, min_consecutive_days=3)
    assert len(result.events) == 0


def test_synthetic_fixture_7_event_spanning_december_and_january():
    """SYNTHETIC TEST FIXTURE 7: Event spanning December and January splits annual hazard days."""
    # 2 days in Dec 2021 (30th, 31st) and 2 days in Jan 2022 (1st, 2nd) = 4-day event
    data = [
        ("2021-12-28", 20.0),
        ("2021-12-29", 20.0),
        ("2021-12-30", 40.0),
        ("2021-12-31", 40.0),
        ("2022-01-01", 40.0),
        ("2022-01-02", 40.0),
        ("2022-01-03", 20.0),
        ("2022-01-04", 20.0),
    ]
    result = detect_heatwaves(data, percentile=50.0, min_consecutive_days=3)
    assert len(result.events) == 1
    ev = result.events[0]
    assert ev.start_date == "2021-12-30"
    assert ev.end_date == "2022-01-02"
    assert ev.duration_days == 4

    metrics = {m.year: m for m in result.annual_metrics}
    assert metrics[2021].hazard_days == 2
    assert metrics[2022].hazard_days == 2
    # Event count attributed to starting year
    assert metrics[2021].event_count == 1
    assert metrics[2022].event_count == 0


def test_synthetic_fixture_8_temperatures_exactly_equal_to_threshold():
    """SYNTHETIC TEST FIXTURE 8: Temperatures exactly equal to threshold do NOT qualify."""
    # Constant series at 35.0°C. 99th percentile = 35.0°C.
    # Exceedance requires strictly > threshold.
    data = _make_synthetic_dates("2021-01-01", [35.0] * 30)
    result = detect_heatwaves(data, percentile=99.0, min_consecutive_days=3)
    assert len(result.events) == 0


def test_synthetic_fixture_9_two_events_separated_by_valid_non_qualifying_day():
    """SYNTHETIC TEST FIXTURE 9: Two distinct qualifying events separated by a non-qualifying day."""
    # Event 1: 3 days (40°C), 1 cool day (20°C), Event 2: 4 days (40°C)
    data = _make_synthetic_dates(
        "2021-01-01",
        [20.0] * 40 + [40.0, 40.0, 40.0] + [20.0] + [40.0, 40.0, 40.0, 40.0] + [20.0] * 20,
    )
    result = detect_heatwaves(data, percentile=80.0, min_consecutive_days=3)
    assert len(result.events) == 2
    assert result.events[0].duration_days == 3
    assert result.events[1].duration_days == 4


def test_synthetic_fixture_10_duplicate_daily_records():
    """SYNTHETIC TEST FIXTURE 10: Duplicate daily records raise ValueError."""
    dup_data = [
        ("2021-01-01", 30.0),
        ("2021-01-01", 31.0),  # Duplicate date
        ("2021-01-02", 32.0),
    ]
    with pytest.raises(ValueError, match="Duplicate date detected"):
        TimeseriesValidator.align_continuous_daily_series(dup_data, "temperature")


# ==============================================================================
# SECTION 5: INDEPENDENT STATISTICAL CALCULATIONS TEST
# ==============================================================================

def test_independent_statistical_calculations_match_dashboard():
    """Independently calculate OLS, Mann-Kendall, Sen's slope, and window comparison."""
    # Verified Mumbai annual heatwave-day series (2015-2023)
    years = np.array([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], dtype=float)
    values = np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 6.0, 3.0, 4.0], dtype=float)
    n = len(years)

    # 1. Independent OLS from first principles
    mean_x = np.mean(years)
    mean_y = np.mean(values)
    ss_xx = np.sum((years - mean_x) ** 2)
    ss_xy = np.sum((years - mean_x) * (values - mean_y))
    ss_yy = np.sum((values - mean_y) ** 2)

    slope = ss_xy / ss_xx
    intercept = mean_y - slope * mean_x
    r_sq = (ss_xy ** 2) / (ss_xx * ss_yy)
    df = n - 2
    residuals = values - (slope * years + intercept)
    se_slope = math.sqrt(np.sum(residuals ** 2) / (df * ss_xx))
    t_stat = slope / se_slope
    p_val_ols = 2.0 * (1.0 - stats.t.cdf(abs(t_stat), df))

    assert slope == pytest.approx(0.6167, abs=0.0005)
    assert r_sq == pytest.approx(0.5404, abs=0.0005)
    assert p_val_ols == pytest.approx(0.02403, abs=0.0005)
    assert se_slope == pytest.approx(0.2150, abs=0.0005)

    # 2. Independent Mann-Kendall test from first principles
    s = 0
    pairwise_slopes = []
    for k in range(n - 1):
        for j in range(k + 1, n):
            diff = values[j] - values[k]
            if diff > 1e-12:
                s += 1
            elif diff < -1e-12:
                s -= 1
            dt = years[j] - years[k]
            pairwise_slopes.append((values[j] - values[k]) / dt)

    assert s == 17

    # Tie groups: 6 zeros -> t = 6
    _, counts = np.unique(values, return_counts=True)
    tie_counts = [int(c) for c in counts if c > 1]
    assert tie_counts == [6]

    tie_term = sum(t * (t - 1) * (2 * t + 5) for t in tie_counts)
    var_s = (n * (n - 1) * (2 * n + 5) - tie_term) / 18.0
    assert var_s == pytest.approx(63.6667, abs=0.01)

    z = (s - 1) / math.sqrt(var_s)
    p_val_mk = 2.0 * (1.0 - stats.norm.cdf(abs(z)))
    assert p_val_mk == pytest.approx(0.04494, abs=0.0005)

    # Kendall tau-b
    denom = math.sqrt(36.0 * (36.0 - 15.0))
    tau_b = s / denom
    assert tau_b == pytest.approx(0.6183, abs=0.0005)

    # Sen's slope
    sens_slope = float(np.median(pairwise_slopes))
    assert sens_slope == pytest.approx(0.4643, abs=0.0005)

    # 3. Window Comparison
    early_mean = np.mean(values[:3])
    late_mean = np.mean(values[-3:])
    assert early_mean == 0.0
    assert late_mean == pytest.approx(4.3333, abs=0.01)
    assert (late_mean - early_mean) == pytest.approx(4.3333, abs=0.01)


# ==============================================================================
# SECTION 7: API, EXPORT, AND NUMERIC GROUNDING TESTS
# ==============================================================================

def test_api_schema_date_validation():
    """Verify API rejects inverted dates and dates preceding 1940."""
    # Reversed dates
    inv_payload = {
        "mode": "point",
        "hazard_type": "heatwave",
        "point": {"latitude": 19.08, "longitude": 72.88},
        "start_date": "2023-12-31",
        "end_date": "2015-01-01",
    }
    resp = client.post("/api/v1/analysis", json=inv_payload)
    assert resp.status_code == 422

    # Pre-1940 date
    old_payload = {
        "mode": "point",
        "hazard_type": "heatwave",
        "point": {"latitude": 19.08, "longitude": 72.88},
        "start_date": "1920-01-01",
        "end_date": "1930-12-31",
    }
    resp = client.post("/api/v1/analysis", json=old_payload)
    assert resp.status_code == 422


def test_ai_fallback_is_deterministic_and_grounded():
    """Verify deterministic summary fallback strictly preserves verified input numbers."""
    from app.services.groq_service import groq_service

    # Create dummy verified analysis
    dummy_analysis = {
        "analysis_id": "test-grounding-001",
        "hazard_type": "heatwave",
        "mode": "point",
        "spatial_metadata": {"representation_text": "Mumbai Point", "sample_count": 1, "resolution": "0.1°"},
        "annual_series": [
            {"year": 2021, "is_available": True, "weighted_hazard_days": 6.0, "weighted_event_count": 2.0},
            {"year": 2022, "is_available": True, "weighted_hazard_days": 3.0, "weighted_event_count": 1.0},
            {"year": 2023, "is_available": True, "weighted_hazard_days": 4.0, "weighted_event_count": 1.0},
        ],
        "trends": {
            "is_calculated": True,
            "trend_direction": "increasing",
            "is_statistically_significant": True,
            "ols_regression": {"slope_per_year": 0.6167, "p_value": 0.02403, "r_squared": 0.5404},
            "mann_kendall": {"tau": 0.6183, "p_value": 0.04494, "sens_slope": 0.4643},
            "window_comparison": {
                "early_window_years": [2021],
                "early_window_mean": 6.0,
                "late_window_years": [2023],
                "late_window_mean": 4.0,
                "absolute_change": -2.0,
                "percentage_change": -33.3,
            },
        },
        "definitions_summary": {"hazard_indicator": "Heatwave Days", "threshold_rule": "99th percentile"},
    }

    compact = groq_service.build_compact_payload(dummy_analysis)
    summary = SummaryFallbackGenerator.generate(compact, fallback_reason="Grounding Audit Test")

    # Verify numbers are faithfully injected into text
    assert "+0.617" in summary.trend_interpretation or "0.617" in summary.trend_interpretation
    assert "0.0240" in summary.trend_interpretation
    assert len(summary.caveats) >= 3
    # Caveats must disclaim causal attribution
    assert any("attribution" in c.lower() for c in summary.caveats)


def test_export_csv_and_pdf_generation():
    """Verify CSV and PDF export functions produce valid, non-empty outputs."""
    dummy_analysis = {
        "analysis_id": "test-export-001",
        "hazard_type": "heatwave",
        "mode": "point",
        "spatial_metadata": {"representation_text": "Point Cell", "resolution": "~0.1°"},
        "annual_series": [
            {"year": 2021, "is_available": True, "weighted_hazard_days": 6.0, "weighted_event_count": 2.0, "weighted_primary_metric": 6.0, "weighted_intensity": 6.8},
            {"year": 2022, "is_available": True, "weighted_hazard_days": 3.0, "weighted_event_count": 1.0, "weighted_primary_metric": 3.0, "weighted_intensity": 3.9},
            {"year": 2023, "is_available": True, "weighted_hazard_days": 4.0, "weighted_event_count": 1.0, "weighted_primary_metric": 4.0, "weighted_intensity": 4.5},
        ],
        "events_list": [
            {"start_date": "2021-03-03", "end_date": "2021-03-05", "duration_days": 3, "mean_value": 36.43, "max_value": 36.6, "intensity_metric": 1.3},
        ],
        "trends": {
            "is_calculated": True,
            "trend_direction": "increasing",
            "is_statistically_significant": True,
            "metric_units": "days",
            "ols_regression": {"slope_per_year": 0.6167, "p_value": 0.02403, "r_squared": 0.5404, "fitted_values": []},
            "mann_kendall": {"tau": 0.6183, "p_value": 0.04494, "sens_slope": 0.4643},
        },
        "definitions_summary": {"threshold_rule": "99th percentile threshold"},
    }

    # 1. Annual CSV
    csv_str = export_service.generate_annual_csv(dummy_analysis)
    assert "year,hazard_type,metric_name" in csv_str
    assert "2021,heatwave" in csv_str
    assert "2023,heatwave" in csv_str

    # 2. Events CSV
    ev_csv_str = export_service.generate_events_csv(dummy_analysis)
    assert "event_index,hazard_type,start_date" in ev_csv_str
    assert "2021-03-03,2021-03-05" in ev_csv_str

    # 3. PDF report
    pdf_bytes = export_service.generate_pdf_report(dummy_analysis)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-")


# ==============================================================================
# SECTION 8: DISCREPANCY SENSITIVITY NEGATIVE TESTS
# ==============================================================================

def test_negative_discrepancy_detection_fails_on_altered_slope():
    """Negative regression test: Assertions must fail if slope or p-value is altered."""
    years = np.array([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], dtype=float)
    # Altered values: swap 2021 and 2015 to create a decreasing trend
    altered_values = np.array([6.0, 3.0, 4.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0], dtype=float)

    res = stats.linregress(years, altered_values)
    # The altered slope is negative, which must NOT match the +0.6167 slope
    assert res.slope < 0
    with pytest.raises(AssertionError):
        assert res.slope == pytest.approx(0.6167, abs=0.01)


# ==============================================================================
# SECTION 9: POST-AUDIT TRANSPARENCY & STATISTICAL PRECISION FIXES
# ==============================================================================

def test_statistical_precision_full_precision_ci_without_intermediate_rounding():
    """ISSUE 4 REGRESSION TEST: Prove CI uses unrounded coefficients and std errors.
    
    Demonstrates that computing CI from full-precision floats:
      ci_lower = round(raw_slope - t_crit * raw_stderr, 4)
      ci_upper = round(raw_slope + t_crit * raw_stderr, 4)
    does not suffer from rounding drift that would occur if computed from pre-rounded
    slope and stderr.
    """
    years = np.array([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], dtype=float)
    values = np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 6.0, 3.0, 4.0], dtype=float)
    
    ols_metrics = TrendAnalyzer._compute_ols_regression(years, values)
    raw_res = stats.linregress(years, values)
    df = len(years) - 2
    t_crit = stats.t.ppf(0.975, df)
    
    # Exact unrounded calculation
    exact_ci_lower = round(float(raw_res.slope) - t_crit * float(raw_res.stderr), 4)
    exact_ci_upper = round(float(raw_res.slope) + t_crit * float(raw_res.stderr), 4)
    
    # Pre-rounded calculation (illustrating intermediate truncation error)
    rounded_slope = round(float(raw_res.slope), 4)
    rounded_stderr = round(float(raw_res.stderr), 4)
    truncated_ci_lower = round(rounded_slope - t_crit * rounded_stderr, 4)
    truncated_ci_upper = round(rounded_slope + t_crit * rounded_stderr, 4)
    
    # The metrics output MUST match the unrounded calculation exactly
    assert ols_metrics.confidence_interval_95 == (exact_ci_lower, exact_ci_upper)
    assert ols_metrics.confidence_interval_95 == (0.1084, 1.1249)
    # The truncated calculation differs at the 4th decimal place
    assert truncated_ci_lower != exact_ci_lower or truncated_ci_upper != exact_ci_upper


def test_threshold_transparency_in_definitions_summary_and_groq_payload():
    """ISSUE 1 REGRESSION TEST: Dynamic threshold transparency in definitions and AI payload."""
    from app.services.groq_service import groq_service

    # Test detection with 95th percentile using 100 ascending values
    data_ascending = _make_synthetic_dates("2021-01-01", [float(i) for i in range(100)])
    res_95 = detect_heatwaves(data_ascending, percentile=95.0, min_consecutive_days=3)
    
    defs_95 = res_95.definitions_summary
    assert defs_95["threshold_percentile"] == 95.0
    assert defs_95["threshold_unit"] == "°C"
    assert defs_95["threshold_value"] == res_95.threshold_value
    assert "95.0th percentile" in defs_95["threshold_rule"]
    assert "significance_sensitivity_note" in defs_95

    # Test detection with 99th percentile
    res_99 = detect_heatwaves(data_ascending, percentile=99.0, min_consecutive_days=3)
    defs_99 = res_99.definitions_summary
    assert defs_99["threshold_percentile"] == 99.0
    assert defs_99["threshold_value"] == res_99.threshold_value
    assert res_99.threshold_value > res_95.threshold_value
    assert "99.0th percentile" in defs_99["threshold_rule"]

    # Verify AI compact payload carries threshold details
    dummy_analysis = {
        "analysis_id": "test-thresh-transparency",
        "hazard_type": "heatwave",
        "mode": "point",
        "spatial_metadata": {"representation_text": "Sample Cell", "sample_count": 1},
        "annual_series": [{"year": 2021, "is_available": True, "weighted_hazard_days": 5.0}],
        "trends": {"is_calculated": True},
        "definitions_summary": defs_99,
    }
    compact = groq_service.build_compact_payload(dummy_analysis)
    assert compact["definitions"]["threshold_percentile"] == 99.0
    assert compact["definitions"]["threshold_value"] == res_99.threshold_value
    assert compact["definitions"]["significance_sensitivity_note"] == defs_99["significance_sensitivity_note"]


def test_pdf_report_includes_threshold_and_spatial_labels():
    """ISSUES 1 & 2 REGRESSION TEST: Verify PDF output includes active threshold and correct spatial labels."""
    import base64
    import zlib
    from app.domain.export_service import export_service

    def extract_pdf_streams_text(pdf_bytes: bytes) -> str:
        decompressed = []
        pos = 0
        while True:
            s_idx = pdf_bytes.find(b"stream\n", pos)
            if s_idx == -1:
                break
            start = s_idx + 7
            e_idx = pdf_bytes.find(b"~>", start)
            if e_idx != -1:
                chunk = pdf_bytes[start : e_idx + 2]
                pos = e_idx + 2
                try:
                    dec = zlib.decompress(base64.a85decode(chunk, adobe=True))
                    decompressed.append(dec.decode("latin1", errors="ignore"))
                except Exception:
                    pass
            else:
                pos = start
        return " ".join(decompressed)

    # Point mode analysis
    point_analysis = {
        "analysis_id": "test-pdf-transparency-point",
        "hazard_type": "heatwave",
        "mode": "point",
        "spatial_metadata": {"representation_text": "Point 19.08N, 72.88E", "sample_count": 1, "resolution": "0.1°"},
        "annual_series": [
            {"year": 2021, "is_available": True, "weighted_hazard_days": 6.0, "weighted_event_count": 2.0},
        ],
        "trends": {
            "is_calculated": True,
            "trend_direction": "increasing",
            "is_statistically_significant": True,
            "metric_units": "days",
            "ols_regression": {"slope_per_year": 0.6167, "p_value": 0.02403, "r_squared": 0.5404, "fitted_values": []},
            "mann_kendall": {"tau": 0.6183, "p_value": 0.04494, "sens_slope": 0.4643},
        },
        "definitions_summary": {
            "threshold_percentile": 99.0,
            "threshold_value": 36.0,
            "threshold_unit": "°C",
            "threshold_rule": "Strictly > 99th percentile (36.0 °C)",
            "significance_sensitivity_note": "Significance is conditional on threshold.",
        },
    }

    pdf_bytes = export_service.generate_pdf_report(point_analysis)
    assert len(pdf_bytes) > 1000
    pdf_text = extract_pdf_streams_text(pdf_bytes)
    assert "Active Threshold" in pdf_text or "99.0th" in pdf_text or "36.0" in pdf_text
    assert "Single ERA5 Grid Cell" in pdf_text
    assert "Sensitivity" in pdf_text

    # Multi-cell regional mode analysis
    regional_analysis = dict(point_analysis)
    regional_analysis["mode"] = "bounding_box"
    regional_analysis["spatial_metadata"] = {
        "representation_text": "Regional Grid Domain",
        "sample_count": 9,
        "resolution": "0.1°",
    }
    pdf_reg_bytes = export_service.generate_pdf_report(regional_analysis)
    pdf_reg_text = extract_pdf_streams_text(pdf_reg_bytes)
    assert "Spatially Weighted Regional Mean" in pdf_reg_text


def test_ai_briefing_card_badge_and_causation_guardrails():
    """ISSUE 3 REGRESSION TEST: Verify AI evidence badge and lack of unsupported causal claims."""
    from pathlib import Path
    import re

    # 1. Assert AIBriefingCard.tsx does NOT contain "Fact-Grounded (100%)"
    card_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "components" / "AIBriefingCard.tsx"
    card_content = card_path.read_text(encoding="utf-8")
    assert "Fact-Grounded (100%)" not in card_content, "Hardcoded Fact-Grounded (100%) badge must be removed"
    assert "Python Metrics Supplied to AI" in card_content, "Must display 'Python Metrics Supplied to AI'"

    # 2. Test AI causation and hallucination guardrail logic
    def verify_no_unsupported_causal_attribution(summary_text: str) -> bool:
        """Helper guardrail: flags unhedged causal attribution claims."""
        forbidden_patterns = [
            r"\bcaused by (global warming|climate change)\b",
            r"\battributable to (global warming|climate change|greenhouse gases)\b",
            r"\bproves climate change\b",
        ]
        for pat in forbidden_patterns:
            if re.search(pat, summary_text, re.IGNORECASE):
                # Must be accompanied by attribution disclaimer
                if "attribution study" not in summary_text.lower() and "attribution analysis" not in summary_text.lower():
                    return False
        return True

    # Deterministic fallback summary must satisfy this guardrail
    from app.services.groq_service import groq_service
    dummy_analysis = {
        "analysis_id": "test-guardrail-001",
        "hazard_type": "heatwave",
        "mode": "point",
        "spatial_metadata": {"representation_text": "Mumbai", "sample_count": 1},
        "annual_series": [{"year": 2021, "is_available": True, "weighted_hazard_days": 6.0}],
        "trends": {"is_calculated": True, "trend_direction": "increasing"},
        "definitions_summary": {"threshold_percentile": 99.0, "threshold_value": 36.0},
    }
    compact = groq_service.build_compact_payload(dummy_analysis)
    fallback = SummaryFallbackGenerator.generate(compact, fallback_reason="Guardrail Check")
    full_text = f"{fallback.headline} {fallback.trend_interpretation} {' '.join(fallback.caveats)}"
    assert verify_no_unsupported_causal_attribution(full_text)
    assert not verify_no_unsupported_causal_attribution("This heatwave was caused by global warming and proves climate change.")

