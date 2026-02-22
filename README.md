# NEO PPT — AI Presentation Generator

An AI-powered PowerPoint generator built for **iamneo**. Enter a title, topics, tone, and context — the app calls Groq's LLaMA 3.3 70B model to generate professional slide content and outputs a ready-to-download `.pptx` file using your company's branded template.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript (Vite) |
| Backend | FastAPI (Python) |
| AI Model | Groq API — `llama-3.3-70b-versatile` |
| PPTX Engine | `python-pptx` |

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
│   └── generated_ppts/    # Output folder (auto-created)
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
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### 2. Configure API key

Create `backend/.env`:
```env
GROQ_API_KEY=your_groq_api_key_here
```
Get a free key at [console.groq.com](https://console.groq.com).

### 3. Add your branded template

Place your PowerPoint template at:
```
backend/template.pptx
```
The template should have **2 slides** — a title slide and a content slide. The generator clones these slides and injects AI content on top. If the template is missing, a built-in dark theme is used as fallback.

### 4. Start the servers

```bash
# Terminal 1 — Backend
cd backend
python main.py        # runs on http://localhost:8000

# Terminal 2 — Frontend
cd frontend
npm run dev           # runs on http://localhost:5173
```

---

## Features

- 🎯 **Tone selector** — Professional, Executive, Technical, Academic, Sales, Simple
- 📝 **Context field** — Guide the AI with audience/goal details
- 🎚️ **Slide count slider** — 2 to 15 slides
- 📱 **Mobile responsive** — Works on all screen sizes
- 📥 **One-click download** — Generates a `.pptx` in seconds
- 🎨 **Branded template support** — Uses your own `.pptx` as the visual base

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | API key from [console.groq.com](https://console.groq.com) |
