"""Deterministic Heavy Precipitation hazard detection algorithm."""
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


def compute_wet_day_threshold(
    points: List[DailyObservationPoint],
    percentile: float = 95.0,
    wet_day_cutoff: float = 1.0,  # 1.0 mm is WMO standard wet day cutoff
    baseline_start_year: Optional[int] = None,
    baseline_end_year: Optional[int] = None,
    min_wet_days: int = 20,
) -> Tuple[float, BaselineConfig]:
    """Compute percentile threshold strictly from valid wet days (P >= wet_day_cutoff)."""
    if baseline_start_year is not None and baseline_end_year is not None:
        baseline_wet_days = [
            p.value for p in points
            if baseline_start_year <= p.year <= baseline_end_year
            and p.is_valid and p.value is not None and p.value >= wet_day_cutoff
        ]
        if len(baseline_wet_days) >= min_wet_days:
            thresh = float(np.percentile(baseline_wet_days, percentile))
            config = BaselineConfig(
                start_year=baseline_start_year,
                end_year=baseline_end_year,
                is_exploratory=False,
                description=f"Fixed {baseline_start_year}–{baseline_end_year} baseline ({len(baseline_wet_days)} wet days ≥{wet_day_cutoff}mm)",
            )
            return round(thresh, 2), config

    # Fallback to exploratory full-series wet days
    all_wet_days = [
        p.value for p in points
        if p.is_valid and p.value is not None and p.value >= wet_day_cutoff
    ]
    if not all_wet_days:
        raise ValueError(f"Cannot compute heavy precipitation threshold: No wet days (≥{wet_day_cutoff} mm) in series.")

    thresh = float(np.percentile(all_wet_days, percentile))
    years = [p.year for p in points]
    config = BaselineConfig(
        start_year=min(years) if years else None,
        end_year=max(years) if years else None,
        is_exploratory=True,
        description=f"Exploratory threshold computed over full {min(years)}–{max(years)} series ({len(all_wet_days)} wet days ≥{wet_day_cutoff}mm)",
    )
    return round(thresh, 2), config


def detect_heavy_rainfall(
    raw_data: List[Tuple[str, Optional[float]]],
    percentile: float = 95.0,
    wet_day_cutoff: float = 1.0,
    baseline_start_year: Optional[int] = None,
    baseline_end_year: Optional[int] = None,
) -> HazardAnalysisResult:
    """Analyze heavy precipitation hazard events and annual extreme metrics."""
    # 1. Align continuous timeline with gap detection
    points = TimeseriesValidator.align_continuous_daily_series(raw_data, variable_type="precipitation")
    if not points:
        raise ValueError("Input time series contains no data points.")

    threshold_val, baseline_cfg = compute_wet_day_threshold(
        points=points,
        percentile=percentile,
        wet_day_cutoff=wet_day_cutoff,
        baseline_start_year=baseline_start_year,
        baseline_end_year=baseline_end_year,
    )

    # 2. Consecutive-day storm event grouping
    # Any day with P > threshold_val qualifies.
    # Consecutive qualifying days are grouped into a single multi-day storm event.
    events: List[EventRecord] = []
    current_streak: List[DailyObservationPoint] = []
    event_days_map: Dict[str, EventRecord] = {}

    for p in points:
        if p.is_valid and p.value is not None and p.value > threshold_val:
            current_streak.append(p)
        else:
            if current_streak:
                ev = _create_heavy_rain_event_record(current_streak)
                events.append(ev)
                for sp in current_streak:
                    event_days_map[sp.date_str] = ev
                current_streak = []

    if current_streak:
        ev = _create_heavy_rain_event_record(current_streak)
        events.append(ev)
        for sp in current_streak:
            event_days_map[sp.date_str] = ev

    # 3. Annual Metrics & Rx1day
    annual_metrics = _aggregate_heavy_rain_annual_metrics(
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
        "hazard": "Heavy Precipitation",
        "hazard_indicator": "Annual Heavy Rainfall Days",
        "threshold_value": threshold_val,
        "threshold_percentile": percentile,
        "threshold_unit": "mm",
        "threshold_rule": f"Daily precipitation strictly > {percentile}th percentile of wet days ({threshold_val} mm)",
        "threshold_definition": f"Daily precipitation > {percentile}th percentile of wet days ({threshold_val} mm)",
        "wet_day_cutoff": f"Precipitation ≥ {wet_day_cutoff} mm",
        "event_grouping_rule": "Consecutive extreme precipitation days are grouped into multi-day storm events.",
        "missing_data_policy": "Missing days break storm groupings and are reported in annual coverage metadata.",
        "annual_rx1day_definition": "Highest 1-day precipitation recorded in each calendar year.",
        "baseline_used": baseline_cfg.description,
        "units": {
            "precipitation": "mm",
            "intensity": "Storm total precipitation (mm)",
            "duration": "Days",
        },
    }

    return HazardAnalysisResult(
        hazard_type="heavy_rainfall",
        threshold_value=threshold_val,
        threshold_unit="mm",
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


def _create_heavy_rain_event_record(streak: List[DailyObservationPoint]) -> EventRecord:
    daily_vals = [p.value for p in streak if p.value is not None]
    duration = len(streak)
    total_precip = round(float(sum(daily_vals)), 2)
    max_precip = round(float(max(daily_vals)), 2)
    mean_precip = round(float(np.mean(daily_vals)), 2)

    return EventRecord(
        start_date=streak[0].date_str,
        end_date=streak[-1].date_str,
        duration_days=duration,
        daily_values=daily_vals,
        mean_value=mean_precip,
        max_value=max_precip,
        intensity_metric=total_precip,
        metadata={
            "storm_total_mm": total_precip,
            "max_daily_mm": max_precip,
        },
    )


def _aggregate_heavy_rain_annual_metrics(
    points: List[DailyObservationPoint],
    events: List[EventRecord],
    event_days_map: Dict[str, EventRecord],
    threshold_val: float,
) -> List[AnnualHazardMetric]:
    by_year: Dict[int, List[DailyObservationPoint]] = defaultdict(list)
    for p in points:
        by_year[p.year].append(p)

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
        is_comparable = coverage_pct >= 90.0

        yr_events = events_by_year.get(year, [])
        event_count = len(yr_events)

        heavy_rain_days = sum(1 for p in yr_points if p.date_str in event_days_map)
        heavy_rain_precip = [
            p.value for p in yr_points
            if p.date_str in event_days_map and p.value is not None
        ]
        total_heavy_rain_mm = round(float(sum(heavy_rain_precip)), 2)

        # Rx1day: Annual maximum 1-day precipitation across all valid days
        all_yr_precip = [p.value for p in yr_points if p.is_valid and p.value is not None]
        rx1day_mm = round(float(max(all_yr_precip)), 2) if all_yr_precip else 0.0

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
                hazard_days=heavy_rain_days,
                primary_metric=heavy_rain_days,  # Primary metric: count of heavy precipitation days
                mean_event_duration=mean_dur,
                max_event_duration=max_dur,
                cumulative_intensity=total_heavy_rain_mm,
                attributes={
                    "total_heavy_rainfall_mm": total_heavy_rain_mm,
                    "rx1day_max_daily_mm": rx1day_mm,
                    "mean_event_storm_total_mm": round(float(np.mean([ev.intensity_metric for ev in yr_events])), 2) if yr_events else 0.0,
                },
            )
        )

    return annual_list
