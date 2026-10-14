"""MongoDB repository for caching AI-generated and fallback climate explanations."""
from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional
from app.db.mongodb import db_manager

logger = logging.getLogger(__name__)


class AISummaryRepository:
    """Persistence and retrieval for climate narrative summaries keyed by analysis hash."""

    def __init__(self):
        self._memory_summaries: Dict[str, Dict[str, Any]] = {}

    async def save_summary(self, analysis_hash: str, doc: Dict[str, Any]) -> None:
        """Persist structured summary document with its provenance metadata."""
        now = datetime.now(timezone.utc).isoformat()
        storage_doc = {
            "analysis_hash": analysis_hash,
            **doc,
            "updated_at": now,
        }

        # In-memory fallback always updated
        self._memory_summaries[analysis_hash] = storage_doc

        if db_manager._is_connected and db_manager.db is not None:
            try:
                await db_manager.db.ai_summaries.update_one(
                    {"analysis_hash": analysis_hash},
                    {"$set": storage_doc, "$setOnInsert": {"created_at": now}},
                    upsert=True,
                )
            except Exception as exc:
                logger.warning("Failed to persist AI summary in MongoDB: %s", exc)

    async def get_summary(self, analysis_hash: str) -> Optional[Dict[str, Any]]:
        """Retrieve stored climate explanation by analysis hash."""
        if db_manager._is_connected and db_manager.db is not None:
            try:
                doc = await db_manager.db.ai_summaries.find_one(
                    {"analysis_hash": analysis_hash},
                    {"_id": 0},
                )
                if doc:
                    return doc
            except Exception as exc:
                logger.warning("MongoDB error retrieving AI summary for hash %s: %s", analysis_hash, exc)

        return self._memory_summaries.get(analysis_hash)


ai_summary_repo = AISummaryRepository()
