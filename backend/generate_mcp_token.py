"""
MCP Token Generator Script
Usage: python generate_mcp_token.py <employee_id> <password>
"""
import sys
import requests
import json

BASE_URL = "https://e56b-103-197-112-133.ngrok-free.app"

def generate_mcp_token(employee_id: str, password: str):
    print(f"🔐 Logging in as {employee_id}...")
    
    # Step 1: Login
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": employee_id,
            "password": password,
            "login_as": "employee"
        },
        headers={"Content-Type": "application/json"}
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return None
    
    login_data = login_response.json()
    jwt_token = login_data["access_token"]
    print(f"✅ Login successful!")
    print(f"   User: {login_data['user']['full_name']}")
    print(f"   Role: {login_data['user']['role']}")
    
    # Step 2: Generate MCP token
    print(f"\n🎫 Generating MCP token...")
    mcp_response = requests.post(
        f"{BASE_URL}/mcp/token",
        headers={"Authorization": f"Bearer {jwt_token}"}
    )
    
    if mcp_response.status_code != 200:
        print(f"❌ MCP token generation failed: {mcp_response.text}")
        return None
    
    mcp_data = mcp_response.json()
    mcp_token = mcp_data["access_token"]
    
    print(f"✅ MCP token generated successfully!")
    print(f"\n{'='*60}")
    print(f"MCP TOKEN (copy this for Claude):")
    print(f"{'='*60}")
    print(f"{mcp_token}")
    print(f"{'='*60}")
    print(f"\nExpires in: {mcp_data['expires_in']} seconds")
    
    # Step 3: Test the token
    print(f"\n🧪 Testing MCP token...")
    test_response = requests.post(
        f"{BASE_URL}/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        headers={
            "Authorization": f"Bearer {mcp_token}",
            "Content-Type": "application/json"
        }
    )
    
    if test_response.status_code == 200:
        tools = test_response.json()["result"]["tools"]
        print(f"✅ Token is valid! Available tools: {len(tools)}")
        for tool in tools:
            print(f"   - {tool['name']}")
    else:
        print(f"❌ Token test failed: {test_response.text}")
    
    return mcp_token

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python generate_mcp_token.py <employee_id> <password>")
        sys.exit(1)
    
    employee_id = sys.argv[1]
    password = sys.argv[2]
    
    generate_mcp_token(employee_id, password)
