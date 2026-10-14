"""API routes for generating and retrieving AI-powered climate hazard summaries."""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.db.repositories.analysis_repo import analysis_repo
from app.schemas.summary import AISummaryRequest, AISummaryResponse
from app.services.groq_service import groq_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["AI Climate Summaries"])


@router.post(
    "/{analysis_id}/summary",
    response_model=AISummaryResponse,
    summary="Generate or retrieve AI narrative summary for a completed analysis",
    description=(
        "Translates pre-computed climate hazard trends and statistics into structured scientific narratives. "
        "Strictly grounded in verified metrics with deterministic template fallback when upstream LLMs are unavailable."
    ),
)
async def generate_summary_for_analysis_id(
    analysis_id: str,
    force_refresh: bool = Query(default=False, description="Bypass cache and force summary regeneration"),
) -> AISummaryResponse:
    doc = await analysis_repo.get_analysis(analysis_id)
    if not doc or "response_data" not in doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis with ID '{analysis_id}' not found.",
        )

    try:
        return await groq_service.generate_summary(
            analysis=doc["response_data"],
            analysis_id=analysis_id,
            force_refresh=force_refresh,
        )
    except Exception as exc:
        logger.error("Failed to generate summary for analysis %s: %s", analysis_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to produce climate summary.",
        )


@router.post(
    "/summary",
    response_model=AISummaryResponse,
    summary="Generate summary from on-demand analysis payload or analysis ID",
)
async def generate_summary_from_payload(
    request: AISummaryRequest,
    force_refresh: bool = Query(default=False, description="Bypass cache and force summary regeneration"),
) -> AISummaryResponse:
    if request.analysis_result:
        analysis_data = request.analysis_result
        analysis_id = request.analysis_result.analysis_id
    elif request.analysis_id:
        doc = await analysis_repo.get_analysis(request.analysis_id)
        if not doc or "response_data" not in doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Analysis with ID '{request.analysis_id}' not found.",
            )
        analysis_data = doc["response_data"]
        analysis_id = request.analysis_id
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'analysis_id' or 'analysis_result' must be provided in request body.",
        )

    try:
        return await groq_service.generate_summary(
            analysis=analysis_data,
            analysis_id=analysis_id,
            force_refresh=force_refresh,
        )
    except Exception as exc:
        logger.error("Failed to generate summary: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to produce climate summary.",
        )
