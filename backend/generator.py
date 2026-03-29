import os
import copy
import io
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# ── Template path ──────────────────────────────────────────────────────────────
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "template.pptx")

# ── Themes ─────────────────────────────────────────────────────────────────────
class Theme:
    def __init__(self, name, main_h, accent_h, text_h, slate_h, white_h, surface_h):
        self.name = name
        self.main = RGBColor.from_string(main_h.replace("#", ""))
        self.accent = RGBColor.from_string(accent_h.replace("#", ""))
        self.text = RGBColor.from_string(text_h.replace("#", ""))
        self.slate = RGBColor.from_string(slate_h.replace("#", ""))
        self.white = RGBColor.from_string(white_h.replace("#", ""))
        self.surface = RGBColor.from_string(surface_h.replace("#", ""))

THEMES = {
    "neon": Theme("Neon", "#F5533D", "#FF6B35", "#0F172A", "#475569", "#FFFFFF", "#F8FAFC"),
    "ocean": Theme("Ocean", "#3B82F6", "#06B6D4", "#0F172A", "#475569", "#FFFFFF", "#F8FAFC"),
    "emerald": Theme("Emerald", "#10B981", "#34D399", "#064E3B", "#374151", "#FFFFFF", "#F9FAFB"),
    "royal": Theme("Royal", "#6366F1", "#A855F7", "#1E1B4B", "#475569", "#FFFFFF", "#F8FAFC"),
    "dark": Theme("Dark", "#F5533D", "#FF6B35", "#F8FAFC", "#94A3B8", "#0F172A", "#1E293B"),
}

DEFAULT_THEME = THEMES["neon"]

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
                  color: RGBColor = None,
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
    if color:
        run.font.color.rgb = color
    return txBox


def _add_rect(slide, left, top, width, height, color: RGBColor):
    shape = slide.shapes.add_shape(1, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape


# ── Slide decorators ───────────────────────────────────────────────────────────

def _decorate_closing_slide(slide, title: str, theme: Theme):
    """Renders a 'Thank You' closing slide."""
    _add_text_box(slide, "Thank You",
                  Inches(1.5), Inches(3.6), Inches(12), Inches(2.5),
                  font_size=72, bold=True, color=theme.white)
    _add_text_box(slide, title,
                  Inches(1.5), Inches(5.8), Inches(14), Inches(1.0),
                  font_size=24, color=theme.main, italic=True)


def _decorate_agenda_slide(slide, slide_titles: list, theme: Theme):
    """Renders a clean 'Agenda' overview slide on the template layout."""
    _add_text_box(slide, "Agenda",
                  Inches(1.0), Inches(0.4), Inches(15.0), Inches(1.0),
                  font_size=36, bold=True, color=theme.text)

    # Print a single, simple column list of agenda items in the upper left
    for row, item in enumerate(slide_titles):
        y = 2.0 + (row * 0.7)
        _add_text_box(slide, f"{row+1:02d}. {item}",
                      Inches(1.5), Inches(y), Inches(15.0), Inches(0.65),
                      font_size=26, color=theme.slate)


def _decorate_title_slide(slide, title: str, theme: Theme):
    # Only map the title text over the existing template.
    _add_text_box(slide, title,
                  Inches(11.0), Inches(5.8), Inches(8.0), Inches(3.0),
                  font_size=60, bold=True, color=theme.text)


def _decorate_content_slide(slide, slide_title: str, content: list,
                             slide_num: int, theme: Theme, image_bytes: bytes | None = None):
    has_image = image_bytes is not None

    # Slide Title (full width regardless of image)
    _add_text_box(slide, slide_title,
                  Inches(1.0), Inches(0.4), Inches(18.0), Inches(1.0),
                  font_size=36, bold=True, color=theme.text)

    # Bullet width: left 55% if image present, full width if no image
    bullet_text_width = Inches(9.0) if has_image else Inches(17.0)
    bullet_font_size  = 22 if has_image else 24

    # Bullet Points
    for i, point in enumerate(content[:5]):
        y = 1.8 + (i * 1.5)
        # Bullet marker
        _add_text_box(slide, "•",
                      Inches(1.0), Inches(y - 0.05), Inches(0.5), Inches(1.0),
                      font_size=28, color=theme.main)
        # Bullet text (narrower when image is present)
        _add_text_box(slide, point,
                      Inches(1.5), Inches(y), bullet_text_width, Inches(1.4),
                      font_size=bullet_font_size, color=theme.slate)

    # Image — right half of the slide
    if has_image:
        try:
            img_stream = io.BytesIO(image_bytes)
            slide.shapes.add_picture(
                img_stream,
                left=Inches(11.0),
                top=Inches(1.6),
                width=Inches(8.0),
                height=Inches(8.2)
            )
        except Exception as e:
            # If image injection fails, slide still renders correctly (just no image)
            import logging
            logging.getLogger(__name__).warning(
                "Failed to add image to slide %d: %s", slide_num, e
            )


# ── Main entry point ───────────────────────────────────────────────────────────

def create_presentation(title: str, slide_data: list,
                         image_bytes_list: list | None = None,
                         theme_name: str = "neon"
                        ) -> tuple[io.BytesIO, str]:
    """
    Generate a PPTX in memory. Returns (BytesIO, filename).
    """
    theme = THEMES.get(theme_name.lower(), DEFAULT_THEME)

    if os.path.exists(TEMPLATE_PATH):
        prs = Presentation(TEMPLATE_PATH)
        n = len(slide_data)

        # We need: Title (1) + Agenda (1) + Content (n) + Closing (1) = n+3 slides
        # Standard template has 2 slides: [Title, Content]
        
        # 1. Create Agenda slot (duplicate slide 1 — content layout)
        _duplicate_slide_within(prs, 1) # slide 2 now
        
        # 2. Create Content slots (n-1) extra after original slide 1
        for _ in range(max(0, n - 1)):
            _duplicate_slide_within(prs, 1)
            
        # 3. Create Closing slot (duplicate slide 0 — title layout for high impact)
        # We ensure it's the absolute last slide.
        _duplicate_slide_within(prs, 0)
        closing_slide_idx = len(prs.slides) - 1

        # Decorate
        # Slide 0: Title
        _decorate_title_slide(prs.slides[0], title, theme)
        
        # Slide 1: Agenda
        titles = [s.get("title", f"Slide {i+1}") for i, s in enumerate(slide_data)]
        _decorate_agenda_slide(prs.slides[1], titles, theme)
        
        # Slides 2 to n+1: Content
        for i, sc in enumerate(slide_data):
            img = image_bytes_list[i] if image_bytes_list and i < len(image_bytes_list) else None
            _decorate_content_slide(
                prs.slides[i + 2],
                slide_title=sc.get("title", f"Slide {i+1}"),
                content=sc.get("content", []),
                slide_num=i + 1,
                theme=theme,
                image_bytes=img,
            )
            
        # Last Slide: Closing
        _decorate_closing_slide(prs.slides[closing_slide_idx], title, theme)
    else:
        raise FileNotFoundError(f"Template file missing: {TEMPLATE_PATH}. A template is required for generation.")

    buf = io.BytesIO()
    prs.save(buf)
    buf.seek(0)
    safe = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)
    filename = f"{safe.replace(' ', '_')}.pptx"
    return buf, filename

