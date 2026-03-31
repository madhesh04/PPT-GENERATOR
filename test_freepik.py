import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from image_client import _fetch_freepik, fetch_slide_image

async def test_freepik():
    query = "professional business presentation"
    print(f"Testing Freepik with query: '{query}'")
    
    # Check if key is set
    key = os.getenv("FREEPIK_API_KEY")
    if not key:
        print("WARNING: FREEPIK_API_KEY not set. _fetch_freepik will return None.")
    
    result = await _fetch_freepik(query)
    
    if result:
        print(f"SUCCESS: Fetched {len(result)} bytes from Freepik.")
    else:
        print("FAILED: Freepik returned None (this is expected if API key is missing or invalid).")

if __name__ == "__main__":
    asyncio.run(test_freepik())
