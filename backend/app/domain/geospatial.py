"""Geospatial grid sampling, coordinate boundary validation, and regional aggregation logic."""
from dataclasses import dataclass, field
import math
from typing import Any, Dict, List, Optional, Tuple

from app.domain.models import AnnualHazardMetric, HazardAnalysisResult


@dataclass(frozen=True)
class PointCoordinate:
    """Validated single geographic point."""
    latitude: float
    longitude: float

    def __post_init__(self):
        if not (-90.0 <= self.latitude <= 90.0):
            raise ValueError(f"Latitude {self.latitude} out of bounds [-90.0, 90.0].")
        if not (-180.0 <= self.longitude <= 180.0):
            raise ValueError(f"Longitude {self.longitude} out of bounds [-180.0, 180.0].")

    @property
    def grid_key(self) -> str:
        """Normalized coordinate grid key formatted to 2 decimal places."""
        return f"{round(self.latitude, 2):.2f}_{round(self.longitude, 2):.2f}"


@dataclass(frozen=True)
class BoundingBox:
    """Validated geographic bounding box with antimeridian support."""
    south: float
    north: float
    west: float
    east: float

    # Maximum permitted physical bounds for responsive execution & quota bounds
    MAX_LAT_SPAN: float = 10.0
    MAX_LON_SPAN: float = 15.0

    def __post_init__(self):
        if not (-90.0 <= self.south <= 90.0):
            raise ValueError(f"South latitude {self.south} out of bounds [-90.0, 90.0].")
        if not (-90.0 <= self.north <= 90.0):
            raise ValueError(f"North latitude {self.north} out of bounds [-90.0, 90.0].")
        if self.south >= self.north:
            raise ValueError(f"South latitude ({self.south}) must be strictly less than North latitude ({self.north}).")
        if not (-180.0 <= self.west <= 180.0):
            raise ValueError(f"West longitude {self.west} out of bounds [-180.0, 180.0].")
        if not (-180.0 <= self.east <= 180.0):
            raise ValueError(f"East longitude {self.east} out of bounds [-180.0, 180.0].")

        lat_span = self.north - self.south
        if lat_span > self.MAX_LAT_SPAN:
            raise ValueError(
                f"Latitude span of {lat_span:.2f}° exceeds the maximum limit of {self.MAX_LAT_SPAN}°."
            )

        lon_span = self.longitude_span
        if lon_span > self.MAX_LON_SPAN:
            raise ValueError(
                f"Longitude span of {lon_span:.2f}° exceeds the maximum limit of {self.MAX_LON_SPAN}°."
            )

    @property
    def crosses_antimeridian(self) -> bool:
        """True if the bounding box spans across the ±180° antimeridian."""
        return self.west > self.east

    @property
    def longitude_span(self) -> float:
        """Compute absolute longitude span in degrees, accounting for antimeridian crossing."""
        if self.crosses_antimeridian:
            return round((180.0 - self.west) + (self.east - (-180.0)), 4)
        return round(self.east - self.west, 4)

    @property
    def latitude_span(self) -> float:
        return round(self.north - self.south, 4)


@dataclass
class SampledGridPoint:
    """A sampled grid point with its spherical area weight."""
    latitude: float
    longitude: float
    grid_key: str
    cosine_weight: float
    normalized_weight: float = 1.0


@dataclass
class RegionalAnnualMetric:
    """Regional aggregated annual hazard metric with spatial coverage metadata."""
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
    point_contributions: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class GeospatialAnalysisResult:
    """Container for point or regional aggregated climate hazard results."""
    mode: str  # 'point' or 'bounding_box'
    hazard_type: str
    point: Optional[PointCoordinate]
    bounds: Optional[BoundingBox]
    sampled_points: List[SampledGridPoint]
    spatial_metadata: Dict[str, Any]
    annual_series: List[RegionalAnnualMetric]
    point_results: List[Dict[str, Any]]
    definitions_summary: Dict[str, Any]


