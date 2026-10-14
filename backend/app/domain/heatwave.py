"""Deterministic heatwave hazard detection algorithm."""
from collections import defaultdict
from typing import Dict, List, Optional, Tuple
import numpy as np

from app.domain.models import (
    AnnualHazardMetric,
    BaselineConfig,
    EventRecord,
    HazardAnalysisResult,
)
from app.domain.timeseries import DailyObservationPoint, TimeseriesValidator


def compute_temperature_threshold(
    points: List[DailyObservationPoint],
    percentile: float = 95.0,
    baseline_start_year: Optional[int] = None,
    baseline_end_year: Optional[int] = None,
    min_baseline_sample: int = 365 * 10 * 8 // 10,  # ~8 years of valid observations
) -> Tuple[float, BaselineConfig]:
    """Compute deterministic percentile threshold from climatological baseline or full series."""
    # Filter points belonging to baseline window if specified
    if baseline_start_year is not None and baseline_end_year is not None:
        baseline_points = [
            p for p in points
            if baseline_start_year <= p.year <= baseline_end_year and p.is_valid and p.value is not None
        ]
        if len(baseline_points) >= min_baseline_sample:
            values = np.array([p.value for p in baseline_points], dtype=float)
            thresh = float(np.percentile(values, percentile))
            config = BaselineConfig(
                start_year=baseline_start_year,
                end_year=baseline_end_year,
                is_exploratory=False,
                description=f"Fixed {baseline_start_year}–{baseline_end_year} baseline ({len(values)} valid days)",
            )
            return round(thresh, 2), config

    # Fallback to exploratory full-series percentile
    all_valid = [p.value for p in points if p.is_valid and p.value is not None]
    if not all_valid:
        raise ValueError("Cannot compute heatwave threshold: No valid temperature observations in series.")

    values = np.array(all_valid, dtype=float)
    thresh = float(np.percentile(values, percentile))
    years = [p.year for p in points]
    config = BaselineConfig(
        start_year=min(years) if years else None,
        end_year=max(years) if years else None,
        is_exploratory=True,
        description=f"Exploratory threshold computed over full {min(years)}–{max(years)} observation period ({len(values)} valid days)",
    )
    return round(thresh, 2), config


def detect_heatwaves(
    raw_data: List[Tuple[str, Optional[float]]],
    percentile: float = 95.0,
    min_consecutive_days: int = 3,
    baseline_start_year: Optional[int] = None,
    baseline_end_year: Optional[int] = None,
) -> HazardAnalysisResult:
    """Analyze heatwave hazard events and annual aggregated series."""
    # 1. Align continuous timeline with gap and boundary auditing
    points = TimeseriesValidator.align_continuous_daily_series(raw_data, variable_type="temperature")
    if not points:
        raise ValueError("Input time series contains no data points.")

    threshold_val, baseline_cfg = compute_temperature_threshold(
        points=points,
        percentile=percentile,
        baseline_start_year=baseline_start_year,
        baseline_end_year=baseline_end_year,
    )

    # 2. Sequential event run detection
    # Run rule: >= min_consecutive_days valid days where T_max > threshold_val.
    # Non-exceedance day OR missing/invalid day immediately terminates current streak.
    events: List[EventRecord] = []
    current_streak: List[DailyObservationPoint] = []

    # Map to track which calendar days belong to an event: {date_str: EventRecord}
    event_days_map: Dict[str, EventRecord] = {}

    for p in points:
        if p.is_valid and p.value is not None and p.value > threshold_val:
            # Strictly above threshold (ties do not qualify)
            current_streak.append(p)
        else:
            # Streak terminates - check if it qualified
            if len(current_streak) >= min_consecutive_days:
                ev = _create_heatwave_event_record(current_streak, threshold_val)
                events.append(ev)
                for sp in current_streak:
                    event_days_map[sp.date_str] = ev
            current_streak = []

    # Check terminal streak at end of series
    if len(current_streak) >= min_consecutive_days:
        ev = _create_heatwave_event_record(current_streak, threshold_val)
        events.append(ev)
        for sp in current_streak:
            event_days_map[sp.date_str] = ev

    # 3. Annual Aggregations & Missingness Reporting
    annual_metrics = _aggregate_heatwave_annual_metrics(
        points=points,
        events=events,
        event_days_map=event_days_map,
        threshold_val=threshold_val,
    )

    total_days = len(points)
    valid_days = sum(1 for p in points if p.is_valid)
    missing_days = total_days - valid_days
    coverage = round((valid_days / total_days) * 100, 2) if total_days > 0 else 0.0

    definitions = {
        "hazard": "Heatwave",
        "hazard_indicator": "Annual Heatwave Days",
        "threshold_value": threshold_val,
        "threshold_percentile": percentile,
        "threshold_unit": "°C",
        "threshold_rule": f"Daily maximum 2m air temperature strictly > {percentile}th percentile ({threshold_val} °C)",
        "threshold_definition": f"Daily maximum 2m air temperature strictly > {percentile}th percentile ({threshold_val} °C)",
        "consecutive_run_rule": f"At least {min_consecutive_days} consecutive valid days above threshold",
        "missing_data_policy": "Missing dates and non-finite values break event runs immediately. Gaps are never bridged.",
        "baseline_used": baseline_cfg.description,
        "significance_sensitivity_note": "Statistical significance (p-value) is conditional on the configured operational threshold; altering the percentile threshold alters qualifying exceedance frequency and may change trend significance.",
        "units": {
            "temperature": "°C",
            "intensity": "Cumulative degree-days exceedance (°C)",
            "duration": "Days",
        },
    }

    return HazardAnalysisResult(
        hazard_type="heatwave",
        threshold_value=threshold_val,
        threshold_unit="°C",
        threshold_percentile=percentile,
        baseline_config=baseline_cfg,
        total_series_days=total_days,
        total_valid_days=valid_days,
        total_missing_days=missing_days,
        overall_coverage_pct=coverage,
        events=events,
        annual_metrics=annual_metrics,
        definitions_summary=definitions,
    )


