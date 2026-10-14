"""Domain service for generating RFC 4180 CSV and server-side PDF reports.

Provides formula-injection defense, strict UTF-8 encoding, and deterministic
ReportLab PDF generation from validated climate hazard analysis records.
"""
import csv
from datetime import datetime, timezone
import io
import logging
from typing import Any, Dict, List, Optional, Union

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.domain.summary_fallback import SummaryFallbackGenerator
from app.schemas.analysis import AnalysisResponse
from app.schemas.summary import AISummarySchema

logger = logging.getLogger(__name__)


def sanitize_cell_value(val: Any) -> Any:
    """Prevent spreadsheet formula injection in CSV exports.

    Prefixes text beginning with =, +, -, @, \\t, or \\r with a single quote (')
    to ensure spreadsheet applications treat the field purely as text.
    Preserves raw numeric types (int, float, bool).
    """
    if val is None:
        return ""
    if isinstance(val, (int, float, bool)):
        return val
    str_val = str(val)
    if not str_val:
        return ""
    if str_val[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{str_val}"
    stripped = str_val.lstrip()
    if stripped and stripped[0] in ("=", "+", "-", "@"):
        return f"'{str_val}"
    return str_val


class ExportService:
    """Generates audited CSV spreadsheets and formatted PDF reports from analysis models."""

    @classmethod
    def generate_annual_csv(cls, analysis_data: Union[AnalysisResponse, Dict[str, Any]]) -> str:
        """Produce RFC 4180 CSV containing annual metrics with formula injection sanitization."""
        if isinstance(analysis_data, AnalysisResponse):
            data = analysis_data.model_dump()
        else:
            data = analysis_data

        analysis_id = data.get("analysis_id", "adhoc")
        hazard_type = data.get("hazard_type", "heatwave")
        mode = data.get("mode", "point")
        spatial = data.get("spatial_metadata", {})
        region_desc = spatial.get("representation_text", "Analyzed Target Area")
        resolution = spatial.get("resolution", "~0.1° (~11 km) ERA5 grid cell")
        data_source = "Open-Meteo Historical Weather API / ECMWF ERA5 Reanalysis"
        method_version = data.get("trends", {}).get("methodology_version", "v1.2-scientific") if data.get("trends") else "v1.2-scientific"
        primary_metric_name = data.get("trends", {}).get("primary_metric_name", f"{hazard_type}_days") if data.get("trends") else f"{hazard_type}_days"
        metric_units = data.get("trends", {}).get("metric_units", "days") if data.get("trends") else "days"

        fieldnames = [
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

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames, lineterminator="\r\n")
        writer.writeheader()

        annual_series = data.get("annual_series", [])
        for yr in annual_series:
            row = {
                "year": sanitize_cell_value(yr.get("year")),
                "hazard_type": sanitize_cell_value(hazard_type),
                "metric_name": sanitize_cell_value(primary_metric_name),
                "weighted_hazard_days": sanitize_cell_value(yr.get("weighted_hazard_days")),
                "weighted_event_count": sanitize_cell_value(yr.get("weighted_event_count")),
                "weighted_primary_metric": sanitize_cell_value(yr.get("weighted_primary_metric")),
                "weighted_intensity": sanitize_cell_value(yr.get("weighted_intensity")),
                "units": sanitize_cell_value(metric_units),
                "spatial_coverage_pct": sanitize_cell_value(yr.get("spatial_coverage_pct")),
                "coverage_status": sanitize_cell_value(yr.get("coverage_status")),
                "valid_points_count": sanitize_cell_value(yr.get("valid_points_count")),
                "total_points_count": sanitize_cell_value(yr.get("total_points_count")),
                "mode": sanitize_cell_value(mode),
                "region_description": sanitize_cell_value(region_desc),
                "data_source": sanitize_cell_value(data_source),
                "resolution": sanitize_cell_value(resolution),
                "methodology_version": sanitize_cell_value(method_version),
                "analysis_id": sanitize_cell_value(analysis_id),
            }
            writer.writerow(row)

        return output.getvalue()

    @classmethod
    def generate_events_csv(cls, analysis_data: Union[AnalysisResponse, Dict[str, Any]]) -> str:
        """Produce RFC 4180 CSV containing individual qualifying extreme events."""
        if isinstance(analysis_data, AnalysisResponse):
            data = analysis_data.model_dump()
        else:
            data = analysis_data

        analysis_id = data.get("analysis_id", "adhoc")
        hazard_type = data.get("hazard_type", "heatwave")
        mode = data.get("mode", "point")
        spatial = data.get("spatial_metadata", {})
        region_desc = spatial.get("representation_text", "Analyzed Target Area")
        data_source = "Open-Meteo Historical Weather API / ECMWF ERA5 Reanalysis"
        defs = data.get("definitions_summary", {}) or {}
        threshold_desc = defs.get("threshold_rule", "Climatological percentile threshold")

        fieldnames = [
            "event_index",
            "hazard_type",
            "start_date",
            "end_date",
            "duration_days",
            "mean_value",
            "max_value",
            "intensity_metric",
            "units",
            "threshold_rule",
            "mode",
            "region_description",
            "data_source",
            "analysis_id",
        ]

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames, lineterminator="\r\n")
        writer.writeheader()

        events_list = data.get("events_list", []) or []
        for idx, ev in enumerate(events_list, start=1):
            row = {
                "event_index": idx,
                "hazard_type": sanitize_cell_value(hazard_type),
                "start_date": sanitize_cell_value(ev.get("start_date")),
                "end_date": sanitize_cell_value(ev.get("end_date")),
                "duration_days": sanitize_cell_value(ev.get("duration_days")),
                "mean_value": sanitize_cell_value(ev.get("mean_value")),
                "max_value": sanitize_cell_value(ev.get("max_value")),
                "intensity_metric": sanitize_cell_value(ev.get("intensity_metric")),
                "units": "°C" if hazard_type == "heatwave" else "mm",
                "threshold_rule": sanitize_cell_value(threshold_desc),
                "mode": sanitize_cell_value(mode),
                "region_description": sanitize_cell_value(region_desc),
                "data_source": sanitize_cell_value(data_source),
                "analysis_id": sanitize_cell_value(analysis_id),
            }
            writer.writerow(row)

        return output.getvalue()

    @classmethod
    def generate_pdf_report(
        cls,
        analysis_data: Union[AnalysisResponse, Dict[str, Any]],
        ai_summary: Optional[Union[AISummarySchema, Dict[str, Any]]] = None,
    ) -> bytes:
        """Produce a comprehensive server-side PDF climate hazard analysis report."""
        if isinstance(analysis_data, AnalysisResponse):
            data = analysis_data.model_dump()
        else:
            data = analysis_data

        if ai_summary and not isinstance(ai_summary, AISummarySchema):
            try:
                summary_obj = AISummarySchema(**ai_summary)
            except Exception:
                summary_obj = None
        elif isinstance(ai_summary, AISummarySchema):
            summary_obj = ai_summary
        else:
            summary_obj = None

        # If no AI summary provided, generate deterministic fallback summary
        if summary_obj is None:
            from app.services.groq_service import groq_service
            compact = groq_service.build_compact_payload(data)
            summary_obj = SummaryFallbackGenerator.generate(compact, fallback_reason="Deterministic Analysis Report")

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()

        # Custom typography styles
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#0f172a"),
        )
        subtitle_style = ParagraphStyle(
            "DocSubTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#0891b2"),
        )
        h2_style = ParagraphStyle(
            "SectionH2",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=15,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=10,
            spaceAfter=4,
        )
        body_style = ParagraphStyle(
            "BodyDark",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#334155"),
        )
        body_bold = ParagraphStyle(
            "BodyBold",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#0f172a"),
        )
        table_hdr = ParagraphStyle(
            "TableHdr",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#ffffff"),
        )
        table_cell = ParagraphStyle(
            "TableCell",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor("#1e293b"),
        )
        caveat_style = ParagraphStyle(
            "CaveatText",
            parent=styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=7.5,
            leading=10.5,
            textColor=colors.HexColor("#475569"),
        )

        story = []

        # 1. Header Banner
        hazard_title = data.get("hazard_type", "climate hazard").replace("_", " ").upper()
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        header_table = Table(
            [
                [
                    Paragraph("Dygnify", subtitle_style),
                    Paragraph(f"Generated: {now_str}", table_cell),
                ],
                [
                    Paragraph(f"Climate Hazard Trend Report: {hazard_title}", title_style),
                    Paragraph(f"ID: {data.get('analysis_id', 'adhoc')}", table_cell),
                ],
            ],
            colWidths=[400, 140],
        )
        header_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
            ])
        )
        story.append(header_table)
        story.append(Spacer(1, 6))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0891b2"), spaceBefore=2, spaceAfter=8))

        # 2. Executive Metadata Grid
        spatial = data.get("spatial_metadata", {})
        annual_series = data.get("annual_series", [])
        trends = data.get("trends", {}) or {}
        defs = data.get("definitions_summary", {}) or {}

        years_count = len(annual_series)
        valid_count = trends.get("valid_years_count", len([y for y in annual_series if y.get("is_available")]))
        start_yr = annual_series[0]["year"] if annual_series else "N/A"
        end_yr = annual_series[-1]["year"] if annual_series else "N/A"

        mode = data.get("mode", "point")
        sample_count = spatial.get("sample_count", 1)
        spatial_metric_label = (
            "Annual Mean — Single ERA5 Grid Cell"
            if mode == "point" or sample_count <= 1
            else "Spatially Weighted Regional Mean"
        )

        thresh_pct = defs.get("threshold_percentile")
        thresh_val = defs.get("threshold_value")
        thresh_unit = defs.get("threshold_unit", "°C")
        if thresh_pct is not None and thresh_val is not None:
            thresh_str = f"{thresh_pct}th %ile ({thresh_val} {thresh_unit})"
        elif thresh_val is not None:
            thresh_str = f"{thresh_val} {thresh_unit}"
        else:
            thresh_str = "Climatological baseline threshold"

        meta_rows = [
            [
                Paragraph("<b>Target Region:</b>", body_style),
                Paragraph(str(spatial.get("representation_text", "Selected Area")), body_style),
                Paragraph("<b>Observation Period:</b>", body_style),
                Paragraph(f"{start_yr}–{end_yr} ({valid_count}/{years_count} valid yrs)", body_style),
            ],
            [
                Paragraph("<b>Spatial Metric:</b>", body_style),
                Paragraph(f"{spatial_metric_label} ({sample_count} grid point{'s' if sample_count > 1 else ''})", body_style),
                Paragraph("<b>Data Source:</b>", body_style),
                Paragraph("ECMWF ERA5 / Open-Meteo CC-BY 4.0", body_style),
            ],
            [
                Paragraph("<b>Hazard Metric:</b>", body_style),
                Paragraph(str(defs.get("hazard_indicator", data.get("hazard_type", "hazard"))), body_style),
                Paragraph("<b>Grid Resolution:</b>", body_style),
                Paragraph(str(spatial.get("resolution", "~0.1° (~11 km)")), body_style),
            ],
            [
                Paragraph("<b>Active Threshold:</b>", body_style),
                Paragraph(thresh_str, body_style),
                Paragraph("<b>Threshold Rule:</b>", body_style),
                Paragraph(str(defs.get("threshold_rule", "Exceedance above baseline percentile")), body_style),
            ],
        ]

        meta_table = Table(meta_rows, colWidths=[90, 180, 100, 170])
        meta_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ])
        )
        story.append(meta_table)
        story.append(Spacer(1, 8))

        # 3. Statistical Trend Analysis
        story.append(Paragraph("Statistical Trend Analysis (OLS & Mann–Kendall)", h2_style))

        ols = trends.get("ols_regression")
        mk = trends.get("mann_kendall")
        win_comp = trends.get("window_comparison")
        is_sig = trends.get("is_statistically_significant", False)
        direction = trends.get("trend_direction", "indeterminate").capitalize()

        sig_label = "Statistically Significant (p < 0.05)" if is_sig else "Not Statistically Significant (p ≥ 0.05)"
        sig_bg = colors.HexColor("#ecfdf5") if is_sig else colors.HexColor("#f8fafc")
        sig_border = colors.HexColor("#10b981") if is_sig else colors.HexColor("#94a3b8")
        sig_color = colors.HexColor("#065f46") if is_sig else colors.HexColor("#475569")

        trend_status_p = Paragraph(
            f"<b>Direction:</b> {direction} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Significance Status:</b> {sig_label}",
            ParagraphStyle("TrendStatus", parent=body_bold, textColor=sig_color),
        )
        status_table = Table([[trend_status_p]], colWidths=[540])
        status_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), sig_bg),
            ("BOX", (0, 0), (-1, -1), 1, sig_border),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(status_table)
        story.append(Spacer(1, 6))

        stats_rows = [
            [
                Paragraph("Statistical Test", table_hdr),
                Paragraph("Primary Metric", table_hdr),
                Paragraph("Rate / Magnitude", table_hdr),
                Paragraph("P-Value", table_hdr),
                Paragraph("Assessment", table_hdr),
            ],
            [
                Paragraph("OLS Linear Regression", table_cell),
                Paragraph(f"R² = {ols['r_squared']:.3f}" if ols else "N/A", table_cell),
                Paragraph(f"{ols['slope_per_year']:+.3f} {trends.get('metric_units', '')}/yr" if ols else "N/A", table_cell),
                Paragraph(f"p = {ols['p_value']:.4f}" if ols else "N/A", table_cell),
                Paragraph("Reject H0 (trend exists)" if (ols and ols["p_value"] < 0.05) else "Fail to reject H0", table_cell),
            ],
            [
                Paragraph("Mann–Kendall Rank Test", table_cell),
                Paragraph(f"τ = {mk['tau']:+.3f}" if mk else "N/A", table_cell),
                Paragraph(f"Sen's = {mk['sens_slope']:+.3f} {trends.get('metric_units', '')}/yr" if mk else "N/A", table_cell),
                Paragraph(f"p = {mk['p_value']:.4f}" if mk else "N/A", table_cell),
                Paragraph("Monotonic trend supported" if (mk and mk["p_value"] < 0.05) else "No monotonic trend", table_cell),
            ],
        ]

        if win_comp:
            pct_str = f"{win_comp['percentage_change']:+.1f}%" if win_comp.get("percentage_change") is not None else "Withheld"
            stats_rows.append([
                Paragraph("Multi-Year Window Shift", table_cell),
                Paragraph(f"Baseline: {win_comp['early_window_mean']:.1f}", table_cell),
                Paragraph(f"Recent: {win_comp['late_window_mean']:.1f} (Δ {win_comp['absolute_change']:+.1f})", table_cell),
                Paragraph(f"{pct_str}", table_cell),
                Paragraph(f"{win_comp.get('percentage_change_status', 'Evaluated')}", table_cell),
            ])

        stats_table = Table(stats_rows, colWidths=[120, 95, 125, 80, 120])
        stats_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(stats_table)
        sens_note = defs.get(
            "significance_sensitivity_note",
            "Statistical significance is conditional on the configured operational threshold; altering the percentile threshold alters qualifying exceedance frequency and may change trend significance."
        )
        story.append(Spacer(1, 3))
        story.append(Paragraph(f"<b>Operational Threshold Sensitivity:</b> {sens_note}", caveat_style))
        story.append(Spacer(1, 8))

        # 4. Synthesized Climate Narrative & Guardrails
        story.append(Paragraph("Synthesized Climate Evidence Briefing", h2_style))

        narrative_box = [
            [Paragraph(f"<b>Headline:</b> {summary_obj.headline}", body_bold)],
            [Paragraph(f"<b>Interpretation:</b> {summary_obj.trend_interpretation}", body_style)],
        ]
        if summary_obj.observed_patterns:
            bullets = "<br/>".join([f"• {p}" for p in summary_obj.observed_patterns])
            narrative_box.append([Paragraph(f"<b>Observed Patterns:</b><br/>{bullets}", body_style)])
        if summary_obj.data_quality_note:
            narrative_box.append([Paragraph(f"<b>Data Quality Assessment:</b> {summary_obj.data_quality_note}", caveat_style)])

        narrative_table = Table(narrative_box, colWidths=[540])
        narrative_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdf4") if is_sig else colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(narrative_table)
        story.append(Spacer(1, 8))

        # 5. Scientific Disclaimers & Attribution Caveats
        story.append(Paragraph("Methodological Caveats & Attribution Limits", h2_style))
        caveat_paragraphs = []
        for c in summary_obj.caveats:
            caveat_paragraphs.append(Paragraph(f"• {c}", caveat_style))
            caveat_paragraphs.append(Spacer(1, 2))
        story.extend(caveat_paragraphs)
        story.append(Spacer(1, 8))

        # 6. Annual Observation Table Sample (Recent 15 years or all if <= 15)
        story.append(Paragraph("Recent Annual Metrics Sample", h2_style))
        days_header = "Annual Hazard Days" if (mode == "point" or sample_count <= 1) else "Spatially Weighted Days"
        sample_rows = [
            [
                Paragraph("Year", table_hdr),
                Paragraph(days_header, table_hdr),
                Paragraph("Events", table_hdr),
                Paragraph("Primary Metric", table_hdr),
                Paragraph("Spatial Coverage", table_hdr),
                Paragraph("Status", table_hdr),
            ]
        ]

        display_annual = annual_series[-15:] if len(annual_series) > 15 else annual_series
        for yr in display_annual:
            days_str = f"{yr.get('weighted_hazard_days', 0.0):.1f}" if yr.get("weighted_hazard_days") is not None else "N/A"
            ev_str = f"{yr.get('weighted_event_count', 0.0):.1f}" if yr.get("weighted_event_count") is not None else "N/A"
            pm_str = f"{yr.get('weighted_primary_metric', 0.0):.1f}" if yr.get("weighted_primary_metric") is not None else "N/A"
            cov_str = f"{yr.get('spatial_coverage_pct', 100.0):.1f}%"
            sample_rows.append([
                Paragraph(str(yr.get("year")), table_cell),
                Paragraph(days_str, table_cell),
                Paragraph(ev_str, table_cell),
                Paragraph(pm_str, table_cell),
                Paragraph(cov_str, table_cell),
                Paragraph(str(yr.get("coverage_status", "certified")), table_cell),
            ])

        annual_table = Table(sample_rows, colWidths=[60, 95, 75, 110, 100, 100])
        annual_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(annual_table)
        story.append(Spacer(1, 10))

        # 7. Document Footer Note
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=4, spaceAfter=4))
        story.append(
            Paragraph(
                "Dygnify Scientific Report • Data: Open-Meteo Historical Weather API (CC-BY 4.0) over ECMWF ERA5 Reanalysis. "
                "All statistical metrics calculated deterministically in Python. Not intended as localized attribution without multi-model detection analysis.",
                caveat_style,
            )
        )

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes


export_service = ExportService()