class GeospatialSampler:
    """Deterministic sampling of atmospheric grid points within bounding boxes."""

    MAX_SAMPLED_POINTS: int = 16  # Strict upper bound for responsive computation

    @classmethod
    def sample_bounding_box(
        cls,
        bounds: BoundingBox,
        max_points: int = 16,
    ) -> List[SampledGridPoint]:
        """Generate a uniform, bounded 2D grid of sample points with cosine-latitude weights."""
        lat_span = bounds.latitude_span
        lon_span = bounds.longitude_span

        # If box is zero/tiny, return single midpoint
        if lat_span < 0.05 and lon_span < 0.05:
            mid_lat = round((bounds.south + bounds.north) / 2.0, 2)
            mid_lon = round(bounds.west if not bounds.crosses_antimeridian else ((bounds.west + bounds.east) / 2.0), 2)
            cos_w = max(0.001, math.cos(math.radians(mid_lat)))
            return [
                SampledGridPoint(
                    latitude=mid_lat,
                    longitude=mid_lon,
                    grid_key=f"{mid_lat:.2f}_{mid_lon:.2f}",
                    cosine_weight=cos_w,
                    normalized_weight=1.0,
                )
            ]

        # Determine grid dimensions (N_lat x N_lon <= max_points)
        # Choose 2x2, 3x3, 4x4 or aspect-ratio matched
        if max_points <= 4:
            n_lat, n_lon = 2, 2
        elif max_points <= 9:
            n_lat, n_lon = 3, 3
        else:
            n_lat, n_lon = 4, 4

        # Generate latitudes
        if n_lat == 1:
            lats = [(bounds.south + bounds.north) / 2.0]
        else:
            lat_step = lat_span / (n_lat - 1)
            lats = [bounds.south + i * lat_step for i in range(n_lat)]

        # Generate longitudes (respecting antimeridian)
        if n_lon == 1:
            if bounds.crosses_antimeridian:
                mid = (bounds.west + bounds.longitude_span / 2.0)
                lons = [mid if mid <= 180.0 else mid - 360.0]
            else:
                lons = [(bounds.west + bounds.east) / 2.0]
        else:
            lon_step = lon_span / (n_lon - 1)
            lons = []
            for i in range(n_lon):
                val = bounds.west + i * lon_step
                if val > 180.0:
                    val -= 360.0
                lons.append(val)

        # Build sampled points with cosine weights
        raw_points: List[SampledGridPoint] = []
        for lat in lats:
            rounded_lat = round(lat, 2)
            cos_w = max(0.001, math.cos(math.radians(rounded_lat)))
            for lon in lons:
                rounded_lon = round(lon, 2)
                raw_points.append(
                    SampledGridPoint(
                        latitude=rounded_lat,
                        longitude=rounded_lon,
                        grid_key=f"{rounded_lat:.2f}_{rounded_lon:.2f}",
                        cosine_weight=cos_w,
                    )
                )

        if not raw_points:
            raise ValueError("No grid points could be sampled within the specified bounding box.")

        # Deduplicate grid points (in case bounds are very small)
        unique_points: Dict[str, SampledGridPoint] = {}
        for p in raw_points:
            if p.grid_key not in unique_points:
                unique_points[p.grid_key] = p

        sampled = list(unique_points.values())
        total_cos = sum(p.cosine_weight for p in sampled)
        if total_cos <= 0:
            total_cos = 1.0

        for p in sampled:
            p.normalized_weight = round(p.cosine_weight / total_cos, 4)

        return sampled


