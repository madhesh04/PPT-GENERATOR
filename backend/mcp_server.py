"""
Skynet MCP Server — exposes PPT generation as MCP tools.

Mount point: /mcp  (streamable-http transport)
No authentication — intended for internal / local use.

Claude Desktop config (~/.config/claude/claude_desktop_config.json):
  {
    "mcpServers": {
      "skynet": {
        "url": "http://localhost:8000/mcp"
      }
    }
  }
"""

import asyncio
import base64
import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from mcp.server.fastmcp import FastMCP

from core.converters import serialize_mongo_doc
from core.utils import sanitize_filename
from db.client import get_presentations_collection, get_generation_logs_collection
from generator import create_presentation
from image_client import fetch_slide_image
from llm_client import generate_slide_content
from models.requests import PresentationRequest, SlideData
from services.generation_service import (
    get_presentation_cache,
    handle_cache_hit,
    run_generation_pipeline,
)
from services.storage_service import StorageService

logger = logging.getLogger(__name__)

mcp_app = FastMCP("Skynet PPT Generator")

# Service account used for all MCP-initiated operations (no auth required)
_MCP_USER = {"user_id": "mcp-service", "username": "MCP Service", "role": "user"}


# ── Tools ─────────────────────────────────────────────────────────────────────

@mcp_app.tool()
async def generate_presentation(
    title: str,
    topics: list[str],
    num_slides: int = 7,
    context: str = "",
    tone: str = "professional",
    theme: str = "neon",
    include_images: bool = True,
    force_provider: str = "auto",
) -> str:
    """
    Generate a full presentation using the Skynet pipeline.

    Runs: LLM content generation → image fetching → MongoDB persistence.
    Returns a summary of slides and a 'token' you must pass to export_presentation.

    Args:
        title: Presentation title.
        topics: List of key topics to cover (1–10).
        num_slides: Number of content slides (2–15). Default 7.
        context: Optional background context, audience notes, or instructions.
        tone: Writing tone — professional | executive | technical | academic |
              creative | sales | simple. Default 'professional'.
        theme: Visual theme — neon | ocean | emerald | royal | dark | light | carbon.
               Default 'neon'.
        include_images: Whether to source images for slides. Default True.
        force_provider: LLM provider — groq | nvidia | auto. Default 'auto'.
    """
    body = PresentationRequest(
        title=title,
        topics=topics,
        num_slides=num_slides,
        context=context,
        tone=tone,
        theme=theme,
        include_images=include_images,
        force_provider=force_provider,
    )

    start_time = time.time()
    cached, content_hash = await get_presentation_cache(
        body.title, body.topics, body.tone, body.theme, body.num_slides, body.context
    )

    if cached:
        result = await handle_cache_hit(cached, content_hash, _MCP_USER, start_time)
    else:
        result = await run_generation_pipeline(body, _MCP_USER, start_time, content_hash)

    slide_summaries = [
        {
            "index": i,
            "title": s.get("title", ""),
            "bullets": s.get("content", []),
            "notes": s.get("notes", ""),
            "has_code": bool(s.get("code")),
            "has_image": bool(s.get("image_base64")),
        }
        for i, s in enumerate(result["slides"])
    ]

    return json.dumps(
        {
            "token": result["token"],
            "title": result["title"],
            "theme": result["theme"],
            "slide_count": len(result["slides"]),
            "provider": result.get("provider", "unknown"),
            "model_used": result.get("model_used", "unknown"),
            "slides": slide_summaries,
            "next_step": f"Call export_presentation(token='{result['token']}') to build the PPTX file.",
        },
        indent=2,
    )


