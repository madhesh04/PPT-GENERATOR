import os
import json
import logging
import asyncio
from dotenv import load_dotenv
from groq import Groq
from openai import OpenAI

from pathlib import Path
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

# ── Tone configuration ─────────────────────────────────────────────────────────
TONE_CONFIG = {
    "professional": {
        "instruction": (
            "Write in a professional, formal business tone for corporate stakeholders. "
            "Each bullet must state a concrete fact, metric, or outcome — not a vague claim. "
            "Where relevant, illustrate with a real industry example (e.g. 'Nike reduced warehouse costs by 18% using...') "
            "to make points tangible and memorable."
        ),
        "temperature": 0.35,
    },
    "executive": {
        "instruction": (
            "Write for C-suite executives. Be direct, strategic, and outcome-focused. "
            "Lead every bullet with the business impact, then briefly state how. "
            "Reference real companies or market data to back up strategic points where appropriate."
        ),
        "temperature": 0.2,
    },
    "technical": {
        "instruction": (
            "Write for a technical audience: engineers, developers, or data analysts. "
            "Use precise technical terminology and explain HOW things work — not just WHAT they are. "
            "Include implementation-level details, architecture decisions, coding patterns, or tool comparisons where relevant. "
            "Add real-world technical examples (e.g. 'Netflix uses circuit-breaker patterns to...') to ground each concept. "
            "IMPORTANT: At least 2–3 slides MUST include a short, practical coding example (3–8 lines) "
            "embedded directly inside one of the bullet points. Use the relevant programming language for the topic. "
            "Format code inline within the bullet text, showing real runnable snippets that illustrate the concept."
        ),
        "temperature": 0.3,
    },
    "academic": {
        "instruction": (
            "Write for a university or academic audience — students, professors, or researchers. "
            "EXPLAIN each concept clearly from first principles, as if the audience is encountering it for the first time. "
            "For every concept: (1) define it clearly, (2) explain how/why it works, (3) give a concrete real-world example or case study. "
            "Use evidence-based language. Reference well-known examples, experiments, or phenomena where they strengthen understanding. "
            "Avoid corporate jargon — favour educational, instructive language. "
            "IMPORTANT: When the topic involves programming, algorithms, or any technical subject, "
            "at least 2–3 slides MUST include a short coding example (3–8 lines) in the relevant language "
            "to demonstrate the concept practically. Students learn best by seeing real code alongside theory."
        ),
        "temperature": 0.4,
    },
    "sales": {
        "instruction": (
            "Write in a persuasive, energetic sales tone. "
            "Every bullet must speak directly to a customer pain point or desire, then show how the solution addresses it. "
            "Use social proof, real customer outcomes, or industry statistics to build credibility. "
            "End with clear calls to action or value statements."
        ),
        "temperature": 0.55,
    },
    "simple": {
        "instruction": (
            "Write in plain, friendly language that a complete beginner can understand. "
            "Avoid all jargon. Explain concepts using everyday analogies and relatable examples. "
            "For each point, briefly explain WHAT it is and WHY it matters using a simple, familiar scenario "
            "(e.g. 'Think of X like a...'). Short sentences. Warm tone."
        ),
        "temperature": 0.45,
    },
}

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
NVIDIA_MODEL = "moonshotai/kimi-k2-instruct"

# ── NVIDIA NIM client (OpenAI-compatible) ──────────────────────────────────────
_nvidia_api_key = os.getenv("NVIDIA_API_KEY")
nvidia_client = (
    OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=_nvidia_api_key,
    )
    if _nvidia_api_key and not _nvidia_api_key.startswith("your_")
    else None
)

