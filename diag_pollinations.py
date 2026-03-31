import asyncio
import httpx

async def diag_pollinations():
    # Attempt 1: Simple free endpoint
    url_free = "https://gen.pollinations.ai/image/test_presentation"
    print(f"DIAG 1: Testing free endpoint: {url_free}")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(url_free)
            print(f"DIAG 1 Result: Status {r.status_code}, Length {len(r.content)}")
    except Exception as e:
        print(f"DIAG 1 Failed: {e}")

    # Attempt 2: Pro endpoint with key
    key = "sk_exmE9CTpWzRqEzMWn6WQpUECscJ1iKmf"
    url_pro = "https://gen.pollinations.ai/image/test_presentation?model=flux"
    print(f"DIAG 2: Testing pro endpoint with key: {url_pro}")
    try:
        headers = {"Authorization": f"Bearer {key}"}
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(url_pro, headers=headers)
            print(f"DIAG 2 Result: Status {r.status_code}, Length {len(r.content)}")
            if r.status_code != 200:
                print(f"DIAG 2 Body: {r.text[:200]}")
    except Exception as e:
        print(f"DIAG 2 Failed: {e}")

if __name__ == "__main__":
    asyncio.run(diag_pollinations())