@mcp_app.tool()
async def export_presentation(token: str, theme: Optional[str] = None) -> str:
    """
    Build a PPTX file from a previously generated presentation and save it to storage.

    Uses the 'token' returned by generate_presentation. The resulting file_id can be
    downloaded via GET /download/{file_id} on the Skynet backend.

    Args:
        token: The presentation token returned by generate_presentation.
        theme: Override the visual theme — neon | ocean | emerald | royal | dark | light | carbon.
               If omitted, the theme used during generation is preserved.
    """
    presentations_collection = get_presentations_collection()

    try:
        obj_id = ObjectId(token)
    except Exception:
        return json.dumps({"error": "Invalid token — must be a valid MongoDB ObjectId string."})

    presentation = await presentations_collection.find_one({"_id": obj_id})
    if not presentation:
        return json.dumps({"error": f"Presentation with token '{token}' not found."})

    slides = presentation.get("slides", [])
    title = presentation.get("title", "Presentation")
    resolved_theme = theme if theme is not None else presentation.get("theme", "neon")

    # Decode base64 images back to bytes for python-pptx
    image_bytes_list: list[Optional[bytes]] = []
    for slide in slides:
        b64 = slide.get("image_base64")
        if b64 and isinstance(b64, str) and b64.startswith("data:"):
            try:
                _, data = b64.split(",", 1)
                image_bytes_list.append(base64.b64decode(data))
            except Exception:
                image_bytes_list.append(None)
        else:
            image_bytes_list.append(None)

    ppt_io, _ = create_presentation(title, slides, image_bytes_list, theme_name=resolved_theme)
    filename = f"{sanitize_filename(title)}.pptx"

    file_id = await StorageService.save_file(
        filename,
        ppt_io.getvalue(),
        metadata={"user_id": "mcp-service", "type": "pptx", "title": title},
    )

    return json.dumps(
        {
            "file_id": file_id,
            "filename": filename,
            "download_path": f"/download/{file_id}",
            "message": "PPTX ready. Fetch via GET /download/{file_id} (requires auth token).",
        },
        indent=2,
    )


@mcp_app.tool()
async def regenerate_slide(
    title: str,
    topics: list[str],
    context: str = "",
    tone: str = "professional",
    force_provider: str = "auto",
) -> str:
    """
    Generate a single replacement slide on the given topic.

    Useful for refining one slide without regenerating the entire presentation.

    Args:
        title: The slide title / topic to generate content for.
        topics: Sub-topics or keywords the slide should cover.
        context: Optional extra context or instructions.
        tone: Writing tone — professional | executive | technical | academic | etc.
        force_provider: LLM provider — groq | nvidia | auto. Default 'auto'.
    """
    try:
        slides, model_used, provider = await generate_slide_content(
            title, topics, num_slides=1,
            context=context, tone=tone,
            provider=force_provider,
            include_notes=True,
            include_images=False,
        )
    except Exception as e:
        return json.dumps({"error": f"Slide generation failed: {e}"})

    if not slides:
        return json.dumps({"error": "LLM returned no slide data."})

    slide = slides[0]
    return json.dumps(
        {
            "title": slide.get("title", ""),
            "content": slide.get("content", []),
            "notes": slide.get("notes", ""),
            "code": slide.get("code"),
            "language": slide.get("language"),
            "provider": provider,
            "model_used": model_used,
        },
        indent=2,
    )


@mcp_app.tool()
async def get_presentation(token: str) -> str:
    """
    Retrieve a saved presentation by its token, including all slides.

    Args:
        token: The presentation token (returned by generate_presentation).
    """
    presentations_collection = get_presentations_collection()

    try:
        obj_id = ObjectId(token)
    except Exception:
        return json.dumps({"error": "Invalid token."})

    doc = await presentations_collection.find_one({"_id": obj_id})
    if not doc:
        return json.dumps({"error": f"No presentation found for token '{token}'."})

    serialized = serialize_mongo_doc(doc)
    # Strip large base64 image blobs from the response to keep it readable
    for slide in serialized.get("slides", []):
        if slide.get("image_base64"):
            slide["image_base64"] = "<base64 omitted>"

    return json.dumps(serialized, indent=2, default=str)