# ── Technical topic detection ──────────────────────────────────────────────────
TECHNICAL_KEYWORDS = [
    # Programming languages
    "python", "javascript", "typescript", "java", "c++", "c#", "golang", "go lang",
    "rust", "kotlin", "swift", "php", "ruby", "scala", "r programming",
    # Web / Frontend
    "react", "angular", "vue", "nextjs", "next.js", "html", "css", "tailwind",
    "bootstrap", "webpack", "vite", "nodejs", "node.js", "express", "fastapi",
    "django", "flask",
    # Data / Backend
    "sql", "nosql", "mongodb", "postgresql", "mysql", "redis", "graphql",
    "rest api", "microservices", "docker", "kubernetes", "aws", "cloud computing",
    # CS Concepts
    "algorithm", "data structure", "sorting", "searching", "binary search",
    "linked list", "tree", "graph", "dynamic programming", "recursion",
    "time complexity", "big o", "oop", "object oriented", "functional programming",
    # AI / ML
    "machine learning", "deep learning", "neural network", "nlp", "llm",
    "tensorflow", "pytorch", "scikit", "pandas", "numpy",
    # General programming
    "programming", "coding", "software engineering", "debugging", "api",
    "backend", "frontend", "fullstack", "full stack", "devops", "git",
    "version control", "testing", "unit test", "ci/cd", "agile", "scrum",
]


def is_technical_topic(title: str, topics: list | None = None) -> bool:
    """
    Returns True if the PPT topic is programming/technical in nature.
    Checks both the presentation title and individual topic strings.
    """
    text = title.lower()
    if topics:
        text += " " + " ".join(t.lower() for t in topics)
    return any(kw in text for kw in TECHNICAL_KEYWORDS)


