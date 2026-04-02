import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import bcrypt
import datetime

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')

async def upsert_admin():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client.get_database('skynet_db')
    users = db.get_collection('users')
    
    hashed = bcrypt.hashpw(b"admin", bcrypt.gensalt()).decode('utf-8')
    
    doc = {
        "$set": {
            "role": "admin",
            "password": hashed,
            "full_name": "System Administrator",
        },
        "$setOnInsert": {
            "created_at": datetime.datetime.utcnow()
        }
    }
    
    res = await users.update_one({"email": "admin@iamneo.ai"}, doc, upsert=True)
    if res.upserted_id:
        print("Created new admin user. Default password: admin")
    else:
        print("Updated existing admin user. Password set to: admin")

if __name__ == '__main__':
    asyncio.run(upsert_admin())
