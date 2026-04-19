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
_auto_route_counter = 0 # Simple round-robin counter for load balancing

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
    },
    "executive": {
        "temperature": 0.2,
        "instruction": "Deliver an executive-level summary. Focus on high-level impact, strategic alignment, and business outcomes. Be extremely concise and impactful."
    },
    "sales": {
        "temperature": 0.5,
        "instruction": "Use a persuasive, compelling, and value-driven sales tone. Highlight benefits, competitive advantages, and direct solutions to client pain points."
    },
    "simple": {
        "temperature": 0.3,
        "instruction": "Keep the language extremely simple, avoiding jargon. Use a minimalist approach focused on ease of understanding and absolute clarity."
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
Add a "notes" field per slide: 2-4 sentences the presenter speaks aloud.
Notes should: expand on slide content, add extra data not in bullets, and guide delivery.
""" if include_notes else "\nSPEAKER NOTES: Set the 'notes' field to an empty string for all slides.\n"

    context_block = (
        f"\nAdditional context about this presentation:\n{context.strip()}\n"
        "Use this context - especially the audience type and domain - to sharpen every slide's content.\n"
        if context.strip() else ""
    )

    # Dynamic word counts to prevent total payload from exceeding model output limits (especially for 15 slides)
    if num_slides <= 7:
        word_range = "25-45 words"
        bullet_instruction = "Contain DEEP academic/technical rigor, specific data, and extensive detail."
    elif num_slides <= 12:
        word_range = "20-35 words"
        bullet_instruction = "Contain specific factual details and standalone insights."
    else:
        word_range = "15-30 words"
        bullet_instruction = "Contain concise, standalone factual insights."

    system_prompt = f"""You are a world-class presentation writer and subject-matter expert hired to create professional client-ready slide decks.
These presentations are used by a company to deliver polished decks to their clients - the quality must be genuinely impressive and immediately useful.
You must generate the ACTUAL FINAL CONTENT of the presentation. DO NOT generate placeholders or templates.

TONE & AUDIENCE STYLE: {tone_instruction}

{notes_instruction}

CONTENT QUALITY STANDARD
Every bullet point you write must do ALL of the following:
  * {bullet_instruction}
  * Be a complete, standalone sentence of {word_range}
  * Deliver genuine insight - no filler, no structural meta-text
  * Include a real-world example, analogy, or data point where applicable

NEVER WRITE PLACEHOLDERS. NEVER WRITE META-TEXT ABOUT THE SLIDE.

DOMAIN DETECTION
Infer the domain of this presentation from the title, topics, and context. Then apply domain-appropriate depth.

SLIDE STRUCTURE RULES
BULLET COUNT: Exactly 5 per slide. Every content slide MUST have exactly 5 bullet points.

CODE BLOCKS
For technical, programming, or academic topics, some slides SHOULD include a code example.
- Put code in the "code" field as a clean snippet.
- CRITICAL: Use literal newline characters (\\n) to ensure every line of code prints on a NEW LINE. 
- REQUIRED: For 'academic' or 'technical' tones, provided code snippets MUST be at least 10 lines. Explain the code block thoroughly.
- For non-code slides, set both "code" and "language" to null.

IMAGE SELECTION
{ "NOT every slide needs an image. Only assign an image_query to slides where a visual genuinely enhances understanding. Typically 2–3 slides per deck should have images." if include_images else "CRITICAL: Image generation is DISABLED for this session. You MUST set the 'image_query' field to null for ALL slides without exception." }

OUTPUT FORMAT: Return ONLY a valid raw JSON array. Start immediately with '[' and end immediately with ']'. No markdown, no code fences.

Each object MUST have exactly these fields:
- "title": specific descriptive slide title
- "content": list of exactly 5 bullets ({word_range} each)
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
    
    # Pre-cleaning: Remove common LLM artifacts that break JSON
    raw = raw.replace('```json', '').replace('```', '')
    raw = re.sub(r'^[^{}\[\]]*', '', raw) # Strip leading text
    
    # 2. Pre-processing: Escape literal newlines within JSON strings
    def _escape_interior_newlines(match):
        return match.group(0).replace('\n', '\\n').replace('\r', '')
    
    raw = re.sub(r'"((?:[^"\\]|\\.)*)"', _escape_interior_newlines, raw, flags=re.DOTALL)
    
    raw = raw.strip()
    if not raw:
        return []

    # 2. Main Parsing Attempt
    repaired = raw  # Initialize to raw to avoid uninitialized variable
    try:
        return json.loads(raw)
    except Exception:
        # 3. Emergency Syntax Cleaning (Trailing commas)
        try:
            # Remove trailing comma before closing array/object: [...,] -> [...] or {...,} -> {...}
            repaired = re.sub(r',\s*([\]}])', r'\1', raw)
            return json.loads(repaired)
        except Exception:
            # 4. Truncation Recovery: Iteratively close brackets
            # This handles cases where the LLM stops mid-generation
            test_raw = repaired
            for i in range(JSON_REPAIR_LIMIT):
                try:
                    # Try adding closing brackets in common patterns
                    for suffix in ["]", "}]", "}}]"]:
                        try:
                            return json.loads(test_raw + (suffix * (i+1)) if i > 0 else test_raw + suffix)
                        except: continue
                except:
                    pass
            
            # Final Emergency Debugging: Dump to file for inspection
            try:
                with open("failed_response.txt", "w", encoding="utf-8") as f:
                    f.write("=== RAW ===\n")
                    f.write(raw)
                    f.write("\n\n=== REPAIRED ===\n")
                    f.write(repaired)
            except:
                pass

            logger.error(f"Failed to parse LLM JSON after all recovery attempts.")
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
        title, topics, num_slides, context, str(tone_cfg["instruction"]), 
        include_notes=include_notes, include_images=include_images
    )

    completion = client.chat.completions.create(
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        model=GROQ_MODEL,
        temperature=float(tone_cfg["temperature"] if num_slides <= 10 else min(0.2, tone_cfg["temperature"])),
        max_tokens=8192,
        top_p=0.9,
    )
    content = completion.choices[0].message.content
    data = _parse_and_validate(content.strip() if content else "")
    return _validate_data(data)


