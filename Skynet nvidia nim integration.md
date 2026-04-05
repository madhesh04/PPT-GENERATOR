# SKYNET — NVIDIA NIM Integration Guide
**Prepared for:** Antigravity  
**Prepared by:** Madhesh (via Claude)  
**Date:** April 2026  
**Status:** Ready for Implementation

---

## Overview

This guide covers integrating **NVIDIA NIM (Kimi K2.5)** into the existing SKYNET FastAPI backend as a **second LLM provider**, specifically for generating technical/programming slide content. The existing **Groq + LLaMA 3.3-70b** setup remains untouched and continues to handle general topic PPTs.

### Why Two Models?

| Situation | Model Used | Provider |
|---|---|---|
| General topics (Business, Marketing, HR, etc.) | `llama-3.3-70b-versatile` | Groq |
| Technical topics (Programming, DSA, Frameworks, etc.) | `moonshotai/kimi-k2-instruct` | NVIDIA NIM |
| Fallback (NIM credits exhausted) | `llama-3.3-70b-versatile` | Groq |

Kimi K2.5 was chosen because it has been independently verified (via direct API testing) to:
- Generate clean, well-commented code blocks across Python, JavaScript, React, and more
- Return valid structured JSON on the first attempt with no post-processing failures
- Handle technical context (algorithms, frameworks, architecture) with high accuracy

---

## Step 1 — Environment Variable

Add the following to your `.env` file locally and to **Render.com environment variables**:

```env
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
```

> **Note:** The key prefix is `nvapi-` not `sk-`. Do not confuse with the Groq key.

---

## Step 2 — Install Dependency

The NVIDIA NIM API is **OpenAI-compatible**, so no new SDK is needed. The existing `openai` Python package handles it.

Confirm it is already in `requirements.txt`:

```
openai>=1.0.0
```

If not present, add it and run:

```bash
pip install openai
```

---

## Step 3 — Update `config.py` (or wherever env vars are loaded)

Add the NVIDIA key alongside the existing Groq key:

```python
import os

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")  # ADD THIS
```

---

## Step 4 — Update `llm_client.py` (or equivalent LLM utility file)

Add the NVIDIA NIM client **alongside** the existing Groq client. Do not remove or modify the Groq client.

```python
from groq import Groq
from openai import OpenAI
import os

# ── Existing Groq client (DO NOT MODIFY) ──────────────────────────
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ── New NVIDIA NIM client (ADD THIS) ──────────────────────────────
nvidia_client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY")
)
```

---

## Step 5 — Topic Detection Function

Add this function to detect whether a user's PPT topic is technical/programming-related. This drives the automatic model routing.

```python
TECHNICAL_KEYWORDS = [
    # Programming languages
    "python", "javascript", "typescript", "java", "c++", "c#", "golang", "go",
    "rust", "kotlin", "swift", "php", "ruby", "scala", "r programming",
    # Web / Frontend
    "react", "angular", "vue", "nextjs", "html", "css", "tailwind", "bootstrap",
    "webpack", "vite", "nodejs", "express", "fastapi", "django", "flask",
    # Data / Backend
    "sql", "nosql", "mongodb", "postgresql", "mysql", "redis", "graphql",
    "rest api", "microservices", "docker", "kubernetes", "aws", "cloud",
    # CS Concepts
    "algorithm", "data structure", "sorting", "searching", "binary search",
    "linked list", "tree", "graph", "dynamic programming", "recursion",
    "time complexity", "big o", "oop", "object oriented", "functional programming",
    # AI / ML
    "machine learning", "deep learning", "neural network", "nlp", "llm",
    "tensorflow", "pytorch", "scikit", "pandas", "numpy",
    # General programming
    "programming", "coding", "software", "debugging", "api", "backend",
    "frontend", "fullstack", "devops", "git", "version control", "testing",
    "unit test", "ci/cd", "agile", "scrum"
]

def is_technical_topic(topic: str) -> bool:
    """
    Returns True if the PPT topic is programming/technical in nature.
    Used to route the request to NVIDIA NIM (Kimi K2.5) instead of Groq.
    """
    topic_lower = topic.lower()
    return any(keyword in topic_lower for keyword in TECHNICAL_KEYWORDS)
```

---

