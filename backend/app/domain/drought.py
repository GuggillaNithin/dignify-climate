"""Deterministic Meteorological Drought Proxy algorithm based on Rolling Precipitation Deficits."""
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


def detect_drought_proxy(
    raw_data: List[Tuple[str, Optional[float]]],
    window_days: int = 90,
    deficit_threshold: float = 0.50,  # 50% cumulative rainfall deficit
    min_consecutive_days: int = 14,   # 14 consecutive days of deficit
    baseline_start_year: Optional[int] = None,
    baseline_end_year: Optional[int] = None,
) -> HazardAnalysisResult:
    """Analyze meteorological drought using a transparent Rolling Precipitation Deficit Proxy.
    
    Identifies periods where multi-month cumulative precipitation drops significantly below
    expected climatological norms for that time of year.
    """
    # 1. Align continuous timeline with gap detection
    points = TimeseriesValidator.align_continuous_daily_series(raw_data, variable_type="precipitation")
    if not points:
        raise ValueError("Input time series contains no data points.")

    n_points = len(points)
    years = [p.year for p in points]
    min_year, max_year = min(years), max(years)

    # 2. Compute Rolling Accumulations
    # Window of N days: if >10% of window is missing, window value is None.
    max_missing_in_window = int(window_days * 0.10)
    rolling_acc: List[Optional[float]] = [None] * n_points

    # Sliding window
    for i in range(window_days - 1, n_points):
        window_pts = points[i - window_days + 1 : i + 1]
        missing_count = sum(1 for p in window_pts if not p.is_valid or p.value is None)
        if missing_count <= max_missing_in_window:
            valid_vals = [p.value for p in window_pts if p.is_valid and p.value is not None]
            rolling_acc[i] = round(float(sum(valid_vals)), 2)
        else:
            rolling_acc[i] = None

    # 3. Determine Baseline Expected Norm by Day of Year (DOY)
    if baseline_start_year is not None and baseline_end_year is not None:
        baseline_mask = [
            (baseline_start_year <= p.year <= baseline_end_year) for p in points
        ]
        is_exploratory = False
        baseline_desc = f"Fixed {baseline_start_year}–{baseline_end_year} climatological seasonal norm"
        b_start, b_end = baseline_start_year, baseline_end_year
    else:
        baseline_mask = [True] * n_points
        is_exploratory = True
        baseline_desc = f"Exploratory seasonal norm computed over full {min_year}–{max_year} series"
        b_start, b_end = min_year, max_year

    baseline_cfg = BaselineConfig(
        start_year=b_start,
        end_year=b_end,
        is_exploratory=is_exploratory,
        description=baseline_desc,
    )

    # Group baseline accumulations by DOY
    doy_baseline_acc: Dict[int, List[float]] = defaultdict(list)
    for i in range(n_points):
        if baseline_mask[i] and rolling_acc[i] is not None:
            doy = points[i].day_of_year
            doy_baseline_acc[doy].append(rolling_acc[i])  # type: ignore

    # Calculate expected mean per DOY
    all_b_vals = [v for vals in doy_baseline_acc.values() for v in vals]
    overall_mean = float(np.mean(all_b_vals)) if all_b_vals else 0.0

    doy_expected: Dict[int, float] = {}
    for doy in range(1, 367):
        accs = doy_baseline_acc.get(doy, [])
        if len(accs) >= 3:
            doy_expected[doy] = float(np.mean(accs))
        else:
            # When fewer than 3 baseline years exist, fallback to overall baseline mean
            doy_expected[doy] = overall_mean

    # 4. Calculate Daily Deficit Ratios
    # deficit_ratio = (expected - observed) / expected
    deficit_ratios: List[Optional[float]] = [None] * n_points
    for i in range(n_points):
        obs_val = rolling_acc[i]
        if obs_val is None:
            deficit_ratios[i] = None
            continue

        exp_val = doy_expected.get(points[i].day_of_year, 0.0)
        # Numerical guard: avoid divide-by-zero or unstable division for hyper-arid periods
        if exp_val < 5.0:
            deficit_ratios[i] = 0.0
        else:
            ratio = (exp_val - obs_val) / exp_val
            # Clamp between 0.0 (normal or wetter) and 1.0 (100% deficit)
            deficit_ratios[i] = round(float(np.clip(ratio, 0.0, 1.0)), 3)

    # 5. Consecutive Drought Event Detection
    events: List[EventRecord] = []
    current_streak_indices: List[int] = []
    event_days_map: Dict[str, EventRecord] = {}

    for i in range(n_points):
        ratio = deficit_ratios[i]
        if ratio is not None and ratio >= deficit_threshold:
            current_streak_indices.append(i)
        else:
            if len(current_streak_indices) >= min_consecutive_days:
                ev = _create_drought_event_record(current_streak_indices, points, deficit_ratios)
                events.append(ev)
                for idx in current_streak_indices:
                    event_days_map[points[idx].date_str] = ev
            current_streak_indices = []

    if len(current_streak_indices) >= min_consecutive_days:
        ev = _create_drought_event_record(current_streak_indices, points, deficit_ratios)
        events.append(ev)
        for idx in current_streak_indices:
            event_days_map[points[idx].date_str] = ev

    # 6. Annual Aggregation
    annual_metrics = _aggregate_drought_annual_metrics(
        points=points,
        events=events,
        event_days_map=event_days_map,
        deficit_ratios=deficit_ratios,
    )

    total_days = len(points)
    valid_days = sum(1 for p in points if p.is_valid)
    missing_days = total_days - valid_days
    coverage = round((valid_days / total_days) * 100, 2) if total_days > 0 else 0.0

    definitions = {
        "hazard": "Meteorological Drought Proxy",
        "hazard_indicator": "Annual Drought Deficit Days",
        "indicator_name": "Rolling Precipitation Deficit Proxy (Not SPI)",
        "accumulation_window": f"{window_days} Calendar Days",
        "threshold_value": deficit_threshold,
        "threshold_percentile": round(deficit_threshold * 100, 1),
        "threshold_unit": "deficit_ratio",
        "threshold_rule": f"Observed 90-day precipitation ≥ {int(deficit_threshold * 100)}% below expected baseline norm",
        "deficit_threshold": f"Observed 90-day precipitation ≥ {int(deficit_threshold * 100)}% below expected baseline norm",
        "consecutive_run_rule": f"At least {min_consecutive_days} consecutive days of deficit",
        "missing_data_policy": f"Windows with >{max_missing_in_window} missing days ({10}%) are marked invalid and break streaks.",
        "scientific_limitation": "This is a meteorological precipitation deficit indicator. It does not measure soil moisture, evapotranspiration, or groundwater and does not claim agricultural or ecological drought.",
        "baseline_used": baseline_cfg.description,
        "units": {
            "window": "Days",
            "deficit_ratio": "Ratio [0.0–1.0]",
            "precipitation": "mm",
        },
    }

    return HazardAnalysisResult(
        hazard_type="drought",
        threshold_value=deficit_threshold,
        threshold_unit="deficit_ratio",
        threshold_percentile=deficit_threshold * 100,
        baseline_config=baseline_cfg,
        total_series_days=total_days,
        total_valid_days=valid_days,
        total_missing_days=missing_days,
        overall_coverage_pct=coverage,
        events=events,
        annual_metrics=annual_metrics,
        definitions_summary=definitions,
    )


