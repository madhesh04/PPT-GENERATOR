import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017').skynet_db
    users = await db.users.find({}).to_list(100)
    for u in users:
        print(f"EMAIL: {u.get('email')} | FULL_NAME: {u.get('full_name')} | ROLE: {u.get('role')}")

if __name__ == '__main__':
    asyncio.run(main())
