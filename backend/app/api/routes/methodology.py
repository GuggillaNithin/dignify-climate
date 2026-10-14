"""Methodology and scientific governance endpoints."""
from typing import Any, Dict
from fastapi import APIRouter
from app.domain.methodology import get_methodology_registry

router = APIRouter()


@router.get(
    "",
    summary="Scientific Methodology Registry",
    description="Retrieve authoritative definitions, formulas, baseline policies, missing-data rules, and limitations.",
)
async def get_methodology() -> Dict[str, Any]:
    """Return scientific definitions, equation parameters, and governance rules."""
    return get_methodology_registry()
