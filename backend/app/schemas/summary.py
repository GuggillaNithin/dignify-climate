"""Pydantic schemas for AI-generated climate explanations and structured response validation."""
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
from app.schemas.analysis import AnalysisResponse


class AISummarySchema(BaseModel):
    """Strictly validated structured output schema for climate evidence summaries."""

    headline: str = Field(
        ...,
        description="Concise, factual headline describing the analyzed hazard and verified trajectory (max 150 chars)",
        max_length=200,
    )
    observed_patterns: List[str] = Field(
        ...,
        description="Factual bullet points summarizing event counts, duration, and exceedance metrics from payload",
        min_length=1,
    )
    trend_interpretation: str = Field(
        ...,
        description="Cautious interpretation of OLS slope, Mann–Kendall rank test, p-value, and multi-year comparison windows",
    )
    caveats: List[str] = Field(
        ...,
        description="Explicit methodological caveats (autocorrelation, no localized causal attribution, baseline constraints)",
        min_length=1,
    )
    data_quality_note: str = Field(
        ...,
        description="Objective assessment of temporal completeness, spatial coverage, and any excluded years",
    )


class AISummaryProvenanceSchema(BaseModel):
    """Metadata tracking generation source, model version, cache status, and fallback state."""

    analysis_id: str
    analysis_hash: str
    source: Literal["groq", "deterministic_fallback"]
    model: str
    prompt_version: str
    is_fallback: bool
    fallback_reason: Optional[str] = None
    cached: bool = False
    created_at: str


class AISummaryResponse(BaseModel):
    """Complete serialized response for AI-generated climate explanation."""

    summary: AISummarySchema
    provenance: AISummaryProvenanceSchema


class AISummaryRequest(BaseModel):
    """Request payload for generating an AI summary, either by analysis_id or full payload."""

    analysis_id: Optional[str] = None
    analysis_result: Optional[AnalysisResponse] = None
