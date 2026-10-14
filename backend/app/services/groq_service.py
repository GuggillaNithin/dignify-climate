"""Groq AI climate summary service with strict grounding, schema validation, and deterministic fallback."""
from datetime import datetime, timezone
import hashlib
import json
import logging
from typing import Any, Dict, Optional, Union
import httpx
from pydantic import ValidationError
from app.core.config import settings
from app.db.repositories.ai_summary_repo import ai_summary_repo
from app.domain.summary_fallback import SummaryFallbackGenerator
from app.schemas.analysis import AnalysisResponse
from app.schemas.summary import (
    AISummaryProvenanceSchema,
    AISummaryResponse,
    AISummarySchema,
)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a cautious, objective climate-data analyst at an academic research institution.
Your task is to accurately narrate pre-computed climate hazard statistics to policy researchers and domain scientists.

CRITICAL INSTRUCTIONS & CONSTRAINTS:
1. ONLY describe numbers, metrics, dates, and relationships present in the provided JSON payload.
2. NEVER invent, hallucinate, extrapolate, or estimate numbers, dates, locations, causal mechanisms, future projections, confidence scores, or policy recommendations.
3. NEVER calculate or recalculate event counts, regressions, or trend significance. Use the exact statistical figures provided.
4. If evidence is insufficient, ambiguous, or the trend is not statistically significant (p >= 0.05), state that clearly without embellishment.
5. Do NOT ascribe local events to global climate change or specific forcing mechanisms without noting that attribution requires dedicated multi-model attribution studies.
6. Return ONLY a single valid JSON object matching this schema:
   {
     "headline": "Concise, factual headline describing hazard and verified trajectory (max 200 chars)",
     "observed_patterns": ["Factual bullet point 1", "Factual bullet point 2", ...],
     "trend_interpretation": "Objective interpretation of OLS slope, Mann–Kendall test, p-value, and comparison windows.",
     "caveats": ["Caveat 1 on autocorrelation", "Caveat 2 on lack of local attribution", ...],
     "data_quality_note": "Objective assessment of temporal completeness, spatial coverage, and any excluded years."
   }
