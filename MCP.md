# Skynet MCP Server

Skynet exposes its PPT generation pipeline as an MCP server mounted on the existing FastAPI backend. Any MCP-compatible client (Claude Desktop, Claude Code, custom agents) can call these tools to generate and export presentations without going through the web UI.

---

## Setup

### 1. Configure MCP API Key

Add to `backend/.env`:

```env
MCP_API_KEY=your-secure-random-key-here
```

This key is required for all MCP requests via the `Authorization: Bearer <key>` header.

### 2. Start the backend

```bash
cd backend
uvicorn main:app --reload
```

The MCP server is available at:

- **Local**: `http://localhost:8000/mcp`
- **Production**: `https://your-domain.com/mcp`

### 3. Connect Claude Desktop (Local)

Add to `~/.config/claude/claude_desktop_config.json` (macOS/Linux) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "skynet": {
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Bearer your-mcp-api-key-here"
      }
    }
  }
}
```

Restart Claude Desktop. The Skynet tools will appear in the tool picker.

### 4. Connect Claude Web / Remote MCP Clients

For Claude web or other remote MCP clients:

1. **Deploy backend** to a public URL (Render, Railway, Vercel, AWS, etc.)
2. **Set environment variable**: `MCP_API_KEY=your-secure-key` in production
3. **Add as custom connector**:
   - **URL**: `https://your-backend-domain.com/mcp`
   - **Method**: POST
   - **Headers**:
     ```json
     {
       "Authorization": "Bearer your-mcp-api-key-here",
       "Content-Type": "application/json"
     }
     ```
   - **Body format**: JSON-RPC 2.0

**Example request**:

```bash
curl -X POST https://your-backend.com/mcp \
  -H "Authorization: Bearer your-mcp-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

---

## Tools

### `create_presentation_from_content` ⭐ Primary Claude → MCP tool

The entry point for the **Claude → MCP flow**. Claude authors the slide JSON and calls this tool. Skynet validates the content, builds a PPTX via the existing pipeline, stores it in GridFS, and returns a `file_id` for immediate download — no separate export step needed.

| Parameter | Type     | Default          | Description                                                                |
| --------- | -------- | ---------------- | -------------------------------------------------------------------------- |
| `title`   | string   | required         | Presentation title                                                         |
| `slides`  | object[] | required         | Array of slide objects (schema below)                                      |
| `theme`   | string   | `"neon"`         | `neon` \| `ocean` \| `emerald` \| `royal` \| `dark` \| `light` \| `carbon` |
| `tone`    | string   | `"professional"` | Stored as metadata only                                                    |

**Slide object schema:**

```json
{
  "title": "What is RAG?",
  "bullets": [
    "RAG combines retrieval with generation to ground LLM outputs in real data.",
    "A retriever fetches relevant documents from a vector store at query time.",
    "The retrieved context is injected into the LLM prompt before generation.",
    "This reduces hallucination without requiring model fine-tuning.",
    "OpenAI, LangChain, and LlamaIndex all provide RAG primitives out of the box."
  ],
  "notes": "Emphasise that RAG is retrieval-augmented, not retrieval-replaced."
}
```

Required fields: `title`, `bullets` (list of strings).  
Optional field: `notes`.

**Returns:** `file_id`, `filename`, `download_path`, `token`, `slide_count`.

---

### `generate_presentation`

Runs the full pipeline: LLM content generation → image fetching → MongoDB persistence. Returns a token used by `export_presentation`.

| Parameter        | Type     | Default          | Description                                                                                     |
| ---------------- | -------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| `title`          | string   | required         | Presentation title                                                                              |
| `topics`         | string[] | required         | Key topics to cover (1–10)                                                                      |
| `num_slides`     | int      | `7`              | Number of slides (2–15)                                                                         |
| `context`        | string   | `""`             | Background context, audience notes, or instructions                                             |
| `tone`           | string   | `"professional"` | `professional` \| `executive` \| `technical` \| `academic` \| `creative` \| `sales` \| `simple` |
| `theme`          | string   | `"neon"`         | `neon` \| `ocean` \| `emerald` \| `royal` \| `dark` \| `light` \| `carbon`                      |
| `include_images` | bool     | `true`           | Fetch images for slides via Freepik/Unsplash/Pollinations                                       |
| `force_provider` | string   | `"auto"`         | `groq` \| `nvidia` \| `auto`                                                                    |

**Returns:** token, title, theme, slide count, provider used, per-slide summary.

---

### `export_presentation`

Builds a PPTX from a saved presentation and stores it in GridFS. Use the token from `generate_presentation`, `ingest_slide_content`, or `create_presentation_from_content`.

| Parameter | Type   | Default  | Description                                                   |
| --------- | ------ | -------- | ------------------------------------------------------------- |
| `token`   | string | required | Token returned by any generation tool                         |
| `theme`   | string | `null`   | Override theme. If omitted, the theme from generation is used |

**Returns:** `file_id`, `filename`, `download_path`.

Download the file:

```
GET http://localhost:8000/download/{file_id}
Authorization: Bearer <your-jwt-token>
```

---

### `ingest_slide_content`

Accepts pre-written slide content with extended fields (code blocks, image queries), optionally fetches images, then persists to MongoDB. Returns a token for use with `export_presentation`.

| Parameter      | Type     | Default          | Description                                              |
| -------------- | -------- | ---------------- | -------------------------------------------------------- |
| `title`        | string   | required         | Presentation title                                       |
| `slides`       | object[] | required         | Array of slide objects (schema below)                    |
| `theme`        | string   | `"neon"`         | Same theme options as above                              |
| `tone`         | string   | `"professional"` | Stored as metadata only                                  |
| `fetch_images` | bool     | `false`          | Fetch images for slides that have an `image_query` field |

**Slide object schema:**

```json
{
  "title": "What is RAG?",
  "content": ["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4", "Bullet 5"],
  "notes": "Presenter note here.",
  "code": null,
  "language": null,
  "image_query": "document retrieval neural network"
}
```

Required fields: `title`, `content`.  
Optional fields: `code`, `language`, `notes`, `image_query`.

**Returns:** token, title, theme, slide count, QC result.

---

### `regenerate_slide`

Generates a single replacement slide without touching the rest of a presentation.

| Parameter        | Type     | Default          | Description                           |
| ---------------- | -------- | ---------------- | ------------------------------------- |
| `title`          | string   | required         | Slide heading / topic                 |
| `topics`         | string[] | required         | Sub-topics or keywords for this slide |
| `context`        | string   | `""`             | Extra context or instructions         |
| `tone`           | string   | `"professional"` | Writing tone                          |
| `force_provider` | string   | `"auto"`         | `groq` \| `nvidia` \| `auto`          |

**Returns:** title, content, notes, code, language, provider used.

---

### `get_presentation`

Retrieves a saved presentation by token, including all slides. Base64 image data is omitted for readability.

| Parameter | Type   | Description        |
| --------- | ------ | ------------------ |
| `token`   | string | Presentation token |

---

### `list_presentations`

Lists the most recently generated presentations (metadata only, no slide content).

| Parameter | Type | Default | Description                        |
| --------- | ---- | ------- | ---------------------------------- |
| `limit`   | int  | `10`    | Number of results to return (1–50) |

---

## Workflows

### Flow A — Claude → MCP → PPT (primary new flow)

Claude authors the slide content and calls one tool to get a ready-to-download PPTX.

```
Claude (chat) generates slide JSON
  → create_presentation_from_content(title, slides, theme)
  → returns { file_id, download_path }
  → GET /download/{file_id}  (with JWT)
  → .pptx downloaded
