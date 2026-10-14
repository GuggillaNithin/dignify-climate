"""Independent Scientific Validation of Mumbai Drought Analysis (Dygnify).

This script independently ingests the raw daily precipitation observations,
computes the 90-day rolling accumulation, derives the climatological baseline,
calculates the deficit ratios, detects qualifying streaks >= 14 days,
aggregates annual hazard metrics, and computes OLS, Mann-Kendall, and Sen's slope statistics.

It does NOT import any domain logic from app.domain.drought or app.domain.trends.
"""
import csv
from datetime import date, datetime, timedelta
import json
import math
import os
import sys
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from scipy import stats

def parse_iso(d_str: str) -> date:
    return datetime.strptime(d_str, "%Y-%m-%d").date()

def run_independent_validation(raw_csv_path: str) -> Dict[str, Any]:
    # 1. Ingest Raw Observations
    with open(raw_csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    dates: List[date] = []
    precips: List[Optional[float]] = []
    temps: List[Optional[float]] = []

    for r in rows:
        d = parse_iso(r["date"])
        dates.append(d)
        p = float(r["precipitation"]) if r["precipitation"] != "" else None
        t = float(r["temperature_max"]) if r["temperature_max"] != "" else None
        precips.append(p)
        temps.append(t)

    n_days = len(dates)
    assert n_days == 3287, f"Expected 3287 days, got {n_days}"

    # Verify continuity
    for i in range(n_days - 1):
        assert dates[i + 1] - dates[i] == timedelta(days=1), f"Gap between {dates[i]} and {dates[i+1]}"

    # 2. Compute 90-day Rolling Accumulation
    window_days = 90
    max_missing_in_window = int(window_days * 0.10)  # 9 days
    rolling_acc: List[Optional[float]] = [None] * n_days

    for i in range(window_days - 1, n_days):
        window_slice = precips[i - window_days + 1 : i + 1]
        missing_count = sum(1 for val in window_slice if val is None)
        if missing_count <= max_missing_in_window:
            valid_vals = [val for val in window_slice if val is not None]
            rolling_acc[i] = round(float(sum(valid_vals)), 2)
        else:
            rolling_acc[i] = None

    valid_rolling_count = sum(1 for v in rolling_acc if v is not None)
    incomplete_window_count = sum(1 for v in rolling_acc if v is None)
    assert incomplete_window_count == 89, f"Expected 89 incomplete windows at start, got {incomplete_window_count}"
    assert valid_rolling_count == 3198, f"Expected 3198 valid rolling windows, got {valid_rolling_count}"

    # 3. Derive Climatological Norm by Day-of-Year (DOY)
    # Using 2015-2023 exploratory baseline
    doy_baseline_acc: Dict[int, List[float]] = {doy: [] for doy in range(1, 367)}
    for i in range(n_days):
        if rolling_acc[i] is not None:
            doy = dates[i].timetuple().tm_yday
            doy_baseline_acc[doy].append(rolling_acc[i])

    all_b_vals = [v for vals in doy_baseline_acc.values() for v in vals]
    overall_mean = float(np.mean(all_b_vals)) if all_b_vals else 0.0

    doy_expected: Dict[int, float] = {}
    doy_year_counts: Dict[int, int] = {}
    for doy in range(1, 367):
        accs = doy_baseline_acc[doy]
        doy_year_counts[doy] = len(accs)
        if len(accs) >= 3:
            doy_expected[doy] = float(np.mean(accs))
        else:
            doy_expected[doy] = overall_mean

    # 4. Compute Daily Deficit Ratio
    deficit_ratios: List[Optional[float]] = [None] * n_days
    for i in range(n_days):
        obs = rolling_acc[i]
        if obs is None:
            deficit_ratios[i] = None
            continue
        doy = dates[i].timetuple().tm_yday
        exp_val = doy_expected.get(doy, 0.0)
        if exp_val < 5.0:
            deficit_ratios[i] = 0.0
        else:
            ratio = (exp_val - obs) / exp_val
            deficit_ratios[i] = round(float(np.clip(ratio, 0.0, 1.0)), 3)

    # 5. Consecutive Drought Event Detection
    deficit_threshold = 0.50
    min_consecutive_days = 14

    events: List[Dict[str, Any]] = []
    current_streak: List[int] = []
    event_day_indices: set = set()

    for i in range(n_days):
        r = deficit_ratios[i]
        if r is not None and r >= deficit_threshold:
            current_streak.append(i)
        else:
            if len(current_streak) >= min_consecutive_days:
                st_date = dates[current_streak[0]].isoformat()
                end_date = dates[current_streak[-1]].isoformat()
                dur = len(current_streak)
                r_vals = [deficit_ratios[idx] for idx in current_streak if deficit_ratios[idx] is not None]
                ev = {
                    "event_id": len(events) + 1,
                    "start_date": st_date,
                    "end_date": end_date,
                    "duration_days": dur,
                    "mean_deficit_ratio": round(float(np.mean(r_vals)), 3) if r_vals else 0.0,
                    "max_deficit_ratio": round(float(np.max(r_vals)), 3) if r_vals else 0.0,
                    "daily_values": r_vals,
                    "streak_indices": current_streak[:],
                }
                events.append(ev)
                for idx in current_streak:
                    event_day_indices.add(idx)
            current_streak = []

    if len(current_streak) >= min_consecutive_days:
        st_date = dates[current_streak[0]].isoformat()
        end_date = dates[current_streak[-1]].isoformat()
        dur = len(current_streak)
        r_vals = [deficit_ratios[idx] for idx in current_streak if deficit_ratios[idx] is not None]
        ev = {
            "event_id": len(events) + 1,
            "start_date": st_date,
            "end_date": end_date,
            "duration_days": dur,
            "mean_deficit_ratio": round(float(np.mean(r_vals)), 3) if r_vals else 0.0,
            "max_deficit_ratio": round(float(np.max(r_vals)), 3) if r_vals else 0.0,
            "daily_values": r_vals,
            "streak_indices": current_streak[:],
        }
        events.append(ev)
        for idx in current_streak:
            event_day_indices.add(idx)

    # Total qualifying deficit days regardless of streak length:
    all_qualifying_indices = [i for i in range(n_days) if deficit_ratios[i] is not None and deficit_ratios[i] >= deficit_threshold]

    # 6. Annual Aggregation
    annual_results: List[Dict[str, Any]] = []
    years = sorted(list({d.year for d in dates}))

    for yr in years:
        yr_indices = [i for i in range(n_days) if dates[i].year == yr]
        total_cal_days = len(yr_indices)
        valid_days = sum(1 for i in yr_indices if precips[i] is not None)
        coverage_pct = round((valid_days / total_cal_days) * 100.0, 2)

        # Hazard days: days falling in this year that belong to an event
        drought_days = sum(1 for i in yr_indices if i in event_day_indices)

        # Events starting in this year
        yr_events = [ev for ev in events if parse_iso(ev["start_date"]).year == yr]
        event_count = len(yr_events)

        durations = [ev["duration_days"] for ev in yr_events]
        mean_dur = round(float(np.mean(durations)), 2) if durations else 0.0
        max_dur = max(durations) if durations else 0

        ratios_in_events = [deficit_ratios[i] for i in yr_indices if i in event_day_indices and deficit_ratios[i] is not None]
        mean_ratio = round(float(np.mean(ratios_in_events)), 3) if ratios_in_events else 0.0
        max_ratio = round(float(np.max(ratios_in_events)), 3) if ratios_in_events else 0.0

        annual_results.append({
            "year": yr,
            "total_calendar_days": total_cal_days,
            "valid_observed_days": valid_days,
            "coverage_pct": coverage_pct,
            "hazard_days": drought_days,
            "event_count": event_count,
            "mean_event_duration": mean_dur,
            "max_event_duration": max_dur,
            "mean_deficit_ratio": mean_ratio,
            "max_deficit_ratio": max_ratio,
        })

    # 7. Independent Trend Statistics
    yrs_arr = np.array([res["year"] for res in annual_results], dtype=float)
    vals_arr = np.array([res["hazard_days"] for res in annual_results], dtype=float)
    n_yrs = len(yrs_arr)

    # OLS Regression
    res_ols = stats.linregress(yrs_arr, vals_arr)
    df = n_yrs - 2
    t_crit = stats.t.ppf(0.975, df)
    ci_lower = round(float(res_ols.slope - t_crit * res_ols.stderr), 4)
    ci_upper = round(float(res_ols.slope + t_crit * res_ols.stderr), 4)

    ols_metrics = {
        "slope_per_year": round(float(res_ols.slope), 4),
        "intercept": round(float(res_ols.intercept), 4),
        "r_squared": round(float(res_ols.rvalue ** 2), 4),
        "p_value": round(float(res_ols.pvalue), 5),
        "stderr": round(float(res_ols.stderr), 4),
        "confidence_interval_95": [ci_lower, ci_upper],
        "sample_count": n_yrs,
    }

    # Mann-Kendall with tie adjustment and Sen's slope
    s = 0
    for k in range(n_yrs - 1):
        for j in range(k + 1, n_yrs):
            diff = vals_arr[j] - vals_arr[k]
            if diff > 1e-12:
                s += 1
            elif diff < -1e-12:
                s -= 1

    _, counts = np.unique(np.round(vals_arr, 4), return_counts=True)
    tie_counts = [int(c) for c in counts if c > 1]
    tied_groups_count = len(tie_counts)

    tie_sum = sum(t * (t - 1) * (2 * t + 5) for t in tie_counts)
    var_s = (n_yrs * (n_yrs - 1) * (2 * n_yrs + 5) - tie_sum) / 18.0

    if s > 0:
        z = (s - 1) / math.sqrt(var_s)
    elif s < 0:
        z = (s + 1) / math.sqrt(var_s)
    else:
        z = 0.0

    p_val_mk = round(float(2.0 * (1.0 - stats.norm.cdf(abs(z)))), 5)

    total_pairs = n_yrs * (n_yrs - 1) / 2.0
    tie_adj = sum(t * (t - 1) / 2.0 for t in tie_counts)
    denom = math.sqrt(total_pairs * (total_pairs - tie_adj)) if (total_pairs - tie_adj) > 0 else total_pairs
    tau = round(float(s / denom), 4) if denom > 0 else 0.0

    pairwise_slopes = []
    for k in range(n_yrs - 1):
        for j in range(k + 1, n_yrs):
            pairwise_slopes.append((vals_arr[j] - vals_arr[k]) / (yrs_arr[j] - yrs_arr[k]))
    sens_slope = round(float(np.median(pairwise_slopes)), 4) if pairwise_slopes else 0.0

    mk_metrics = {
        "tau": tau,
        "s_statistic": s,
        "variance_s": round(var_s, 2),
        "z_statistic": round(float(z), 4),
        "p_value": p_val_mk,
        "sens_slope": sens_slope,
        "sample_size": n_yrs,
        "tied_groups_count": tied_groups_count,
        "tie_counts": tie_counts,
    }

    # Window comparison (3 early: 2015-2017, 3 late: 2021-2023)
    k_win = 3
    early_vals = vals_arr[:k_win]
    late_vals = vals_arr[-k_win:]
    early_mean = round(float(np.mean(early_vals)), 2)
    late_mean = round(float(np.mean(late_vals)), 2)
    abs_change = round(late_mean - early_mean, 2)
    pct_change = round(((late_mean - early_mean) / early_mean) * 100.0, 1)

    window_comp = {
        "early_window_years": [int(y) for y in yrs_arr[:k_win]],
        "early_window_mean": early_mean,
        "late_window_years": [int(y) for y in yrs_arr[-k_win:]],
        "late_window_mean": late_mean,
        "absolute_change": abs_change,
        "percentage_change": pct_change,
    }

    return {
        "data_summary": {
            "total_days": n_days,
            "start_date": dates[0].isoformat(),
            "end_date": dates[-1].isoformat(),
            "valid_rolling_windows": valid_rolling_count,
            "incomplete_initial_windows": incomplete_window_count,
            "first_valid_rolling_date": dates[89].isoformat(),
            "total_qualifying_deficit_days": len(all_qualifying_indices),
            "event_deficit_days": len(event_day_indices),
            "discarded_deficit_streak_days": len(all_qualifying_indices) - len(event_day_indices),
            "events_count": len(events),
        },
        "annual_results": annual_results,
        "events": events,
        "ols_metrics": ols_metrics,
        "mann_kendall_metrics": mk_metrics,
        "window_comparison": window_comp,
    }

if __name__ == "__main__":
    csv_file = sys.argv[1] if len(sys.argv) > 1 else "mumbai_raw_weather_daily.csv"
    res = run_independent_validation(csv_file)
    print("Independent Validation Run Completed.")
    print("Total Days:", res["data_summary"]["total_days"])
    print("Event Days:", res["data_summary"]["event_deficit_days"])
    print("Events Count:", res["data_summary"]["events_count"])
    for yr in res["annual_results"]:
        print(f"  {yr['year']}: drought_days={yr['hazard_days']}, event_count={yr['event_count']}")
    print("OLS:", res["ols_metrics"])
    print("MK:", res["mann_kendall_metrics"])
    print("Window:", res["window_comparison"])
