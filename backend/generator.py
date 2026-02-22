import os
import copy
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# ── Template path ──────────────────────────────────────────────────────────────
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "template.pptx")

# ── Brand colours (iamneo) ─────────────────────────────────────────────────────
COLOR_ORANGE   = RGBColor(0xF5, 0x53, 0x3D)   # iamneo primary
COLOR_ORANGE2  = RGBColor(0xFF, 0x6B, 0x35)   # iamneo secondary
COLOR_NAVY     = RGBColor(0x0F, 0x17, 0x2A)   # deep navy
COLOR_SLATE    = RGBColor(0x47, 0x55, 0x69)   # body text
COLOR_WHITE    = RGBColor(0xFF, 0xFF, 0xFF)
COLOR_LIGHT    = RGBColor(0xF8, 0xFA, 0xFC)   # surface

# Slide dimensions from the template (20 x 11.25 inches)
SLIDE_W = Inches(20.00)
SLIDE_H = Inches(11.25)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _clone_template_slide(prs: Presentation, template_slide) -> object:
    """
    Deep-copy all shapes from a template slide onto a fresh blank slide.
    Returns the new slide object.
    """
    blank_layout = prs.slide_layouts[6]   # Blank layout
    new_slide = prs.slides.add_slide(blank_layout)

    src_tree = template_slide.shapes._spTree
    dst_tree = new_slide.shapes._spTree

    for child in copy.deepcopy(src_tree):
        dst_tree.append(child)

    return new_slide


