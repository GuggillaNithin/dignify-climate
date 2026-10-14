"""Deterministic annual trend analysis, OLS regression, Mann-Kendall non-parametric testing, and multi-year window comparisons."""
from dataclasses import dataclass, field
import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from scipy import stats


@dataclass
class OLSMetrics:
    """Ordinary Least-Squares linear regression results against calendar year."""
    slope_per_year: float
    intercept: float
    r_squared: float
    p_value: float
    stderr: float
    confidence_interval_95: Tuple[float, float]
    sample_count: int
    fitted_values: List[Dict[str, float]]  # [{"year": y, "fitted": val}]


@dataclass
class MannKendallMetrics:
    """Non-parametric Mann-Kendall monotonic trend test with tie adjustment and Sen's slope."""
    tau: float
    s_statistic: int
    variance_s: float
    z_statistic: float
    p_value: float
    sens_slope: float
    sample_size: int
    tied_groups_count: int


@dataclass
class MultiYearWindowComparison:
    """Multi-year mean window comparison avoiding unstable single-endpoint comparisons."""
    early_window_years: List[int]
    early_window_mean: float
    late_window_years: List[int]
    late_window_mean: float
    absolute_change: float
    percentage_change: Optional[float]
    percentage_change_status: str  # "calculated" or reason why null


@dataclass
class RollingPoint:
    """Observed annual point with centered rolling average."""
    year: int
    observed_value: Optional[float]
    rolling_mean: Optional[float]
    is_valid: bool


@dataclass
class TrendAnalysisResult:
    """Complete statistical trend analysis with honest scientific disclaimers."""
    is_calculated: bool
    diagnostic_message: Optional[str]
    total_years: int
    valid_years_count: int
    excluded_years: List[int]
    primary_metric_name: str
    metric_units: str
    ols_regression: Optional[OLSMetrics]
    mann_kendall: Optional[MannKendallMetrics]
    window_comparison: Optional[MultiYearWindowComparison]
    rolling_series: List[RollingPoint]
    trend_direction: str  # "increasing", "decreasing", "no_significant_trend", "insufficient_data"
    is_statistically_significant: bool
    magnitude_summary: str
    scientific_caution: str
    methodology_version: str = "v1.2-scientific"


