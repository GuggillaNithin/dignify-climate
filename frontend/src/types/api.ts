export interface HealthServicesStatus {
  api: string;
  database: string;
  weather_provider: string;
}

export interface HealthResponse {
  status: string;
  project: string;
  version: string;
  environment: string;
  timestamp: string;
  uptime_seconds: number;
  services: HealthServicesStatus;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string;
}

export interface ApiErrorResponse {
  success: boolean;
  error: string;
  message: string;
  status_code: number;
  timestamp: string;
  details?: ApiErrorDetail[];
}

export type ConnectionState = 'checking' | 'connected' | 'disconnected' | 'degraded';

export interface WeatherQueryRequest {
  latitude: number;
  longitude: number;
  start_date: string;
  end_date: string;
}

export interface WeatherDailyObservation {
  date: string;
  temperature_max: number | null;
  precipitation: number | null;
}

export interface WeatherMetadata {
  source: string;
  dataset: string;
  attribution: string;
  spatial_resolution: string;
  retrieved_at: string;
  cached: boolean;
  cache_source: 'mongodb' | 'in_memory' | 'upstream_fetched';
  grid_latitude: number;
  grid_longitude: number;
  total_days: number;
  valid_temperature_days: number;
  missing_temperature_days: number;
  valid_precipitation_days: number;
  missing_precipitation_days: number;
}

export interface WeatherSeriesResponse {
  latitude: number;
  longitude: number;
  elevation?: number | null;
  timezone: string;
  temperature_unit: string;
  precipitation_unit: string;
  metadata: WeatherMetadata;
  daily: WeatherDailyObservation[];
}

export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  admin1?: string;
  timezone?: string;
}

export interface GeocodingResponse {
  results: GeocodingResult[];
  attribution: string;
  cached: boolean;
}

export interface PointCoordinate {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface SampledGridPoint {
  latitude: number;
  longitude: number;
  grid_key: string;
  cosine_weight: number;
  normalized_weight: number;
}

export interface PointContribution {
  grid_key: string;
  latitude: number;
  longitude: number;
  weight: number;
  hazard_days: number | null;
  event_count: number | null;
  primary_metric: number | null;
  is_valid: boolean;
}

export interface RegionalAnnualMetric {
  year: int_or_number;
  is_available: boolean;
  spatial_coverage_pct: number;
  valid_points_count: number;
  total_points_count: number;
  weighted_hazard_days: number | null;
  weighted_event_count: number | null;
  weighted_primary_metric: number | null;
  weighted_intensity: number | null;
  coverage_status: string;
  point_contributions: PointContribution[];
}

type int_or_number = number;

export interface SpatialMetadata {
  mode: 'point' | 'bounding_box';
  representation_text: string;
  sample_count: number;
  area_weighting_method: string;
  bounds?: BoundingBox | null;
  point?: PointCoordinate | null;
  resolution: string;
}

export interface AnalysisRequest {
  mode: 'point' | 'bounding_box';
  point?: PointCoordinate;
  bounds?: BoundingBox;
  hazard_type: 'heatwave' | 'drought' | 'heavy_rainfall';
  start_date: string;
  end_date: string;
  percentile?: number;
  min_consecutive_days?: number;
  baseline_start_year?: number;
  baseline_end_year?: number;
  min_spatial_coverage_pct?: number;
  sample_density?: number;
}

export interface OLSMetrics {
  slope_per_year: number;
  intercept: number;
  r_squared: number;
  p_value: number;
  stderr: number;
  confidence_interval_95: [number, number];
  sample_count: number;
  fitted_values: Array<{ year: number; fitted: number }>;
}

export interface MannKendallMetrics {
  tau: number;
  s_statistic: number;
  variance_s: number;
  z_statistic: number;
  p_value: number;
  sens_slope: number;
  sample_size: number;
  tied_groups_count: number;
}

export interface MultiYearWindowComparison {
  early_window_years: number[];
  early_window_mean: number;
  late_window_years: number[];
  late_window_mean: number;
  absolute_change: number;
  percentage_change: number | null;
  percentage_change_status: string;
}

export interface RollingPoint {
  year: number;
  observed_value: number | null;
  rolling_mean: number | null;
  is_valid: boolean;
}

export interface TrendAnalysisResult {
  is_calculated: boolean;
  diagnostic_message?: string | null;
  total_years: number;
  valid_years_count: number;
  excluded_years: number[];
  primary_metric_name: string;
  metric_units: string;
  ols_regression?: OLSMetrics | null;
  mann_kendall?: MannKendallMetrics | null;
  window_comparison?: MultiYearWindowComparison | null;
  rolling_series: RollingPoint[];
  trend_direction: 'increasing' | 'decreasing' | 'no_significant_trend' | 'insufficient_data';
  is_statistically_significant: boolean;
  magnitude_summary: string;
  scientific_caution: string;
  methodology_version: string;
}

export interface HazardEventItem {
  start_date: string;
  end_date: string;
  duration_days: number;
  mean_value: number;
  max_value: number;
  intensity_metric: number;
}

export interface HazardDefinitionsSummary {
  hazard?: string;
  hazard_indicator?: string;
  threshold_value?: number;
  threshold_percentile?: number;
  threshold_unit?: string;
  threshold_rule?: string;
  threshold_definition?: string;
  consecutive_run_rule?: string;
  missing_data_policy?: string;
  baseline_used?: string;
  significance_sensitivity_note?: string;
  units?: Record<string, string>;
  [key: string]: unknown;
}

export interface AnalysisResponse {
  analysis_id: string;
  mode: 'point' | 'bounding_box';
  hazard_type: string;
  spatial_metadata: SpatialMetadata;
  sampled_points: SampledGridPoint[];
  annual_series: RegionalAnnualMetric[];
  point_results?: Array<{
    grid_key: string;
    latitude: number;
    longitude: number;
    weight?: number;
    events_count: number;
    threshold_value: number;
    threshold_percentile?: number;
    threshold_unit: string;
    baseline: string;
  }>;
  trends?: TrendAnalysisResult | null;
  events_list?: HazardEventItem[] | null;
  definitions_summary: HazardDefinitionsSummary;
  created_at: string;
}

export interface AISummarySchema {
  headline: string;
  observed_patterns: string[];
  trend_interpretation: string;
  caveats: string[];
  data_quality_note: string;
}

export interface AISummaryProvenanceSchema {
  analysis_id: string;
  analysis_hash: string;
  source: 'groq' | 'deterministic_fallback';
  model: string;
  prompt_version: string;
  is_fallback: boolean;
  fallback_reason?: string | null;
  cached: boolean;
  created_at: string;
}

export interface AISummaryResponse {
  summary: AISummarySchema;
  provenance: AISummaryProvenanceSchema;
}

