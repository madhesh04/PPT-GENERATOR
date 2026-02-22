import os
import copy
import io
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# ── Template path ──────────────────────────────────────────────────────────────
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "template.pptx")

# ── Brand colours ──────────────────────────────────────────────────────────────
COLOR_ORANGE  = RGBColor(0xF5, 0x53, 0x3D)
COLOR_ORANGE2 = RGBColor(0xFF, 0x6B, 0x35)
COLOR_NAVY    = RGBColor(0x0F, 0x17, 0x2A)
COLOR_SLATE   = RGBColor(0x47, 0x55, 0x69)
COLOR_WHITE   = RGBColor(0xFF, 0xFF, 0xFF)
COLOR_SURFACE = RGBColor(0xF8, 0xFA, 0xFC)

SLIDE_W = Inches(20.00)
SLIDE_H = Inches(11.25)


# ── Slide duplication (within same prs — preserves image relationships) ────────

def _duplicate_slide_within(prs: Presentation, source_idx: int):
    """
    Clone slide[source_idx] and append it to the end of prs.
    Works within the SAME Presentation so all embedded image/media parts
    and their relationship IDs are preserved.
    """
    source = prs.slides[source_idx]
    new_slide = prs.slides.add_slide(source.slide_layout)

    # 1. Copy relationships, building old-rId → new-rId map
    rId_map: dict[str, str] = {}
    for rel in source.part.rels.values():
        if "slideLayout" in rel.reltype or "slideMaster" in rel.reltype:
            continue
        if rel.is_external:
            continue
        new_rId = new_slide.part.relate_to(rel.target_part, rel.reltype)
        rId_map[rel.rId] = new_rId

    # 2. Deep-copy the shape tree and remap all rId attribute values
    src_copy = copy.deepcopy(source.shapes._spTree)
    for elem in src_copy.iter():
        for attr, val in list(elem.attrib.items()):
            if val in rId_map:
                elem.attrib[attr] = rId_map[val]

    # 3. Replace the new slide's shape tree
    dst = new_slide.shapes._spTree
    for child in list(dst):
        dst.remove(child)
    for child in src_copy:
        dst.append(child)

    return new_slide


# ── Drawing helpers ────────────────────────────────────────────────────────────

