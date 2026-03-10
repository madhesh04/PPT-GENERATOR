# NEO PPT — AI Presentation Generator

An AI-powered PowerPoint generator built for **iamneo**. Enter a title, topics, tone, and context — the app calls Groq's LLaMA 3.3 70B model to generate professional slide content and outputs a ready-to-download `.pptx` file using your company's branded template.

---

## Tech Stack

| Layer     | Technology                           |
|-----------|--------------------------------------|
| Frontend  | React + TypeScript (Vite)            |
| Backend   | FastAPI (Python)                     |
| AI Model  | Groq API — `llama-3.3-70b-versatile` |
| PPTX Engine | `python-pptx`                      |
| Rate Limiting | `slowapi`                        |

---

## Project Structure

```
PPT GENERATOR/
├── backend/
│   ├── main.py            # FastAPI app & API routes
│   ├── llm_client.py      # Groq API integration
│   ├── generator.py       # PowerPoint generation logic
│   ├── template.pptx      # ← Your branded template (required)
│   ├── requirements.txt
│   ├── .env               # GROQ_API_KEY goes here
│   └── .env.example       # Template for env vars
└── frontend/
    ├── src/
    │   ├── App.tsx         # Main React component
    │   └── index.css       # iamneo-themed styles
    └── index.html
```

---

## Setup & Running

### 1. Clone & install dependencies

```bash
# Backend
pip install -r backend/requirements.txt

# Frontend
cd frontend
npm install
```

### 2. Configure API key

Copy `backend/.env.example` to `backend/.env` and fill in:
```env
GROQ_API_KEY=your_groq_api_key_here

# Optional — defaults shown
GROQ_MODEL=llama-3.3-70b-versatile
PPT_FONT=Calibri
```
Get a free key at [console.groq.com](https://console.groq.com).

### 3. Add your branded template

Place your PowerPoint template at:
```
backend/template.pptx
```
The template should have **2 slides** — a title slide and a content slide. The generator clones these and injects AI content on top. If the template is missing, a built-in dark theme is used as fallback.

### 4. Start the servers

```bash
# Terminal 1 — Backend  ← run from the PROJECT ROOT, not from inside backend/
py -m uvicorn backend.main:app --reload --port 8000     # Windows (py launcher)
# python -m uvicorn backend.main:app --reload --port 8000  # macOS / Linux

# Terminal 2 — Frontend
cd frontend
npm run dev           # runs on http://localhost:5173
```

---

## Features

- 🏷️ **Tag-based topic input** — Add topics as chips; press Enter or comma to add, × to remove
- 🎯 **Tone selector** — Professional, Executive, Technical, Academic, Sales, Simple
- 📝 **Context field** — Guide the AI with audience/goal details (500 char limit)
- 🎚️ **Slide count slider** — 2 to 15 slides with quick-select presets
- 📋 **Auto agenda slide** — Automatically generated after the title slide
- 🎉 **Auto closing slide** — "Thank You" closing slide appended automatically
- 🎨 **3 layout variants** — Slides alternate between bullet-list, two-column, and highlight styles
- 🗒️ **Speaker notes** — Generated for every slide, visible in PPT notes pane & preview
- ✏️ **Inline editing** — Click any bullet in the preview to edit it before downloading
- ⏳ **Step-by-step progress** — Animated 3-step indicator while generating
- 📱 **Mobile responsive** — Works on all screen sizes
- 📥 **One-click download** — Generates a `.pptx` in seconds
- 🔒 **Rate limited** — 10 requests/minute per IP to protect the Groq API key

---

## API Endpoints

| Method | Endpoint            | Description                            |
|--------|---------------------|----------------------------------------|
| GET    | `/health`           | Health check — returns model name      |
| POST   | `/generate`         | Generate slide content + PPTX          |
| GET    | `/download/{token}` | Download the generated PPTX (5 min TTL)|

---

## Environment Variables

| Variable      | Required | Default                     | Description                              |
|---------------|----------|-----------------------------|------------------------------------------|
| `GROQ_API_KEY`| ✅ Yes   | —                           | API key from [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL`  | No       | `llama-3.3-70b-versatile`   | Groq model to use                        |
| `PPT_FONT`    | No       | `Calibri`                   | Font used in generated PPTX              |
