import io
import logging
from fastapi import HTTPException
from pypdf import PdfReader
from docx import Document

logger = logging.getLogger(__name__)

def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    text = ""
    try:
        if filename.lower().endswith(".pdf"):
            reader = PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                text += (page.extract_text() or "") + "\n"
        elif filename.lower().endswith(".docx"):
            doc = Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            # Assume plain text
            text = file_bytes.decode("utf-8", errors="ignore")
    except Exception as e:
        logger.error("Extraction failed for %s: %s", filename, e)
        raise HTTPException(status_code=400, detail=f"Failed to extract text: {str(e)}")
    
    return text.strip()[:10000] # Cap for LLM context


# ── URL Extraction ─────────────────────────────────────────────────────────────
from html.parser import HTMLParser


class _TextExtractor(HTMLParser):
    """Strips HTML tags and collects readable text, skipping scripts/styles/nav."""
    _SKIP_TAGS = {"script", "style", "nav", "footer", "header", "noscript"}

    def __init__(self):
        super().__init__()
        self.text_parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in self._SKIP_TAGS:
            self._skip_depth += 1

    def handle_endtag(self, tag):
        if tag in self._SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data):
        if self._skip_depth == 0 and data.strip():
            self.text_parts.append(data.strip())


async def extract_text_from_url(url: str) -> str:
    """Fetch a URL and extract readable text content. Capped at 10,000 chars."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; Skynet/1.0)"})
            r.raise_for_status()
        parser = _TextExtractor()
        parser.feed(r.text)
        text = " ".join(parser.text_parts)
        return text[:10000]
    except Exception as e:
        raise ValueError(f"Could not fetch URL: {e}")

