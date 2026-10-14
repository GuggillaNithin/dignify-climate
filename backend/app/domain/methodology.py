"""Authoritative scientific methodology definitions, equations, and governance."""
from typing import Any, Dict


def get_methodology_registry() -> Dict[str, Any]:
    """Return dictionary of scientific methodologies, definitions, baselines, and limitations."""
    return {
        "version": "1.0.0",
        "last_updated": "2026-10-11",
        "governance_rule": (
            "All climate metrics, event runs, threshold calculations, and aggregations are strictly deterministic "
            "Python routines. Large Language Models (LLMs) are restricted to descriptive evidence synthesis and are "
            "never permitted to calculate authoritative statistics or generate fabricated observations."
        ),
        "data_source": {
            "provider": "Open-Meteo Historical Weather API",
            "model": "ECMWF ERA5 / ERA5-Land Reanalysis",
            "attribution": "Weather data by Open-Meteo.com under CC-BY 4.0",
            "spatial_resolution": "~0.1° (~11 km)",
            "temporal_resolution": "Daily aggregates (UTC)",
            "limitations": [
                "Reanalysis interpolates satellite, radiosonde, and surface station data through numerical weather models.",
                "Grid cells represent regional volume averages and may smooth localized microclimates or steep topographical gradients.",
                "Single-point coordinates query the nearest model grid centroid (~11 km) and do not represent a regional boundary mean.",
            ],
        },
        "missing_data_governance": {
            "gap_bridging_prohibition": "Missing dates or null observations immediately break consecutive event runs. Gaps are never bridged.",
            "zero_substitution_prohibition": "Missing observation days are never treated as non-hazard, cool, or dry days.",
            "annual_comparability_threshold": "Calendar years with >10% missing daily data (coverage < 90%) are flagged as non-comparable.",
        },
        "hazards": {
            "heatwave": {
                "name": "Heatwave Hazard",
                "variable": "temperature_2m_max (Daily Maximum 2m Air Temperature)",
                "units": "°C",
                "default_percentile": 95.0,
                "consecutive_run_rule": "Strictly ≥ 3 consecutive valid days strictly exceeding the threshold (T_max > threshold).",
                "tie_handling": "Temperatures equal to the threshold do not exceed it.",
                "intensity_metric": "Cumulative Exceedance Degree-Days: Sum of (T_max - threshold) over qualifying event days.",
                "baseline_options": [
                    "Fixed Climatological Baseline: Standard WMO 30-year normal (e.g. 1981–2010 or 1991–2020) requiring ≥80% valid coverage.",
                    "Exploratory Baseline: Percentile calculated across the complete selected historical range.",
                ],
                "year_boundary_attribution": "Events spanning across December 31/January 1 are attributed to their start year, while individual hazard days are credited to the exact calendar year in which they occur.",
            },
            "drought": {
                "name": "Meteorological Drought Proxy",
                "indicator_name": "Rolling Precipitation Deficit Proxy (Explicitly not SPI)",
                "variable": "precipitation_sum (Daily Precipitation Sum)",
                "units": "Deficit Ratio [0.0–1.0], mm accumulation",
                "window_duration": "90 Calendar Days rolling accumulation window",
                "deficit_threshold": "Observed 90-day precipitation ≥ 50% below climatological Day-of-Year (DOY) normal (deficit_ratio ≥ 0.50).",
                "minimum_persistence": "≥ 14 consecutive days of qualifying deficit.",
                "missing_data_policy": "Rolling windows with >10% missing daily data within their 90-day span are marked invalid and terminate streaks.",
                "hyper_arid_handling": "Days where expected 90-day accumulation is < 5.0 mm are guarded against divide-by-zero instability and assigned deficit ratio 0.0.",
                "scientific_disclaimer": "This indicator measures purely meteorological precipitation deficit. It does not measure soil moisture, vegetation stress, or hydrological reservoir levels and does not claim agricultural or ecological drought.",
            },
            "heavy_rainfall": {
                "name": "Heavy Precipitation Hazard",
                "variable": "precipitation_sum (Daily Precipitation Sum)",
                "units": "mm",
                "wet_day_cutoff": "≥ 1.0 mm (WMO ETCCDI standard wet day cutoff)",
                "default_percentile": 95.0,
                "threshold_computation": "Computed strictly from the pool of valid wet days (P ≥ 1.0 mm) in the baseline period.",
                "event_grouping_rule": "Consecutive extreme precipitation days (P ≥ threshold) are grouped into single multi-day storm events.",
                "metrics_produced": [
                    "Heavy rainfall day count (P ≥ threshold)",
                    "Storm event count",
                    "Total heavy precipitation volume (mm)",
                    "Rx1day: Annual maximum 1-day precipitation across all valid days (mm)",
                ],
            },
        },
    }