```

Example call from Claude:

```json
create_presentation_from_content({
  "title": "Introduction to RAG",
  "slides": [
    {
      "title": "What is RAG?",
      "bullets": [
        "RAG stands for Retrieval-Augmented Generation.",
        "It grounds LLM outputs in real, up-to-date documents.",
        "A retriever fetches relevant chunks from a vector store.",
        "Retrieved context is injected into the prompt before generation.",
        "Reduces hallucination without fine-tuning the base model."
      ]
    },
    {
      "title": "RAG Architecture",
      "bullets": [
        "The pipeline has three stages: index, retrieve, generate.",
        "Documents are chunked and embedded into a vector database.",
        "At query time, top-k similar chunks are fetched by cosine similarity.",
        "The LLM receives both the user query and the retrieved context.",
        "LangChain and LlamaIndex provide ready-made RAG chains."
      ],
      "notes": "Draw the three-stage diagram on the whiteboard."
    }
  ],
  "theme": "neon"
})
```

---

### Flow B — UI → LLM → PPT (existing flow, unchanged)

```
1. generate_presentation(title, topics, force_provider="auto")
   → returns token

2. export_presentation(token)
   → returns file_id

3. GET /download/{file_id}  (with JWT)
   → downloads .pptx
```

---

### Flow C — Ingest with images, then export

Use when you need code blocks or Skynet to fetch slide images.

```
1. ingest_slide_content(title, slides, fetch_images=True)
   → returns token

2. export_presentation(token)
   → returns file_id

3. GET /download/{file_id}
```

---

## Notes

- **Authentication required** — All `/mcp` requests require `Authorization: Bearer <MCP_API_KEY>` header. Set `MCP_API_KEY` in your `.env` file.
- The MCP server uses a service account (`user_id: "mcp-service"`) for all MongoDB writes. Presentations created via MCP appear alongside web-UI presentations in the admin dashboard.
- Claude is used **externally only** — it calls MCP tools directly. There is no Anthropic API key on the backend.
- LLM generation inside the pipeline (Flows B/C) uses Groq or NVIDIA (auto-routed).
- **CORS**: The backend allows requests from Vercel domains and localhost. Update `FRONTEND_URL` in `.env` to add more origins.