def _create_heatwave_event_record(
    streak: List[DailyObservationPoint],
    threshold: float,
) -> EventRecord:
    daily_vals = [p.value for p in streak if p.value is not None]
    duration = len(streak)
    mean_temp = round(float(np.mean(daily_vals)), 2)
    max_temp = round(float(np.max(daily_vals)), 2)
    cum_exceedance = round(float(sum(v - threshold for v in daily_vals)), 2)

    return EventRecord(
        start_date=streak[0].date_str,
        end_date=streak[-1].date_str,
        duration_days=duration,
        daily_values=daily_vals,
        mean_value=mean_temp,
        max_value=max_temp,
        intensity_metric=cum_exceedance,
        metadata={
            "mean_exceedance": round(cum_exceedance / duration, 2) if duration > 0 else 0.0,
            "threshold": threshold,
        },
    )


def _aggregate_heatwave_annual_metrics(
    points: List[DailyObservationPoint],
    events: List[EventRecord],
    event_days_map: Dict[str, EventRecord],
    threshold_val: float,
) -> List[AnnualHazardMetric]:
    # Group points by year
    by_year: Dict[int, List[DailyObservationPoint]] = defaultdict(list)
    for p in points:
        by_year[p.year].append(p)

    # Group events by start year
    events_by_year: Dict[int, List[EventRecord]] = defaultdict(list)
    for ev in events:
        start_year = int(ev.start_date.split("-")[0])
        events_by_year[start_year].append(ev)

    annual_list: List[AnnualHazardMetric] = []
    for year in sorted(by_year.keys()):
        yr_points = by_year[year]
        total_cal_days = TimeseriesValidator.get_days_in_year(year)
        valid_days = sum(1 for p in yr_points if p.is_valid)
        missing_days = total_cal_days - valid_days
        coverage_pct = round((valid_days / total_cal_days) * 100, 2)
        is_comparable = coverage_pct >= 90.0  # WMO recommendation: <= 10% missing

        yr_events = events_by_year.get(year, [])
        event_count = len(yr_events)

        # Count hazard days that physically fell in this calendar year
        hazard_days = sum(1 for p in yr_points if p.date_str in event_days_map)

        # Intensity metrics for days in this year
        exceedances_in_year = [
            round(p.value - threshold_val, 2)
            for p in yr_points
            if p.date_str in event_days_map and p.value is not None
        ]
        cum_intensity = round(sum(exceedances_in_year), 2)

        durations = [ev.duration_days for ev in yr_events]
        mean_dur = round(float(np.mean(durations)), 2) if durations else 0.0
        max_dur = max(durations) if durations else 0

        annual_list.append(
            AnnualHazardMetric(
                year=year,
                total_calendar_days=total_cal_days,
                valid_observed_days=valid_days,
                missing_days=missing_days,
                coverage_pct=coverage_pct,
                is_comparable=is_comparable,
                event_count=event_count,
                hazard_days=hazard_days,
                primary_metric=hazard_days,  # Primary metric: count of heatwave days
                mean_event_duration=mean_dur,
                max_event_duration=max_dur,
                cumulative_intensity=cum_intensity,
                attributes={
                    "cumulative_exceedance_deg_c": cum_intensity,
                    "mean_event_temperature": round(float(np.mean([ev.mean_value for ev in yr_events])), 2) if yr_events else 0.0,
                },
            )
        )

    return annual_list
