"""Comprehensive unit and integration tests for CSV and server-side PDF exports.

Tests formula injection defense, column ordering, ReportLab PDF generation,
and FastAPI export endpoints.
"""
import csv
import io
import pytest
from fastapi.testclient import TestClient

from app.db.repositories.analysis_repo import analysis_repo
from app.domain.export_service import export_service, sanitize_cell_value
from app.main import app
from app.schemas.summary import AISummarySchema

client = TestClient(app)

SAMPLE_EXPORT_ANALYSIS = {
    "analysis_id": "test_export_anl_001",
    "mode": "point",
    "hazard_type": "heatwave",
    "spatial_metadata": {
        "mode": "point",
        "representation_text": "Single ERA5 grid cell (lat: 35.68, lon: 139.69)",
        "sample_count": 1,
        "area_weighting_method": "Single cell unit weight",
        "point": {"latitude": 35.68, "longitude": 139.69},
        "resolution": "~0.1° (~11 km) ERA5 grid cell",
    },
    "sampled_points": [
        {
            "latitude": 35.68,
            "longitude": 139.69,
            "grid_key": "35.68_139.69",
            "cosine_weight": 0.812,
            "normalized_weight": 1.0,
        }
    ],
    "annual_series": [
        {
            "year": 1990 + i,
            "is_available": True,
            "spatial_coverage_pct": 100.0,
            "valid_points_count": 1,
            "total_points_count": 1,
            "weighted_hazard_days": 4.0 + (i * 0.25),
            "weighted_event_count": 1.0 + (i * 0.05),
            "weighted_primary_metric": 38.5 + (i * 0.03),
            "weighted_intensity": 1.8,
            "coverage_status": "certified",
        }
        for i in range(25)
    ],
    "trends": {
        "is_calculated": True,
        "total_years": 25,
        "valid_years_count": 25,
        "excluded_years": [],
        "primary_metric_name": "heatwave_days",
        "metric_units": "days",
        "ols_regression": {
            "slope_per_year": 0.254,
            "intercept": 3.98,
            "r_squared": 0.712,
            "p_value": 0.0003,
            "stderr": 0.031,
            "confidence_interval_95": [0.189, 0.319],
            "sample_count": 25,
            "fitted_values": [],
        },
        "mann_kendall": {
            "tau": 0.612,
            "s_statistic": 183,
            "variance_s": 1720.0,
            "z_statistic": 4.38,
            "p_value": 0.00001,
            "sens_slope": 0.250,
            "sample_size": 25,
            "tied_groups_count": 0,
        },
        "window_comparison": {
            "early_window_years": [1990, 1991, 1992, 1993, 1994],
            "early_window_mean": 4.5,
            "late_window_years": [2010, 2011, 2012, 2013, 2014],
            "late_window_mean": 9.5,
            "absolute_change": 5.0,
            "percentage_change": 111.1,
            "percentage_change_status": "calculated",
        },
        "rolling_series": [],
        "trend_direction": "increasing",
        "is_statistically_significant": True,
        "magnitude_summary": "+0.254 days/year (p=0.0003)",
        "scientific_caution": "Serial autocorrelation may inflate significance.",
        "methodology_version": "v1.2-scientific",
    },
    "events_list": [
        {
            "start_date": "1995-07-12",
            "end_date": "1995-07-16",
            "duration_days": 5,
            "mean_value": 37.8,
            "max_value": 39.2,
            "intensity_metric": 2.4,
        },
        {
            "start_date": "2012-08-01",
            "end_date": "2012-08-07",
            "duration_days": 7,
            "mean_value": 38.4,
            "max_value": 40.1,
            "intensity_metric": 3.1,
        },
    ],
    "definitions_summary": {
        "hazard_type": "heatwave",
        "hazard_indicator": "Heatwave Days",
        "threshold_rule": "95th percentile of daily max temperature",
        "run_length_rule": ">= 3 consecutive days strictly exceeding threshold",
    },
    "created_at": "2026-10-11T12:00:00Z",
}


# ==============================================================================
# 1. UNIT TESTS: SPREADSHEET FORMULA INJECTION DEFENSE
# ==============================================================================

