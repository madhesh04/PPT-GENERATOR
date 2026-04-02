import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import bcrypt
import datetime
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')

async def seed_db():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client.get_database('skynet_db')
    users = db.get_collection('users')
    
    # 1. Seed new master admin account
    hashed = bcrypt.hashpw(b"SkyAdmin@2026", bcrypt.gensalt()).decode('utf-8')
    admin_doc = {
        "$set": {
            "role": "admin",
            "password": hashed,
            "full_name": "skynet_admin",
            "status": "active",
        },
        "$setOnInsert": {
            "created_at": datetime.datetime.utcnow(),
            "ppt_count": 0
        }
    }
    await users.update_one({"email": "admin@skynet.ai"}, admin_doc, upsert=True)
    print("Seeded admin@skynet.ai (master admin).")
    
    # 2. Fix the old bypassed account(s) to 'user' except for the new admin
    await users.update_many(
        {"email": {"$ne": "admin@skynet.ai"}},
        {"$set": {"role": "user"}}
    )
    print("Demoted all other accounts to 'user' role.")
    
    # 3. Ensure schema columns exist for older docs
    await users.update_many(
        {"status": {"$exists": False}},
        {"$set": {"status": "active", "role": "user", "ppt_count": 0}}
    )
    print("Database seeded and schema normalized successfully.")

if __name__ == '__main__':
    asyncio.run(seed_db())
