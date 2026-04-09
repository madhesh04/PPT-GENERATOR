import os
import json
import asyncio
import logging
import base64
from groq import Groq
from openai import OpenAI
from typing import Optional
from core.config import settings

logger = logging.getLogger(__name__)

# LLM Configurations
GROQ_MODEL = "llama-3.3-70b-versatile"
NVIDIA_MODEL = "moonshotai/kimi-k2-instruct" # Kimi K2.5 or similar high-quality NIM
NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"

# NVIDIA client setup
nvidia_client = None
if settings.nvidia_api_key and settings.nvidia_api_key.strip() != "your_nvidia_api_key_here":
    nvidia_client = OpenAI(base_url=NVIDIA_BASE_URL, api_key=settings.nvidia_api_key)

# Tone Configurations
TONE_CONFIG = {
    "professional": {
        "temperature": 0.5,
        "instruction": "Maintain a polished, authoritative corporate tone. Use clear, objective language. Focus on strategic value, ROI, and professional excellence."
    },
    "creative": {
        "temperature": 0.8,
        "instruction": "Use an engaging, visionary, and dynamic tone. Emphasize innovation and unique perspectives. Feel free to use metaphors and inspiring language."
    },
    "technical": {
        "temperature": 0.3,
        "instruction": "Prioritize depth, accuracy, and engineering rigor. Use precise terminology. Explain 'how' things work internally. Include code logic where appropriate."
    },
    "educational": {
        "temperature": 0.6,
        "instruction": "Adopt a clear, pedagogical style. Break down complex concepts into first principles. Use analogies and step-by-step explanations."
    }
}

TECHNICAL_KEYWORDS = [
    "python", "react", "javascript", "typescript", "backend", "frontend", "api", "database", "mongodb", "sql",
    "cloud", "aws", "azure", "docker", "kubernetes", "architecture", "microservices", "algorithm", "data structure",
    "machine learning", "ai", "deep learning", "neural network", "security", "encryption", "networking", "protocol",
    "git", "devops", "ci/cd", "agile", "coding", "software", "engineering", "server", "system design"
]

def is_technical_topic(title: str, topics: list) -> bool:
    """
    Returns True if the PPT topic is programming/technical in nature.
    Checks both the presentation title and individual topic strings.
    """
    text = title.lower()
    if topics:
        text += " " + " ".join(t.lower() for t in topics)
    return any(kw in text for kw in TECHNICAL_KEYWORDS)


def _build_prompt(title: str, topics: list, num_slides: int, context: str, tone_instruction: str, include_notes: bool = True) -> tuple[str, str]:
    """Returns (system_prompt, user_prompt)."""
    notes_instruction = """
═══════════════════════════
SPEAKER NOTES
═══════════════════════════
Add a "notes" field per slide: 2-4 sentences the presenter speaks aloud.
Notes should: expand on what's on the slide, add one more example or data point not in the bullets, and guide the presenter's delivery.
""" if include_notes else "\nSPEAKER NOTES: Set the 'notes' field to an empty string for all slides.\n"

    context_block = (
        f"\nAdditional context about this presentation:\n{context.strip()}\n"
        "Use this context — especially the audience type and domain — to sharpen every slide's content.\n"
        if context.strip() else ""
    )

    system_prompt = f"""You are a world-class presentation writer and subject-matter expert hired to create professional client-ready slide decks.
These presentations are used by a company to deliver polished decks to their clients — the quality must be genuinely impressive and immediately useful.
You must generate the ACTUAL FINAL CONTENT of the presentation. DO NOT generate placeholders or templates.

TONE & AUDIENCE STYLE: {tone_instruction}

{notes_instruction}

═══════════════════════════════════════════
CONTENT QUALITY STANDARD — NON-NEGOTIABLE
═══════════════════════════════════════════

Every bullet point you write must do ALL of the following:
  ✔ Contain ACTUAL FACTUAL KNOWLEDGE, specific details, and educational value
  ✔ Be a complete, standalone sentence of 20–40 words
  ✔ Deliver genuine insight — no filler, no structural meta-text
  ✔ Where the concept warrants it: include a real-world example, analogy, case study, or data point

NEVER WRITE PLACEHOLDERS. NEVER WRITE META-TEXT ABOUT THE SLIDE.

═══════════════════════════
DOMAIN DETECTION
═══════════════════════════
Infer the domain of this presentation from the title, topics, and context. Then apply domain-appropriate depth.

═══════════════════════════
SLIDE STRUCTURE RULES
═══════════════════════════
BULLET COUNT: Exactly 5 per slide. Every content slide MUST have exactly 5 bullet points.

═══════════════════════════
CODE BLOCKS
═══════════════════════════
For technical or programming topics, some slides SHOULD include a code example.
- Put code in the "code" field as a clean, runnable snippet.
- For non-code slides, set both "code" and "language" to null.

═══════════════════════════
IMAGE SELECTION (SELECTIVE)
═══════════════════════════
NOT every slide needs an image. Only assign an image_query to slides where a visual genuinely enhances understanding.
Typically 2–3 slides per deck should have images.

OUTPUT FORMAT: Return ONLY a valid raw JSON array. No markdown, no code fences.

Each object MUST have exactly these fields:
- "title": specific descriptive slide title
- "content": list of exactly 5 bullets (20-45 words each)
- "code": a code snippet string or null
- "language": programming language name or null
- "notes": { "2-4 sentences for the presenter" if include_notes else "empty string" }
- "image_query": a 3-6 word image search phrase OR null"""

    user_prompt = f"""Create the COMPLETE, FACTUAL FINAL CONTENT for a slide deck titled "{title}".
{context_block}
Topics to cover: {', '.join(topics)}.
Generate EXACTLY {num_slides} slides.

Return a JSON array of exactly {num_slides} objects. Each object MUST have:
- "title": slide title
- "content": list of 5 bullets
- "code": string or null
- "language": string or null
- "notes": { "presenter notes" if include_notes else "empty string" }
- "image_query": 3-6 word image search phrase or null

JSON only. Start immediately with ["""

    return system_prompt, user_prompt


