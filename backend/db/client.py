from motor.motor_asyncio import AsyncIOMotorClient
from core.config import settings
import logging

logger = logging.getLogger(__name__)


class Database:
    client: AsyncIOMotorClient = None
    db = None


db_state = Database()


async def connect_db():
    """Called once from lifespan startup. Initializes the Motor client."""
    db_state.client = AsyncIOMotorClient(settings.mongodb_uri)
    db_state.db = db_state.client.get_database("skynet_db")
    logger.info("Database: Motor client connected to skynet_db.")


async def close_db():
    """Called from lifespan shutdown. Closes the Motor client cleanly."""
    if db_state.client is not None:
        db_state.client.close()
        logger.info("Database: Motor client connection closed.")


def get_db():
    if db_state.db is None:
        raise RuntimeError(
            "Database not initialized. Ensure connect_db() is called in the lifespan startup hook."
        )
    return db_state.db


def get_users_collection():
    return get_db().get_collection("users")


def get_presentations_collection():
    return get_db().get_collection("presentations")


def get_generation_logs_collection():
    return get_db().get_collection("generation_logs")


def get_settings_collection():
    return get_db().get_collection("settings")
