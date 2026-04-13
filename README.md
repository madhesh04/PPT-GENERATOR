# 🧬 SkyNet — AI Presentation Platform

**SkyNet** is a high-performance, production-ready AI PowerPoint engine designed for the **iamneo** ecosystem. It features a premium "Vanish" glassmorphism interface, deep LLM intelligence via NVIDIA NIM, and precision PPTX mapping to turn raw topics into stunning, ready-to-present slide decks in seconds.

---

## ✨ Features

### 🧠 Intelligence Architecture
- **NVIDIA NIM Integration**: Primary generation via **Kimi K2.5** for high-speed, factually dense technical content.
- **Failover Logic**: Automatic fallback to **Groq Llama 3.3 70B** to ensure 100% uptime.
- **Technical Code-Slides**: Detects code snippets and automatically interleaves dedicated, high-contrast slides for maximum readability.
- **5-Bullet Standard**: Enforces a strict 5-bullet density per content slide for optimal information retention.
- **Visual Intelligence**: Context-aware stock photo injection for visual storytelling.

### 🎨 Visual & UX Excellence
- **Vanish Design System**: A premium glassmorphism UI with hardware-accelerated background effects and smooth scrolling.
- **Skynet Branding**: Custom "S" logo and favicon integrated across the entire portal.
- **Admin Control Center**: Comprehensive management of users (fetched from shared DB) and global generation history.
- **Responsive Layout**: Modern, collapsible navigation optimized for professional productivity.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React + TypeScript (Vite) |
| **Visuals** | Vanilla CSS (Vanish System) + Glassmorphism |
| **Backend** | FastAPI (Python) |
| **Database** | Dual MongoDB (Internal `skynet_db` + External `timesheet`) |
| **Main LLM** | NVIDIA NIM (Kimi K2.5) |
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
│   ├── core/              # Security, Config, and Dependencies
│   └── generator.py       # Precision PPTX Layout Engine
├── frontend/
│   ├── src/
│   │   ├── views/         # High-level page components
│   │   ├── components/    # Reusable UI & Layout parts
│   │   └── index.css      # Core Design Tokens
│   ├── public/            # Logo & Static assets
│   └── package.json        # Verified production build spec
└── .gitignore              # Multi-tier repository exclusion rules
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.9+ | Node.js 18+
- [NVIDIA NIM API Key](https://build.nvidia.com/)
- [Groq API Key](https://console.groq.com/)
- MongoDB Instance (Access to both Skynet and Timesheet DBs)

### 2. Environment Config
Set your keys in the following files (use `.env.example` as a template):
- `backend/.env`
- `frontend/.env`

### 3. Launch Development
```bash
# Terminal 1: Backend
uvicorn backend.main:app --port 8000 --reload

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

## 🛡️ Production Readiness
This repository successfully passes all production checks:
- ✅ **CORS Optimized**: Dynamic origins for Render/Vercel.
- ✅ **Clean Repo**: All development artifacts and test slides removed.
- ✅ **Verified Build**: `npm run build` tested with zero TypeScript errors.
- ✅ **Database Aware**: Fully integrated with the legacy Timesheet ID system.

---

© 2026 iamneo | **SkyNet**

