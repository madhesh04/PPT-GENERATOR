# Skynet MCP Server

Skynet exposes its PPT generation pipeline as an MCP server mounted on the existing FastAPI backend. Any MCP-compatible client (Claude Desktop, Claude Code, custom agents) can call these tools to generate and export presentations without going through the web UI.

---

## Setup

### 1. Add your Anthropic API key to the backend `.env`

```env
ANTHROPIC_API_KEY=sk-ant-...
```

This enables the `claude-sonnet-4-6` provider. All other providers (Groq, NVIDIA) continue to work as before.

### 2. Start the backend

```bash
cd backend
uvicorn main:app --reload
```

The MCP server is available at `http://localhost:8000/mcp` (no separate process or port).

### 3. Connect Claude Desktop

Add to `~/.config/claude/claude_desktop_config.json` (macOS/Linux) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "skynet": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

Restart Claude Desktop. You should see the Skynet tools available in the tool picker.

---

## Tools

### `generate_presentation`

Runs the full pipeline: LLM content generation → image fetching → MongoDB persistence. Returns a token used by `export_presentation`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `title` | string | required | Presentation title |
| `topics` | string[] | required | Key topics to cover (1–10) |
| `num_slides` | int | `7` | Number of slides (2–15) |
| `context` | string | `""` | Background context, audience notes, or instructions |
| `tone` | string | `"professional"` | `professional` \| `executive` \| `technical` \| `academic` \| `creative` \| `sales` \| `simple` |
| `theme` | string | `"neon"` | `neon` \| `ocean` \| `emerald` \| `royal` \| `dark` \| `light` \| `carbon` |
| `include_images` | bool | `true` | Fetch images for slides via Freepik/Unsplash/Pollinations |
| `force_provider` | string | `"claude"` | `claude` \| `groq` \| `nvidia` \| `auto` |

**Returns:** token, title, theme, slide count, provider used, per-slide summary.

---

### `ingest_slide_content`

Bypasses LLM generation entirely. Accepts pre-written slide content (JSON), validates it, optionally fetches images, and feeds it into the same storage and export pipeline as `generate_presentation`. Use this when Claude has already written the slides and you want to turn them into a PPTX.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `title` | string | required | Presentation title |
| `slides` | object[] | required | Array of slide objects (schema below) |
| `theme` | string | `"neon"` | Same theme options as above |
| `tone` | string | `"professional"` | Stored as metadata only |
| `fetch_images` | bool | `false` | Fetch images for slides that have an `image_query` field |

**Slide object schema:**

```json
{
  "title": "What is RAG?",
  "content": [
    "RAG combines retrieval with generation to ground LLM outputs in real data.",
    "A retriever fetches relevant documents from a vector store at query time.",
    "The retrieved context is injected into the LLM prompt before generation.",
    "This reduces hallucination without requiring model fine-tuning.",
    "OpenAI, LangChain, and LlamaIndex all provide RAG primitives out of the box."
  ],
  "notes": "Emphasise that RAG is retrieval-augmented, not retrieval-replaced.",
  "code": null,
  "language": null,
  "image_query": "document retrieval neural network"
}
```

Required fields: `title`, `content` (list of strings, ideally 5 bullets).  
Optional fields: `code`, `language`, `notes`, `image_query`.

**Returns:** token, title, theme, slide count, QC result.

---

### `export_presentation`

Builds a PPTX from a saved presentation and stores it in GridFS. Use the token from `generate_presentation` or `ingest_slide_content`.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `token` | string | required | Token returned by `generate_presentation` or `ingest_slide_content` |
| `theme` | string | `null` | Override theme. If omitted, the theme from generation is used |

**Returns:** `file_id`, `filename`, `download_path`.

Download the file:

```
GET http://localhost:8000/download/{file_id}
Authorization: Bearer <your-jwt-token>
```

---

### `regenerate_slide`

Generates a single replacement slide without touching the rest of a presentation.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `title` | string | required | Slide heading / topic |
| `topics` | string[] | required | Sub-topics or keywords for this slide |
| `context` | string | `""` | Extra context or instructions |
| `tone` | string | `"professional"` | Writing tone |
| `force_provider` | string | `"claude"` | LLM provider |

**Returns:** title, content, notes, code, language, provider used.

---

### `get_presentation`

Retrieves a saved presentation by token, including all slides. Base64 image data is omitted from the response for readability.

| Parameter | Type | Description |
|---|---|---|
| `token` | string | Presentation token |

---

### `list_presentations`

Lists the most recently generated presentations (metadata only, no slide content).

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | int | `10` | Number of results to return (1–50) |

---

## Typical workflows

### Prompt-based generation

```
1. generate_presentation(title="...", topics=[...], force_provider="claude")
   → returns token

2. export_presentation(token="...")
   → returns file_id

3. GET /download/{file_id}  (with JWT)
   → downloads the .pptx
```

### Claude writes slides, then exports

```
1. Claude authors slide content in the conversation

2. ingest_slide_content(title="...", slides=[...], theme="ocean")
   → validates, stores, returns token

3. export_presentation(token="...")
   → returns file_id

4. GET /download/{file_id}
   → downloads the .pptx
```

### Refine one slide and re-export

```
1. regenerate_slide(title="...", topics=[...])
   → returns new slide dict

2. (Edit the slide dict as needed in the conversation)

3. ingest_slide_content(title="...", slides=[updated full slide list])
   → new token

4. export_presentation(token="...")
```

---

## Notes

- **No authentication on `/mcp`** — intended for internal / local use. Do not expose this endpoint publicly without adding an API key check.
- The MCP server uses a service account (`user_id: "mcp-service"`) for all MongoDB writes. Presentations created via MCP appear alongside web-UI presentations in the admin dashboard.
- If `ANTHROPIC_API_KEY` is not set, `force_provider="claude"` silently falls back to Groq. A warning is logged server-side.
- The `claude_model` used is `claude-sonnet-4-6`. To change it, set `CLAUDE_MODEL=<model-id>` in `.env`.