class RegionalAggregator:
    """Aggregates point-level climate hazard results into regional annual time series."""

    @classmethod
    def aggregate_points(
        cls,
        sampled_points: List[SampledGridPoint],
        point_hazard_results: Dict[str, HazardAnalysisResult],
        min_spatial_coverage_pct: float = 75.0,
    ) -> List[RegionalAnnualMetric]:
        """Aggregate annual hazard metrics using cosine-latitude spatial weights.
        
        Enforces spatial coverage threshold: years where valid point coverage < min_spatial_coverage_pct
        are marked unavailable rather than quietly biasing results.
        """
        if not sampled_points:
            return []

        total_points = len(sampled_points)
        weight_map = {p.grid_key: p.normalized_weight for p in sampled_points}

        # Collect all observed years across all sampled points
        all_years = set()
        by_point_year: Dict[str, Dict[int, AnnualHazardMetric]] = {}

        for p in sampled_points:
            res = point_hazard_results.get(p.grid_key)
            if res:
                by_point_year[p.grid_key] = {m.year: m for m in res.annual_metrics}
                all_years.update(by_point_year[p.grid_key].keys())
            else:
                by_point_year[p.grid_key] = {}

        annual_metrics: List[RegionalAnnualMetric] = []

        for yr in sorted(all_years):
            valid_points = []
            point_contribs = []

            for p in sampled_points:
                yr_metric = by_point_year[p.grid_key].get(yr)
                # A point qualifies if it has data and satisfies WMO comparability (coverage >= 90%)
                is_valid_point = (yr_metric is not None and yr_metric.is_comparable)
                if is_valid_point and yr_metric is not None:
                    valid_points.append((p, yr_metric))
                    point_contribs.append({
                        "grid_key": p.grid_key,
                        "latitude": p.latitude,
                        "longitude": p.longitude,
                        "weight": p.normalized_weight,
                        "hazard_days": yr_metric.hazard_days,
                        "event_count": yr_metric.event_count,
                        "primary_metric": yr_metric.primary_metric,
                        "is_valid": True,
                    })
                else:
                    point_contribs.append({
                        "grid_key": p.grid_key,
                        "latitude": p.latitude,
                        "longitude": p.longitude,
                        "weight": p.normalized_weight,
                        "hazard_days": None,
                        "event_count": None,
                        "primary_metric": None,
                        "is_valid": False,
                    })

            # Calculate spatial coverage: sum of normalized weights of valid points
            valid_weight_sum = sum(p.normalized_weight for p, _ in valid_points)
            spatial_coverage_pct = round(valid_weight_sum * 100.0, 2)

            is_available = spatial_coverage_pct >= min_spatial_coverage_pct

            if is_available and valid_weight_sum > 0:
                # Area-weighted spatial mean
                w_hazard_days = round(
                    sum(p.normalized_weight * m.hazard_days for p, m in valid_points) / valid_weight_sum,
                    2,
                )
                w_events = round(
                    sum(p.normalized_weight * m.event_count for p, m in valid_points) / valid_weight_sum,
                    2,
                )
                w_primary = round(
                    sum(p.normalized_weight * m.primary_metric for p, m in valid_points) / valid_weight_sum,
                    2,
                )
                w_intensity = round(
                    sum(p.normalized_weight * m.cumulative_intensity for p, m in valid_points) / valid_weight_sum,
                    2,
                )
                status = "Complete spatial sample" if spatial_coverage_pct >= 95.0 else f"Partial sample ({spatial_coverage_pct}%)"
            else:
                w_hazard_days = None
                w_events = None
                w_primary = None
                w_intensity = None
                status = f"Unavailable: spatial coverage {spatial_coverage_pct}% < {min_spatial_coverage_pct}% threshold"

            annual_metrics.append(
                RegionalAnnualMetric(
                    year=yr,
                    is_available=is_available,
                    spatial_coverage_pct=spatial_coverage_pct,
                    valid_points_count=len(valid_points),
                    total_points_count=total_points,
                    weighted_hazard_days=w_hazard_days,
                    weighted_event_count=w_events,
                    weighted_primary_metric=w_primary,
                    weighted_intensity=w_intensity,
                    coverage_status=status,
                    point_contributions=point_contribs,
                )
            )

        return annual_metrics
