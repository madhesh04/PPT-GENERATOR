from motor.motor_asyncio import AsyncIOMotorClient
from core.config import settings
import logging

from typing import Optional

logger = logging.getLogger(__name__)


# ── Skynet Application Database (presentations, settings, logs) ────────────────
class Database:
    client: Optional[AsyncIOMotorClient] = None
    db = None


db_state = Database()


async def connect_db():
    """Called once from lifespan startup. Initializes the Motor client for Skynet app data."""
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


def get_presentations_collection():
    return get_db().get_collection("presentations")


def get_generation_logs_collection():
    return get_db().get_collection("generation_logs")


def get_settings_collection():
    return get_db().get_collection("settings")


def get_audit_logs_collection():
    return get_db().get_collection("audit_logs")


def get_bank_collection():
    return get_db().get_collection("series")


# ── Timesheet Auth Database (external — read-only for auth) ────────────────────
class TimesheetDatabase:
    client: Optional[AsyncIOMotorClient] = None
    db = None


timesheet_state = TimesheetDatabase()


async def connect_timesheet_db():
    """Connect to the external Timesheet-Application MongoDB for user authentication."""
    uri = settings.timesheet_mongodb_uri or settings.mongodb_uri
    db_name = settings.timesheet_db_name
    timesheet_state.client = AsyncIOMotorClient(uri)
    timesheet_state.db = timesheet_state.client.get_database(db_name)
    logger.info("Database: Motor client connected to Timesheet DB (%s).", db_name)


async def close_timesheet_db():
    """Close the Timesheet Motor client cleanly."""
    if timesheet_state.client is not None:
        timesheet_state.client.close()
        logger.info("Database: Timesheet DB connection closed.")


def get_timesheet_db():
    if timesheet_state.db is None:
        raise RuntimeError(
            "Timesheet DB not initialized. Ensure connect_timesheet_db() is called in the lifespan startup hook."
        )
    return timesheet_state.db


def get_timesheet_users_collection():
    """Returns the `users` collection from the external Timesheet-Application database."""
    return get_timesheet_db().get_collection("users")
