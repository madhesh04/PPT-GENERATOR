# 🧬 SkyNet — Backend (FastAPI)

The backend of **SkyNet PPT Generator** is a production-hardened API powered by **FastAPI** and **Motor** (Asynchronous MongoDB driver). It manages the sequential generation pipeline, shared authentication, and the administrative suite.

## 🧠 Shared Authentication Architecture
SkyNet uses a **dual-database architecture**:
1.  **Shared Auth DB (`timesheet`)**: Centralized user store used by multiple applications. Authentication is performed via `employeeId` and `password` (bcrypt).
2.  **App Data DB (`skynet_db`)**: Stores presentation blueprints, generation logs, and global system settings.

## 🛡️ Administrative Suite
- **Role-Based Access (RBAC)**: User roles (`admin`, `employee`, `teamlead`) are managed in the external Timesheet system.
- **Unified Generations**: Admin portal allows full visibility and cross-user download/delete capability for presentations.
- **Externally Managed Users**: User management (creation, role assignment, status) is consolidated in the primary Timesheet system to maintain data integrity.

## 🧠 Intelligence Engine
SkyNet leverages a high-performance LLM pipeline:
- **Primary**: NVIDIA NIM (`deepseek-ai/deepseek-v3` or `kimi-2.5`) for deep technical reasoning.
- **Failover**: Groq (`llama-3.3-70b-versatile`) for instant recovery and uptime.

## 📂 Project Structure
- `core/`: Critical infrastructure (Security, Config, Themes).
- `db/`: Dual-client persistence logic (Internal/External).
- `routers/`: Modular API surface (Auth, Admin, Generate).
- `services/`: Core logic (AI Orchestration, Storage, PDF/PPTX generation).
- `generator.py`: The precision PPTX layout engine.

## 🚀 Setup
1. Install dependencies: `pip install -r requirements.txt`
2. Configure `.env` from `.env.example`.
3. Start server: `uvicorn main:app --port 8000`

---
© 2026 iamneo | **SkyNet**
