from motor.motor_asyncio import AsyncIOMotorClient
from core.config import settings

class Database:
    client: AsyncIOMotorClient = None
    db = None

db = Database()

def get_db():
    if db.client is None:
        db.client = AsyncIOMotorClient(settings.mongodb_uri)
        db.db = db.client.get_database("skynet_db")
    return db.db

def get_users_collection():
    return get_db().get_collection("users")

def get_presentations_collection():
    return get_db().get_collection("presentations")

def get_generation_logs_collection():
    return get_db().get_collection("generation_logs")

def get_settings_collection():
    return get_db().get_collection("settings")
