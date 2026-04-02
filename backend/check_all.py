import asyncio
import json
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017').skynet_db
    users = await db.users.find({}).to_list(100)
    data = [{"email": u.get("email"), "full_name": u.get("full_name"), "role": u.get("role")} for u in users]
    with open("users.json", "w") as f:
        json.dump(data, f, indent=2)

if __name__ == '__main__':
    asyncio.run(main())
