import logging
import re
from fastapi import APIRouter, HTTPException, Response, status
from app.db.repositories.ai_summary_repo import ai_summary_repo
from app.db.repositories.analysis_repo import analysis_repo
from app.domain.export_service import export_service
from app.schemas.analysis import AnalysisRequest, AnalysisResponse
from app.services.analysis_service import analysis_service
from app.services.groq_service import groq_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analysis", tags=["Geospatial Analysis & Exports"])


def _clean_filename_part(text: str) -> str:
    """Sanitize filename to prevent directory traversal and header injection."""
    return re.sub(r"[^a-zA-Z0-9_\-]", "_", text).strip("_")


@router.post(
    "",
    response_model=AnalysisResponse,
    summary="Execute point or regional bounding-box climate hazard analysis",
    description=(
        "Analyzes climate hazards (Heatwave, Meteorological Drought Proxy, Heavy Precipitation) "
        "either at a single ERA5 grid cell or sampled across a regional bounding box with cosine-latitude "
        "spatial area weighting."
    ),
)
async def analyze_climate_hazard(request: AnalysisRequest) -> AnalysisResponse:
    try:
        return await analysis_service.execute_analysis(request)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error("Analysis execution failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(exc)}",
        )


@router.get(
    "/{analysis_id}",
    response_model=AnalysisResponse,
    summary="Retrieve previously computed analysis by ID",
)
async def get_analysis_by_id(analysis_id: str) -> AnalysisResponse:
    doc = await analysis_repo.get_analysis(analysis_id)
    if not doc or "response_data" not in doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis with ID '{analysis_id}' not found.",
        )
    return AnalysisResponse(**doc["response_data"])


@router.get(
    "/regions/{region_id}",
    summary="Retrieve stored bounding-box region definition and sampled grid coordinates",
)
async def get_region_by_id(region_id: str):
    doc = await analysis_repo.get_region(region_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Region with ID '{region_id}' not found.",
        )
    return doc


# ==============================================================================
# EXPORT ENDPOINTS: AUDITED RFC 4180 CSV & SERVER-SIDE PDF REPORTS
# ==============================================================================

@router.get(
    "/{analysis_id}/export/csv",
    summary="Export audited annual metrics as RFC 4180 CSV with formula injection defense",
)
async def export_analysis_annual_csv(analysis_id: str) -> Response:
    doc = await analysis_repo.get_analysis(analysis_id)
    if not doc or "response_data" not in doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis with ID '{analysis_id}' not found.",
        )
    analysis_data = doc["response_data"]
    hazard = _clean_filename_part(analysis_data.get("hazard_type", "hazard"))
    clean_id = _clean_filename_part(analysis_id)
    csv_text = export_service.generate_annual_csv(analysis_data)
    filename = f"dygnify_annual_{hazard}_{clean_id}.csv"

    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get(
    "/{analysis_id}/export/events-csv",
    summary="Export verified individual qualifying extreme events as RFC 4180 CSV",
)
async def export_analysis_events_csv(analysis_id: str) -> Response:
    doc = await analysis_repo.get_analysis(analysis_id)
    if not doc or "response_data" not in doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis with ID '{analysis_id}' not found.",
        )
    analysis_data = doc["response_data"]
    hazard = _clean_filename_part(analysis_data.get("hazard_type", "hazard"))
    clean_id = _clean_filename_part(analysis_id)
    csv_text = export_service.generate_events_csv(analysis_data)
    filename = f"dygnify_events_{hazard}_{clean_id}.csv"

    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get(
    "/{analysis_id}/export/pdf",
    summary="Export comprehensive scientific climate hazard trend report as PDF",
)
async def export_analysis_pdf(analysis_id: str) -> Response:
    doc = await analysis_repo.get_analysis(analysis_id)
    if not doc or "response_data" not in doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis with ID '{analysis_id}' not found.",
        )
    analysis_data = doc["response_data"]
    hazard = _clean_filename_part(analysis_data.get("hazard_type", "hazard"))
    clean_id = _clean_filename_part(analysis_id)

    # Check if a cached AI summary is available for this analysis
    ai_summary_doc = None
    try:
        compact = groq_service.build_compact_payload(analysis_data)
        analysis_hash = groq_service.compute_analysis_hash(compact)
        ai_summary_doc = await ai_summary_repo.get_summary(analysis_hash)
    except Exception as exc:
        logger.warning("Could not check AI summary for PDF export: %s", exc)

    ai_summary = ai_summary_doc.get("summary") if ai_summary_doc else None
    pdf_bytes = export_service.generate_pdf_report(analysis_data, ai_summary=ai_summary)
    filename = f"dygnify_report_{hazard}_{clean_id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.post(
    "/export/csv",
    summary="Export on-demand analysis payload directly as RFC 4180 annual CSV",
)
async def export_payload_annual_csv(analysis: AnalysisResponse) -> Response:
    hazard = _clean_filename_part(analysis.hazard_type)
    clean_id = _clean_filename_part(analysis.analysis_id)
    csv_text = export_service.generate_annual_csv(analysis)
    filename = f"dygnify_annual_{hazard}_{clean_id}.csv"

    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.post(
    "/export/events-csv",
    summary="Export on-demand analysis payload directly as RFC 4180 events CSV",
)
async def export_payload_events_csv(analysis: AnalysisResponse) -> Response:
    hazard = _clean_filename_part(analysis.hazard_type)
    clean_id = _clean_filename_part(analysis.analysis_id)
    csv_text = export_service.generate_events_csv(analysis)
    filename = f"dygnify_events_{hazard}_{clean_id}.csv"

    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.post(
    "/export/pdf",
    summary="Export on-demand analysis payload directly as PDF report",
)
async def export_payload_pdf(analysis: AnalysisResponse) -> Response:
    hazard = _clean_filename_part(analysis.hazard_type)
    clean_id = _clean_filename_part(analysis.analysis_id)

    # Check if a cached AI summary is available for this analysis
    ai_summary_doc = None
    try:
        compact = groq_service.build_compact_payload(analysis)
        analysis_hash = groq_service.compute_analysis_hash(compact)
        ai_summary_doc = await ai_summary_repo.get_summary(analysis_hash)
    except Exception as exc:
        logger.warning("Could not check AI summary for PDF export: %s", exc)

    ai_summary = ai_summary_doc.get("summary") if ai_summary_doc else None
    pdf_bytes = export_service.generate_pdf_report(analysis, ai_summary=ai_summary)
    filename = f"dygnify_report_{hazard}_{clean_id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )
