# 🧬 SkyNet — Backend (FastAPI)

The backend of **SkyNet PPT Generator** is a production-hardened API powered by **FastAPI** and **Motor** (Asynchronous MongoDB driver). It manages the high-fidelity generation pipeline, shared identity authentication, and the administrative dashboard.

## 🧠 Shared Authentication Architecture
SkyNet uses a **dual-database architecture** for maximum security and integration:
1.  **Shared Auth DB (`timesheet`)**: Centralized user store used by multiple applications. Authentication is performed via `employeeId` and `password` (bcrypt-verified).
2.  **App Data DB (`skynet_db`)**: Stores presentation blueprints, slide content, generation logs, and global system configurations.

## 🛡️ Administrative Suite
- **Role-Based Access (RBAC)**: User roles (`admin`, `employee`, `teamlead`) are synced from the external Timesheet system.
- **Global Control**: Admin portal provides full visibility into all generated presentations across the organization.
- **System Toggles**: Admins can globally enable/disable features like AI Image Generation to manage API costs and usage.
- **Global Content Bank**: Rebranded from 'Series', the Bank provides a real-time, system-wide gallery of all generated presentations with universal download access.

## 🔌 MCP Server (FastMCP)
SkyNet is a native **Model Context Protocol (MCP)** server, allowing AI clients like Claude to generate presentations directly:
- **Mount Path**: `/mcp`
- **Auth**: Fully integrated with the OAuth 2.0 Authorization Code flow.
- **Middleware**: Custom `MCPAuthMiddleware` and `ContextVar` wiring ensures every tool call is authenticated against the organizational database.
- **Tools**: Exposes 7 tools for creating, listing, searching, and exporting presentations.

## 🧠 Intelligence & Generation Engine
SkyNet leverages a multi-provider LLM pipeline for 99.9% availability:
- **Primary Model**: NVIDIA NIM (`deepseek-ai/deepseek-v3`) for deep technical reasoning and structured slide generation.
- **Failover Engine**: Groq (`llama-3.3-70b-versatile`) for ultra-fast recovery and fallback.
- **Visuals**: Integrated image search and processing for dynamic slide illustrations.
- **Layout Engine**: Custom-built `generator.py` for precision PPTX layout and `pdf_generator.py` for high-fidelity exports.

## 📂 Project Structure
- `core/`: Security protocols, global configuration, and PPTX themes.
- `db/`: Dual-client persistence logic for internal and shared databases.
- `routers/`: Modular API endpoints for Auth, Admin, and Content Generation.
- `models/`: Pydantic schemas for request validation and internal data structures.
- `services/`: AI Orchestration, GridFS Storage, and Document Generation logic.

## 🚀 Setup & Deployment
1. **Dependencies**: `pip install -r requirements.txt`
2. **Configuration**: Set up your credentials in `.env` (refer to `.env.example`).
3. **Execution**: `uvicorn main:app --host 0.0.0.0 --port 8000`

---
© 2026 iamneo | **SkyNet**
