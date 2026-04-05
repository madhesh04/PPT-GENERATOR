# 🧬 Kinetic Curator — Backend (FastAPI)

The backend of **Kinetic Curator** is a production-hardened API powered by **FastAPI** and **Motor** (Asynchronous MongoDB driver). It manages the sequential generation pipeline, user authentication, and the administrative suite.

## 🧠 Generation Pipeline
1.  **AI Intelligence**: Primary content generation using **NVIDIA NIM** (Kimi K2.5). Fact-dense, technical content with a fallback to **Groq Llama 3 70B**.
2.  **Sequential Slide Builder**: Generates content slides (5-bullet standard) and interleaves high-contrast **Code Slides** for technical topics.
3.  **Image Search**: Multi-source image injection using **Freepik** and context-aware keyword extraction.
4.  **Native PPTX Export**: Precision layout mapping using `python-pptx` into a corporate brand template (`template.pptx`).

## 🛡️ Administrative Suite
- **Role-Based Access (RBAC)**: Supports `User`, `Admin`, and `Master` tiers.
- **Global Generations**: Full visibility and cross-user download/delete capability for administrators.
- **Pending Approvals**: A secure "Master-only" workflow for approving or rejecting new administrative accounts.
- **Security Checkpoints**: Bypasses `user_id` filtering for authorized admins to allow site-wide management.

## 📂 Internal Structure
- `main.py`: Entry point for FastAPI, auth dependencies, and administrative routes.
- `llm_client.py`: The "Brain" – handles prompt engineering, failover logic, and JSON parsing.
- `generator.py`: The "Engine" – manages the `python-pptx` layout injection and coordinate mapping.
- `slide_renderer.py`: Handles high-contrast technical slide rendering.

## 🚀 Deployment
Ensure `requirements.txt` is installed and the `.env` is configured with:
- `NVIDIA_API_KEY`
- `GROQ_API_KEY`
- `MONGODB_URI`

The server is pre-configured with a `Procfile` for one-click deployment to **Render** or **Heroku**.

---
© 2026 iamneo | **Kinetic Curator**
