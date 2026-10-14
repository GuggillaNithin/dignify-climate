import type {
  HealthResponse,
  ApiErrorResponse,
  WeatherQueryRequest,
  WeatherSeriesResponse,
  AnalysisResponse,
  AISummaryResponse,
} from '../types/api';

const DEFAULT_API_BASE_URL = 'http://localhost:8000';

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return DEFAULT_API_BASE_URL;
}

export interface HealthCheckResult {
  data: HealthResponse | null;
  error: string | null;
  timestamp: string;
}

export async function checkBackendHealth(timeoutMs = 5000): Promise<HealthCheckResult> {
  const baseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      let errMsg = `Server returned HTTP ${response.status}`;
      try {
        const errorJson: ApiErrorResponse = await response.json();
        errMsg = errorJson.message || errMsg;
      } catch {
        // Fallback to HTTP text
      }
      return {
        data: null,
        error: errMsg,
        timestamp: new Date().toISOString(),
      };
    }

    const data: HealthResponse = await response.json();
    return {
      data,
      error: null,
      timestamp: new Date().toISOString(),
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    let message = 'Unable to reach backend server.';
    if (err instanceof DOMException && err.name === 'AbortError') {
      message = `Connection timed out after ${timeoutMs / 1000}s.`;
    } else if (err instanceof TypeError && err.message.includes('fetch')) {
      message = `Network error connecting to ${baseUrl}. Check if server is running.`;
    } else if (err instanceof Error) {
      message = err.message;
    }
    return {
      data: null,
      error: message,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function queryWeather(
  params: WeatherQueryRequest,
  timeoutMs = 25000
): Promise<{ data: WeatherSeriesResponse | null; error: string | null }> {
  const baseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/v1/weather/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      let errMsg = `Weather API error (${response.status})`;
      try {
        const errorJson: ApiErrorResponse = await response.json();
        errMsg = errorJson.message || errMsg;
      } catch {
        // fallback
      }
      return { data: null, error: errMsg };
    }

    const data: WeatherSeriesResponse = await response.json();
    return { data, error: null };
  } catch (err: unknown) {
    clearTimeout(timer);
    let message = 'Failed to fetch weather observations.';
    if (err instanceof DOMException && err.name === 'AbortError') {
      message = `Request timed out after ${timeoutMs / 1000}s.`;
    } else if (err instanceof Error) {
      message = err.message;
    }
    return { data: null, error: message };
  }
}

export async function searchPlaces(
  query: string,
  count = 6,
  timeoutMs = 6000
): Promise<{ data: import('../types/api').GeocodingResponse | null; error: string | null }> {
  const baseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const params = new URLSearchParams({ q: query, count: count.toString() });
    const response = await fetch(`${baseUrl}/api/v1/geocoding/search?${params.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return { data: null, error: `Geocoding request failed (${response.status})` };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (err: unknown) {
    clearTimeout(timer);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to search places',
    };
  }
}

export async function runClimateAnalysis(
  params: import('../types/api').AnalysisRequest,
  timeoutMs = 35000
): Promise<{ data: import('../types/api').AnalysisResponse | null; error: string | null }> {
  const baseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/v1/analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      let errMsg = `Analysis failed (${response.status})`;
      try {
        const errorJson: ApiErrorResponse = await response.json();
        errMsg = errorJson.message || errMsg;
      } catch {
        // fallback
      }
      return { data: null, error: errMsg };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (err: unknown) {
    clearTimeout(timer);
    let message = 'Failed to execute climate hazard analysis.';
    if (err instanceof DOMException && err.name === 'AbortError') {
      message = `Analysis request timed out after ${timeoutMs / 1000}s.`;
    } else if (err instanceof Error) {
      message = err.message;
    }
    return { data: null, error: message };
  }
}

export async function fetchClimateSummary(
  analysisId: string,
  forceRefresh = false,
  timeoutMs = 15000
): Promise<{ data: AISummaryResponse | null; error: string | null }> {
  const baseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const refreshParam = forceRefresh ? '?force_refresh=true' : '';
    const response = await fetch(`${baseUrl}/api/v1/analysis/${analysisId}/summary${refreshParam}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      let errMsg = `Summary generation failed (${response.status})`;
      try {
        const errorJson: ApiErrorResponse = await response.json();
        errMsg = errorJson.message || errMsg;
      } catch {
        // fallback
      }
      return { data: null, error: errMsg };
    }

    const data: AISummaryResponse = await response.json();
    return { data, error: null };
  } catch (err: unknown) {
    clearTimeout(timer);
    let message = 'Failed to generate climate summary.';
    if (err instanceof DOMException && err.name === 'AbortError') {
      message = `Summary request timed out after ${timeoutMs / 1000}s.`;
    } else if (err instanceof Error) {
      message = err.message;
    }
    return { data: null, error: message };
  }
}

export async function generateClimateSummary(
  analysis: AnalysisResponse,
  forceRefresh = false,
  timeoutMs = 15000
): Promise<{ data: AISummaryResponse | null; error: string | null }> {
  const baseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const refreshParam = forceRefresh ? '?force_refresh=true' : '';
    const response = await fetch(`${baseUrl}/api/v1/analysis/summary${refreshParam}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        analysis_id: analysis.analysis_id,
        analysis_result: analysis,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      let errMsg = `Summary generation failed (${response.status})`;
      try {
        const errorJson: ApiErrorResponse = await response.json();
        errMsg = errorJson.message || errMsg;
      } catch {
        // fallback
      }
      return { data: null, error: errMsg };
    }

    const data: AISummaryResponse = await response.json();
    return { data, error: null };
  } catch (err: unknown) {
    clearTimeout(timer);
    let message = 'Failed to generate climate summary.';
    if (err instanceof DOMException && err.name === 'AbortError') {
      message = `Summary request timed out after ${timeoutMs / 1000}s.`;
    } else if (err instanceof Error) {
      message = err.message;
    }
    return { data: null, error: message };
  }
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function extractFilenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = header.match(/filename="?([^";]+)"?/i);
  return match && match[1] ? match[1].trim() : fallback;
}

export async function downloadAnnualCSV(analysis: AnalysisResponse): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/analysis/export/csv`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/csv',
    },
    body: JSON.stringify(analysis),
  });

  if (!response.ok) {
    throw new Error(`Failed to export Annual CSV (${response.status})`);
  }

  const blob = await response.blob();
  const filename = extractFilenameFromHeader(
    response.headers.get('content-disposition'),
    `dygnify_annual_${analysis.hazard_type}_${analysis.analysis_id}.csv`
  );
  triggerBrowserDownload(blob, filename);
}

export async function downloadEventsCSV(analysis: AnalysisResponse): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/analysis/export/events-csv`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/csv',
    },
    body: JSON.stringify(analysis),
  });

  if (!response.ok) {
    throw new Error(`Failed to export Events CSV (${response.status})`);
  }

  const blob = await response.blob();
  const filename = extractFilenameFromHeader(
    response.headers.get('content-disposition'),
    `dygnify_events_${analysis.hazard_type}_${analysis.analysis_id}.csv`
  );
  triggerBrowserDownload(blob, filename);
}

export async function downloadPDFReport(analysis: AnalysisResponse): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/analysis/export/pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/pdf',
    },
    body: JSON.stringify(analysis),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate PDF report (${response.status})`);
  }

  const blob = await response.blob();
  const filename = extractFilenameFromHeader(
    response.headers.get('content-disposition'),
    `dygnify_report_${analysis.hazard_type}_${analysis.analysis_id}.pdf`
  );
  triggerBrowserDownload(blob, filename);
}
