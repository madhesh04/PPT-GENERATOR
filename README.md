# 🧬 SkyNet — AI Presentation Platform

**SkyNet** is a high-performance, production-ready AI PowerPoint engine designed for the **iamneo** ecosystem. It features a premium "Vanish" glassmorphism interface, deep LLM intelligence via NVIDIA NIM, and precision PPTX mapping to turn raw topics into stunning, ready-to-present slide decks in seconds.

---

## ✨ Features

### 🧠 Intelligence Architecture
- **NVIDIA NIM Integration**: Primary generation via **DeepSeek-V3** and **Kimi K2.5** for high-speed, factually dense technical content.
- **Failover Logic**: Automatic fallback to **Groq Llama 3.3 70B** to ensure 100% uptime.
- **Technical Code-Slides**: Detects code snippets and automatically interleaves dedicated, high-contrast slides for maximum readability.
- **Visual Intelligence**: Context-aware stock photo injection for visual storytelling and professional aesthetics.

### 🎨 Visual & UX Excellence
- **Vanish Design System**: A premium glassmorphism UI with hardware-accelerated background effects and smooth scrolling.
- **Live Preview Stage**: A professional "Presenter View" that allows for real-time slide editing and instant verification before export.
- **Admin Control Center**: Comprehensive management of system settings, generation history, and user activity (synced from shared DB).
- **Responsive Navigation**: Modern, collapsible sidebar optimized for professional productivity and multi-role access.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React + TypeScript (Vite) |
| **Visuals** | Vanilla CSS (Vanish System) + Glassmorphism |
| **Backend** | FastAPI (Python) |
| **Database** | Dual MongoDB (Internal `skynet_db` + Shared `timesheet`) |
| **Main LLM** | NVIDIA NIM (DeepSeek-V3 / Kimi) |
| **Failover** | Groq API (Llama 3.3 70B) |
| **PPT Engine** | `python-pptx` (Strict Native Injection) |

---

## 📂 Project Structure

```bash
PPT-GENERATOR/
├── backend/
│   ├── main.py            # FastAPI Entry Point
│   ├── routers/           # Auth, Admin, and Generation endpoints
│   ├── services/          # Business logic for storage and generation
│   ├── models/            # Pydantic schemas and request models
│   └── generator.py       # Precision PPTX Layout Engine
├── frontend/
│   ├── src/
│   │   ├── views/         # High-level page components (Creator, Admin)
│   │   ├── components/    # Reusable UI & Layout parts
│   │   └── index.css      # Core Design Tokens & Animations
│   └── public/            # Branding & Static assets
└── .gitignore              # Multi-tier repository exclusion rules
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.9+ | Node.js 18+
- [NVIDIA NIM API Key](https://build.nvidia.com/)
- [Groq API Key](https://console.groq.com/)
- MongoDB Atlas or Local Instance (Access to `skynet_db` and `timesheet`)

### 2. Environment Config
Configure your keys in the following files:
- `backend/.env`
- `frontend/.env`

### 3. Launch Development
```bash
# Terminal 1: Backend
cd backend && uvicorn main:app --port 8000 --reload

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

## 🛡️ Production Readiness
This repository successfully passes all production checks:
- ✅ **CORS Optimized**: Dynamic origins for Render/Vercel deployments.
- ✅ **Clean State**: All development logs, temporary files, and test slides purged.
- ✅ **Verified Build**: `npm run build` tested with zero TypeScript/CSS errors.
- ✅ **Shared Identity**: Fully integrated with the centralized Timesheet auth system.

---

© 2026 iamneo | **SkyNet**