def _create_drought_event_record(
    streak_indices: List[int],
    points: List[DailyObservationPoint],
    ratios: List[Optional[float]],
) -> EventRecord:
    streak_pts = [points[i] for i in streak_indices]
    streak_ratios = [ratios[i] for i in streak_indices if ratios[i] is not None]
    duration = len(streak_pts)
    mean_ratio = round(float(np.mean(streak_ratios)), 3) if streak_ratios else 0.0
    max_ratio = round(float(np.max(streak_ratios)), 3) if streak_ratios else 0.0

    return EventRecord(
        start_date=streak_pts[0].date_str,
        end_date=streak_pts[-1].date_str,
        duration_days=duration,
        daily_values=streak_ratios,  # type: ignore
        mean_value=mean_ratio,
        max_value=max_ratio,
        intensity_metric=mean_ratio,
        metadata={"duration_days": duration},
    )


def _aggregate_drought_annual_metrics(
    points: List[DailyObservationPoint],
    events: List[EventRecord],
    event_days_map: Dict[str, EventRecord],
    deficit_ratios: List[Optional[float]],
) -> List[AnnualHazardMetric]:
    by_year: Dict[int, List[Tuple[DailyObservationPoint, Optional[float]]]] = defaultdict(list)
    for p, r in zip(points, deficit_ratios):
        by_year[p.year].append((p, r))

    events_by_year: Dict[int, List[EventRecord]] = defaultdict(list)
    for ev in events:
        start_year = int(ev.start_date.split("-")[0])
        events_by_year[start_year].append(ev)

    annual_list: List[AnnualHazardMetric] = []
    for year in sorted(by_year.keys()):
        yr_data = by_year[year]
        total_cal_days = TimeseriesValidator.get_days_in_year(year)
        valid_days = sum(1 for p, _ in yr_data if p.is_valid)
        missing_days = total_cal_days - valid_days
        coverage_pct = round((valid_days / total_cal_days) * 100, 2)
        is_comparable = coverage_pct >= 90.0

        yr_events = events_by_year.get(year, [])
        event_count = len(yr_events)

        drought_days = sum(1 for p, _ in yr_data if p.date_str in event_days_map)
        ratios_in_events = [r for p, r in yr_data if p.date_str in event_days_map and r is not None]
        mean_ratio = round(float(np.mean(ratios_in_events)), 3) if ratios_in_events else 0.0
        max_ratio = round(float(np.max(ratios_in_events)), 3) if ratios_in_events else 0.0

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
                hazard_days=drought_days,
                primary_metric=drought_days,  # Primary metric: count of days in meteorological drought
                mean_event_duration=mean_dur,
                max_event_duration=max_dur,
                cumulative_intensity=round(sum(ratios_in_events), 2),
                attributes={
                    "mean_drought_deficit_ratio": mean_ratio,
                    "max_drought_deficit_ratio": max_ratio,
                },
            )
        )

    return annual_list
