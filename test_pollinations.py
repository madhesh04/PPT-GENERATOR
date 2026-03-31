import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from image_client import _fetch_pollinations

async def test_pollinations():
    query = "futuristic city skyline"
    print(f"Testing Pollinations with query: '{query}'")
    
    result = await _fetch_pollinations(query)
    
    if result:
        print(f"SUCCESS: Fetched {len(result)} bytes from Pollinations.")
        # Save for manual check
        with open("pollinations_test.jpg", "wb") as f:
            f.write(result)
        print("Image saved as 'pollinations_test.jpg'")
    else:
        print("FAILED: Pollinations returned None.")

if __name__ == "__main__":
    asyncio.run(test_pollinations())
