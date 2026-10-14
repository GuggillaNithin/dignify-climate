"""Unit tests for Phase 5 annual trend analysis, OLS regression, Mann-Kendall test, and window comparisons."""
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.domain.trends import TrendAnalyzer, TrendAnalysisResult
from app.main import app
from app.schemas.analysis import AnalysisRequest


class TestTrendAnalyzerUnit:
    """Deterministic unit tests for trend analysis mathematical algorithms."""

    def test_increasing_series(self):
        """Monotonically increasing series must yield positive slope, p < 0.05, and increasing direction."""
        # 10 years of clearly increasing hazard days
        points = [(2010 + i, float(2 + 3 * i), True) for i in range(10)]
        result = TrendAnalyzer.analyze_annual_series(
            annual_points=points,
            primary_metric_name="Heatwave Days",
            metric_units="days",
        )

        assert result.is_calculated is True
        assert result.valid_years_count == 10
        assert len(result.excluded_years) == 0
        assert result.trend_direction == "increasing"
        assert result.is_statistically_significant is True

        # OLS Metrics
        assert result.ols_regression is not None
        assert result.ols_regression.slope_per_year == pytest.approx(3.0, abs=0.01)
        assert result.ols_regression.r_squared == pytest.approx(1.0, abs=0.01)
        assert result.ols_regression.p_value < 0.001
        assert result.ols_regression.confidence_interval_95[0] > 0
        assert len(result.ols_regression.fitted_values) == 10

        # Mann-Kendall Metrics
        assert result.mann_kendall is not None
        assert result.mann_kendall.s_statistic > 0
        assert result.mann_kendall.tau == pytest.approx(1.0, abs=0.01)
        assert result.mann_kendall.sens_slope == pytest.approx(3.0, abs=0.01)
        assert result.mann_kendall.p_value < 0.01

        # Multi-year Window Comparison (10 // 3 = 3-year windows: [2, 5, 8] vs [23, 26, 29])
        assert result.window_comparison is not None
        assert result.window_comparison.early_window_years == [2010, 2011, 2012]
        assert result.window_comparison.late_window_years == [2017, 2018, 2019]
        assert result.window_comparison.early_window_mean == pytest.approx(5.0, abs=0.1)
        assert result.window_comparison.late_window_mean == pytest.approx(26.0, abs=0.1)
        assert result.window_comparison.percentage_change is not None
        assert result.window_comparison.percentage_change > 0
        assert result.window_comparison.percentage_change_status == "calculated"

        # Rolling Averages
        assert len(result.rolling_series) == 10
        assert result.rolling_series[0].rolling_mean is not None

    def test_decreasing_series(self):
        """Monotonically decreasing series must yield negative slope, p < 0.05, and decreasing direction."""
        points = [(2005 + i, float(30 - 2.5 * i), True) for i in range(10)]
        result = TrendAnalyzer.analyze_annual_series(
            annual_points=points,
            primary_metric_name="Drought Days",
            metric_units="days",
        )

        assert result.is_calculated is True
        assert result.trend_direction == "decreasing"
        assert result.is_statistically_significant is True
        assert result.ols_regression.slope_per_year == pytest.approx(-2.5, abs=0.01)
        assert result.mann_kendall.sens_slope == pytest.approx(-2.5, abs=0.01)
        assert result.mann_kendall.s_statistic < 0
        assert result.mann_kendall.p_value < 0.01
        assert result.window_comparison.absolute_change < 0
        assert result.window_comparison.percentage_change < 0

    def test_no_trend_and_tied_series(self):
        """Series with tied values and no monotonic movement must report no significant trend."""
        # Oscillating tied values
        vals = [10.0, 12.0, 10.0, 12.0, 10.0, 12.0, 10.0, 12.0]
        points = [(2010 + i, vals[i], True) for i in range(len(vals))]

        result = TrendAnalyzer.analyze_annual_series(
            annual_points=points,
            primary_metric_name="Rainfall Intensity",
            metric_units="mm",
        )

        assert result.is_calculated is True
        assert result.trend_direction == "no_significant_trend"
        assert result.is_statistically_significant is False
        assert result.mann_kendall is not None
        assert result.mann_kendall.tied_groups_count > 0  # Tie correction engaged
        assert abs(result.mann_kendall.sens_slope) < 0.1
        assert result.mann_kendall.p_value > 0.05

    def test_short_series_minimum_sample_size(self):
        """Series with fewer than 5 valid years must return is_calculated=False with clear diagnostics."""
        short_points = [
            (2020, 12.0, True),
            (2021, 15.0, True),
            (2022, 18.0, True),
        ]
        result = TrendAnalyzer.analyze_annual_series(
            annual_points=short_points,
            primary_metric_name="Heatwave Days",
            metric_units="days",
        )

        assert result.is_calculated is False
        assert result.valid_years_count == 3
        assert result.total_years == 3
        assert result.trend_direction == "insufficient_data"
        assert "Insufficient valid annual samples (N = 3 < 5)" in result.diagnostic_message
        assert result.ols_regression is None
        assert result.mann_kendall is None
        assert result.window_comparison is None
        # Rolling series is still provided for exploratory view
        assert len(result.rolling_series) == 3

    def test_missing_and_incomplete_years(self):
        """Incomplete or unavailable years must be excluded from regression and MK calculations."""
        points = [
            (2010, 5.0, True),
            (2011, None, False),  # Missing year
            (2012, 9.0, True),
            (2013, 11.0, True),
            (2014, float("nan"), True),  # NaN value
            (2015, 15.0, True),
            (2016, 17.0, True),
            (2017, None, False),  # Incomplete year
            (2018, 21.0, True),
            (2019, 23.0, True),
        ]
        result = TrendAnalyzer.analyze_annual_series(
            annual_points=points,
            primary_metric_name="Heavy Rain Days",
            metric_units="days",
        )

        assert result.is_calculated is True
        assert result.total_years == 10
        assert result.valid_years_count == 7
        assert sorted(result.excluded_years) == [2011, 2014, 2017]
        assert result.ols_regression.sample_count == 7
        assert result.mann_kendall.sample_size == 7
        # Trend is still detected among the valid 7 points
        assert result.trend_direction == "increasing"

    def test_constant_series_zero_variance(self):
        """Constant series must handle 0 variance without ZeroDivisionError."""
        constant_points = [(2010 + i, 10.0, True) for i in range(8)]
        result = TrendAnalyzer.analyze_annual_series(
            annual_points=constant_points,
            primary_metric_name="Baseline Temp",
            metric_units="°C",
        )

        assert result.is_calculated is True
        assert result.trend_direction == "no_significant_trend"
        assert result.is_statistically_significant is False

        # OLS zero slope
        assert result.ols_regression.slope_per_year == 0.0
        assert result.ols_regression.r_squared == 0.0
        assert result.ols_regression.p_value == 1.0

        # Mann-Kendall zero slope
        assert result.mann_kendall.s_statistic == 0
        assert result.mann_kendall.sens_slope == 0.0
        assert result.mann_kendall.p_value == 1.0

        # Window comparison 0% change
        assert result.window_comparison.absolute_change == 0.0
        assert result.window_comparison.percentage_change == 0.0

    def test_near_zero_and_zero_baseline(self):
        """Zero and near-zero baseline window means must withhold percentage change with documented reasons."""
        # 1. Zero baseline: [0, 0] in early window
        zero_baseline = [
            (2010, 0.0, True),
            (2011, 0.0, True),
            (2012, 1.0, True),
            (2013, 2.0, True),
            (2014, 3.0, True),
            (2015, 4.0, True),
        ]
        res_zero = TrendAnalyzer.analyze_annual_series(zero_baseline)
        assert res_zero.window_comparison.early_window_mean == 0.0
        assert res_zero.window_comparison.percentage_change is None
        assert "division by zero" in res_zero.window_comparison.percentage_change_status

        # 2. Near-zero baseline (< 0.1): [0.04, 0.06] -> mean = 0.05
        near_zero_baseline = [
            (2010, 0.04, True),
            (2011, 0.06, True),
            (2012, 1.0, True),
            (2013, 2.0, True),
            (2014, 3.0, True),
            (2015, 4.0, True),
        ]
        res_near_zero = TrendAnalyzer.analyze_annual_series(near_zero_baseline)
        assert res_near_zero.window_comparison.early_window_mean == 0.05
        assert res_near_zero.window_comparison.percentage_change is None
        assert "near-zero" in res_near_zero.window_comparison.percentage_change_status

        # 3. Negative baseline
        neg_baseline = [
            (2010, -5.0, True),
            (2011, -3.0, True),
            (2012, 0.0, True),
            (2013, 2.0, True),
            (2014, 4.0, True),
            (2015, 6.0, True),
        ]
        res_neg = TrendAnalyzer.analyze_annual_series(neg_baseline)
        assert res_neg.window_comparison.percentage_change is None
        assert "negative" in res_neg.window_comparison.percentage_change_status

    def test_rolling_averages_edge_behavior(self):
        """Centered rolling average must compute boundary windows without truncation or shift."""
        points = [
            (2015, 10.0, True),
            (2016, 20.0, True),
            (2017, 30.0, True),
            (2018, 40.0, True),
            (2019, 50.0, True),
        ]
        rolling = TrendAnalyzer._compute_rolling_averages(points, window_size=3)
        assert len(rolling) == 5

        # Year 2015 (index 0, window [0:2]): mean(10, 20) = 15.0
        assert rolling[0].rolling_mean == 15.0
        # Year 2016 (index 1, window [0:3]): mean(10, 20, 30) = 20.0
        assert rolling[1].rolling_mean == 20.0
        # Year 2017 (index 2, window [1:4]): mean(20, 30, 40) = 30.0
        assert rolling[2].rolling_mean == 30.0
        # Year 2019 (index 4, window [3:5]): mean(40, 50) = 45.0
        assert rolling[4].rolling_mean == 45.0

    def test_scientific_caution_and_disclaimer(self):
        """All computed trend results must include clear scientific disclaimers on autocorrelation and causation."""
        points = [(2010 + i, float(10 + i), True) for i in range(10)]
        result = TrendAnalyzer.analyze_annual_series(points)
        assert "causation" in result.scientific_caution.lower()
        assert "autocorrelation" in result.scientific_caution.lower()
        assert result.methodology_version == "v1.2-scientific"


