"""Pydantic schemas for geospatial point and bounding-box climate hazard analysis requests and responses."""
from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional, Tuple
from pydantic import BaseModel, Field, field_validator, model_validator


class PointSchema(BaseModel):
    """Single geographic target coordinate."""
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees (-90.0 to 90.0)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees (-180.0 to 180.0)")


class BoundingBoxSchema(BaseModel):
    """Geographic bounding box with antimeridian support."""
    south: float = Field(..., ge=-90.0, le=90.0, description="South boundary latitude")
    north: float = Field(..., ge=-90.0, le=90.0, description="North boundary latitude")
    west: float = Field(..., ge=-180.0, le=180.0, description="West boundary longitude")
    east: float = Field(..., ge=-180.0, le=180.0, description="East boundary longitude")

    @model_validator(mode="after")
    def validate_bounds(self) -> "BoundingBoxSchema":
        if self.south >= self.north:
            raise ValueError(f"South latitude ({self.south}) must be strictly less than North latitude ({self.north}).")

        lat_span = self.north - self.south
        if lat_span > 10.0:
            raise ValueError(f"Latitude span of {lat_span:.2f}° exceeds the maximum limit of 10.0°.")

        lon_span = (180.0 - self.west + self.east - (-180.0)) if self.west > self.east else (self.east - self.west)
        if lon_span > 15.0:
            raise ValueError(f"Longitude span of {lon_span:.2f}° exceeds the maximum limit of 15.0°.")

        return self


