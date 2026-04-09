import io
import logging
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from db.client import get_db

logger = logging.getLogger(__name__)

class StorageService:
    @staticmethod
    async def save_file(filename: str, file_bytes: bytes, metadata: dict = None) -> str:
        db = get_db()
        bucket = AsyncIOMotorGridFSBucket(db)
        try:
            file_id = await bucket.upload_from_stream(
                filename,
                file_bytes,
                metadata=metadata
            )
            return str(file_id)
        except Exception as e:
            logger.error(f"Failed to save file to GridFS: {e}")
            raise e

    @staticmethod
    async def get_file_stream(file_id: str):
        from bson import ObjectId
        db = get_db()
        bucket = AsyncIOMotorGridFSBucket(db)
        try:
            grid_out = await bucket.open_download_stream(ObjectId(file_id))
            return grid_out
        except Exception as e:
            logger.error(f"Failed to retrieve file from GridFS: {e}")
            return None

    @staticmethod
    async def delete_file(file_id: str):
        from bson import ObjectId
        db = get_db()
        bucket = AsyncIOMotorGridFSBucket(db)
        try:
            await bucket.delete(ObjectId(file_id))
            return True
        except Exception as e:
            logger.error(f"Failed to delete file from GridFS: {e}")
            return False
