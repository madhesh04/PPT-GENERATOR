import re
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

JSON_REPAIR_LIMIT = 20 # Max brackets to try adding

# Tone Configurations
TONE_CONFIG = {
    "professional": {
        "temperature": 0.25,
        "instruction": "Maintain a polished, authoritative corporate tone. Use clear, objective language. Focus on strategic value, ROI, and professional excellence."
    },
    "creative": {
        "temperature": 0.5,
        "instruction": "Use an engaging, visionary, and dynamic tone. Emphasize innovation and unique perspectives. Feel free to use metaphors and inspiring language."
    },
    "technical": {
        "temperature": 0.2,
        "instruction": "Prioritize depth, accuracy, and engineering rigor. Use precise terminology. Explain 'how' things work internally. Include code logic where appropriate."
    },
    "educational": {
        "temperature": 0.6,
        "instruction": "Adopt a clear, pedagogical style. Break down complex concepts into first principles. Use analogies and step-by-step explanations."
    },
    "academic": {
        "temperature": 0.4,
        "instruction": "Maintain a rigorous, formal, and objective academic tone. Cite concepts clearly, focus on detailed methodology, theoretical background, and ensure thorough explanations of both concepts and any code examples."
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


def _build_prompt(title: str, topics: list, num_slides: int, context: str, tone_instruction: str, include_notes: bool = True, include_images: bool = True) -> tuple[str, str]:
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
For technical, programming, or academic topics, some slides SHOULD include a code example.
- Put code in the "code" field as a clean, runnable snippet.
- CRITICAL: You must use literal `\n` characters to ensure every line of code prints on a NEW LINE. Under no circumstance should multiple code statements be concatenated on the same horizontal line.
- REQUIRED: If the tone is 'academic' or 'technical', any provided code snippet MUST be at least 10 lines long. You MUST explain the code block thoroughly line-by-line within the slide's content or notes.
- For non-code slides, set both "code" and "language" to null.

═══════════════════════════
IMAGE SELECTION
═══════════════════════════
{ "NOT every slide needs an image. Only assign an image_query to slides where a visual genuinely enhances understanding. Typically 2–3 slides per deck should have images." if include_images else "CRITICAL: Image generation is DISABLED for this session. You MUST set the 'image_query' field to null for ALL slides without exception." }

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
- "image_query": { "3-6 word image search phrase or null" if include_images else "MUST BE null" }

JSON only. Start immediately with ["""

    return system_prompt, user_prompt


def _parse_and_validate(raw: str) -> list:
    """Parse raw JSON string with aggressive recovery for truncated or malformed content."""
    raw = raw.strip()
    
    # 1. Advanced Extraction: Find the outermost JSON array boundaries
    start_idx = raw.find('[')
    end_idx = raw.rfind(']')
    
    if start_idx != -1:
        if end_idx != -1 and end_idx > start_idx:
            raw = raw[start_idx:end_idx+1]
        else:
            # Handle truncation (missing closing bracket)
            raw = raw[start_idx:]
    
    # 2. Pre-processing: Escape literal newlines within JSON strings
    # This specifically fixes the "Expecting value" error caused by raw newlines in strings
    def _escape_interior_newlines(match):
        return match.group(0).replace('\n', '\\n').replace('\r', '')
    
    # Robustly find double-quoted strings and escape their newlines
    # Using a regex that handles escaped quotes: ((?:[^"\\]|\\.)*)
    raw = re.sub(r'"((?:[^"\\]|\\.)*)"', _escape_interior_newlines, raw, flags=re.DOTALL)
    
    raw = raw.strip()
    if not raw:
        return []

    # 2. Main Parsing Attempt
    try:
        return json.loads(raw)
    except Exception:
        # 3. Emergency Syntax Cleaning (Trailing commas)
        try:
            repaired = re.sub(r',\s*([\]}])', r'\1', raw)
            return json.loads(repaired)
        except Exception:
            # 4. Truncation Recovery: Iteratively close brackets
            # This handles cases where the LLM stops mid-generation
            test_raw = repaired if 'repaired' in locals() else raw
            for i in range(JSON_REPAIR_LIMIT):
                try:
                    # Try adding closing brackets in common patterns
                    for suffix in ["]", "}]", "}}]"]:
                        try:
                            return json.loads(test_raw + (suffix * (i+1)) if i > 0 else test_raw + suffix)
                        except: continue
                except:
                    pass
            
            logger.error(f"Failed to parse LLM JSON after all recovery attempts.")
            # Final Debugging Payload: Log boundaries to terminal for inspection
            logger.debug(f"START-CAP (First 500): {raw[:500]}")
            logger.debug(f"END-CAP (Last 500): {raw[-500:]}")
            raise


def _validate_data(data: list) -> list:
    """Standardizes slide object structure."""
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


def _call_groq(title: str, topics: list, num_slides: int = 5, context: str = "", tone: str = "professional", include_notes: bool = True, include_images: bool = True) -> list:
    """Synchronous Groq call with retry on JSON failure."""
    client = Groq(api_key=settings.groq_api_key)
    
    tone_cfg = TONE_CONFIG.get(tone.lower(), TONE_CONFIG["professional"])
    system_prompt, user_prompt = _build_prompt(
        title, topics, num_slides, context, tone_cfg["instruction"], 
        include_notes=include_notes, include_images=include_images
    )

    completion = client.chat.completions.create(
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        model=GROQ_MODEL,
        temperature=tone_cfg["temperature"],
        max_tokens=8192,
    )
    data = _parse_and_validate(completion.choices[0].message.content.strip())
    return _validate_data(data)


def _call_nvidia(title: str, topics: list, num_slides: int = 5, context: str = "", tone: str = "professional", include_notes: bool = True, include_images: bool = True) -> list:
    """Synchronous NVIDIA NIM call."""
    if not nvidia_client:
        raise RuntimeError("NVIDIA NIM client is not configured.")

    tone_cfg = TONE_CONFIG.get(tone.lower(), TONE_CONFIG["technical"])
    system_prompt, user_prompt = _build_prompt(
        title, topics, num_slides, context, tone_cfg["instruction"], 
        include_notes=include_notes, include_images=include_images
    )

    completion = nvidia_client.chat.completions.create(
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        model=NVIDIA_MODEL,
        temperature=min(tone_cfg["temperature"], 0.35),
        max_tokens=8192,
    )
    data = _parse_and_validate(completion.choices[0].message.content.strip())
    return _validate_data(data)


async def generate_slide_content(
    title: str,
    topics: list,
    num_slides: int = 5,
    context: str = "",
    tone: str = "professional",
    provider: str | None = None,
    include_notes: bool = True,
    include_images: bool = True,
) -> tuple[list, str, str]:
    """Async entry point for slide generation with automatic provider routing."""
    use_nvidia = False
    if provider == "nvidia":
        use_nvidia = True
    elif provider == "groq":
        use_nvidia = False
    else:
        use_nvidia = nvidia_client is not None and is_technical_topic(title, topics)

    if use_nvidia:
        try:
            logger.info(f"Routing to NVIDIA NIM ({NVIDIA_MODEL})")
            # Phase 2: Wrap primary provider in a sub-timeout to allow fallback time
            slides = await asyncio.wait_for(
                asyncio.to_thread(_call_nvidia, title, topics, num_slides, context, tone, include_notes=include_notes, include_images=include_images),
                timeout=120.0
            )
        except (asyncio.TimeoutError, Exception) as e:
            logger.warning(f"NVIDIA NIM failed or timed out ({e}). Falling back to Groq.")
            logger.info(f"Using Groq ({GROQ_MODEL})")
            slides = await asyncio.wait_for(
                asyncio.to_thread(_call_groq, title, topics, num_slides, context, tone, include_notes=include_notes, include_images=include_images),
                timeout=70.0
            )
        return slides, NVIDIA_MODEL, "nvidia_nim"

    logger.info(f"Using Groq ({GROQ_MODEL})")
    slides = await asyncio.to_thread(_call_groq, title, topics, num_slides, context, tone, include_notes=include_notes, include_images=include_images)
    return slides, GROQ_MODEL, "groq"