class AnalysisRequest(BaseModel):
    """Request payload for point or regional climate hazard analysis."""
    mode: Literal["point", "bounding_box"] = Field(
        default="point",
        description="Analysis spatial mode: 'point' for single ERA5 cell, 'bounding_box' for regional grid sampling",
    )
    point: Optional[PointSchema] = Field(None, description="Target coordinate when mode is 'point'")
    bounds: Optional[BoundingBoxSchema] = Field(None, description="Target bounding box when mode is 'bounding_box'")
    hazard_type: Literal["heatwave", "drought", "heavy_rainfall"] = Field(
        ...,
        description="Target climate hazard indicator",
    )
    start_date: str = Field(..., description="Start date in ISO YYYY-MM-DD format (>= 1940-01-01)")
    end_date: str = Field(..., description="End date in ISO YYYY-MM-DD format (<= today)")
    percentile: float = Field(default=95.0, ge=50.0, le=99.9, description="Threshold percentile (default 95th)")
    min_consecutive_days: Optional[int] = Field(None, ge=1, le=60, description="Run length requirement (e.g. 3 for heatwaves)")
    baseline_start_year: Optional[int] = Field(None, ge=1940, description="Climatological baseline start year (e.g. 1991)")
    baseline_end_year: Optional[int] = Field(None, ge=1940, description="Climatological baseline end year (e.g. 2020)")
    min_spatial_coverage_pct: float = Field(
        default=75.0,
        ge=10.0,
        le=100.0,
        description="Minimum valid grid point coverage required per calendar year to certify regional metric",
    )
    sample_density: int = Field(
        default=9,
        ge=1,
        le=16,
        description="Target number of grid sample points inside bounding box (max 16)",
    )

    @field_validator("start_date", "end_date")
    @classmethod
    def validate_dates(cls, v: str) -> str:
        try:
            d = datetime.strptime(v, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError(f"Invalid date format '{v}'. Expected ISO YYYY-MM-DD.")
        if d < date(1940, 1, 1):
            raise ValueError(f"Date {v} precedes the ERA5 archive limit (1940-01-01).")
        if d > date.today():
            raise ValueError(f"Date {v} cannot be in the future.")
        return v

    @model_validator(mode="after")
    def validate_spatial_and_temporal(self) -> "AnalysisRequest":
        if self.mode == "point" and self.point is None:
            raise ValueError("Target 'point' must be provided when mode is 'point'.")
        if self.mode == "bounding_box" and self.bounds is None:
            raise ValueError("Target 'bounds' must be provided when mode is 'bounding_box'.")

        s = datetime.strptime(self.start_date, "%Y-%m-%d").date()
        e = datetime.strptime(self.end_date, "%Y-%m-%d").date()
        if s > e:
            raise ValueError(f"start_date ({self.start_date}) cannot be after end_date ({self.end_date}).")
        if (e - s).days > 365 * 75:
            raise ValueError("Requested temporal span exceeds 75 years.")

        if self.baseline_start_year and self.baseline_end_year:
            if self.baseline_start_year >= self.baseline_end_year:
                raise ValueError("baseline_start_year must be strictly less than baseline_end_year.")

        return self


class SampledGridPointSchema(BaseModel):
    """Sampled grid point location with spherical area weight."""
    latitude: float
    longitude: float
    grid_key: str
    cosine_weight: float
    normalized_weight: float


class RegionalAnnualMetricSchema(BaseModel):
    """Annual aggregated hazard metric with spatial coverage gating."""
    year: int
    is_available: bool
    spatial_coverage_pct: float
    valid_points_count: int
    total_points_count: int
    weighted_hazard_days: Optional[float]
    weighted_event_count: Optional[float]
    weighted_primary_metric: Optional[float]
    weighted_intensity: Optional[float]
    coverage_status: str
    point_contributions: List[Dict[str, Any]] = Field(default_factory=list)


class SpatialMetadataSchema(BaseModel):
    """Transparent geospatial disclosure and sample description."""
    mode: str
    representation_text: str
    sample_count: int
    area_weighting_method: str
    bounds: Optional[Dict[str, float]] = None
    point: Optional[Dict[str, float]] = None
    resolution: str = "~0.1° (~11 km) ERA5 grid cell"


class OLSMetricsSchema(BaseModel):
    """Ordinary Least-Squares regression metrics against calendar year."""
    slope_per_year: float
    intercept: float
    r_squared: float
    p_value: float
    stderr: float
    confidence_interval_95: Tuple[float, float]
    sample_count: int
    fitted_values: List[Dict[str, float]]


class MannKendallMetricsSchema(BaseModel):
    """Non-parametric Mann-Kendall test with tie adjustments and Sen's slope."""
    tau: float
    s_statistic: int
    variance_s: float
    z_statistic: float
    p_value: float
    sens_slope: float
    sample_size: int
    tied_groups_count: int


class MultiYearWindowComparisonSchema(BaseModel):
    """Multi-year mean window comparison avoiding unstable single-endpoint comparisons."""
    early_window_years: List[int]
    early_window_mean: float
    late_window_years: List[int]
    late_window_mean: float
    absolute_change: float
    percentage_change: Optional[float]
    percentage_change_status: str


class RollingPointSchema(BaseModel):
    """Observed annual point with centered rolling average."""
    year: int
    observed_value: Optional[float]
    rolling_mean: Optional[float]
    is_valid: bool


class TrendAnalysisResultSchema(BaseModel):
    """Complete statistical trend analysis with honest scientific disclaimers."""
    is_calculated: bool
    diagnostic_message: Optional[str] = None
    total_years: int
    valid_years_count: int
    excluded_years: List[int]
    primary_metric_name: str
    metric_units: str
    ols_regression: Optional[OLSMetricsSchema] = None
    mann_kendall: Optional[MannKendallMetricsSchema] = None
    window_comparison: Optional[MultiYearWindowComparisonSchema] = None
    rolling_series: List[RollingPointSchema] = Field(default_factory=list)
    trend_direction: str
    is_statistically_significant: bool
    magnitude_summary: str
    scientific_caution: str
    methodology_version: str = "v1.2-scientific"


class AnalysisResponse(BaseModel):
    """Complete serialized response for climate hazard analysis."""
    analysis_id: str
    mode: str
    hazard_type: str
    spatial_metadata: SpatialMetadataSchema
    sampled_points: List[SampledGridPointSchema]
    annual_series: List[RegionalAnnualMetricSchema]
    point_results: Optional[List[Dict[str, Any]]] = None
    trends: Optional[TrendAnalysisResultSchema] = None
    events_list: Optional[List[Dict[str, Any]]] = None
    definitions_summary: Dict[str, Any]
    created_at: str
