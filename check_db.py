import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')

async def check():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client.get_database('skynet_db')
    users = db.get_collection('users')
    u = await users.find_one({"email": "admin@skynet.ai"})
    if u:
        print(f"Found: {u['email']}, Role: {u['role']}, Status: {u['status']}")
    else:
        print("Not found")

asyncio.run(check())