@mcp_app.tool()
async def create_presentation_from_content(
    title: str,
    slides: list[dict],
    theme: str = "neon",
    tone: str = "professional",
) -> str:
    """
    Build a PPTX from slide content authored by Claude (or any external agent).

    This is the primary entry point for the Claude → MCP flow.
    Claude generates slide JSON, calls this tool, and receives a file_id
    for direct download — no separate export step required.

    Expected input shape:
      {
        "title": "My Presentation",
        "slides": [
          { "title": "Slide 1", "bullets": ["Point A", "Point B", "Point C"] },
          { "title": "Slide 2", "bullets": ["Point D", "Point E"], "notes": "Optional presenter note" }
        ]
      }

    Args:
        title:  Presentation title.
        slides: List of slide objects. Each must have 'title' (string) and
                'bullets' (list of strings). 'notes' is optional.
        theme:  Visual theme — neon | ocean | emerald | royal | dark | light | carbon.
        tone:   Tone label stored as metadata. Default 'professional'.
    """
    if not slides:
        return json.dumps({"error": "slides list cannot be empty."})

    # Validate and normalise — map 'bullets' → 'content'
    normalised: list[dict] = []
    for i, raw in enumerate(slides):
        if not isinstance(raw, dict):
            return json.dumps({"error": f"Slide {i}: expected a dict, got {type(raw).__name__}."})
        if "title" not in raw or "bullets" not in raw:
            return json.dumps({"error": f"Slide {i}: must have 'title' and 'bullets' fields."})
        try:
            sd = SlideData(
                title=raw["title"],
                content=raw["bullets"],
                notes=raw.get("notes", ""),
            )
            normalised.append(sd.model_dump())
        except Exception as exc:
            return json.dumps({"error": f"Slide {i} validation failed: {exc}"})

    # Build PPTX
    image_bytes_list: list[Optional[bytes]] = [None] * len(normalised)
    ppt_io, _ = create_presentation(title, normalised, image_bytes_list, theme_name=theme)
    filename = f"{sanitize_filename(title)}.pptx"

    file_id = await StorageService.save_file(
        filename,
        ppt_io.getvalue(),
        metadata={"user_id": "mcp-service", "type": "pptx", "title": title, "source": "mcp_direct"},
    )

    # Persist to MongoDB
    presentations_collection = get_presentations_collection()
    now = datetime.now(timezone.utc)
    content_hash = hashlib.sha256(
        json.dumps([{"title": s["title"], "content": s["content"]} for s in normalised], sort_keys=True).encode()
    ).hexdigest()
    res = await presentations_collection.insert_one({
        "user_id": "mcp-service",
        "generated_by": "MCP Service",
        "username": "MCP Service",
        "title": title,
        "topics": [s["title"] for s in normalised],
        "content_hash": content_hash,
        "slides": normalised,
        "created_at": now,
        "updated_at": now,
        "last_edited_by": None,
        "theme": theme,
        "type": "ppt",
        "tone": tone,
        "num_slides_requested": len(normalised),
        "track": None, "client": None, "module": None, "course": None,
        "source": "mcp_direct",
    })
    token = str(res.inserted_id)

    return json.dumps({
        "file_id": file_id,
        "filename": filename,
        "download_path": f"/download/{file_id}",
        "token": token,
        "slide_count": len(normalised),
        "message": "PPTX ready. Fetch via GET /download/{file_id}.",
    }, indent=2)


@mcp_app.tool()
async def list_presentations(limit: int = 10) -> str:
    """
    List the most recently generated presentations.

    Args:
        limit: Maximum number of presentations to return (1–50). Default 10.
    """
    limit = max(1, min(limit, 50))
    presentations_collection = get_presentations_collection()

    cursor = presentations_collection.find(
        {},
        {
            "title": 1,
            "created_at": 1,
            "theme": 1,
            "tone": 1,
            "num_slides_requested": 1,
            "generated_by": 1,
            "user_id": 1,
        },
    ).sort("created_at", -1).limit(limit)

    docs = await cursor.to_list(length=limit)
    return json.dumps(
        [serialize_mongo_doc(d) for d in docs],
        indent=2,
        default=str,
    )


