import httpx
import logging
from core.config import settings

logger = logging.getLogger(__name__)

UNSPLASH_KEY = settings.unsplash_access_key
POLLINATIONS_KEY = settings.pollinations_api_key
FREEPIK_KEY      = settings.freepik_api_key




# ── Source 1: Pollinations.ai ─────────────────────────────────────────────────
# Completely free, no API key, AI-generated images

async def _fetch_pollinations(query: str) -> bytes | None:
    try:
        # Avoid "presentation slide" and "text" to ensure high-quality background imagery
        safe_prompt = query.replace(" ", "%20")
        url = (
            f"https://gen.pollinations.ai/image/"
            f"{safe_prompt}%20professional%20high-resolution%20photography%20"
            f"minimalist%20corporate%20clean%20cinematic%20lighting"
            f"?width=1344&height=768&nologo=true&enhance=true&model=flux"
        )
        
        headers = {}
        if POLLINATIONS_KEY:
            headers["Authorization"] = f"Bearer {POLLINATIONS_KEY.strip()}"

        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            r = await client.get(url, headers=headers)
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


# ── Source 3: Freepik ─────────────────────────────────────────────────────────
# Requires a paid/free-trial API key

async def _fetch_freepik(query: str) -> bytes | None:
    if not FREEPIK_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.freepik.com/v1/resources",
                params={
                    "query": query,
                    "per_page": 1,
                    "type": "photo"
                },
                headers={"x-freepik-api-key": FREEPIK_KEY}
            )
            if r.status_code != 200:
                return None
            
            data = r.json().get("data", [])
            if not data:
                return None
                
            img_url = data[0]["preview"]["url"]
            img = await client.get(img_url, timeout=15)
            return img.content if img.status_code == 200 else None
    except Exception as e:
        logger.warning("Freepik failed: %s", e)
        return None



# ── Main entry point ──────────────────────────────────────────────────────────

async def fetch_slide_image(query: str) -> bytes | None:
    """
    Fetch an image for a slide using the query string.
    Tries Freepik → Unsplash → Pollinations in order.
    Returns image bytes or None if all sources fail.
    """

    if not query or not query.strip():
        return None

    # 1. Try Freepik (Real Photos)
    result = await _fetch_freepik(query)
    if result:
        logger.info("Image fetched from Freepik: %s", query)
        return result

    # 2. Try Unsplash (Real Photos)
    result = await _fetch_unsplash(query)
    if result:
        logger.info("Image fetched from Unsplash: %s", query)
        return result

    # 3. Try Pollinations (AI Fallback - Photography Model)
    result = await _fetch_pollinations(query)
    if result:
        logger.info("Image fetched from Pollinations: %s", query)
        return result

    logger.warning("All image sources failed for query: %s", query)
    return None



