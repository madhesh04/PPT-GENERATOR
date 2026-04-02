import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    db = AsyncIOMotorClient('mongodb://localhost:27017').skynet_db
    user = await db.users.find_one({'email': 'admin@iamneo.ai'})
    print("ROLE:", user.get('role', 'MISSING_ROLE'))
    print("EMAIL:", user.get('email'))
    print("FULL_NAME:", user.get('full_name'))

if __name__ == '__main__':
    asyncio.run(main())
