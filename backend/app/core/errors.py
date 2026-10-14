"""Structured error responses and exception handlers."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiErrorDetail(BaseModel):
    code: str
    message: str
    field: Optional[str] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    message: str
    status_code: int
    timestamp: str
    details: Optional[List[ApiErrorDetail]] = None


class AppException(Exception):
    """Base application exception for domain and validation errors."""

    def __init__(
        self,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        error: str = "BAD_REQUEST",
        message: str = "An error occurred while processing the request.",
        details: Optional[List[ApiErrorDetail]] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.error = error
        self.message = message
        self.details = details or []


def register_exception_handlers(app: FastAPI) -> None:
    """Register custom exception handlers for uniform error structures."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        content = ErrorResponse(
            error=exc.error,
            message=exc.message,
            status_code=exc.status_code,
            timestamp=datetime.now(timezone.utc).isoformat(),
            details=exc.details,
        )
        return JSONResponse(status_code=exc.status_code, content=content.model_dump())

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details: List[ApiErrorDetail] = []
        for err in exc.errors():
            loc = " -> ".join(str(l) for l in err.get("loc", []))
            details.append(
                ApiErrorDetail(
                    code="VALIDATION_ERROR",
                    message=err.get("msg", "Invalid value"),
                    field=loc,
                )
            )

        content = ErrorResponse(
            error="VALIDATION_ERROR",
            message="Request parameters failed validation.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            timestamp=datetime.now(timezone.utc).isoformat(),
            details=details,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=content.model_dump(),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        content = ErrorResponse(
            error="HTTP_ERROR",
            message=str(exc.detail),
            status_code=exc.status_code,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        return JSONResponse(status_code=exc.status_code, content=content.model_dump())

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        # Avoid leaking internal system traces in production
        content = ErrorResponse(
            error="INTERNAL_SERVER_ERROR",
            message="An unexpected server error occurred. Please try again later.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=content.model_dump(),
        )
