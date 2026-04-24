"""
Auto MCP Token Generator
Creates a test user in the database and generates an MCP token
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient
from core.security import get_password_hash, create_access_token
from datetime import datetime, timedelta, timezone
from core.config import settings

async def create_test_user_and_token():
    # Connect to Timesheet DB
    client = AsyncIOMotorClient(settings.timesheet_mongodb_uri)
    db = client[settings.timesheet_db_name]
    users_collection = db["users"]
    
    # Test user credentials
    test_employee_id = "TEST001"
    test_password = "test123"
    test_name = "MCP Test User"
    
    print(f"[*] Checking if test user exists...")
    
    # Check if user exists
    existing_user = await users_collection.find_one({"employeeId": test_employee_id})
    
    if not existing_user:
        print(f"[+] Creating test user: {test_employee_id}")
        hashed_password = get_password_hash(test_password)
        
        await users_collection.insert_one({
            "employeeId": test_employee_id,
            "name": test_name,
            "password": hashed_password,
            "role": "user",
            "teamLead": "",
            "createdAt": datetime.now(timezone.utc)
        })
        print(f"[+] Test user created!")
    else:
        print(f"[+] Test user already exists!")
    
    # Generate JWT token
    print(f"\n[*] Generating JWT token...")
    payload_data = {
        "sub": test_employee_id,
        "user_id": test_employee_id,
        "username": test_name,
        "role": "USER",
        "team_lead": "",
    }
    jwt_token = create_access_token(
        data=payload_data,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
    )
    
    # Generate MCP token
    print(f"[*] Generating MCP token...")
    mcp_token = f"mcp-{test_employee_id}-{int(datetime.now(timezone.utc).timestamp())}"
    
    print(f"\n{'='*70}")
    print(f"TEST USER CREDENTIALS:")
    print(f"{'='*70}")
    print(f"Employee ID: {test_employee_id}")
    print(f"Password:    {test_password}")
    print(f"Name:        {test_name}")
    print(f"Role:        USER")
    print(f"\n{'='*70}")
    print(f"JWT TOKEN (for API calls):")
    print(f"{'='*70}")
    print(f"{jwt_token}")
    print(f"\n{'='*70}")
    print(f"MCP TOKEN (for Claude):")
    print(f"{'='*70}")
    print(f"{mcp_token}")
    print(f"{'='*70}")
    
    print(f"\n[!] USAGE:")
    print(f"1. Add this token to your backend's VALID_MCP_TOKENS set")
    print(f"2. Configure Claude with:")
    print(f"   URL: https://e56b-103-197-112-133.ngrok-free.app")
    print(f"   Token: {mcp_token}")
    
    print(f"\n[!] To add token to backend, run this in Python console:")
    print(f"   VALID_MCP_TOKENS.add('{mcp_token}')")
    
    await client.close()
    
    return {
        "employee_id": test_employee_id,
        "password": test_password,
        "jwt_token": jwt_token,
        "mcp_token": mcp_token
    }

if __name__ == "__main__":
    result = asyncio.run(create_test_user_and_token())
