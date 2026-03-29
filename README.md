# 🧬 Kinetic Curator — AI Presentation Platform

**Kinetic Curator** is a high-performance, production-ready AI PowerPoint engine designed for the **iamneo** ecosystem. It blends a "Neon Noir" aesthetic with deep LLM intelligence and precision PPTX mapping to turn raw topics into stunning, ready-to-present slide decks in seconds.

---

## ✨ Features

### 🧠 Intelligence Architecture
- **Multi-Agent Pipeline**: A sophisticated sequential flow: `System Check` → `LLM Agent` → `Image Engine`.
- **Factual Density**: Strictly avoids "fluff" and meta-templates; generates specific, high-value corporate and academic insights.
- **Precision Mapping**: Maps content directly onto native PowerPoint placeholders, maintaining 100% template integrity.
- **Visual Intelligence**: Integrated with **Unsplash** and **Pexels** for automated, context-aware stock photo injection.

### 🎨 Visual & UX Excellence
- **Neon Noir Design**: A premium glassmorphism UI with high-performance **Three.js** particle field animations (`DottedSurface`).
- **Live System Monitoring**: A high-tech "Live" scanning footer tracking system status in real-time.
- **Real-Time Slide Controls**: Interactive progress tracking with micro-animations and status indicators (`#F5533D`).
- **Auto-Speaker Notes**: Every slide includes professional-grade delivery scripts and extra factual context in the notes section.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React + TypeScript (Vite) |
| **Visual Library** | Three.js (Particle Wave Field) |
| **Backend** | FastAPI (Python) |
| **AI Model** | Groq API (`llama-3.3-70b-versatile`) |
| **PPT Engine** | `python-pptx` (Strict Native Injection) |
| **Styling** | Vanilla CSS + Tailwind CSS (Glassmorphism) |

---

## 📂 Project Structure

```bash
PPT-GENERATOR/
├── backend/
│   ├── main.py            # FastAPI Production Server & CORS
│   ├── generator.py       # Precision PPTX Layout Engine
│   ├── llm_client.py      # Prompt Engineering & JSON Parser
│   ├── image_client.py    # Multi-source Image Search (Unsplash/Pexels)
│   ├── template.pptx      # ← The master brand template
│   └── requirements.txt   # Cross-platform dependencies (Render-ready)
├── frontend/
│   ├── src/
│   │   ├── components/ui/  # Premium UI components (DottedSurface, etc.)
│   │   ├── App.tsx         # Main Orchestrator & State
│   │   └── index.css       # Scan-line & Neon glow animations
│   ├── .env.example        # Environment variable reference
│   └── package.json        # Verified production build spec
└── .gitignore              # Multi-tier repository exclusion rules
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.9+
- Node.js 18+
- [Groq API Key](https://console.groq.com/)

### 2. Physical Setup
```bash
# Backend (Python)
pip install -r backend/requirements.txt

# Frontend (Node)
cd frontend && npm install
```

### 3. Environment Config
Copy the example files and set your keys:
- `backend/.env` (Set `GROQ_API_KEY`, `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`)
- `frontend/.env` (Set `VITE_API_BASE=http://localhost:8000`)

### 4. Launch Development
```bash
# Terminal 1: Backend
python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

## 🛡️ Production Readiness
This repository is pre-configured for **Vercel** (Frontend) and **Render** (Backend):
- ✅ **CORS Optimized**: Dynamic `FRONTEND_URL` support.
- ✅ **Clean Repo**: Zero development artifacts or test slides.
- ✅ **Cross-Platform**: Windows, macOS, and Linux compatibility.
- ✅ **Verified Build**: `npm run build` tested with zero TypeScript errors.

---

© 2026 iamneo | **Kinetic Curator**