def _add_text_box(slide, text, left, top, width, height,
                  font_size=24, bold=False,
                  color: RGBColor = COLOR_NAVY,
                  align=PP_ALIGN.LEFT,
                  italic=False):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(font_size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return txBox


def _add_rect(slide, left, top, width, height, color: RGBColor):
    shape = slide.shapes.add_shape(1, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape


# ── Slide decorators ───────────────────────────────────────────────────────────

def _decorate_title_slide(slide, title: str):
    _add_rect(slide, Inches(1.5), Inches(3.2), Inches(1.2), Pt(4), COLOR_ORANGE)
    _add_text_box(slide, title,
                  Inches(1.5), Inches(3.4), Inches(11), Inches(2.8),
                  font_size=60, bold=True, color=COLOR_NAVY)
    _add_text_box(slide, "AI-Powered Presentation  ·  iamneo",
                  Inches(1.5), Inches(6.4), Inches(10), Inches(0.7),
                  font_size=20, color=COLOR_ORANGE, italic=True)


def _decorate_content_slide(slide, slide_title: str, content: list, slide_num: int):
    accent = COLOR_ORANGE if slide_num % 2 == 0 else COLOR_ORANGE2

    _add_rect(slide, Inches(0), Inches(0), SLIDE_W, Pt(6), accent)

    _add_rect(slide, Inches(18.8), Inches(0.1), Inches(0.9), Inches(0.65), accent)
    _add_text_box(slide, str(slide_num).zfill(2),
                  Inches(18.8), Inches(0.1), Inches(0.9), Inches(0.65),
                  font_size=18, bold=True, color=COLOR_WHITE, align=PP_ALIGN.CENTER)

    _add_text_box(slide, slide_title,
                  Inches(1.0), Inches(0.3), Inches(17.5), Inches(1.2),
                  font_size=38, bold=True, color=COLOR_NAVY)

    _add_rect(slide, Inches(1.0), Inches(1.55), Inches(17.5), Pt(2), accent)

    for i, point in enumerate(content[:5]):
        y = Inches(1.75) + i * Inches(1.45)
        _add_rect(slide, Inches(1.0), y, Inches(17.5), Inches(1.3), COLOR_SURFACE)
        _add_rect(slide, Inches(1.15), y + Inches(0.5), Inches(0.18), Inches(0.18), accent)
        _add_text_box(slide, point,
                      Inches(1.5), y + Pt(4), Inches(16.8), Inches(1.2),
                      font_size=22, color=COLOR_SLATE)


# ── Main entry point ───────────────────────────────────────────────────────────

def create_presentation(title: str, slide_data: list) -> tuple[io.BytesIO, str]:
    """
    Generate a PPTX in memory. Returns (BytesIO, filename).

    Template strategy (no slide deletion needed):
      template starts with slides[0]=title, slides[1]=content_template
      → duplicate slides[1]  (n-1) times  →  slides[1..n] are all content slots
      → decorate slides[0] as title
      → decorate slides[1..n] as content
    """
    if os.path.exists(TEMPLATE_PATH):
        prs = Presentation(TEMPLATE_PATH)
        n   = len(slide_data)

        # Duplicate content template (n-1) extra times so we have exactly n slots
        for _ in range(max(0, n - 1)):
            _duplicate_slide_within(prs, 1)

        # Decorate title slide
        _decorate_title_slide(prs.slides[0], title)

        # Decorate content slides
        for i, sc in enumerate(slide_data):
            _decorate_content_slide(
                prs.slides[i + 1],
                slide_title=sc.get("title", f"Slide {i+1}"),
                content=sc.get("content", []),
                slide_num=i + 1,
            )
    else:
        print("[WARN] template.pptx not found — using built-in fallback.")
        prs = _build_fallback(title, slide_data)

    buf = io.BytesIO()
    prs.save(buf)
    buf.seek(0)
    safe = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)
    filename = f"{safe.replace(' ', '_')}.pptx"
    return buf, filename


# ── Fallback (dark navy theme, no template) ────────────────────────────────────

_FW = Inches(13.33)
_FH = Inches(7.5)
_C_BG   = RGBColor(0x0F, 0x17, 0x2A)
_C_BLUE = RGBColor(0x35, 0x8E, 0xF1)
_C_PURP = RGBColor(0x7C, 0x3A, 0xED)
_C_LG   = RGBColor(0xD0, 0xD8, 0xE8)
_C_DB   = RGBColor(0x1A, 0x27, 0x45)


def _build_fallback(title: str, slide_data: list) -> Presentation:
    prs = Presentation()
    prs.slide_width  = _FW
    prs.slide_height = _FH

    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg = s.background.fill; bg.solid(); bg.fore_color.rgb = _C_BG
    _add_rect(s, Inches(0), Inches(0), _FW, Inches(0.07), _C_BLUE)
    _add_rect(s, Inches(0), Inches(7.43), _FW, Inches(0.07), _C_PURP)
    _add_rect(s, Inches(0), Inches(0), Inches(0.07), _FH, _C_PURP)
    _add_text_box(s, title, Inches(0.8), Inches(2.5), Inches(8), Inches(1.8),
                  52, True, COLOR_WHITE, PP_ALIGN.LEFT)
    _add_text_box(s, "AI-Powered Presentation",
                  Inches(0.8), Inches(4.5), Inches(7), Inches(0.6),
                  18, False, RGBColor(0x92, 0xBC, 0xF5), PP_ALIGN.LEFT, italic=True)

    for idx, sc in enumerate(slide_data):
        s      = prs.slides.add_slide(prs.slide_layouts[6])
        bg     = s.background.fill; bg.solid(); bg.fore_color.rgb = _C_BG
        accent = _C_BLUE if idx % 2 == 0 else _C_PURP
        _add_rect(s, Inches(0), Inches(0), _FW, Inches(0.08), accent)
        _add_rect(s, Inches(0), Inches(0), Inches(0.4), _FH, accent)
        _add_text_box(s, sc.get("title", ""), Inches(0.7), Inches(0.25),
                      Inches(12.3), Inches(0.9), 34, True, COLOR_WHITE, PP_ALIGN.LEFT)
        _add_rect(s, Inches(0.7), Inches(1.15), Inches(11.5), Pt(2), accent)
        _add_rect(s, Inches(12.3), Inches(0.25), Inches(0.8), Inches(0.6), accent)
        _add_text_box(s, str(idx+1).zfill(2), Inches(12.3), Inches(0.25),
                      Inches(0.8), Inches(0.6), 16, True, COLOR_WHITE, PP_ALIGN.CENTER)
        for i, pt in enumerate(sc.get("content", [])[:6]):
            y = Inches(1.4) + i * Inches(0.7)
            _add_rect(s, Inches(0.7), y, Inches(11.5), Inches(0.58), _C_DB)
            _add_rect(s, Inches(0.85), y+Inches(0.2), Inches(0.12), Inches(0.18), accent)
            _add_text_box(s, pt, Inches(1.15), y+Pt(2), Inches(11), Inches(0.55),
                          18, False, _C_LG, PP_ALIGN.LEFT)
    return prs
