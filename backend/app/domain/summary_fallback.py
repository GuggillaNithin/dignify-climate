"""Deterministic template-based climate hazard explanation generator.

Produces strictly validated AISummarySchema structures without calling external LLM APIs,
grounded exclusively in verified pre-computed statistical outputs.
"""
from typing import Any, Dict, List
from app.schemas.summary import AISummarySchema


class SummaryFallbackGenerator:
    """Generates rigorous, cautious analytical summaries from pre-computed climate metrics."""

    @classmethod
    def generate(cls, payload: Dict[str, Any], fallback_reason: str = "Deterministic algorithm") -> AISummarySchema:
        """Construct structured summary from validated compact metrics payload."""
        hazard_type = payload.get("hazard_type", "climate hazard").replace("_", " ")
        region_desc = payload.get("spatial_representation", "analyzed area")
        date_range = payload.get("date_range", {})
        start_year = date_range.get("start_year", "N/A")
        end_year = date_range.get("end_year", "N/A")
        total_years = date_range.get("total_years", 0)
        valid_years = date_range.get("valid_years", 0)
        excluded_years = date_range.get("excluded_years", [])

        annual_agg = payload.get("annual_aggregates", {})
        total_events = annual_agg.get("total_events", 0)
        total_days = annual_agg.get("total_hazard_days", 0)
        mean_events = annual_agg.get("annual_mean_events", 0.0)
        mean_days = annual_agg.get("annual_mean_hazard_days", 0.0)
        peak_year = annual_agg.get("peak_year", None)
        peak_days = annual_agg.get("peak_year_hazard_days", 0.0)

        trend_stats = payload.get("trend_statistics", {})
        is_calculated = trend_stats.get("is_calculated", False)
        trend_direction = trend_stats.get("trend_direction", "indeterminate")
        is_significant = trend_stats.get("is_statistically_significant", False)
        ols_slope = trend_stats.get("ols_slope_per_year")
        ols_p = trend_stats.get("ols_p_value")
        ols_r2 = trend_stats.get("ols_r_squared")
        mk_tau = trend_stats.get("mann_kendall_tau")
        mk_p = trend_stats.get("mann_kendall_p_value")
        sens_slope = trend_stats.get("sens_slope")

        win_comp = payload.get("window_comparison")
        coverage_pct = payload.get("coverage_and_missingness", {}).get("mean_spatial_coverage_pct", 100.0)
        sample_count = payload.get("sample_count", 1)

        # 1. Headline
        if not is_calculated:
            headline = f"Analysis of historical {hazard_type} records across {start_year}–{end_year} ({valid_years} valid years)."
        elif is_significant:
            sig_text = "statistically significant"
            slope_str = f"{ols_slope:+.2f} days/year" if ols_slope is not None else ""
            headline = f"{region_desc}: Verified {sig_text} {trend_direction} trend in annual {hazard_type} ({slope_str}, p={ols_p:.3f})."
        else:
            p_val_str = f"p={ols_p:.3f}" if ols_p is not None else "p > 0.05"
            headline = f"{region_desc}: Observed {hazard_type} metrics show no statistically significant multi-decadal trend ({p_val_str})."

        # Trim headline to max 200 chars if necessary
        if len(headline) > 195:
            headline = headline[:192] + "..."

        # 2. Observed Patterns
        observed: List[str] = []
        observed.append(
            f"Over the {valid_years} valid observation years ({start_year}–{end_year}), a cumulative total of "
            f"{int(total_events) if isinstance(total_events, (int, float)) and total_events.is_integer() else f'{total_events:.1f}'} "
            f"{hazard_type} events and {total_days:.1f} total hazard days were verified."
        )
        if peak_year is not None:
            observed.append(
                f"Annual exposure averaged {mean_days:.1f} days/year ({mean_events:.1f} events/year), with historical "
                f"peak intensity reaching {peak_days:.1f} hazard days in {peak_year}."
            )
        else:
            observed.append(
                f"Annual exposure averaged {mean_days:.1f} days/year across the analyzed period."
            )

        if win_comp and isinstance(win_comp, dict):
            early_years_span = win_comp.get("early_years_span", "baseline window")
            early_mean = win_comp.get("early_window_mean", 0.0)
            late_years_span = win_comp.get("late_window_mean", 0.0)
            late_mean = win_comp.get("late_window_mean", 0.0)
            late_years_text = win_comp.get("late_years_span", "recent window")
            abs_change = win_comp.get("absolute_change", 0.0)
            pct_change = win_comp.get("percentage_change")
            pct_str = f"{pct_change:+.1f}%" if pct_change is not None else "non-calculable % (zero baseline)"
            observed.append(
                f"Multi-year window comparison: Baseline window ({early_years_span}) averaged {early_mean:.1f} days/year vs "
                f"{late_mean:.1f} days/year in recent period ({late_years_text}), an absolute change of {abs_change:+.1f} days ({pct_str})."
            )

        # 3. Trend Interpretation
        if is_calculated and ols_slope is not None and mk_tau is not None:
            sig_assessment = (
                f"rejects the null hypothesis of no monotonic trend at the α=0.05 level (OLS p={ols_p:.4f}, MK p={mk_p:.4f})"
                if is_significant
                else f"does not reject the null hypothesis of no monotonic trend at α=0.05 (OLS p={ols_p:.4f}, MK p={mk_p:.4f})"
            )
            trend_interpretation = (
                f"Parametric OLS regression indicates an annual trajectory of {ols_slope:+.3f} days/year (R² = {ols_r2:.3f}), "
                f"while the non-parametric Mann–Kendall rank correlation yields τ = {mk_tau:+.3f} with Sen's slope estimator "
                f"of {sens_slope:+.3f} days/year. This statistical evidence {sig_assessment}."
            )
        else:
            diag = trend_stats.get("diagnostic_message", "Sample size or valid years insufficient for formal trend tests.")
            trend_interpretation = (
                f"Trend statistics were not evaluated for this series. Reason: {diag} "
                "A minimum of 5 valid annual observations is required to compute defensible parametric and non-parametric trends."
            )

        # 4. Caveats
        caveats = [
            "Statistical significance estimates (OLS and Mann–Kendall) assume independent annual observations; geophysical persistence and autocorrelation can artificially deflate p-values.",
            "Local observational trends derived from ERA5 reanalysis describe historical meteorological metrics and do not constitute localized causal attribution to specific anthropogenic or planetary forcing mechanisms without dedicated multi-model attribution studies.",
            "Geospatial and climatological percentile thresholds are calibrated relative to historical sample distributions; localized microclimates and topographic boundaries may experience differing localized exposure.",
        ]

        # 5. Data Quality Note
        excluded_text = f" Excluded years due to incomplete data: {', '.join(map(str, excluded_years))}." if excluded_years else " No calendar years were excluded for data incompleteness."
        data_quality_note = (
            f"Analysis covers {valid_years} valid years out of {total_years} requested calendar years from the Open-Meteo Historical / "
            f"ERA5 Reanalysis archive (0.1° resolution).{excluded_text} Spatial sampling density: {sample_count} grid point(s) "
            f"with an average annual coverage certification of {coverage_pct:.1f}%."
        )

        return AISummarySchema(
            headline=headline,
            observed_patterns=observed,
            trend_interpretation=trend_interpretation,
            caveats=caveats,
            data_quality_note=data_quality_note,
        )