def test_formula_injection_defense():
    """Verify that dangerous spreadsheet formula prefixes are safely escaped with a single quote."""
    # Equals formula
    assert sanitize_cell_value("=SUM(A1:B10)") == "'=SUM(A1:B10)"
    # Plus formula
    assert sanitize_cell_value("+cmd|' /C calc'!A0") == "'+cmd|' /C calc'!A0"
    # Minus formula
    assert sanitize_cell_value("-1+2*cmd|' /C calc'!A0") == "'-1+2*cmd|' /C calc'!A0"
    # At sign formula
    assert sanitize_cell_value("@HYPERLINK(\"http://evil.com\")") == "'@HYPERLINK(\"http://evil.com\")"
    # Tab / Carriage return prefixes
    assert sanitize_cell_value("\tcmd") == "'\tcmd"
    assert sanitize_cell_value("\rcmd") == "'\rcmd"

    # Benign numbers are preserved
    assert sanitize_cell_value(2024) == 2024
    assert sanitize_cell_value(15.75) == 15.75
    assert sanitize_cell_value(True) is True
    assert sanitize_cell_value(None) == ""

    # Normal text without dangerous prefix
    assert sanitize_cell_value("Tokyo, Japan") == "Tokyo, Japan"


# ==============================================================================
# 2. UNIT TESTS: CSV EXPORT STRUCTURE & COMPLIANCE
# ==============================================================================

def test_annual_csv_generation():
    """Verify annual CSV contains RFC 4180 headers, stable column order, and accurate row counts."""
    csv_text = export_service.generate_annual_csv(SAMPLE_EXPORT_ANALYSIS)
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)

    # Header row
    headers = rows[0]
    expected_headers = [
        "year",
        "hazard_type",
        "metric_name",
        "weighted_hazard_days",
        "weighted_event_count",
        "weighted_primary_metric",
        "weighted_intensity",
        "units",
        "spatial_coverage_pct",
        "coverage_status",
        "valid_points_count",
        "total_points_count",
        "mode",
        "region_description",
        "data_source",
        "resolution",
        "methodology_version",
        "analysis_id",
    ]
    assert headers == expected_headers

    # Data rows: 25 years
    assert len(rows) == 26  # 1 header + 25 data rows

    # First data row
    first_row = rows[1]
    assert first_row[0] == "1990"
    assert first_row[1] == "heatwave"
    assert first_row[2] == "heatwave_days"
    assert first_row[17] == "test_export_anl_001"


def test_annual_csv_with_malicious_user_input():
    """Verify formula injection in region description or custom names is properly escaped in CSV."""
    malicious_analysis = dict(SAMPLE_EXPORT_ANALYSIS)
    malicious_analysis["spatial_metadata"] = {
        "representation_text": "=cmd|' /C calc'!A0",
        "resolution": "+SYSTEM('format')",
    }

    csv_text = export_service.generate_annual_csv(malicious_analysis)
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)

    first_row = rows[1]
    # Column 13 is region_description, Column 15 is resolution
    assert first_row[13] == "'=cmd|' /C calc'!A0"
    assert first_row[15] == "'+SYSTEM('format')"


def test_events_csv_generation():
    """Verify event-level CSV contains all qualifying extreme events and correct headers."""
    csv_text = export_service.generate_events_csv(SAMPLE_EXPORT_ANALYSIS)
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)

    headers = rows[0]
    assert "event_index" in headers
    assert "start_date" in headers
    assert "duration_days" in headers
    assert "intensity_metric" in headers

    # 2 events in SAMPLE_EXPORT_ANALYSIS
    assert len(rows) == 3  # 1 header + 2 events
    assert rows[1][0] == "1"
    assert rows[1][2] == "1995-07-12"
    assert rows[1][4] == "5"


# ==============================================================================
# 3. UNIT TESTS: REPORTLAB SERVER-SIDE PDF REPORT
# ==============================================================================

def test_pdf_report_generation_with_ai_summary():
    """Verify that PDF generation produces non-empty bytes and valid PDF magic bytes with AI summary."""
    ai_summary = AISummarySchema(
        headline="Tokyo: Significant increase in heatwave exposure (+0.25 days/year).",
        observed_patterns=["25 years evaluated.", "Historical peak reached in 2014."],
        trend_interpretation="OLS indicates +0.254 days/year with MK tau of 0.612 (p < 0.001).",
        caveats=["Serial autocorrelation caveat.", "No localized causal attribution."],
        data_quality_note="100% spatial coverage across all 25 years.",
    )

    pdf_bytes = export_service.generate_pdf_report(SAMPLE_EXPORT_ANALYSIS, ai_summary=ai_summary)

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 2000
    assert pdf_bytes.startswith(b"%PDF-")


