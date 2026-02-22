import os
import json
import asyncio
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

TONE_INSTRUCTIONS = {
    "professional": "Write in a professional, formal business tone. Use precise, concise language suitable for corporate stakeholders.",
    "executive":    "Write as if for a C-suite executive audience. Use strategic, high-level language. Focus on business impact, ROI, and outcomes. Be direct and authoritative.",
    "technical":    "Write for a technical audience (engineers, developers, analysts). Use specific technical terminology, include implementation details, and reference best practices.",
    "academic":     "Write in an academic tone. Use formal language, reference evidence-based insights, and structure content logically with clear arguments.",
    "sales":        "Write in a persuasive, energetic sales tone. Emphasize benefits, value propositions, customer outcomes, and calls to action.",
    "simple":       "Write in simple, clear language that anyone can understand. Avoid jargon. Use short sentences and relatable examples.",
}

def _call_groq(title: str, topics: list, num_slides: int = 5, context: str = "", tone: str = "professional") -> list:
    """Synchronous Groq call — runs in a thread to avoid blocking the event loop."""
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

    num_slides = max(2, min(15, num_slides))  # clamp to safe range
    tone_key = tone.lower() if tone.lower() in TONE_INSTRUCTIONS else "professional"
    tone_instruction = TONE_INSTRUCTIONS[tone_key]

    if not GROQ_API_KEY:
        return [
            {"title": topic, "content": [f"Key point 1 about {topic}", f"Key point 2 about {topic}"]}
            for topic in topics
        ]

    client = Groq(api_key=GROQ_API_KEY)

    context_block = f"\nAdditional context about this presentation:\n{context.strip()}\nUse this context to make the content more specific, relevant, and accurate.\n" if context.strip() else ""

    system_prompt = f"""You are an expert presentation writer, business consultant, and communication strategist.
Your job is to write compelling, insightful, and well-structured slide content.

TONE & AUDIENCE: {tone_instruction}

CONTENT RULES — follow these strictly:
1. Every bullet point must be a COMPLETE, meaningful sentence of 15-30 words.
2. Never write vague filler like "Key point", "Important aspect", or "This is significant".
3. Use active voice, concrete details, and specific language.
4. Each bullet must deliver a standalone insight — no repetition across bullets.
5. Slide titles must be descriptive and specific (not generic like "Introduction" or "Overview").

OUTPUT FORMAT: Return ONLY a valid raw JSON array. No markdown, no code fences, no explanation — just the JSON."""

    prompt = f"""Create a presentation outline for a slide deck titled "{title}".
{context_block}
Topics to cover: {', '.join(topics)}.

Generate EXACTLY {num_slides} slides (content slides only, not the title slide).
Distribute topics logically across all {num_slides} slides. If fewer topics than slides, expand each topic with deeper sub-topics and detail.

Return a JSON array of exactly {num_slides} objects. Each object must have:
- "title": A specific, descriptive slide title (string, not generic)
- "content": A list of exactly 4 bullet points, each a complete, informative sentence of 15-30 words

JSON only. No extra text."""

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": prompt},
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.3,   # Lower = more focused, consistent, professional
            max_tokens=4096,
        )

        raw = chat_completion.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()

        print(f"[LLM RAW RESPONSE]: {raw[:400]}")  # Debug log

        data = json.loads(raw)

        # Validate & sanitise structure
        validated = []
        for item in data:
            if isinstance(item, dict) and "title" in item and "content" in item:
                validated.append({
                    "title":   str(item["title"]),
                    "content": [str(c) for c in item["content"] if c],
                })
        return validated

    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON parse failed: {e}. Raw: {raw}")
        return [
            {
                "title": topic,
                "content": [
                    f"Introduction to {topic} and its significance in the context of {title}.",
                    f"Key strategies and best practices associated with {topic}.",
                    f"Real-world applications and measurable outcomes of {topic}.",
                    f"Actionable next steps to leverage {topic} effectively.",
                ]
            }
            for topic in topics
        ]
    except Exception as e:
        print(f"[ERROR] Groq API call failed: {e}")
        raise


async def generate_slide_content(title: str, topics: list, num_slides: int = 5, context: str = "", tone: str = "professional") -> list:
    """Async wrapper — runs the synchronous Groq call in a thread pool."""
    return await asyncio.to_thread(_call_groq, title, topics, num_slides, context, tone)
