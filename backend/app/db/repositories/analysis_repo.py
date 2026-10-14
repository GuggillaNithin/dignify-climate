"""MongoDB repository for storing region definitions, sampling configurations, and analysis results."""
from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
from app.db.mongodb import db_manager

logger = logging.getLogger(__name__)


class AnalysisRepository:
    """Manages persistence for geospatial analyses and region definitions."""

    def __init__(self):
        # In-memory fallback caches when MongoDB is offline
        self._memory_analyses: Dict[str, Dict[str, Any]] = {}
        self._memory_regions: Dict[str, Dict[str, Any]] = {}

    async def save_region(self, region_id: str, region_data: Dict[str, Any]) -> None:
        """Persist region bounding box metadata and sample definition."""
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "region_id": region_id,
            **region_data,
            "updated_at": now,
        }

        self._memory_regions[region_id] = doc

        if db_manager._is_connected and db_manager.db is not None:
            try:
                await db_manager.db.regions.update_one(
                    {"region_id": region_id},
                    {"$set": doc, "$setOnInsert": {"created_at": now}},
                    upsert=True,
                )
            except Exception as exc:
                logger.warning("Failed to persist region metadata in MongoDB: %s", exc)

    async def get_region(self, region_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve stored region metadata."""
        if db_manager._is_connected and db_manager.db is not None:
            try:
                doc = await db_manager.db.regions.find_one({"region_id": region_id}, {"_id": 0})
                if doc:
                    return doc
            except Exception as exc:
                logger.warning("MongoDB error retrieving region %s: %s", region_id, exc)

        return self._memory_regions.get(region_id)

    async def save_analysis(self, analysis_id: str, cache_key: str, data: Dict[str, Any]) -> None:
        """Persist climate hazard analysis results with cache key."""
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "analysis_id": analysis_id,
            "cache_key": cache_key,
            **data,
            "created_at": now,
        }

        self._memory_analyses[analysis_id] = doc

        if db_manager._is_connected and db_manager.db is not None:
            try:
                await db_manager.db.analyses.update_one(
                    {"analysis_id": analysis_id},
                    {"$set": doc},
                    upsert=True,
                )
            except Exception as exc:
                logger.warning("Failed to persist analysis in MongoDB: %s", exc)

    async def get_analysis(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve analysis by analysis_id."""
        if db_manager._is_connected and db_manager.db is not None:
            try:
                doc = await db_manager.db.analyses.find_one({"analysis_id": analysis_id}, {"_id": 0})
                if doc:
                    return doc
            except Exception as exc:
                logger.warning("MongoDB error retrieving analysis %s: %s", analysis_id, exc)

        return self._memory_analyses.get(analysis_id)

    async def get_by_cache_key(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Look up existing analysis matching request parameters."""
        if db_manager._is_connected and db_manager.db is not None:
            try:
                doc = await db_manager.db.analyses.find_one({"cache_key": cache_key}, {"_id": 0})
                if doc:
                    return doc
            except Exception as exc:
                logger.warning("MongoDB error finding cached analysis: %s", exc)

        for a in self._memory_analyses.values():
            if a.get("cache_key") == cache_key:
                return a
        return None


analysis_repo = AnalysisRepository()
