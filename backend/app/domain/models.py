"""Domain data structures for climate hazard algorithms and annual metrics."""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class BaselineConfig:
    """Climatological reference baseline configuration."""
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    is_exploratory: bool = False
    description: str = "Climatological baseline"

    @property
    def label(self) -> str:
        if self.is_exploratory or self.start_year is None or self.end_year is None:
            return "Exploratory (Full Series)"
        return f"{self.start_year}–{self.end_year} Climatological Normal"


@dataclass
class EventRecord:
    """Individual qualifying extreme hazard event."""
    start_date: str
    end_date: str
    duration_days: int
    daily_values: List[float]
    mean_value: float
    max_value: float
    intensity_metric: float  # e.g., cumulative exceedance °C or total precipitation mm
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AnnualHazardMetric:
    """Annual aggregated metrics for trend analysis and time series evaluation."""
    year: int
    total_calendar_days: int
    valid_observed_days: int
    missing_days: int
    coverage_pct: float
    is_comparable: bool  # False if coverage < 90% (insufficient data)
    event_count: int
    hazard_days: int
    primary_metric: float  # e.g., annual max intensity, event days, or Rx1day
    mean_event_duration: float
    max_event_duration: int
    cumulative_intensity: float
    attributes: Dict[str, Any] = field(default_factory=dict)


@dataclass
class HazardAnalysisResult:
    """Complete deterministic hazard analysis result with provenance."""
    hazard_type: str
    threshold_value: float
    threshold_unit: str
    threshold_percentile: float
    baseline_config: BaselineConfig
    total_series_days: int
    total_valid_days: int
    total_missing_days: int
    overall_coverage_pct: float
    events: List[EventRecord]
    annual_metrics: List[AnnualHazardMetric]
    definitions_summary: Dict[str, Any]
