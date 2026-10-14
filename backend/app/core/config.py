"""Application configuration using Pydantic Settings."""
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Dygnify backend settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    PROJECT_NAME: str = "Dygnify"
    PROJECT_VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # CORS settings: comma-separated or list of allowed frontend origins
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # Database
    MONGODB_URI: str = Field(default="mongodb://localhost:27017", description="MongoDB connection URI")
    MONGODB_DATABASE: str = Field(default="terrascope", description="MongoDB database name")

    # Upstream Weather Provider
    OPEN_METEO_ARCHIVE_URL: str = "https://archive-api.open-meteo.com/v1/archive"
    PROVIDER_TIMEOUT_SECONDS: float = 15.0
    PROVIDER_MAX_RETRIES: int = 3

    # LLM / AI Summary
    GROQ_API_KEY: str = Field(default="", description="Optional Groq API key for summaries")
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_API_URL: str = "https://api.groq.com/openai/v1/chat/completions"
    GROQ_TIMEOUT_SECONDS: float = 12.0
    AI_PROMPT_VERSION: str = "v1.0-cautious"

    # Rate limiting & bounds
    RATE_LIMIT_PER_MINUTE: int = 60
    MAX_DATE_SPAN_DAYS: int = 365 * 75  # Max 75 years (~1950 to present)
    MAX_BOUNDING_BOX_GRID_POINTS: int = 25

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]


settings = Settings()
