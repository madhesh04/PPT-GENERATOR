# 🧬 Kinetic Curator — AI Presentation Platform

**Kinetic Curator** is a high-performance, production-ready AI PowerPoint engine designed for the **iamneo** ecosystem. It blends a "Neon Noir" aesthetic with deep LLM intelligence and precision PPTX mapping to turn raw topics into stunning, ready-to-present slide decks in seconds.

---

## ✨ Features

### 🧠 Intelligence Architecture
- **NVIDIA NIM Integration**: Primary generation via **Kimi K2.5** for high-speed, factually dense technical content.
- **Failover Logic**: Automatic fallback to **Groq Llama 3.3 70B** to ensure 100% uptime.
- **Technical Code-Slides**: Detects code snippets and automatically interleaves dedicated, high-contrast slides (Consolas font) for maximum readability.
- **5-Bullet Standard**: Enforces a strict 5-bullet density per content slide for optimal information retention.
- **Precision Mapping**: Maps content directly onto native PowerPoint placeholders, maintaining 100% template integrity.
- **Visual Intelligence**: Integrated with **Freepik** for automated, context-aware stock photo injection.



### 🎨 Visual & UX Excellence
- **Vanish Design System**: A premium glassmorphism UI with high-performance **Three.js** particle animations.
- **Collapsible Navigation**: High-tech, icon-only navigation mode for maximized workspace.
- **Skynet Admin Suite**: Comprehensive management of users, global generations, and system stats.
- **Data Isolation**: Built-in preview clearing and identity-based state isolation to prevent cross-user data leakage.
- **Auto-Speaker Notes**: Every slide includes professional-grade delivery scripts and extra factual context in the notes section.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React + TypeScript (Vite) |
| **Visuals** | Three.js + Vanilla CSS (Vanish System) |
| **Backend** | FastAPI (Python) |
| **Database** | MongoDB (Persistence & Caching) |
| **Main LLM** | **NVIDIA NIM** (Kimi K2.5) |
| **Failover** | Groq API (Llama 3.3 70B) |
| **PPT Engine** | `python-pptx` (Strict Native Injection) |

---

## 📂 Project Structure

```bash
PPT-GENERATOR/
├── backend/
│   ├── main.py            # FastAPI Production Server & CORS
│   ├── generator.py       # Precision PPTX Layout Engine
│   ├── llm_client.py      # Prompt Engineering & JSON Parser
│   ├── image_client.py    # Multi-source Image Search (Unsplash/Freepik)

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
- Python 3.9+ | Node.js 18+
- [NVIDIA NIM API Key](https://build.nvidia.com/)
- [Groq API Key](https://console.groq.com/)
- MongoDB Instance (Local or Atlas)

### 2. Physical Setup
```bash
# Backend (Python)
pip install -r backend/requirements.txt

# Frontend (Node)
cd frontend && npm install
```

### 3. Environment Config
Copy the example files and set your keys:
- `backend/.env`: `NVIDIA_API_KEY`, `GROQ_API_KEY`, `MONGODB_URI`
- `frontend/.env`: `VITE_API_BASE=http://localhost:8000`

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