def _parse_and_validate(raw: str) -> list:
    """Parse raw JSON string and validate slide structure."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"): raw = raw[4:]
    
    try:
        data = json.loads(raw.strip())
    except Exception as e:
        logger.error(f"Failed to parse LLM JSON: {e}")
        raise

    validated = []
    if isinstance(data, list):
        for item in data:
            if not isinstance(item, dict) or "title" not in item or "content" not in item:
                continue
            
            img_q = item.get("image_query")
            if img_q and str(img_q).lower() not in ("null", "none", ""):
                img_q = str(img_q)
            else:
                img_q = None

            validated.append({
                "title":       str(item["title"]),
                "content":     [str(c) for c in item["content"] if c],
                "code":        item.get("code"),
                "language":    item.get("language"),
                "notes":       str(item.get("notes", "")),
                "image_query": img_q,
            })
    return validated


def _call_groq(title: str, topics: list, num_slides: int = 5, context: str = "", tone: str = "professional", include_notes: bool = True) -> list:
    """Synchronous Groq call with retry on JSON failure."""
    client = Groq(api_key=settings.groq_api_key)
    
    tone_cfg = TONE_CONFIG.get(tone.lower(), TONE_CONFIG["professional"])
    system_prompt, user_prompt = _build_prompt(title, topics, num_slides, context, tone_cfg["instruction"], include_notes=include_notes)

    completion = client.chat.completions.create(
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        model=GROQ_MODEL,
        temperature=tone_cfg["temperature"],
        max_tokens=6000,
    )
    return _parse_and_validate(completion.choices[0].message.content.strip())


def _call_nvidia(title: str, topics: list, num_slides: int = 5, context: str = "", tone: str = "professional", include_notes: bool = True) -> list:
    """Synchronous NVIDIA NIM call."""
    if not nvidia_client:
        raise RuntimeError("NVIDIA NIM client is not configured.")

    tone_cfg = TONE_CONFIG.get(tone.lower(), TONE_CONFIG["technical"])
    system_prompt, user_prompt = _build_prompt(title, topics, num_slides, context, tone_cfg["instruction"], include_notes=include_notes)

    completion = nvidia_client.chat.completions.create(
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        model=NVIDIA_MODEL,
        temperature=min(tone_cfg["temperature"], 0.35),
        max_tokens=6000,
    )
    return _parse_and_validate(completion.choices[0].message.content.strip())


async def generate_slide_content(
    title: str,
    topics: list,
    num_slides: int = 5,
    context: str = "",
    tone: str = "professional",
    force_provider: str | None = None,
    include_notes: bool = True,
) -> tuple[list, str, str]:
    """Async entry point for slide generation with automatic provider routing."""
    use_nvidia = False
    if force_provider == "nvidia":
        use_nvidia = True
    elif force_provider == "groq":
        use_nvidia = False
    else:
        use_nvidia = nvidia_client is not None and is_technical_topic(title, topics)

    if use_nvidia:
        try:
            logger.info(f"Routing to NVIDIA NIM ({NVIDIA_MODEL})")
            slides = await asyncio.to_thread(_call_nvidia, title, topics, num_slides, context, tone, include_notes=include_notes)
            return slides, NVIDIA_MODEL, "nvidia_nim"
        except Exception as e:
            logger.warning(f"NVIDIA NIM failed: {e}. Falling back to Groq.")

    logger.info(f"Using Groq ({GROQ_MODEL})")
    slides = await asyncio.to_thread(_call_groq, title, topics, num_slides, context, tone, include_notes=include_notes)
    return slides, GROQ_MODEL, "groq"