class TrendAnalyzer:
    """Performs deterministic statistical trend evaluations on annual hazard metrics."""

    MIN_SAMPLE_SIZE: int = 5  # Absolute minimum valid years required for trend tests

    @classmethod
    def analyze_annual_series(
        cls,
        annual_points: List[Tuple[int, Optional[float], bool]],  # (year, value, is_available)
        primary_metric_name: str = "Hazard Days",
        metric_units: str = "days",
        rolling_window_size: int = 3,
    ) -> TrendAnalysisResult:
        """Run complete statistical trend analysis over annual metric points."""
        total_years = len(annual_points)
        if total_years == 0:
            return cls._insufficient_data_result(0, 0, [], primary_metric_name, metric_units, "Empty time series.")

        # Filter valid points
        valid_points: List[Tuple[int, float]] = []
        excluded_years: List[int] = []

        for yr, val, is_avail in annual_points:
            if is_avail and val is not None and not math.isnan(val) and not math.isinf(val):
                valid_points.append((yr, float(val)))
            else:
                excluded_years.append(yr)

        valid_count = len(valid_points)
        rolling_series = cls._compute_rolling_averages(annual_points, rolling_window_size)

        if valid_count < cls.MIN_SAMPLE_SIZE:
            msg = f"Insufficient valid annual samples (N = {valid_count} < {cls.MIN_SAMPLE_SIZE}) to compute defensible trend statistics."
            res = cls._insufficient_data_result(total_years, valid_count, excluded_years, primary_metric_name, metric_units, msg)
            res.rolling_series = rolling_series
            return res

        # Sort valid points chronologically
        valid_points.sort(key=lambda p: p[0])
        years = np.array([p[0] for p in valid_points], dtype=float)
        values = np.array([p[1] for p in valid_points], dtype=float)

        # 1. OLS Regression
        ols_res = cls._compute_ols_regression(years, values)

        # 2. Mann-Kendall Test with tie adjustment & Sen's slope
        mk_res = cls._compute_mann_kendall(years, values)

        # 3. Multi-year comparison windows
        window_comp = cls._compute_window_comparison(valid_points)

        # 4. Trend direction & Significance synthesis
        # Use Mann-Kendall p-value and Sen's slope as primary non-parametric authority
        sig = mk_res.p_value < 0.05
        if sig and mk_res.sens_slope > 0.001:
            direction = "increasing"
        elif sig and mk_res.sens_slope < -0.001:
            direction = "decreasing"
        else:
            direction = "no_significant_trend"

        annual_rate = ols_res.slope_per_year
        decade_rate = annual_rate * 10.0
        sign_str = "+" if annual_rate > 0 else ""
        mag_summary = f"{sign_str}{annual_rate:.2f} {metric_units}/yr ({sign_str}{decade_rate:.1f} {metric_units}/decade)"

        caution = (
            "Statistical trend correlation indicates empirical historical direction over the selected window. "
            "It does not establish physical or anthropogenic causation. Serial autocorrelation (e.g. multi-year climate cycles) "
            "and multiple hypothesis testing may affect nominal p-values."
        )

        return TrendAnalysisResult(
            is_calculated=True,
            diagnostic_message=None,
            total_years=total_years,
            valid_years_count=valid_count,
            excluded_years=excluded_years,
            primary_metric_name=primary_metric_name,
            metric_units=metric_units,
            ols_regression=ols_res,
            mann_kendall=mk_res,
            window_comparison=window_comp,
            rolling_series=rolling_series,
            trend_direction=direction,
            is_statistically_significant=sig,
            magnitude_summary=mag_summary,
            scientific_caution=caution,
            methodology_version="v1.2-scientific",
        )

    @classmethod
    def _compute_ols_regression(cls, years: np.ndarray, values: np.ndarray) -> OLSMetrics:
        """Compute ordinary least squares linear regression."""
        n = len(years)
        # Check if values are identical (constant series, 0 variance)
        var_y = np.var(values)
        if var_y < 1e-12:
            fitted = [{"year": int(y), "fitted": round(float(values[0]), 2)} for y in years]
            return OLSMetrics(
                slope_per_year=0.0,
                intercept=round(float(values[0]), 2),
                r_squared=0.0,
                p_value=1.0,
                stderr=0.0,
                confidence_interval_95=(0.0, 0.0),
                sample_count=n,
                fitted_values=fitted,
            )

        res = stats.linregress(years, values)
        raw_slope = float(res.slope)
        raw_intercept = float(res.intercept)
        raw_stderr = float(res.stderr)

        # 95% Confidence Interval for slope computed from full-precision coefficients
        df = n - 2
        t_crit = stats.t.ppf(0.975, df) if df > 0 else 1.96
        ci_lower = round(raw_slope - t_crit * raw_stderr, 4)
        ci_upper = round(raw_slope + t_crit * raw_stderr, 4)

        slope = round(raw_slope, 4)
        intercept = round(raw_intercept, 4)
        r_sq = round(float(res.rvalue ** 2), 4)
        p_val = round(float(res.pvalue), 5)
        stderr = round(raw_stderr, 4)

        fitted_points = [
            {"year": int(y), "fitted": round(float(raw_slope * y + raw_intercept), 2)}
            for y in years
        ]

        return OLSMetrics(
            slope_per_year=slope,
            intercept=intercept,
            r_squared=r_sq,
            p_value=p_val,
            stderr=stderr,
            confidence_interval_95=(ci_lower, ci_upper),
            sample_count=n,
            fitted_values=fitted_points,
        )

    @classmethod
    def _compute_mann_kendall(cls, years: np.ndarray, values: np.ndarray) -> MannKendallMetrics:
        """Mann-Kendall test with exact tie correction and Sen's slope."""
        n = len(values)

        # 1. Compute Kendall S statistic
        s = 0
        for k in range(n - 1):
            for j in range(k + 1, n):
                diff = values[j] - values[k]
                if diff > 1e-12:
                    s += 1
                elif diff < -1e-12:
                    s -= 1

        # 2. Tie groups calculation
        # Identify frequencies of tied values
        _, counts = np.unique(np.round(values, 4), return_counts=True)
        tie_counts = [int(c) for c in counts if c > 1]
        tied_groups_count = len(tie_counts)

        # 3. Variance of S with tie adjustment
        tie_sum = sum(t * (t - 1) * (2 * t + 5) for t in tie_counts)
        var_s = (n * (n - 1) * (2 * n + 5) - tie_sum) / 18.0

        # If variance is zero or negative (e.g. constant series)
        if var_s <= 1e-12:
            return MannKendallMetrics(
                tau=0.0,
                s_statistic=0,
                variance_s=0.0,
                z_statistic=0.0,
                p_value=1.0,
                sens_slope=0.0,
                sample_size=n,
                tied_groups_count=tied_groups_count,
            )

        # 4. Standardized Z statistic with continuity correction
        if s > 0:
            z = (s - 1) / math.sqrt(var_s)
        elif s < 0:
            z = (s + 1) / math.sqrt(var_s)
        else:
            z = 0.0

        # Two-tailed p-value
        p_val = 2.0 * (1.0 - stats.norm.cdf(abs(z)))
        p_val = round(float(p_val), 5)

        # 5. Kendall's Tau
        total_pairs = n * (n - 1) / 2.0
        tie_adj = sum(t * (t - 1) / 2.0 for t in tie_counts)
        denom = math.sqrt(total_pairs * (total_pairs - tie_adj)) if (total_pairs - tie_adj) > 0 else total_pairs
        tau = round(float(s / denom), 4) if denom > 0 else 0.0

        # 6. Sen's Slope (Theil-Sen estimator)
        pairwise_slopes = []
        for k in range(n - 1):
            for j in range(k + 1, n):
                dt = years[j] - years[k]
                if dt != 0:
                    pairwise_slopes.append((values[j] - values[k]) / dt)

        sens_slope = round(float(np.median(pairwise_slopes)), 4) if pairwise_slopes else 0.0

        return MannKendallMetrics(
            tau=tau,
            s_statistic=s,
            variance_s=round(var_s, 2),
            z_statistic=round(float(z), 4),
            p_value=p_val,
            sens_slope=sens_slope,
            sample_size=n,
            tied_groups_count=tied_groups_count,
        )

    @classmethod
    def _compute_window_comparison(
        cls,
        valid_points: List[Tuple[int, float]],
    ) -> MultiYearWindowComparison:
        """Compare early multi-year baseline window vs late analysis window."""
        n = len(valid_points)
        # Window size: 2 to 5 years (approx 1/3 of series)
        k = max(2, min(5, n // 3))

        early_slice = valid_points[:k]
        late_slice = valid_points[-k:]

        early_years = [p[0] for p in early_slice]
        late_years = [p[0] for p in late_slice]

        early_mean = round(float(np.mean([p[1] for p in early_slice])), 2)
        late_mean = round(float(np.mean([p[1] for p in late_slice])), 2)
        abs_change = round(late_mean - early_mean, 2)

        # Guard against zero, negative, or near-zero baseline division
        if early_mean == 0.0:
            pct_change = None
            status = "Early baseline window mean is 0.0; percentage change is mathematically undefined (division by zero)."
        elif early_mean < 0.0:
            pct_change = None
            status = "Early baseline window mean is negative; relative percentage change is not applicable."
        elif abs(early_mean) < 0.1:
            pct_change = None
            status = f"Early baseline window mean is near-zero ({early_mean}); percentage change is numerically unstable and withheld."
        else:
            pct_val = round(((late_mean - early_mean) / early_mean) * 100.0, 1)
            pct_change = pct_val
            status = "calculated"

        return MultiYearWindowComparison(
            early_window_years=early_years,
            early_window_mean=early_mean,
            late_window_years=late_years,
            late_window_mean=late_mean,
            absolute_change=abs_change,
            percentage_change=pct_change,
            percentage_change_status=status,
        )

    @classmethod
    def _compute_rolling_averages(
        cls,
        annual_points: List[Tuple[int, Optional[float], bool]],
        window_size: int = 3,
    ) -> List[RollingPoint]:
        """Compute centered rolling average series with explicit edge handling."""
        points: List[RollingPoint] = []
        n = len(annual_points)
        half_w = window_size // 2

        for i, (yr, val, is_avail) in enumerate(annual_points):
            # Centered window [i - half_w, i + half_w + 1]
            start_idx = max(0, i - half_w)
            end_idx = min(n, i + half_w + 1)
            window_slice = annual_points[start_idx:end_idx]

            valid_vals = [
                p[1] for p in window_slice
                if p[2] and p[1] is not None and not math.isnan(p[1]) and not math.isinf(p[1])
            ]

            rolling_val = round(float(np.mean(valid_vals)), 2) if valid_vals else None

            points.append(
                RollingPoint(
                    year=yr,
                    observed_value=round(val, 2) if (is_avail and val is not None) else None,
                    rolling_mean=rolling_val,
                    is_valid=is_avail and (val is not None),
                )
            )

        return points

    @classmethod
    def _insufficient_data_result(
        cls,
        total_years: int,
        valid_count: int,
        excluded_years: List[int],
        primary_metric_name: str,
        metric_units: str,
        diagnostic: str,
    ) -> TrendAnalysisResult:
        return TrendAnalysisResult(
            is_calculated=False,
            diagnostic_message=diagnostic,
            total_years=total_years,
            valid_years_count=valid_count,
            excluded_years=excluded_years,
            primary_metric_name=primary_metric_name,
            metric_units=metric_units,
            ols_regression=None,
            mann_kendall=None,
            window_comparison=None,
            rolling_series=[],
            trend_direction="insufficient_data",
            is_statistically_significant=False,
            magnitude_summary="Insufficient valid years for trend calculation",
            scientific_caution="Trend tests require at least 5 complete valid years.",
            methodology_version="v1.2-scientific",
        )