"""


class GroqService:
    """Service managing Groq API interactions, payload compaction, caching, and fallback."""

    def __init__(self):
        self.api_url = settings.GROQ_API_URL
        self.model = settings.GROQ_MODEL
        self.timeout = settings.GROQ_TIMEOUT_SECONDS
        self.prompt_version = settings.AI_PROMPT_VERSION

    def build_compact_payload(self, analysis: Union[AnalysisResponse, Dict[str, Any]]) -> Dict[str, Any]:
        """Extract only verified statistical metrics needed for scientific explanation."""
        if isinstance(analysis, AnalysisResponse):
            data = analysis.model_dump()
        else:
            data = analysis

        spatial = data.get("spatial_metadata", {})
        annual_series = data.get("annual_series", [])
        trends = data.get("trends", {}) or {}
        definitions = data.get("definitions_summary", {}) or {}

        # Derive annual summary aggregates
        valid_annual = [yr for yr in annual_series if yr.get("is_available", True)]
        years_list = [yr["year"] for yr in valid_annual if "year" in yr]
        start_year = min(years_list) if years_list else None
        end_year = max(years_list) if years_list else None

        total_hazard_days = 0.0
        total_events = 0.0
        peak_year = None
        peak_days = -1.0

        for yr in valid_annual:
            days = yr.get("weighted_hazard_days") or 0.0
            events = yr.get("weighted_event_count") or 0.0
            total_hazard_days += days
            total_events += events
            if days > peak_days:
                peak_days = days
                peak_year = yr.get("year")

        valid_count = len(valid_annual)
        mean_days = (total_hazard_days / valid_count) if valid_count > 0 else 0.0
        mean_events = (total_events / valid_count) if valid_count > 0 else 0.0

        # Mean spatial coverage
        coverages = [yr.get("spatial_coverage_pct", 100.0) for yr in valid_annual]
        mean_cov = (sum(coverages) / len(coverages)) if coverages else 100.0

        # Trends extraction
        ols = trends.get("ols_regression")
        mk = trends.get("mann_kendall")
        win_comp = trends.get("window_comparison")

        compact_payload = {
            "hazard_type": data.get("hazard_type", "heatwave"),
            "mode": data.get("mode", "point"),
            "spatial_representation": spatial.get("representation_text", "Analyzed target location"),
            "sample_count": spatial.get("sample_count", 1),
            "date_range": {
                "start_year": start_year,
                "end_year": end_year,
                "total_years": len(annual_series),
                "valid_years": valid_count,
                "excluded_years": trends.get("excluded_years", []),
            },
            "data_source": "Open-Meteo Historical Weather API / ECMWF ERA5 Reanalysis (0.1° grid resolution)",
            "annual_aggregates": {
                "total_events": round(total_events, 1),
                "total_hazard_days": round(total_hazard_days, 1),
                "annual_mean_events": round(mean_events, 2),
                "annual_mean_hazard_days": round(mean_days, 2),
                "peak_year": peak_year,
                "peak_year_hazard_days": round(peak_days, 1) if peak_days >= 0 else 0.0,
            },
            "trend_statistics": {
                "is_calculated": trends.get("is_calculated", False),
                "diagnostic_message": trends.get("diagnostic_message"),
                "trend_direction": trends.get("trend_direction", "indeterminate"),
                "is_statistically_significant": trends.get("is_statistically_significant", False),
                "magnitude_summary": trends.get("magnitude_summary", ""),
                "ols_slope_per_year": round(ols["slope_per_year"], 4) if ols else None,
                "ols_p_value": round(ols["p_value"], 5) if ols else None,
                "ols_r_squared": round(ols["r_squared"], 4) if ols else None,
                "mann_kendall_tau": round(mk["tau"], 4) if mk else None,
                "mann_kendall_p_value": round(mk["p_value"], 5) if mk else None,
                "sens_slope": round(mk["sens_slope"], 4) if mk else None,
            },
            "window_comparison": {
                "early_years_span": f"{min(win_comp['early_window_years'])}-{max(win_comp['early_window_years'])}" if win_comp and win_comp.get("early_window_years") else None,
                "early_window_mean": round(win_comp["early_window_mean"], 2) if win_comp else None,
                "late_years_span": f"{min(win_comp['late_window_years'])}-{max(win_comp['late_window_years'])}" if win_comp and win_comp.get("late_window_years") else None,
                "late_window_mean": round(win_comp["late_window_mean"], 2) if win_comp else None,
                "absolute_change": round(win_comp["absolute_change"], 2) if win_comp else None,
                "percentage_change": round(win_comp["percentage_change"], 1) if win_comp and win_comp.get("percentage_change") is not None else None,
            } if win_comp else None,
            "coverage_and_missingness": {
                "mean_spatial_coverage_pct": round(mean_cov, 1),
                "excluded_years": trends.get("excluded_years", []),
            },
            "definitions": {
                "hazard_definition": definitions.get("hazard_indicator", definitions.get("hazard_type", data.get("hazard_type"))),
                "threshold_rule": definitions.get("threshold_rule", "Climatological percentile threshold"),
                "threshold_value": definitions.get("threshold_value"),
                "threshold_percentile": definitions.get("threshold_percentile"),
                "threshold_unit": definitions.get("threshold_unit", "°C"),
                "run_length_rule": definitions.get("consecutive_run_rule", definitions.get("run_length_rule", "Consecutive days rule")),
                "significance_sensitivity_note": definitions.get("significance_sensitivity_note", ""),
            },
        }

        return compact_payload

    def compute_analysis_hash(self, compact_payload: Dict[str, Any]) -> str:
        """Calculate deterministic SHA-256 hash across sorted compact metrics, model, and prompt version."""
        canonical_json = json.dumps(compact_payload, sort_keys=True, separators=(",", ":"))
        combined_string = f"{canonical_json}::{self.model}::{self.prompt_version}"
        return hashlib.sha256(combined_string.encode("utf-8")).hexdigest()

    async def generate_summary(
        self,
        analysis: Union[AnalysisResponse, Dict[str, Any]],
        analysis_id: Optional[str] = None,
        force_refresh: bool = False,
    ) -> AISummaryResponse:
        """Generate structured climate summary using Groq with caching and automatic fallback."""
        compact_payload = self.build_compact_payload(analysis)
        analysis_hash = self.compute_analysis_hash(compact_payload)
        actual_analysis_id = analysis_id or (analysis.analysis_id if isinstance(analysis, AnalysisResponse) else analysis.get("analysis_id", "adhoc"))

        # Check repository cache
        if not force_refresh:
            cached_doc = await ai_summary_repo.get_summary(analysis_hash)
            if cached_doc and "summary" in cached_doc and "provenance" in cached_doc:
                logger.info("Serving cached AI summary for analysis_hash=%s", analysis_hash)
                provenance_data = dict(cached_doc["provenance"])
                provenance_data["cached"] = True
                return AISummaryResponse(
                    summary=AISummarySchema(**cached_doc["summary"]),
                    provenance=AISummaryProvenanceSchema(**provenance_data),
                )

        now = datetime.now(timezone.utc).isoformat()

        # Check API key presence
        api_key = settings.GROQ_API_KEY.strip()
        if not api_key:
            logger.info("GROQ_API_KEY not configured. Generating deterministic fallback summary.")
            fallback_reason = "Groq API key not configured. Generated deterministic analysis summary."
            summary = SummaryFallbackGenerator.generate(compact_payload, fallback_reason=fallback_reason)
            provenance = AISummaryProvenanceSchema(
                analysis_id=actual_analysis_id,
                analysis_hash=analysis_hash,
                source="deterministic_fallback",
                model="deterministic-template",
                prompt_version=self.prompt_version,
                is_fallback=True,
                fallback_reason=fallback_reason,
                cached=False,
                created_at=now,
            )
            response = AISummaryResponse(summary=summary, provenance=provenance)
            await ai_summary_repo.save_summary(analysis_hash, {
                "summary": summary.model_dump(),
                "provenance": provenance.model_dump(),
            })
            return response

        # Call Groq API via HTTPX
        try:
            user_prompt = (
                f"Analyze the following verified climate hazard dataset and provide a structured scientific summary:\n"
                f"{json.dumps(compact_payload, indent=2)}"
            )

            request_body = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
            }

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(self.api_url, json=request_body, headers=headers)

                if resp.status_code == 429:
                    raise httpx.HTTPStatusError("Groq rate limit exceeded (HTTP 429)", request=resp.request, response=resp)
                elif resp.status_code == 401:
                    raise httpx.HTTPStatusError("Groq authentication failed (HTTP 401)", request=resp.request, response=resp)
                resp.raise_for_status()

                response_data = resp.json()
                content = response_data["choices"][0]["message"]["content"]
                parsed_json = json.loads(content)

                # Validate strictly against Pydantic schema
                summary = AISummarySchema.model_validate(parsed_json)

                provenance = AISummaryProvenanceSchema(
                    analysis_id=actual_analysis_id,
                    analysis_hash=analysis_hash,
                    source="groq",
                    model=self.model,
                    prompt_version=self.prompt_version,
                    is_fallback=False,
                    fallback_reason=None,
                    cached=False,
                    created_at=now,
                )

                response = AISummaryResponse(summary=summary, provenance=provenance)
                await ai_summary_repo.save_summary(analysis_hash, {
                    "summary": summary.model_dump(),
                    "provenance": provenance.model_dump(),
                })
                logger.info("Successfully generated and cached Groq summary for analysis_hash=%s", analysis_hash)
                return response

        except httpx.TimeoutException as exc:
            logger.warning("Groq API request timed out after %s seconds: %s", self.timeout, exc)
            fallback_reason = f"Groq request timed out after {self.timeout}s. Generated deterministic analysis summary."
        except httpx.HTTPStatusError as exc:
            logger.warning("Groq upstream HTTP error status %s: %s", exc.response.status_code, exc)
            fallback_reason = f"Groq upstream error (HTTP {exc.response.status_code}). Generated deterministic analysis summary."
        except (json.JSONDecodeError, ValidationError) as exc:
            logger.warning("Groq returned invalid JSON or schema violation: %s", exc)
            fallback_reason = "Invalid response schema returned by LLM. Generated deterministic analysis summary."
        except Exception as exc:
            logger.error("Unexpected error contacting Groq API: %s", exc, exc_info=True)
            fallback_reason = "Upstream AI provider unavailable. Generated deterministic analysis summary."

        # Graceful fallback on any failure
        summary = SummaryFallbackGenerator.generate(compact_payload, fallback_reason=fallback_reason)
        provenance = AISummaryProvenanceSchema(
            analysis_id=actual_analysis_id,
            analysis_hash=analysis_hash,
            source="deterministic_fallback",
            model="deterministic-template",
            prompt_version=self.prompt_version,
            is_fallback=True,
            fallback_reason=fallback_reason,
            cached=False,
            created_at=now,
        )
        response = AISummaryResponse(summary=summary, provenance=provenance)
        await ai_summary_repo.save_summary(analysis_hash, {
            "summary": summary.model_dump(),
            "provenance": provenance.model_dump(),
        })
        return response


groq_service = GroqService()