@mcp_app.tool()
async def ingest_slide_content(
    title: str,
    slides: list[dict],
    theme: str = "neon",
    tone: str = "professional",
    fetch_images: bool = False,
) -> str:
    """
    Accept pre-generated slide content and feed it directly into the PPT pipeline.

    Bypasses LLM generation entirely. The slides you supply are validated, optionally
    enriched with images, persisted to MongoDB, and made available for export via
    export_presentation — using the exact same storage and export path as
    generate_presentation.

    Each slide dict must contain:
      - "title"   : string — the slide heading
      - "content" : list of strings — bullet points (ideally 5)

    Optional slide fields:
      - "code"        : code snippet string or null
      - "language"    : programming language name or null
      - "notes"       : presenter notes string
      - "image_query" : 3-6 word image search phrase (used only when fetch_images=True)

    Args:
        title:         Presentation title.
        slides:        List of slide objects as described above.
        theme:         Visual theme — neon | ocean | emerald | royal | dark | light | carbon.
        tone:          Tone label stored as metadata. Default 'professional'.
        fetch_images:  Fetch images for slides that have an image_query. Default False.
    """
    if not slides:
        return json.dumps({"error": "slides list cannot be empty."})

    # ── Validate and normalise each slide via the shared SlideData schema ─────
    normalised: list[dict] = []
    for i, raw in enumerate(slides):
        if not isinstance(raw, dict):
            return json.dumps({"error": f"Slide {i}: expected a dict, got {type(raw).__name__}."})
        try:
            sd = SlideData(
                title=raw["title"],
                content=raw["content"],
                code=raw.get("code"),
                language=raw.get("language"),
                notes=raw.get("notes", ""),
                image_query=raw.get("image_query"),
                image_base64=raw.get("image_base64"),
            )
            normalised.append(sd.model_dump())
        except (KeyError, Exception) as exc:
            return json.dumps({"error": f"Slide {i} validation failed: {exc}"})

    # ── Optional image fetching — identical cascade to run_generation_pipeline ─
    if fetch_images:
        async def _fetch(slide: dict) -> Optional[bytes]:
            query = slide.get("image_query")
            if not query:
                return None
            try:
                return await asyncio.wait_for(fetch_slide_image(query), timeout=25.0)
            except Exception:
                return None

        results = await asyncio.gather(*[_fetch(s) for s in normalised], return_exceptions=True)
        for slide, img in zip(normalised, results):
            if isinstance(img, bytes):
                slide["image_base64"] = f"data:image/jpeg;base64,{base64.b64encode(img).decode()}"

    # ── QC validation — same logic as run_generation_pipeline ─────────────────
    qc_issues: list[str] = []
    for i, slide in enumerate(normalised):
        if not slide.get("title", "").strip():
            qc_issues.append(f"Slide {i + 1}: missing title")
        bullets = slide.get("content", [])
        if len(bullets) < 3:
            qc_issues.append(f"Slide {i + 1}: only {len(bullets)} bullets (minimum 3)")
        if any(len(b.strip()) < 10 for b in bullets if b.strip()):
            qc_issues.append(f"Slide {i + 1}: contains suspiciously short bullet points")
    qc_score = max(0, 100 - len(qc_issues) * 10)
    qc_result = {"score": qc_score, "issues": qc_issues, "passed": qc_score >= 70}

    # ── MongoDB persistence — same document shape as run_generation_pipeline ───
    presentations_collection = get_presentations_collection()
    logs_collection = get_generation_logs_collection()
    start_time = time.time()

    content_hash = hashlib.sha256(
        json.dumps([{k: v for k, v in s.items() if k != "image_base64"} for s in normalised],
                   sort_keys=True).encode()
    ).hexdigest()

    now = datetime.now(timezone.utc)
    new_doc = {
        "user_id": "mcp-service",
        "generated_by": "MCP Service",
        "username": "MCP Service",
        "title": title,
        "topics": [s["title"] for s in normalised],
        "content_hash": content_hash,
        "slides": normalised,
        "created_at": now,
        "updated_at": now,
        "last_edited_by": None,
        "theme": theme,
        "type": "ppt",
        "tone": tone,
        "num_slides_requested": len(normalised),
        "track": None,
        "client": None,
        "module": None,
        "course": None,
        "qc": qc_result,
        "source": "mcp_ingest",
    }
    res = await presentations_collection.insert_one(new_doc)
    token = str(res.inserted_id)

    await logs_collection.insert_one({
        "user_id": "mcp-service",
        "presentation_id": res.inserted_id,
        "action": "ingest",
        "status": "success",
        "execution_time_ms": int((time.time() - start_time) * 1000),
        "timestamp": now,
    })

    return json.dumps(
        {
            "token": token,
            "title": title,
            "theme": theme,
            "slide_count": len(normalised),
            "qc": qc_result,
            "next_step": f"Call export_presentation(token='{token}') to build the PPTX file.",
        },
        indent=2,
    )
