import os
import json
import logging
import asyncio
from dotenv import load_dotenv
from groq import Groq

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
            "Add real-world technical examples (e.g. 'Netflix uses circuit-breaker patterns to...') to ground each concept."
        ),
        "temperature": 0.3,
    },
    "academic": {
        "instruction": (
            "Write for a university or academic audience — students, professors, or researchers. "
            "EXPLAIN each concept clearly from first principles, as if the audience is encountering it for the first time. "
            "For every concept: (1) define it clearly, (2) explain how/why it works, (3) give a concrete real-world example or case study. "
            "Use evidence-based language. Reference well-known examples, experiments, or phenomena where they strengthen understanding. "
            "Avoid corporate jargon — favour educational, instructive language."
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

BULLET COUNT: Exactly 5 per slide. You MUST generate exactly 5 bullets for every single slide. Quality over quantity, but meet the count.

TOPIC DISTRIBUTION: Intelligently group and expand topics. If given 3 topics for 8 slides, go deeper into each with sub-concepts — don't pad with repetition.

═══════════════════════════
SPEAKER NOTES
═══════════════════════════
Add a "notes" field per slide: 2–4 sentences the presenter speaks aloud.
Notes should: expand on what's on the slide, add one more example or data point not in the bullets, and guide the presenter's delivery (e.g. "Pause here and ask the audience...").

OUTPUT FORMAT: Return ONLY a valid raw JSON array. No markdown, no code fences, no explanation — just the JSON array starting with [ and ending with ]."""

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

Return a JSON array of exactly {num_slides} objects. Each object MUST have:
- "title": A specific, descriptive slide title
- "content": A list of exactly 5 bullets (each 20–45 words, packed with actual facts and examples)
- "notes": 2–4 sentences for the presenter — add one more example or fact not covered in the bullets, and include a delivery cue

JSON only. Start immediately with ["""

    return system_prompt, user_prompt


def _parse_and_validate(raw: str) -> list:
    """Parse raw JSON string and validate slide structure."""
    # Strip any accidental markdown fences
    raw = raw.replace("```json", "").replace("```", "").strip()
    data = json.loads(raw)

    validated = []
    for item in data:
        if isinstance(item, dict) and "title" in item and "content" in item:
            validated.append({
                "title":   str(item["title"]),
                "content": [str(c) for c in item["content"] if c],
                "notes":   str(item.get("notes", "")),
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


async def generate_slide_content(
    title: str,
    topics: list,
    num_slides: int = 5,
    context: str = "",
    tone: str = "professional",
) -> list:
    """Async wrapper — runs the synchronous Groq call in a thread pool."""
    return await asyncio.to_thread(_call_groq, title, topics, num_slides, context, tone)
