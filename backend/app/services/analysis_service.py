"""Geospatial analysis orchestrator coordinating weather retrieval, hazard calculation, and spatial aggregation."""
from datetime import datetime, timezone
import hashlib
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from app.db.repositories.analysis_repo import analysis_repo
from app.domain.drought import detect_drought_proxy
from app.domain.geospatial import (
    BoundingBox,
    GeospatialSampler,
    PointCoordinate,
    RegionalAggregator,
    SampledGridPoint,
)
from app.domain.heatwave import detect_heatwaves
from app.domain.models import HazardAnalysisResult
from app.domain.rainfall import detect_heavy_rainfall
from app.domain.trends import TrendAnalysisResult, TrendAnalyzer
from app.schemas.analysis import (
    AnalysisRequest,
    AnalysisResponse,
    MannKendallMetricsSchema,
    MultiYearWindowComparisonSchema,
    OLSMetricsSchema,
    RegionalAnnualMetricSchema,
    RollingPointSchema,
    SampledGridPointSchema,
    SpatialMetadataSchema,
    TrendAnalysisResultSchema,
)
from app.services.weather_service import weather_service

logger = logging.getLogger(__name__)


class AnalysisService:
    """Executes point or bounding-box climate hazard analyses with full data governance."""

    def __init__(self, repo=None, weather_svc=None):
        self.repo = repo or analysis_repo
        self.weather_svc = weather_svc or weather_service

    @staticmethod
    def compute_cache_key(request: AnalysisRequest) -> str:
        """Generate deterministic hash for analysis caching."""
        payload = {
            "mode": request.mode,
            "point": request.point.model_dump() if request.point else None,
            "bounds": request.bounds.model_dump() if request.bounds else None,
            "hazard_type": request.hazard_type,
            "start_date": request.start_date,
            "end_date": request.end_date,
            "percentile": request.percentile,
            "min_consecutive_days": request.min_consecutive_days,
            "baseline_start_year": request.baseline_start_year,
            "baseline_end_year": request.baseline_end_year,
            "min_spatial_coverage_pct": request.min_spatial_coverage_pct,
            "sample_density": request.sample_density,
        }
        raw_str = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

    async def execute_analysis(self, request: AnalysisRequest) -> AnalysisResponse:
        """Run climate hazard analysis in point or bounding-box mode."""
        cache_key = self.compute_cache_key(request)

        # Check existing cache
        cached = await self.repo.get_by_cache_key(cache_key)
        if cached and "annual_series" in cached:
            logger.info("Serving analysis from cache for key: %s", cache_key[:12])
            return AnalysisResponse(**cached["response_data"])

        analysis_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()

        if request.mode == "point":
            response = await self._analyze_point(request, analysis_id, created_at)
        else:
            response = await self._analyze_bounding_box(request, analysis_id, created_at)

        # Persist to repository
        await self.repo.save_analysis(
            analysis_id=analysis_id,
            cache_key=cache_key,
            data={"response_data": response.model_dump()},
        )

        return response

    async def _analyze_point(
        self,
        request: AnalysisRequest,
        analysis_id: str,
        created_at: str,
    ) -> AnalysisResponse:
        """Run analysis for a single coordinate."""
        pt = request.point
        assert pt is not None

        coord = PointCoordinate(latitude=pt.latitude, longitude=pt.longitude)

        # Fetch observations from provider/cache
        weather_resp = await self.weather_svc.get_weather_series(
            latitude=coord.latitude,
            longitude=coord.longitude,
            start_date=request.start_date,
            end_date=request.end_date,
        )

        # Execute pure hazard domain logic
        hazard_result = self._run_domain_hazard(
            hazard_type=request.hazard_type,
            daily_observations=weather_resp.daily,
            percentile=request.percentile,
            min_consecutive_days=request.min_consecutive_days,
            baseline_start_year=request.baseline_start_year,
            baseline_end_year=request.baseline_end_year,
        )

        sampled_pt = SampledGridPointSchema(
            latitude=coord.latitude,
            longitude=coord.longitude,
            grid_key=coord.grid_key,
            cosine_weight=1.0,
            normalized_weight=1.0,
        )

        # Map annual metrics to regional schema format
        annual_series = [
            RegionalAnnualMetricSchema(
                year=m.year,
                is_available=m.is_comparable,
                spatial_coverage_pct=100.0 if m.is_comparable else 0.0,
                valid_points_count=1 if m.is_comparable else 0,
                total_points_count=1,
                weighted_hazard_days=float(m.hazard_days) if m.is_comparable else None,
                weighted_event_count=float(m.event_count) if m.is_comparable else None,
                weighted_primary_metric=float(m.primary_metric) if m.is_comparable else None,
                weighted_intensity=float(m.cumulative_intensity) if m.is_comparable else None,
                coverage_status="Single point observation" if m.is_comparable else "Incomplete point data (<90% days)",
                point_contributions=[{
                    "grid_key": coord.grid_key,
                    "latitude": coord.latitude,
                    "longitude": coord.longitude,
                    "weight": 1.0,
                    "hazard_days": m.hazard_days,
                    "event_count": m.event_count,
                    "primary_metric": m.primary_metric,
                    "is_valid": m.is_comparable,
                }],
            )
            for m in hazard_result.annual_metrics
        ]

        spatial_meta = SpatialMetadataSchema(
            mode="point",
            representation_text=(
                f"Single coordinate represents the nearest ~11 km ERA5 model grid cell ({coord.latitude:.2f}°, {coord.longitude:.2f}°). "
                "This reflects local atmospheric reanalysis for that cell and is not an interpolated municipal average."
            ),
            sample_count=1,
            area_weighting_method="Single cell (weight 1.0)",
            point={"latitude": coord.latitude, "longitude": coord.longitude},
            resolution="~0.1° (~11 km) ERA5 grid cell",
        )

        # Compute deterministic annual trend statistics
        annual_points = [
            (m.year, m.weighted_hazard_days if m.is_available else None, m.is_available)
            for m in annual_series
        ]
        metric_name, metric_unit = self._get_metric_info(request.hazard_type)
        trend_res = TrendAnalyzer.analyze_annual_series(annual_points, metric_name, metric_unit)
        trend_schema = self._format_trend_schema(trend_res)

        events_list = [
            {
                "start_date": ev.start_date,
                "end_date": ev.end_date,
                "duration_days": ev.duration_days,
                "mean_value": ev.mean_value,
                "max_value": ev.max_value,
                "intensity_metric": ev.intensity_metric,
            }
            for ev in hazard_result.events
        ]

        return AnalysisResponse(
            analysis_id=analysis_id,
            mode="point",
            hazard_type=request.hazard_type,
            spatial_metadata=spatial_meta,
            sampled_points=[sampled_pt],
            annual_series=annual_series,
            point_results=[{
                "grid_key": coord.grid_key,
                "latitude": coord.latitude,
                "longitude": coord.longitude,
                "events_count": len(hazard_result.events),
                "threshold_value": hazard_result.threshold_value,
                "threshold_percentile": hazard_result.threshold_percentile,
                "threshold_unit": hazard_result.threshold_unit,
                "baseline": hazard_result.baseline_config.description,
            }],
            trends=trend_schema,
            events_list=events_list,
            definitions_summary=hazard_result.definitions_summary,
            created_at=created_at,
        )

    async def _analyze_bounding_box(
        self,
        request: AnalysisRequest,
        analysis_id: str,
        created_at: str,
    ) -> AnalysisResponse:
        """Run regional analysis by sampling bounded grid points inside the bounding box."""
        b = request.bounds
        assert b is not None

        bbox = BoundingBox(south=b.south, north=b.north, west=b.west, east=b.east)
        sampled_points = GeospatialSampler.sample_bounding_box(
            bounds=bbox,
            max_points=request.sample_density,
        )

        # Fetch weather series and execute hazard logic for each sampled point
        point_hazard_results: Dict[str, HazardAnalysisResult] = {}
        point_summaries: List[Dict[str, Any]] = []

        for p in sampled_points:
            weather_resp = await self.weather_svc.get_weather_series(
                latitude=p.latitude,
                longitude=p.longitude,
                start_date=request.start_date,
                end_date=request.end_date,
            )

            h_res = self._run_domain_hazard(
                hazard_type=request.hazard_type,
                daily_observations=weather_resp.daily,
                percentile=request.percentile,
                min_consecutive_days=request.min_consecutive_days,
                baseline_start_year=request.baseline_start_year,
                baseline_end_year=request.baseline_end_year,
            )

            point_hazard_results[p.grid_key] = h_res
            point_summaries.append({
                "grid_key": p.grid_key,
                "latitude": p.latitude,
                "longitude": p.longitude,
                "weight": p.normalized_weight,
                "events_count": len(h_res.events),
                "threshold_value": h_res.threshold_value,
                "threshold_percentile": h_res.threshold_percentile,
                "threshold_unit": h_res.threshold_unit,
                "baseline": h_res.baseline_config.description,
            })

        # Regional Aggregation with Cosine-Latitude Spatial Weighting
        regional_annual = RegionalAggregator.aggregate_points(
            sampled_points=sampled_points,
            point_hazard_results=point_hazard_results,
            min_spatial_coverage_pct=request.min_spatial_coverage_pct,
        )

        # Convert to schemas
        annual_series = [
            RegionalAnnualMetricSchema(
                year=r.year,
                is_available=r.is_available,
                spatial_coverage_pct=r.spatial_coverage_pct,
                valid_points_count=r.valid_points_count,
                total_points_count=r.total_points_count,
                weighted_hazard_days=r.weighted_hazard_days,
                weighted_event_count=r.weighted_event_count,
                weighted_primary_metric=r.weighted_primary_metric,
                weighted_intensity=r.weighted_intensity,
                coverage_status=r.coverage_status,
                point_contributions=r.point_contributions,
            )
            for r in regional_annual
        ]

        sampled_schemas = [
            SampledGridPointSchema(
                latitude=p.latitude,
                longitude=p.longitude,
                grid_key=p.grid_key,
                cosine_weight=round(p.cosine_weight, 4),
                normalized_weight=p.normalized_weight,
            )
            for p in sampled_points
        ]

        # Use definition summary from first sampled point
        definitions = next(iter(point_hazard_results.values())).definitions_summary

        spatial_meta = SpatialMetadataSchema(
            mode="bounding_box",
            representation_text=(
                f"Regional domain [{bbox.south:.2f}°S, {bbox.north:.2f}°N, {bbox.west:.2f}°W, {bbox.east:.2f}°E] "
                f"sampled across {len(sampled_points)} distinct grid cells using cosine-latitude spherical area weighting. "
                f"Points are evaluated independently and aggregated; years with spatial coverage < {request.min_spatial_coverage_pct}% "
                "are marked unavailable rather than quietly biasing regional trends."
            ),
            sample_count=len(sampled_points),
            area_weighting_method="Cosine-latitude spherical area weighting: w_i = cos(lat_i * pi / 180)",
            bounds={
                "south": bbox.south,
                "north": bbox.north,
                "west": bbox.west,
                "east": bbox.east,
            },
            resolution=f"Sampled at {bbox.latitude_span / max(1, len(sampled_points) ** 0.5):.2f}° grid interval",
        )

        # Persist region definition in MongoDB regions collection
        region_id = f"bbox_{bbox.south:.2f}_{bbox.north:.2f}_{bbox.west:.2f}_{bbox.east:.2f}"
        await self.repo.save_region(
            region_id=region_id,
            region_data={
                "bounds": bbox.__dict__,
                "sample_count": len(sampled_points),
                "sampled_points": [p.__dict__ for p in sampled_points],
            },
        )

        # Compute deterministic annual trend statistics
        annual_points = [
            (m.year, m.weighted_hazard_days if m.is_available else None, m.is_available)
            for m in annual_series
        ]
        metric_name, metric_unit = self._get_metric_info(request.hazard_type)
        trend_res = TrendAnalyzer.analyze_annual_series(annual_points, metric_name, metric_unit)
        trend_schema = self._format_trend_schema(trend_res)

        events_list = [
            {
                "grid_key": gk,
                "start_date": ev.start_date,
                "end_date": ev.end_date,
                "duration_days": ev.duration_days,
                "mean_value": ev.mean_value,
                "max_value": ev.max_value,
                "intensity_metric": ev.intensity_metric,
            }
            for gk, h_res in point_hazard_results.items()
            for ev in h_res.events
        ]

        return AnalysisResponse(
            analysis_id=analysis_id,
            mode="bounding_box",
            hazard_type=request.hazard_type,
            spatial_metadata=spatial_meta,
            sampled_points=sampled_schemas,
            annual_series=annual_series,
            point_results=point_summaries,
            trends=trend_schema,
            events_list=events_list,
            definitions_summary=definitions,
            created_at=created_at,
        )

    @staticmethod
    def _get_metric_info(hazard_type: str) -> tuple[str, str]:
        if hazard_type == "heatwave":
            return "Annual Heatwave Days", "days"
        elif hazard_type == "drought":
            return "Annual Drought Deficit Days", "days"
        return "Annual Heavy Rainfall Days", "days"

    @staticmethod
    def _format_trend_schema(trend_res: TrendAnalysisResult) -> TrendAnalysisResultSchema:
        ols_schema = None
        if trend_res.ols_regression:
            ols = trend_res.ols_regression
            ols_schema = OLSMetricsSchema(
                slope_per_year=ols.slope_per_year,
                intercept=ols.intercept,
                r_squared=ols.r_squared,
                p_value=ols.p_value,
                stderr=ols.stderr,
                confidence_interval_95=ols.confidence_interval_95,
                sample_count=ols.sample_count,
                fitted_values=ols.fitted_values,
            )

        mk_schema = None
        if trend_res.mann_kendall:
            mk = trend_res.mann_kendall
            mk_schema = MannKendallMetricsSchema(
                tau=mk.tau,
                s_statistic=mk.s_statistic,
                variance_s=mk.variance_s,
                z_statistic=mk.z_statistic,
                p_value=mk.p_value,
                sens_slope=mk.sens_slope,
                sample_size=mk.sample_size,
                tied_groups_count=mk.tied_groups_count,
            )

        win_schema = None
        if trend_res.window_comparison:
            wc = trend_res.window_comparison
            win_schema = MultiYearWindowComparisonSchema(
                early_window_years=wc.early_window_years,
                early_window_mean=wc.early_window_mean,
                late_window_years=wc.late_window_years,
                late_window_mean=wc.late_window_mean,
                absolute_change=wc.absolute_change,
                percentage_change=wc.percentage_change,
                percentage_change_status=wc.percentage_change_status,
            )

        rolling_schemas = [
            RollingPointSchema(
                year=rp.year,
                observed_value=rp.observed_value,
                rolling_mean=rp.rolling_mean,
                is_valid=rp.is_valid,
            )
            for rp in trend_res.rolling_series
        ]

        return TrendAnalysisResultSchema(
            is_calculated=trend_res.is_calculated,
            diagnostic_message=trend_res.diagnostic_message,
            total_years=trend_res.total_years,
            valid_years_count=trend_res.valid_years_count,
            excluded_years=trend_res.excluded_years,
            primary_metric_name=trend_res.primary_metric_name,
            metric_units=trend_res.metric_units,
            ols_regression=ols_schema,
            mann_kendall=mk_schema,
            window_comparison=win_schema,
            rolling_series=rolling_schemas,
            trend_direction=trend_res.trend_direction,
            is_statistically_significant=trend_res.is_statistically_significant,
            magnitude_summary=trend_res.magnitude_summary,
            scientific_caution=trend_res.scientific_caution,
            methodology_version=trend_res.methodology_version,
        )

    def _run_domain_hazard(
        self,
        hazard_type: str,
        daily_observations: list,
        percentile: float,
        min_consecutive_days: Optional[int],
        baseline_start_year: Optional[int],
        baseline_end_year: Optional[int],
    ) -> HazardAnalysisResult:
        """Route to appropriate pure Python hazard domain function."""
        if hazard_type == "heatwave":
            temp_series = [(obs.date, obs.temperature_max) for obs in daily_observations]
            return detect_heatwaves(
                raw_data=temp_series,
                percentile=percentile,
                min_consecutive_days=min_consecutive_days or 3,
                baseline_start_year=baseline_start_year,
                baseline_end_year=baseline_end_year,
            )
        elif hazard_type == "drought":
            precip_series = [(obs.date, obs.precipitation) for obs in daily_observations]
            # Map requested deficit threshold or percentile to deficit_threshold ratio
            if percentile > 1.0:
                deficit_th = percentile / 100.0
            else:
                deficit_th = percentile
            # Sensible bounds between 0.10 and 0.90, default 0.50
            if deficit_th < 0.10 or deficit_th > 0.90:
                deficit_th = 0.50
            return detect_drought_proxy(
                raw_data=precip_series,
                window_days=90,
                deficit_threshold=round(deficit_th, 2),
                min_consecutive_days=min_consecutive_days or 14,
                baseline_start_year=baseline_start_year,
                baseline_end_year=baseline_end_year,
            )
        else:  # heavy_rainfall
            precip_series = [(obs.date, obs.precipitation) for obs in daily_observations]
            return detect_heavy_rainfall(
                raw_data=precip_series,
                percentile=percentile,
                wet_day_cutoff=1.0,
                baseline_start_year=baseline_start_year,
                baseline_end_year=baseline_end_year,
            )


analysis_service = AnalysisService()
