"""MongoDB client management and index initialization using Motor."""
import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from app.core.config import settings

logger = logging.getLogger(__name__)


class MongoDBManager:
    """Manages AsyncIOMotorClient lifecycle and collection references."""

    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None
        self._is_connected: bool = False

    async def connect(self) -> bool:
        """Attempt to connect to MongoDB Atlas or local MongoDB instance."""
        if not settings.MONGODB_URI:
            logger.warning("MONGODB_URI is not configured. Running in degraded in-memory mode.")
            self._is_connected = False
            return False

        # On Windows, local router DNS often fails SRV record lookups for mongodb+srv://
        # Add public DNS resolvers (Cloudflare / Google) so SRV resolution succeeds reliably
        if "mongodb+srv://" in settings.MONGODB_URI:
            try:
                import dns.resolver
                resolver = dns.resolver.Resolver(configure=True)
                existing = list(resolver.nameservers)
                for ns in ["8.8.8.8", "1.1.1.1"]:
                    if ns not in existing:
                        existing.append(ns)
                resolver.nameservers = existing
                dns.resolver.default_resolver = resolver
            except Exception as e:
                logger.debug("Could not configure fallback DNS resolver: %s", e)

        try:
            # Set serverSelectionTimeoutMS to 5000ms to allow remote Atlas TLS handshakes
            self.client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
            )
            # Test connectivity with ping
            await self.client.admin.command("ping")
            self.db = self.client[settings.MONGODB_DATABASE]
            self._is_connected = True
            logger.info("Connected to MongoDB database: %s", settings.MONGODB_DATABASE)
            await self.init_indexes()
            return True
        except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as exc:
            logger.warning(
                "MongoDB connection failed (%s). Operating in degraded in-memory mode.",
                str(exc),
            )
            self._is_connected = False
            self.client = None
            self.db = None
            return False

    async def init_indexes(self) -> None:
        """Create required indexes across all collections."""
        if not self._is_connected or self.db is None:
            return

        try:
            # 1. weather_daily: unique index on grid_key + date
            await self.db.weather_daily.create_index(
                [("grid_key", 1), ("date", 1)],
                unique=True,
                name="idx_grid_key_date_unique",
            )
            await self.db.weather_daily.create_index(
                [("date", 1)],
                name="idx_weather_date",
            )

            # 2. analyses: unique on analysis_id, index on cache_key + created_at
            await self.db.analyses.create_index(
                [("analysis_id", 1)],
                unique=True,
                name="idx_analysis_id_unique",
            )
            await self.db.analyses.create_index(
                [("cache_key", 1)],
                name="idx_analysis_cache_key",
            )

            # 3. regions / cache_metadata: unique on grid_key
            await self.db.regions.create_index(
                [("grid_key", 1)],
                unique=True,
                name="idx_regions_grid_key_unique",
            )

            # 4. ai_summaries: unique on analysis_hash
            await self.db.ai_summaries.create_index(
                [("analysis_hash", 1)],
                unique=True,
                name="idx_ai_summary_hash_unique",
            )
            logger.info("MongoDB indexes verified/created successfully.")
        except Exception as exc:
            logger.error("Failed to initialize MongoDB indexes: %s", exc)

    async def is_healthy(self) -> bool:
        """Check if MongoDB is actively responding."""
        if not self._is_connected or self.client is None:
            return False
        try:
            await self.client.admin.command("ping")
            return True
        except Exception:
            return False

    async def close(self) -> None:
        """Close MongoDB connection pool."""
        if self.client:
            self.client.close()
            self._is_connected = False
            logger.info("MongoDB client closed.")


db_manager = MongoDBManager()