class TestTrendAPIIntegration:
    """End-to-end API integration tests verifying trend metrics and event lists in analysis responses."""

    def test_api_analysis_returns_trends_and_events(self):
        """API endpoint /api/v1/analysis must include trends, events_list, and valid regression fields."""
        from datetime import date, timedelta
        from app.schemas.weather import WeatherDailyObservation, WeatherMetadata, WeatherSeriesResponse

        client = TestClient(app)

        # Generate 2015 to 2020 daily data (6 years >= 5 min sample size)
        daily_obs = []
        cur_date = date(2015, 1, 1)
        end_date = date(2020, 12, 31)
        while cur_date <= end_date:
            year = cur_date.year
            t_max = 28.0 + (year - 2015) * 1.5 + (0.5 if cur_date.day % 2 == 0 else 0.0)
            daily_obs.append(WeatherDailyObservation(date=cur_date.isoformat(), temperature_max=t_max, precipitation=2.0))
            cur_date += timedelta(days=1)

        mock_series = WeatherSeriesResponse(
            latitude=37.77,
            longitude=-122.42,
            metadata=WeatherMetadata(
                retrieved_at="2026-10-11T00:00:00Z",
                cached=False,
                cache_source="upstream_fetched",
                grid_latitude=37.8,
                grid_longitude=-122.4,
                total_days=len(daily_obs),
                valid_temperature_days=len(daily_obs),
                missing_temperature_days=0,
                valid_precipitation_days=len(daily_obs),
                missing_precipitation_days=0,
            ),
            daily=daily_obs,
        )

        with patch("app.services.weather_service.WeatherService.get_weather_series", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_series

            payload = {
                "hazard_type": "heatwave",
                "point": {"latitude": 37.77, "longitude": -122.42},
                "start_date": "2015-01-01",
                "end_date": "2020-12-31",
                "percentile": 90.0,
            }

            resp = client.post("/api/v1/analysis", json=payload)
            assert resp.status_code == 200
            data = resp.json()

            # Verify response schema fields
            assert "trends" in data
            assert data["trends"] is not None
            trends = data["trends"]

            assert trends["is_calculated"] is True
            assert trends["total_years"] == 6
            assert trends["valid_years_count"] == 6
            assert trends["methodology_version"] == "v1.2-scientific"
            assert "causation" in trends["scientific_caution"].lower()

            # Verify OLS fields
            assert trends["ols_regression"] is not None
            assert "slope_per_year" in trends["ols_regression"]
            assert "r_squared" in trends["ols_regression"]
            assert "confidence_interval_95" in trends["ols_regression"]
            assert len(trends["ols_regression"]["fitted_values"]) == 6

            # Verify Mann-Kendall fields
            assert trends["mann_kendall"] is not None
            assert "tau" in trends["mann_kendall"]
            assert "s_statistic" in trends["mann_kendall"]
            assert "sens_slope" in trends["mann_kendall"]
            assert "tied_groups_count" in trends["mann_kendall"]

            # Verify Window Comparison fields
            assert trends["window_comparison"] is not None
            assert "early_window_mean" in trends["window_comparison"]
            assert "late_window_mean" in trends["window_comparison"]
            assert "percentage_change" in trends["window_comparison"]

            # Verify Rolling Series
            assert len(trends["rolling_series"]) == 6

            # Verify Events list
            assert "events_list" in data
            assert isinstance(data["events_list"], list)