def test_pdf_report_generation_without_ai_summary_fallback():
    """Verify that PDF report still generates gracefully when AI summary is None."""
    pdf_bytes = export_service.generate_pdf_report(SAMPLE_EXPORT_ANALYSIS, ai_summary=None)

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 2000
    assert pdf_bytes.startswith(b"%PDF-")


# ==============================================================================
# 4. FASTAPI ROUTE INTEGRATION TESTS: EXPORT ENDPOINTS
# ==============================================================================

@pytest.mark.asyncio
async def test_get_export_csv_endpoint():
    """Verify GET /api/v1/analysis/{analysis_id}/export/csv returns valid CSV download."""
    test_id = "test_export_get_csv_999"
    await analysis_repo.save_analysis(
        analysis_id=test_id,
        cache_key="cache_key_export_csv",
        data={"response_data": SAMPLE_EXPORT_ANALYSIS},
    )

    resp = client.get(f"/api/v1/analysis/{test_id}/export/csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment" in resp.headers["content-disposition"]
    assert "dygnify_annual_heatwave" in resp.headers["content-disposition"]
    assert "year,hazard_type,metric_name" in resp.text


@pytest.mark.asyncio
async def test_get_export_events_csv_endpoint():
    """Verify GET /api/v1/analysis/{analysis_id}/export/events-csv returns valid events CSV."""
    test_id = "test_export_get_events_999"
    await analysis_repo.save_analysis(
        analysis_id=test_id,
        cache_key="cache_key_export_events",
        data={"response_data": SAMPLE_EXPORT_ANALYSIS},
    )

    resp = client.get(f"/api/v1/analysis/{test_id}/export/events-csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment" in resp.headers["content-disposition"]
    assert "dygnify_events_heatwave" in resp.headers["content-disposition"]
    assert "event_index,hazard_type,start_date" in resp.text


@pytest.mark.asyncio
async def test_get_export_pdf_endpoint():
    """Verify GET /api/v1/analysis/{analysis_id}/export/pdf returns valid PDF download."""
    test_id = "test_export_get_pdf_999"
    await analysis_repo.save_analysis(
        analysis_id=test_id,
        cache_key="cache_key_export_pdf",
        data={"response_data": SAMPLE_EXPORT_ANALYSIS},
    )

    resp = client.get(f"/api/v1/analysis/{test_id}/export/pdf")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert "attachment" in resp.headers["content-disposition"]
    assert "dygnify_report_heatwave" in resp.headers["content-disposition"]
    assert resp.content.startswith(b"%PDF-")


def test_get_export_nonexistent_analysis_returns_404():
    """Verify 404 is returned when attempting to export an unknown analysis ID."""
    resp = client.get("/api/v1/analysis/nonexistent_export_id_000/export/csv")
    assert resp.status_code == 404

    resp_pdf = client.get("/api/v1/analysis/nonexistent_export_id_000/export/pdf")
    assert resp_pdf.status_code == 404


def test_post_export_payload_csv_and_pdf():
    """Verify POST /api/v1/analysis/export/csv and /pdf work directly with on-demand payloads."""
    # POST Annual CSV
    resp_csv = client.post("/api/v1/analysis/export/csv", json=SAMPLE_EXPORT_ANALYSIS)
    assert resp_csv.status_code == 200
    assert "text/csv" in resp_csv.headers["content-type"]
    assert "year,hazard_type" in resp_csv.text

    # POST Events CSV
    resp_ev = client.post("/api/v1/analysis/export/events-csv", json=SAMPLE_EXPORT_ANALYSIS)
    assert resp_ev.status_code == 200
    assert "text/csv" in resp_ev.headers["content-type"]
    assert "event_index,hazard_type" in resp_ev.text

    # POST PDF
    resp_pdf = client.post("/api/v1/analysis/export/pdf", json=SAMPLE_EXPORT_ANALYSIS)
    assert resp_pdf.status_code == 200
    assert resp_pdf.headers["content-type"] == "application/pdf"
    assert resp_pdf.content.startswith(b"%PDF-")