def _add_text_box(slide, text: str,
                  left, top, width, height,
                  font_size=24, bold=False,
                  color: RGBColor = COLOR_NAVY,
                  align=PP_ALIGN.LEFT,
                  italic=False,
                  line_spacing=None):
    """Add a styled text box to the slide."""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    if line_spacing:
        from pptx.util import Pt as _Pt
        from pptx.oxml.ns import qn
        from lxml import etree
        pPr = p._pPr
        if pPr is None:
            pPr = p._p.get_or_add_pPr()
        lnSpc = etree.SubElement(pPr, qn('a:lnSpc'))
        spcPts = etree.SubElement(lnSpc, qn('a:spcPts'))
        spcPts.set('val', str(int(line_spacing * 100)))
    run = p.add_run()
    run.text = text
    run.font.size = Pt(font_size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return txBox


def _add_rect(slide, left, top, width, height, color: RGBColor):
    """Add a filled rectangle (no border)."""
    shape = slide.shapes.add_shape(1, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape


# ── Slide creators ─────────────────────────────────────────────────────────────

def create_title_slide(prs: Presentation, template_title_slide, title: str):
    """
    Clone the template's title slide (slide[0]) and overlay the presentation title.
    Content area: top 9.5 inches is open (decorative shapes hug the borders/bottom).
    """
    slide = _clone_template_slide(prs, template_title_slide)

    # ── Orange accent bar (top‑left) ──────────────────────────────────────────
    _add_rect(slide,
              left=Inches(1.5), top=Inches(3.2),
              width=Inches(1.2), height=Pt(4),
              color=COLOR_ORANGE)

    # ── Main title ────────────────────────────────────────────────────────────
    _add_text_box(
        slide, title,
        left=Inches(1.5), top=Inches(3.4),
        width=Inches(11), height=Inches(2.8),
        font_size=60, bold=True,
        color=COLOR_NAVY,
        align=PP_ALIGN.LEFT,
    )

    # ── Tagline ───────────────────────────────────────────────────────────────
    _add_text_box(
        slide, "AI-Powered Presentation  ·  iamneo",
        left=Inches(1.5), top=Inches(6.4),
        width=Inches(10), height=Inches(0.7),
        font_size=20, bold=False,
        color=COLOR_ORANGE,
        italic=True,
        align=PP_ALIGN.LEFT,
    )


def create_content_slide(prs: Presentation, template_content_slide,
                         slide_title: str, content: list, slide_num: int):
    """
    Clone the template's content slide (slide[1]) and overlay title + bullet points.
    Decorative shapes are all below y≈9.8 inches, so the full top area is free.
    """
    slide = _clone_template_slide(prs, template_content_slide)

    accent = COLOR_ORANGE if slide_num % 2 == 0 else COLOR_ORANGE2

    # ── Top accent bar ────────────────────────────────────────────────────────
    _add_rect(slide,
              left=Inches(0), top=Inches(0),
              width=SLIDE_W, height=Pt(6),
              color=accent)

    # ── Slide number badge ────────────────────────────────────────────────────
    _add_rect(slide,
              left=Inches(18.8), top=Inches(0.1),
              width=Inches(0.9), height=Inches(0.65),
              color=accent)
    _add_text_box(
        slide, str(slide_num).zfill(2),
        left=Inches(18.8), top=Inches(0.1),
        width=Inches(0.9), height=Inches(0.65),
        font_size=18, bold=True,
        color=COLOR_WHITE,
        align=PP_ALIGN.CENTER,
    )

    # ── Slide title ───────────────────────────────────────────────────────────
    _add_text_box(
        slide, slide_title,
        left=Inches(1.0), top=Inches(0.3),
        width=Inches(17.5), height=Inches(1.2),
        font_size=38, bold=True,
        color=COLOR_NAVY,
        align=PP_ALIGN.LEFT,
    )

    # ── Thin divider under title ──────────────────────────────────────────────
    _add_rect(slide,
              left=Inches(1.0), top=Inches(1.55),
              width=Inches(17.5), height=Pt(2),
              color=accent)

    # ── Bullet points ─────────────────────────────────────────────────────────
    bullet_y_start = Inches(1.75)
    bullet_gap     = Inches(1.45)   # spacing between bullets (max 5 fit in ~8.5in)

    for i, point in enumerate(content[:5]):
        y = bullet_y_start + i * bullet_gap

        # Subtle bullet row background
        _add_rect(slide,
                  left=Inches(1.0), top=y,
                  width=Inches(17.5), height=Inches(1.3),
                  color=RGBColor(0xF8, 0xFA, 0xFC))

        # Bullet dot
        _add_rect(slide,
                  left=Inches(1.15), top=y + Inches(0.5),
                  width=Inches(0.18), height=Inches(0.18),
                  color=accent)

        # Bullet text
        _add_text_box(
            slide, point,
            left=Inches(1.5), top=y + Pt(4),
            width=Inches(16.8), height=Inches(1.2),
            font_size=22, bold=False,
            color=COLOR_SLATE,
            align=PP_ALIGN.LEFT,
        )


# ── Main entry point ───────────────────────────────────────────────────────────

def create_presentation(title: str, slide_data: list) -> str:
    """
    Build a .pptx from the user template.
    Falls back to a blank Presentation if template.pptx is not found.
    """
    use_template = os.path.exists(TEMPLATE_PATH)

    if use_template:
        template_prs  = Presentation(TEMPLATE_PATH)
        template_title_slide   = template_prs.slides[0]   # slide[0] = title design
        template_content_slide = template_prs.slides[1]   # slide[1] = content design

        # New presentation inherits theme/fonts from template
        prs = Presentation(TEMPLATE_PATH)
        # Remove the 2 template placeholder slides; we'll re-add them as real slides
        # python-pptx doesn't allow direct deletion easily, so we build from blank
        # but keep the slide master (which carries the visual theme)
        prs = Presentation()
        prs.slide_width  = template_prs.slide_width
        prs.slide_height = template_prs.slide_height

        # Add title slide (cloned from template slide[0])
        create_title_slide(prs, template_title_slide, title)

        # Add content slides (cloned from template slide[1])
        for i, slide_content in enumerate(slide_data):
            create_content_slide(
                prs,
                template_content_slide,
                slide_title=slide_content.get("title", f"Slide {i+1}"),
                content=slide_content.get("content", []),
                slide_num=i + 1,
            )
    else:
        # ── Fallback: build from scratch (original dark-theme approach) ──────
        print("[WARN] template.pptx not found — using built-in theme.")
        prs = Presentation()
        prs.slide_width  = SLIDE_W
        prs.slide_height = SLIDE_H
        _fallback_title_slide(prs, title)
        for i, s in enumerate(slide_data):
            _fallback_content_slide(prs, s.get("title", "Slide"), s.get("content", []), i + 1)

    # ── Save ──────────────────────────────────────────────────────────────────
    output_dir = os.path.join(os.path.dirname(__file__), "generated_ppts")
    os.makedirs(output_dir, exist_ok=True)
    safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)
    file_path  = os.path.join(output_dir, f"{safe_title.replace(' ', '_')}.pptx")
    prs.save(file_path)
    return file_path


# ── Fallback (original design, no template) ───────────────────────────────────

COLOR_BG    = RGBColor(0x0F, 0x17, 0x2A)
COLOR_BLUE  = RGBColor(0x35, 0x8E, 0xF1)
COLOR_PURP  = RGBColor(0x7C, 0x3A, 0xED)
COLOR_LGRAY = RGBColor(0xD0, 0xD8, 0xE8)
COLOR_DBULLET = RGBColor(0x1A, 0x27, 0x45)

_FW = Inches(13.33)
_FH = Inches(7.5)


def _fallback_title_slide(prs, title):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg = slide.background.fill; bg.solid(); bg.fore_color.rgb = COLOR_BG
    _add_rect(slide, Inches(0), Inches(0), _FW, Inches(0.07), COLOR_BLUE)
    _add_rect(slide, Inches(0), Inches(7.43), _FW, Inches(0.07), COLOR_PURP)
    _add_rect(slide, Inches(0), Inches(0), Inches(0.07), _FH, COLOR_PURP)
    _add_text_box(slide, title, Inches(0.8), Inches(2.5), Inches(8), Inches(1.8),
                  52, True, COLOR_WHITE, PP_ALIGN.LEFT)
    _add_text_box(slide, "AI-Powered Presentation", Inches(0.8), Inches(4.5),
                  Inches(7), Inches(0.6), 18, False,
                  RGBColor(0x92, 0xBC, 0xF5), PP_ALIGN.LEFT, italic=True)


def _fallback_content_slide(prs, slide_title, content, slide_num):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg = slide.background.fill; bg.solid(); bg.fore_color.rgb = COLOR_BG
    accent = COLOR_BLUE if slide_num % 2 == 0 else COLOR_PURP
    _add_rect(slide, Inches(0), Inches(0), _FW, Inches(0.08), accent)
    _add_rect(slide, Inches(0), Inches(0), Inches(0.4), _FH, accent)
    _add_text_box(slide, slide_title, Inches(0.7), Inches(0.25),
                  Inches(12.3), Inches(0.9), 34, True, COLOR_WHITE, PP_ALIGN.LEFT)
    _add_rect(slide, Inches(0.7), Inches(1.15), Inches(11.5), Pt(2), accent)
    _add_rect(slide, Inches(12.3), Inches(0.25), Inches(0.8), Inches(0.6), accent)
    _add_text_box(slide, str(slide_num).zfill(2), Inches(12.3), Inches(0.25),
                  Inches(0.8), Inches(0.6), 16, True, COLOR_WHITE, PP_ALIGN.CENTER)
    for i, point in enumerate(content[:6]):
        y = Inches(1.4) + i * Inches(0.7)
        _add_rect(slide, Inches(0.7), y, Inches(11.5), Inches(0.58), COLOR_DBULLET)
        _add_rect(slide, Inches(0.85), y + Inches(0.2), Inches(0.12), Inches(0.18), accent)
        _add_text_box(slide, point, Inches(1.15), y + Pt(2),
                      Inches(11), Inches(0.55), 18, False, COLOR_LGRAY, PP_ALIGN.LEFT)
