import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check():
    load_dotenv('backend/.env')
    uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(uri)
    db = client.get_database('skynet_db')
    users = db.get_collection('users')
    
    all_u = await users.find().to_list(100)
    print(f"Total users found: {len(all_u)}")
    for u in all_u:
        print(f"ID: {u['_id']} | Email: {u['email']} | Role: {u.get('role')} | Hash: {u.get('password')[:10]}...")

if __name__ == "__main__":
    asyncio.run(check())
