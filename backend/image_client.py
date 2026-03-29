import os
import httpx
import logging

logger = logging.getLogger(__name__)

UNSPLASH_KEY = os.getenv("UNSPLASH_ACCESS_KEY")
PEXELS_KEY   = os.getenv("PEXELS_API_KEY")
POLLINATIONS_KEY = os.getenv("POLLINATIONS_API_KEY")


# ── Source 1: Pollinations.ai ─────────────────────────────────────────────────
# Completely free, no API key, AI-generated images

async def _fetch_pollinations(query: str) -> bytes | None:
    try:
        safe_prompt = query.replace(" ", "%20")
        url = (
            f"https://image.pollinations.ai/prompt/"
            f"professional%20presentation%20slide%20{safe_prompt}"
            f"%20minimalist%20clean%20corporate"
            f"?width=1344&height=768&nologo=true&enhance=true"
        )
        # When using an API key, Pollinations often requires a model parameter and query-based key
        if POLLINATIONS_KEY:
            safe_key = POLLINATIONS_KEY.strip()
            url += f"&model=flux&key={safe_key}"

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            r = await client.get(url)
            if r.status_code == 200 and len(r.content) > 5000:
                return r.content
            return None
    except Exception as e:
        logger.warning("Pollinations failed: %s", e)
        return None


# ── Source 2: Unsplash ────────────────────────────────────────────────────────
# Free tier: 50 requests/hour

async def _fetch_unsplash(query: str) -> bytes | None:
    if not UNSPLASH_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.unsplash.com/photos/random",
                params={
                    "query": query,
                    "orientation": "landscape",
                    "content_filter": "high"
                },
                headers={"Authorization": f"Client-ID {UNSPLASH_KEY}"}
            )
            if r.status_code != 200:
                return None
            photo_url = r.json()["urls"]["regular"]
            img = await client.get(photo_url, timeout=15)
            return img.content if img.status_code == 200 else None
    except Exception as e:
        logger.warning("Unsplash failed: %s", e)
        return None


# ── Source 3: Pexels ──────────────────────────────────────────────────────────
# Free tier: 200 requests/hour

async def _fetch_pexels(query: str) -> bytes | None:
    if not PEXELS_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.pexels.com/v1/search",
                params={
                    "query": query,
                    "per_page": 1,
                    "orientation": "landscape"
                },
                headers={"Authorization": PEXELS_KEY}
            )
            if r.status_code != 200:
                return None
            photos = r.json().get("photos", [])
            if not photos:
                return None
            img_url = photos[0]["src"]["large"]
            img = await client.get(img_url, timeout=15)
            return img.content if img.status_code == 200 else None
    except Exception as e:
        logger.warning("Pexels failed: %s", e)
        return None


# ── Main entry point ──────────────────────────────────────────────────────────

async def fetch_slide_image(query: str) -> bytes | None:
    """
    Fetch an image for a slide using the query string.
    Tries Pollinations → Unsplash → Pexels in order.
    Returns image bytes or None if all sources fail.
    """
    if not query or not query.strip():
        return None

    result = await _fetch_pollinations(query)
    if result:
        logger.info("Image fetched from Pollinations: %s", query)
        return result

    result = await _fetch_unsplash(query)
    if result:
        logger.info("Image fetched from Unsplash: %s", query)
        return result

    result = await _fetch_pexels(query)
    if result:
        logger.info("Image fetched from Pexels: %s", query)
        return result

    logger.warning("All image sources failed for query: %s", query)
    return None