def _build_prompt(title: str, topics: list, num_slides: int, context: str, tone_instruction: str) -> tuple[str, str]:
    """Returns (system_prompt, user_prompt)."""
    context_block = (
        f"\nAdditional context about this presentation:\n{context.strip()}\n"
        "Use this context — especially the audience type and domain — to sharpen every slide's content.\n"
        if context.strip() else ""
    )

    system_prompt = f"""You are a world-class presentation writer and subject-matter expert hired to create professional client-ready slide decks.
These presentations are used by a company to deliver polished decks to their clients — the quality must be genuinely impressive and immediately useful.
You must generate the ACTUAL FINAL CONTENT of the presentation. DO NOT generate placeholders or templates.

TONE & AUDIENCE STYLE: {tone_instruction}

═══════════════════════════════════════════
CONTENT QUALITY STANDARD — NON-NEGOTIABLE
═══════════════════════════════════════════

Every bullet point you write must do ALL of the following:
  ✔ Contain ACTUAL FACTUAL KNOWLEDGE, specific details, and educational value
  ✔ Be a complete, standalone sentence of 20–40 words
  ✔ Deliver genuine insight — no filler, no structural meta-text
  ✔ Where the concept warrants it: include a real-world example, analogy, case study, or data point

NEVER WRITE PLACEHOLDERS. NEVER WRITE META-TEXT ABOUT THE SLIDE.
BAD bullet (placeholder/meta-text): "Key insight about supervised learning in the context of Azure AI."
GOOD bullet (actual content): "Supervised learning algorithms are trained on labeled datasets, meaning both the input and the desired output are provided, allowing the model to learn mapping functions like predicting house prices from square footage."

BAD bullet (placeholder): "Strategic implications of regression for stakeholders."
GOOD bullet: "Regression models predict continuous numerical values, enabling businesses to forecast future trends such as estimating quarterly sales revenue based on historical ad spend."

═══════════════════════════
DOMAIN DETECTION
═══════════════════════════
Infer the domain of this presentation from the title, topics, and context. Then apply domain-appropriate depth:

• EDUCATIONAL / UNIVERSITY topics → Explain FROM FIRST PRINCIPLES. Define the concept, explain the mechanism, then give a real-world or textbook example. Structure each slide to genuinely teach the audience.
• BUSINESS / CORPORATE topics → Lead with outcomes and impact. Back up claims with metrics, market data, or named company examples.
• TECHNICAL / ENGINEERING topics → Explain HOW it works internally. Include architecture decisions, code patterns, tool comparisons, or system design examples.
• GENERAL / MIXED topics → Use clear explanations, relatable analogies, and one real-world example per major concept.

═══════════════════════════
SLIDE STRUCTURE RULES
═══════════════════════════
NARRATIVE ARC:
  - First slide: introduce the topic and establish why it matters
  - Middle slides: go deep on each sub-topic — explain, illustrate, exemplify
  - Last slide: summarise key takeaways and suggest next steps or applications

SLIDE TITLES: Must be specific and descriptive. Not "Introduction" — instead use "Why [Topic] Is Reshaping [Domain]" or "How [Concept] Works: Core Mechanism Explained".

BULLET COUNT: Exactly 5 per slide. Every content slide MUST have exactly 5 bullet points. Quality and substance in every bullet.

TOPIC DISTRIBUTION: Intelligently group and expand topics. If given 3 topics for 8 slides, go deeper into each with sub-concepts — don't pad with repetition.

═══════════════════════════
CODE BLOCKS
═══════════════════════════
For technical or programming topics, some slides SHOULD include a code example.
- Put code in the "code" field as a clean, runnable snippet (3–12 lines max).
- Set "language" to the programming language name (e.g. "python", "csharp", "javascript").
- Code must be properly formatted with line breaks (use \n), indentation, and comments.
- Do NOT embed code inline within bullet text — always use the separate "code" field.
- For non-code slides, set both "code" and "language" to null.
- Aim for 2–4 slides with code in a technical deck; 0 for non-technical topics.

═══════════════════════════
SPEAKER NOTES
═══════════════════════════
Add a "notes" field per slide: 2–4 sentences the presenter speaks aloud.
Notes should: expand on what's on the slide, add one more example or data point not in the bullets, and guide the presenter's delivery (e.g. "Pause here and ask the audience...").

═══════════════════════════
IMAGE SELECTION (SELECTIVE)
═══════════════════════════
NOT every slide needs an image. Only assign an image_query to slides where a visual genuinely enhances understanding.
Typically 2–3 slides per deck should have images — usually introductory, conceptual, or architecture slides.
Slides that are code-heavy, bullet-dense, or summary slides should set image_query to null.

When you DO provide an image_query, make it 3–6 specific visual words:
  GOOD: "data scientist analyzing dashboard", "cloud server room blue", "team meeting whiteboard"
  BAD: "concept", "idea", "abstract" (too vague)

OUTPUT FORMAT: Return ONLY a valid raw JSON array. No markdown, no code fences, no explanation — just the JSON array starting with [ and ending with ].

Each object MUST have exactly these fields:
- "title": specific descriptive slide title
- "content": list of exactly 5 bullets (20-45 words each)
- "code": a code snippet string with \n line breaks, or null if no code for this slide
- "language": programming language name, or null if no code
- "notes": 2-4 sentences for the presenter
- "image_query": a 3-6 word image search phrase OR null if this slide should not have an image"""

    user_prompt = f"""Create the COMPLETE, FACTUAL FINAL CONTENT for a slide deck titled "{title}".
{context_block}
Topics to cover: {', '.join(topics)}.

Generate EXACTLY {num_slides} slides (content slides only).

CRITICAL INSTRUCTIONS FOR CONTENT:
- DO NOT generate an "outline". Generate the ACTUAL detailed content as if the presentation is being delivered right now.
- DO NOT write things like "Discuss the importance of..." or "Key insight about...". Write the actual importance and the actual insights.
- Infer the domain from the title and topics. If it is educational or academic, EXPLAIN concepts from scratch with examples.
- Every bullet must be a rich, factual, complete sentence of 20–45 words.
- At least 2 out of every 5 bullets across the whole deck must include a specific real-world example, analogy, statistic, or case study.
- Do NOT write vague statements. Every bullet must convey a concrete, learnable insight.
- Every slide MUST have exactly 5 bullet points. No exceptions.
- For technical topics: put code in the "code" field (not inline in bullets). Use proper formatting with \n line breaks.
- Only give image_query to 2–3 slides that genuinely benefit from a visual. Set it to null for the rest.

Return a JSON array of exactly {num_slides} objects. Each object MUST have:
- "title": A specific, descriptive slide title
- "content": A list of exactly 5 bullets (each 20–45 words, packed with actual facts and examples)
- "code": A code snippet string (3–12 lines, with \n for line breaks) or null
- "language": Language name ("python", "csharp", etc.) or null
- "notes": 2–4 sentences for the presenter
- "image_query": 3–6 word image search phrase or null (only for 2–3 slides per deck)

JSON only. Start immediately with ["""

    return system_prompt, user_prompt


