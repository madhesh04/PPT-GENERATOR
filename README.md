# 🧬 SkyNet — High-Fidelity PPT Generation Suite

**SkyNet** is a production-grade, AI-powered presentation generation platform designed for enterprise workflows. It combines deep technical reasoning with a premium, mechanical design language to deliver professional PPTX and PDF documents from simple topics or URLs.

## 🏗️ Architecture Overview

SkyNet is structured as a monorepo containing a high-performance backend and a precision frontend:

-   **[Backend (FastAPI)](./backend)**: A hardened Python API leveraging NVIDIA NIM (DeepSeek-V3) and Groq (Llama-3.3) for resilient, high-speed content generation.
-   **[Frontend (React)](./frontend)**: A sleek, dashboard-driven interface built with TypeScript and the custom **Vanish UI** design system.

## 🚀 Key Features

-   **Intelligent Generation**: Multi-provider LLM pipeline with 99.9% availability and technical reasoning.
-   **Global Content Bank**: A real-time, system-wide gallery of all generated presentations with universal download access and advanced filtering.
-   **High-Fidelity Preview**: An interactive, slide-by-slide stage for reviewing and editing content before export.
-   **Shared Identity (RBAC)**: Secure integration with the Timesheet-Application database for centralized authentication and role management.
-   **Admin Control Center**: Comprehensive monitoring of system activity, audit logs, and global feature toggles.
-   **MCP Integration**: Native support for the Model Context Protocol (MCP), enabling AI agents like Claude to generate presentations directly via custom connectors.

## 🔌 MCP Integration (Claude)

SkyNet implements a full **Model Context Protocol (MCP)** server with OAuth 2.0 authentication. This allows Claude to use SkyNet's PPT generation tools as part of its reasoning process.

### Features:
-   **Secure OAuth 2.0**: Authenticate using existing organizational credentials (Timesheet DB).
-   **Persistent Sessions**: MCP access tokens are stored in MongoDB for long-term connectivity.
-   **Tool Suite**: 7 specialized tools for generating, searching, and downloading presentations.

### Connection Details:
-   **Server URL**: `https://<your-backend-url>/mcp`
-   **OAuth Client ID**: `skynet-mcp-client`
-   **Scope**: `mcp`

-   **Frontend**: React 18, TypeScript, Vite, Lucide Icons, Vanilla CSS.
-   **Backend**: FastAPI, Motor (Async MongoDB), NVIDIA NIM, Groq, Pollinations AI.
-   **Database**: MongoDB (Atlas) for persistence and authentication.
-   **Storage**: GridFS for high-performance file management and streaming.

## 📥 Getting Started

To get the full system running locally:

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
# Configure .env with MongoDB and LLM API keys
python main.py
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---
© 2026 iamneo | **SkyNet**