def _call_nvidia(title: str, topics: list, num_slides: int = 5, context: str = "", tone: str = "professional", include_notes: bool = True, include_images: bool = True) -> list:
    """Synchronous NVIDIA NIM call."""
    if not nvidia_client:
        raise RuntimeError("NVIDIA NIM client is not configured.")

    tone_cfg = TONE_CONFIG.get(tone.lower(), TONE_CONFIG["technical"])
    system_prompt, user_prompt = _build_prompt(
        title, topics, num_slides, context, str(tone_cfg["instruction"]), 
        include_notes=include_notes, include_images=include_images
    )

    completion = nvidia_client.chat.completions.create(
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        model=NVIDIA_MODEL,
        temperature=float(min(tone_cfg["temperature"], 0.35) if num_slides <= 10 else 0.15),
        max_tokens=8192,
        top_p=0.9,
    )
    content = completion.choices[0].message.content
    data = _parse_and_validate(content.strip() if content else "")
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
    """Async entry point for slide generation with automatic provider routing & Load Balancing."""
    global _auto_route_counter
    
    # Determine the rotation order for this specific request
    if provider == "nvidia":
        order = [("nvidia", _call_nvidia, NVIDIA_MODEL), ("groq", _call_groq, GROQ_MODEL)]
    elif provider == "groq":
        order = [("groq", _call_groq, GROQ_MODEL), ("nvidia", _call_nvidia, NVIDIA_MODEL)]
    else:
        # Load balanced routing
        if _auto_route_counter % 2 == 0:
            order = [("nvidia", _call_nvidia, NVIDIA_MODEL), ("groq", _call_groq, GROQ_MODEL)]
        else:
            order = [("groq", _call_groq, GROQ_MODEL), ("nvidia", _call_nvidia, NVIDIA_MODEL)]
        _auto_route_counter += 1

    last_error = None
    for prov_id, func, model_name in order:
        if prov_id == "nvidia" and not nvidia_client:
            continue
            
        try:
            logger.info(f"Attempting generation with {prov_id.upper()} ({model_name}) [Counter: {_auto_route_counter}]")
            # Set shorter timeout for first attempt to allow fallback if slow
            timeout = 160.0 if prov_id == "nvidia" else 100.0
            
            slides = await asyncio.wait_for(
                asyncio.to_thread(func, title, topics, num_slides, context, tone, include_notes=include_notes, include_images=include_images),
                timeout=timeout
            )
            return slides, model_name, prov_id
        except Exception as e:
            last_error = e
            logger.warning(f"{prov_id.upper()} failed or timed out ({e}). Trying next provider...")
            continue

    if last_error:
        raise last_error
    raise RuntimeError("No LLM providers available for generation.")


def _build_notes_prompt(subject: str, unit: str, topics: list, context: str, pages: int, depth: str, format: str) -> tuple[str, str]:
    depth_instructions = {
        "summary": "Provide a high-level overview. Keep explanations concise and focus on key takeaways.",
        "standard": "Provide a balanced, comprehensive review of the topics with definitions and examples.",
        "deep": "Provide extreme detail. Include theoretical background, edge cases, formulas, code snippets (if technical), and historical context where applicable."
    }
    format_instructions = {
        "prose": "Write in flowing paragraphs with clear headings and subheadings.",
        "bullets": "Use heavily structured bullet points, nested lists, and bold terms for easy skimming.",
        "qa": "Structure the entire document as a series of Socratic Questions and detailed Answers."
    }

    system_prompt = f"""You are a master academic writer and subject-matter expert.
Your task is to write comprehensive, accurate, and highly structured Lecture Notes.
Do NOT output JSON. Output beautifully formatted Markdown.

DEPTH & RIGOR: {depth_instructions.get(depth.lower(), depth_instructions["standard"])}
FORMATTING STYLE: {format_instructions.get(format.lower(), format_instructions["prose"])}

The content must be roughly equivalent to what would be found in a {pages}-page academic handout.
Use Markdown headers (#, ##, ###), bold text, tables (if useful), and code blocks (if the subject is technical).
Start immediately with the title as an H1."""

    user_prompt = f"""Write Lecture Notes for:
Subject: {subject}
Unit: {unit}
Topics to cover: {', '.join(topics)}
Additional Context / Specific instructions: {context}

Generate the notes now in Markdown."""
    
    return system_prompt, user_prompt


def _call_groq_notes(subject: str, unit: str, topics: list, context: str, pages: int, depth: str, format: str) -> str:
    client = Groq(api_key=settings.groq_api_key)
    system_prompt, user_prompt = _build_notes_prompt(subject, unit, topics, context, pages, depth, format)

    completion = client.chat.completions.create(
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        model=GROQ_MODEL,
        temperature=0.3,
        max_tokens=8192,
    )
    content = completion.choices[0].message.content
    return content.strip() if content else ""


async def generate_lecture_notes(subject: str, unit: str, topics: list, context: str, pages: int, depth: str, format: str, provider: str | None = None) -> tuple[str, str, str]:
    """Generates markdown lecture notes."""
    # For simplicity, currently only routing to Groq for notes
    logger.info(f"Generating Lecture Notes with Groq ({GROQ_MODEL})")
    content = await asyncio.to_thread(_call_groq_notes, subject, unit, topics, context, pages, depth, format)
    return content, GROQ_MODEL, "groq"