def _parse_and_validate(raw: str) -> list:
    """Parse raw JSON string and validate slide structure."""
    # Strip any accidental markdown fences
    raw = raw.replace("```json", "").replace("```", "").strip()
    # Fix trailing commas before ] or } (common LLM quirk)
    import re
    raw = re.sub(r',\s*([}\]])', r'\1', raw)
    data = json.loads(raw)

    validated = []
    for item in data:
        if isinstance(item, dict) and "title" in item and "content" in item:
            # image_query: keep null/None if LLM set it to null (selective images)
            img_q = item.get("image_query")
            if img_q and str(img_q).lower() not in ("null", "none", ""):
                img_q = str(img_q)
            else:
                img_q = None

            # code: preserve as-is if present
            code_val = item.get("code")
            if code_val and str(code_val).lower() not in ("null", "none", ""):
                code_val = str(code_val)
            else:
                code_val = None

            lang_val = item.get("language")
            if lang_val and str(lang_val).lower() not in ("null", "none", ""):
                lang_val = str(lang_val)
            else:
                lang_val = None

            validated.append({
                "title":       str(item["title"]),
                "content":     [str(c) for c in item["content"] if c],
                "code":        code_val,
                "language":    lang_val,
                "notes":       str(item.get("notes", "")),
                "image_query": img_q,
            })
    return validated


def _call_groq(title: str, topics: list, num_slides: int = 5, context: str = "", tone: str = "professional") -> list:
    """Synchronous Groq call with retry on JSON failure."""
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    num_slides = max(2, min(15, num_slides))

    tone_key = tone.lower() if tone.lower() in TONE_CONFIG else "professional"
    cfg = TONE_CONFIG[tone_key]
    temperature = cfg["temperature"]
    tone_instruction = cfg["instruction"]

    if not GROQ_API_KEY or GROQ_API_KEY.strip() == "your_groq_api_key_here":
        logger.error("GROQ_API_KEY is missing or set to the boilerplate string.")
        raise ValueError("GROQ_API_KEY is missing! Please paste your actual Groq API key into the backend/.env file and restart the server.")

    client = Groq(api_key=GROQ_API_KEY)
    system_prompt, user_prompt = _build_prompt(title, topics, num_slides, context, tone_instruction)

    def _call_api(extra_system: str = "") -> str:
        sys_content = system_prompt + extra_system
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": sys_content},
                {"role": "user",   "content": user_prompt},
            ],
            model=GROQ_MODEL,
            temperature=temperature,
            max_tokens=6000,
        )
        return completion.choices[0].message.content.strip()

    # First attempt
    try:
        raw = _call_api()
        logger.debug("[LLM] Raw response (first 500 chars): %s", raw[:500])
        return _parse_and_validate(raw)
    except json.JSONDecodeError as e:
        logger.warning("[LLM] JSON parse failed on first attempt: %s. Retrying with stricter prompt.", e)

    # Retry with stricter instruction
    try:
        raw = _call_api(extra_system="\n\nCRITICAL: Your ENTIRE response must be a single valid JSON array. Absolutely no prose, no markdown, no code fences. Start with [ and end with ].")
        logger.debug("[LLM] Raw response (retry, first 500 chars): %s", raw[:500])
        return _parse_and_validate(raw)
    except json.JSONDecodeError as e:
        logger.error("[LLM] JSON parse failed on retry: %s. Using fallback content.", e)
        return [
            {
                "title": topic,
                "content": [
                    f"Introduction to {topic} and its significance in the context of {title}.",
                    f"Key strategies and best practices associated with {topic}.",
                    f"Real-world applications and measurable outcomes of {topic}.",
                    f"Actionable next steps to leverage {topic} effectively.",
                ],
                "notes": f"This slide covers {topic}. Walk the audience through each point and allow time for discussion.",
            }
            for topic in topics[:num_slides]
        ]
    except Exception as e:
        logger.error("[LLM] Groq API call failed: %s", e)
        raise