## Step 6 — Core Generation Function

Replace or extend your existing slide generation function with this routing-aware version:

```python
import json
import logging

logger = logging.getLogger(__name__)

def generate_slides(topic: str, num_slides: int = 8) -> dict:
    """
    Generates PPT slide content.
    Routes to NVIDIA NIM for technical topics, Groq for general topics.
    Falls back to Groq if NVIDIA NIM fails.
    
    Returns:
        dict with keys: slides (list), model_used (str), provider (str)
    """
    use_nvidia = is_technical_topic(topic)
    
    if use_nvidia:
        try:
            result = _generate_with_nvidia(topic, num_slides)
            result["provider"] = "nvidia_nim"
            return result
        except Exception as e:
            logger.warning(f"NVIDIA NIM failed, falling back to Groq. Error: {e}")
            # Fall through to Groq fallback below

    result = _generate_with_groq(topic, num_slides)
    result["provider"] = "groq"
    return result


# ── NVIDIA NIM Generator ───────────────────────────────────────────

def _generate_with_nvidia(topic: str, num_slides: int) -> dict:
    """Calls NVIDIA NIM (Kimi K2.5) for technical/code-heavy slide generation."""

    system_prompt = """You are SKYNET, an elite technical PPT slide generator.
You specialize in creating precise, developer-friendly presentation slides.
Always respond ONLY with valid JSON. No markdown, no explanation, no code fences.

Rules:
- Code blocks must be complete, runnable, and well-commented
- Use proper syntax for the language mentioned in the topic
- Explanation must be clear and concise (2-4 sentences max per slide)
- For non-code slides (intro, summary), set "code" and "language" to null"""

    user_prompt = f"""Create exactly {num_slides} presentation slides about: "{topic}"

Respond ONLY with this JSON structure:
{{
  "title": "presentation title",
  "slides": [
    {{
      "slide_number": 1,
      "title": "slide title",
      "content": "explanation text (2-4 sentences)",
      "code": "full code block or null",
      "language": "python/javascript/java/etc or null",
      "key_points": ["point 1", "point 2", "point 3"]
    }}
  ]
}}"""

    response = nvidia_client.chat.completions.create(
        model="moonshotai/kimi-k2-instruct",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        max_tokens=4096,
        temperature=0.4
    )

    raw = response.choices[0].message.content
    parsed = _parse_json_response(raw)
    parsed["model_used"] = "moonshotai/kimi-k2-instruct"
    return parsed


# ── Groq Generator (existing logic, adapted) ──────────────────────

def _generate_with_groq(topic: str, num_slides: int) -> dict:
    """Calls Groq (LLaMA 3.3-70b) for general slide generation."""

    system_prompt = """You are SKYNET, an elite PPT slide generator.
Always respond ONLY with valid JSON. No markdown, no explanation, no code fences."""

    user_prompt = f"""Create exactly {num_slides} presentation slides about: "{topic}"

Respond ONLY with this JSON structure:
{{
  "title": "presentation title",
  "slides": [
    {{
      "slide_number": 1,
      "title": "slide title",
      "content": "explanation text (2-4 sentences)",
      "code": null,
      "language": null,
      "key_points": ["point 1", "point 2", "point 3"]
    }}
  ]
}}"""

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        max_tokens=4096,
        temperature=0.7
    )

    raw = response.choices[0].message.content
    parsed = _parse_json_response(raw)
    parsed["model_used"] = "llama-3.3-70b-versatile"
    return parsed


# ── JSON Parser (shared utility) ──────────────────────────────────

def _parse_json_response(raw: str) -> dict:
    """
    Strips markdown code fences if present and parses JSON.
    Both Groq and NIM can occasionally wrap JSON in ```json blocks.
    """
    clean = raw.strip()

    # Strip ```json ... ``` or ``` ... ``` wrappers
    if clean.startswith("```"):
        parts = clean.split("```")
        # parts[1] is the content between first pair of fences
        clean = parts[1]
        if clean.startswith("json"):
            clean = clean[4:]
        clean = clean.strip()

    return json.loads(clean)
```

---

## Step 7 — FastAPI Endpoint Update

Update your existing PPT generation endpoint to use the new routing function and return the provider info to the frontend:

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class PPTRequest(BaseModel):
    topic: str
    num_slides: int = 8
    # Optional: let user manually force a provider
    force_provider: str | None = None  # "nvidia" | "groq" | None

class PPTResponse(BaseModel):
    title: str
    slides: list
    model_used: str
    provider: str
    is_technical: bool

@router.post("/generate", response_model=PPTResponse)
async def generate_ppt(request: PPTRequest):
    try:
        # Manual override (for future model selector UI)
        if request.force_provider == "nvidia":
            result = _generate_with_nvidia(request.topic, request.num_slides)
            result["provider"] = "nvidia_nim"
        elif request.force_provider == "groq":
            result = _generate_with_groq(request.topic, request.num_slides)
            result["provider"] = "groq"
        else:
            # Auto-route based on topic detection
            result = generate_slides(request.topic, request.num_slides)

        return PPTResponse(
            title=result["title"],
            slides=result["slides"],
            model_used=result["model_used"],
            provider=result["provider"],
            is_technical=is_technical_topic(request.topic)
        )

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"LLM returned invalid JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
```

---

## Step 8 — Error Handling Reference

| Error | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Wrong or expired `NVIDIA_API_KEY` | Regenerate key at `build.nvidia.com/settings/api-keys` |
| `429 Too Many Requests` | Hit 40 req/min rate limit | Add `time.sleep(1.5)` between requests or queue them |
| `JSONDecodeError` | Model wrapped output in markdown fences | Already handled by `_parse_json_response()` |
| `500` from NIM | Credits exhausted | Fallback to Groq kicks in automatically (Step 6) |

---

## Step 9 — Testing the Integration Locally

Run this quick test after wiring everything up:

```python
# test_nim_integration.py

from your_module import generate_slides, is_technical_topic

# Should route to NVIDIA NIM
print(is_technical_topic("Binary Search in Python"))   # True
print(is_technical_topic("React Hooks"))               # True

# Should route to Groq
print(is_technical_topic("Marketing Strategies"))      # False
print(is_technical_topic("Leadership Skills"))         # False

# Full generation test
result = generate_slides("Python Sorting Algorithms", num_slides=3)
print("Provider:", result["provider"])       # nvidia_nim
print("Model:", result["model_used"])        # moonshotai/kimi-k2-instruct
print("Slides:", len(result["slides"]))      # 3
print("Has code:", bool(result["slides"][1].get("code")))  # True
```

---

## Summary — Files to Modify

| File | Change |
|---|---|
| `.env` | Add `NVIDIA_API_KEY=nvapi-...` |
| `Render.com env vars` | Add `NVIDIA_API_KEY=nvapi-...` |
| `requirements.txt` | Confirm `openai>=1.0.0` is present |
| `config.py` | Add `NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")` |
| `llm_client.py` | Add `nvidia_client` OpenAI instance |
| `ppt_generator.py` | Add `is_technical_topic()`, `generate_slides()`, `_generate_with_nvidia()`, `_parse_json_response()` |
| `routes/ppt.py` | Update endpoint to use new `generate_slides()` and return `provider` + `is_technical` fields |

---

## Slide JSON Schema Reference

This is the exact structure both providers will return. The frontend should expect this shape:

```json
{
  "title": "Python Sorting Algorithms",
  "slides": [
    {
      "slide_number": 1,
      "title": "Introduction to Sorting",
      "content": "Sorting arranges elements in a defined order...",
      "code": null,
      "language": null,
      "key_points": ["Why sorting matters", "Stable vs unstable", "In-place sorting"]
    },
    {
      "slide_number": 2,
      "title": "Bubble Sort",
      "content": "Bubble sort repeatedly swaps adjacent elements...",
      "code": "def bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(n - i - 1):\n            if arr[j] > arr[j + 1]:\n                arr[j], arr[j + 1] = arr[j + 1], arr[j]\n    return arr",
      "language": "python",
      "key_points": ["O(n²) time complexity", "O(1) space", "Stable sort"]
    }
  ],
  "model_used": "moonshotai/kimi-k2-instruct",
  "provider": "nvidia_nim",
  "is_technical": true
}
```

---

*This document was prepared by Madhesh for implementation by Antigravity. All API calls have been verified working via Google Colab testing prior to this guide being written.*