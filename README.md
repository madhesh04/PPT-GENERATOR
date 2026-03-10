# NEO PPT — AI Presentation Generator

An AI-powered PowerPoint generator built specifically for **iamneo**. 

Enter a title, topics, tone, and context — the app calls Groq's `llama-3.3-70b-versatile` model to generate highly factual, specific slide content (including presenter notes). The backend then writes this text *directly* into the precision-mapped native placeholders and UI cards matching the iamneo brand template.

---

## Tech Stack

| Layer     | Technology                           |
|-----------|--------------------------------------|
| Frontend  | React + TypeScript (Vite)            |
| Backend   | FastAPI (Python)                     |
| AI Model  | Groq API (`llama-3.3-70b-versatile`) |
| PPT Engine| `python-pptx` (Strict Native Engine) |
| Security  | `slowapi` (Rate Limiting)            |

---

## Project Structure

```
PPT GENERATOR/
├── backend/
│   ├── main.py            # FastAPI app, API routes, Rate Limiter
│   ├── llm_client.py      # Groq AI prompt engineering & JSON generation
│   ├── generator.py       # Strict native PPTX text mapping engine
│   ├── template.pptx      # ← Your predefined branded template design
│   ├── requirements.txt
│   ├── .env               # GROQ_API_KEY
│   └── .env.example       
└── frontend/
    ├── src/
    │   ├── App.tsx         # Main React UI, Preview, Downloader
    │   └── index.css       # iamneo-themed styling
    ├── .env                # Local Dev API Base (http://localhost:8000)
    └── .env.production     # Prod API Base (https://your-backend.com)
```

---

## Setup & Local Development

### 1. Install dependencies

```bash
# Backend (Python)
pip install -r backend/requirements.txt

# Frontend (Node)
cd frontend
npm install
```

### 2. Configure Environment Variables

**Backend (`backend/.env`):**
```env
# Required
GROQ_API_KEY=your_api_key_here

# Optional configuration
GROQ_MODEL=llama-3.3-70b-versatile
```

**Frontend (`frontend/.env.production`):**
For production deployment on platforms like Vercel or Render, modify `.env.production` to point to your live hosted FastAPI backend:
```env
VITE_API_BASE=https://your-hosted-render-backend.com
```

### 3. Start the servers

```bash
# Terminal 1 — Backend (from project root)
python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

---

## Generative Features

The AI pipeline is heavily optimized for academic, corporate, and sales presentations:
- 🧠 **Anti-Fluff Restraints:** The AI is strictly prompted to avoid meta-templates ("Here is an overview of...") and instead generate dense, factual information and real-world examples.
- 📐 **Rigid Structure:** Guarantees exactly **5 bullet points** per slide (20-45 words each), ensuring uniform sizing across the template layout.
- � **Auto-Speaker Notes:** Automatically writes an additional paragraph of notes for the presenter on every slide, including a delivery cue and extra facts not mentioned on screen.
- 🧮 **Adaptive Pacing:** Intelligently maps the user's input topics across the requested number of slides, pacing out complex topics into multi-slide breakdowns.

## UI / UX Features

- 🏷️ **Tag-based Topic Input:** Add topics cleanly as chips (press Enter).
- ✏️ **Live Inline Editing:** Click any generated bullet point in the browser preview to rewrite it yourself before clicking Download.
- 📝 **Live Notes Preview:** Expand the bottom area of any slide preview card to read the AI-generated speaker notes.
- ⏳ **Intelligent Loader:** 3-step animated progress view while the LLM generates and the PPT builds.
- � **Expirable Download Links:** Downloads use a 5-minute Time-To-Live (TTL) secure token system to prevent server storage bloat.

## Template Engine

The backend generator (`generator.py`) relies **100% on the source `template.pptx` file**. 

It does not inject its own colored rectangles or attempt to override your design. Instead, it measures the exact grid coordinates on your template's background on Slide 2, and cleanly overlays pure, native text onto those predetermined graphical areas to maintain absolute brand purity.
