import asyncio
import motor.motor_asyncio
from pprint import pprint

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb+srv://admin123:admin123@skynet.i9yvzfk.mongodb.net/?appName=Skynet")
    db = client["skynet_db"]
    count = await db["presentations"].count_documents({})
    print("Total docs:", count)
    docs = await db["presentations"].find().to_list(10)
    for d in docs:
        print("USER:", d.get("user_id"), "| TITLE:", d.get("title"))

asyncio.run(main())
