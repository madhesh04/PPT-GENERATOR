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

def _decorate_closing_slide(slide, title: str):
    """Renders a 'Thank You' closing slide."""
    _add_text_box(slide, "Thank You",
                  Inches(1.5), Inches(3.6), Inches(12), Inches(2.5),
                  font_size=72, bold=True, color=COLOR_WHITE)
    _add_text_box(slide, title,
                  Inches(1.5), Inches(5.8), Inches(14), Inches(1.0),
                  font_size=24, color=COLOR_ORANGE, italic=True)


def _decorate_agenda_slide(slide, slide_titles: list):
    """Renders a clean 'Agenda' overview slide on the template layout."""
    _add_text_box(slide, "Agenda",
                  Inches(1.0), Inches(0.4), Inches(15.0), Inches(1.0),
                  font_size=36, bold=True, color=COLOR_NAVY)

    # Print a single, simple column list of agenda items in the upper left
    for row, item in enumerate(slide_titles):
        y = 2.0 + (row * 0.7)
        _add_text_box(slide, f"{row+1:02d}. {item}",
                      Inches(1.5), Inches(y), Inches(15.0), Inches(0.65),
                      font_size=26, color=COLOR_SLATE)


def _decorate_title_slide(slide, title: str):
    # Only map the title text over the existing template.
    # Do not draw new background rect shapes.
    _add_text_box(slide, title,
                  Inches(1.5), Inches(3.4), Inches(11), Inches(2.8),
                  font_size=60, bold=True, color=COLOR_NAVY)


def _decorate_content_slide(slide, slide_title: str, content: list, slide_num: int):
    # Slide Title (dark text over the plain white background)
    _add_text_box(slide, slide_title,
                  Inches(1.0), Inches(0.4), Inches(18.0), Inches(1.0),
                  font_size=36, bold=True, color=COLOR_NAVY)

    # Bullet Points (Standard vertical list, exactly 5 points)
    for i, point in enumerate(content[:5]):
        y = 1.8 + (i * 1.5)
        # Bullet marker
        _add_text_box(slide, "•",
                      Inches(1.0), Inches(y - 0.05), Inches(0.5), Inches(1.0),
                      font_size=28, color=COLOR_NAVY)
        # Bullet text
        _add_text_box(slide, point,
                      Inches(1.5), Inches(y), Inches(17.0), Inches(1.4),
                      font_size=24, color=COLOR_SLATE)


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
        raise FileNotFoundError(f"Template file missing: {TEMPLATE_PATH}. A template is required for generation.")

    buf = io.BytesIO()
    prs.save(buf)
    buf.seek(0)
    safe = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)
    filename = f"{safe.replace(' ', '_')}.pptx"
    return buf, filename