# ── NVIDIA NIM Generator ───────────────────────────────────────────────────────

def _call_nvidia(title: str, topics: list, num_slides: int = 5, context: str = "", tone: str = "professional") -> list:
    """
    Synchronous NVIDIA NIM call using Kimi K2.5.
    Uses the SAME prompt system as Groq for consistency.
    Lower temperature for technical precision.
    """
    if not nvidia_client:
        raise RuntimeError("NVIDIA NIM client is not configured (missing NVIDIA_API_KEY).")

    num_slides = max(2, min(15, num_slides))

    # Use technical tone by default for NIM, but respect explicit user choice
    tone_key = tone.lower() if tone.lower() in TONE_CONFIG else "technical"
    cfg = TONE_CONFIG[tone_key]
    # Clamp temperature slightly lower for NIM (more deterministic for code)
    temperature = min(cfg["temperature"], 0.35)
    tone_instruction = cfg["instruction"]

    system_prompt, user_prompt = _build_prompt(title, topics, num_slides, context, tone_instruction)

    def _call_api(extra_system: str = "") -> str:
        sys_content = system_prompt + extra_system
        completion = nvidia_client.chat.completions.create(
            messages=[
                {"role": "system", "content": sys_content},
                {"role": "user",   "content": user_prompt},
            ],
            model=NVIDIA_MODEL,
            temperature=temperature,
            max_tokens=6000,
        )
        return completion.choices[0].message.content.strip()

    # First attempt
    try:
        raw = _call_api()
        logger.debug("[NIM] Raw response (first 500 chars): %s", raw[:500])
        return _parse_and_validate(raw)
    except json.JSONDecodeError as e:
        logger.warning("[NIM] JSON parse failed on first attempt: %s. Retrying.", e)

    # Retry with stricter instruction
    raw = _call_api(extra_system="\n\nCRITICAL: Your ENTIRE response must be a single valid JSON array. Absolutely no prose, no markdown, no code fences. Start with [ and end with ].")
    logger.debug("[NIM] Raw response (retry, first 500 chars): %s", raw[:500])
    return _parse_and_validate(raw)


# ── Unified async entry point with auto-routing ────────────────────────────────

async def generate_slide_content(
    title: str,
    topics: list,
    num_slides: int = 5,
    context: str = "",
    tone: str = "professional",
    force_provider: str | None = None,
) -> tuple[list, str, str]:
    """
    Async entry point for slide generation with automatic provider routing.

    Returns:
        (slides, model_used, provider)  where provider is 'nvidia_nim' or 'groq'
    """
    use_nvidia = False

    if force_provider == "nvidia":
        use_nvidia = True
    elif force_provider == "groq":
        use_nvidia = False
    else:
        # Auto-detect based on topic keywords
        use_nvidia = nvidia_client is not None and is_technical_topic(title, topics)

    if use_nvidia:
        try:
            logger.info("[ROUTER] Technical topic detected — routing to NVIDIA NIM (%s)", NVIDIA_MODEL)
            slides = await asyncio.to_thread(_call_nvidia, title, topics, num_slides, context, tone)
            return slides, NVIDIA_MODEL, "nvidia_nim"
        except Exception as e:
            logger.warning("[ROUTER] NVIDIA NIM failed (%s), falling back to Groq.", e)

    # Default / fallback to Groq
    logger.info("[ROUTER] Using Groq (%s) for generation.", GROQ_MODEL)
    slides = await asyncio.to_thread(_call_groq, title, topics, num_slides, context, tone)
    return slides, GROQ_MODEL, "groq"
