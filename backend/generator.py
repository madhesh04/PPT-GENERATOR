from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
import os

# Theme Colors
COLOR_BG_DARK     = RGBColor(0x0F, 0x17, 0x2A)   # Deep navy
COLOR_ACCENT      = RGBColor(0x35, 0x8E, 0xF1)   # Bright blue
COLOR_ACCENT2     = RGBColor(0x7C, 0x3A, 0xED)   # Purple
COLOR_WHITE       = RGBColor(0xFF, 0xFF, 0xFF)
COLOR_LIGHT_GRAY  = RGBColor(0xD0, 0xD8, 0xE8)
COLOR_BULLET_BG   = RGBColor(0x1A, 0x27, 0x45)   # Slightly lighter navy

SLIDE_W = Inches(13.33)
SLIDE_H = Inches(7.5)


def _set_slide_bg(slide, color: RGBColor):
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = color


def _add_text_box(slide, text, left, top, width, height,
                  font_size=24, bold=False, color=COLOR_WHITE,
                  align=PP_ALIGN.LEFT, italic=False):
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


def _add_gradient_bar(slide, left, top, width, height, color: RGBColor):
    shape = slide.shapes.add_shape(
        1,  # MSO_SHAPE_TYPE.RECTANGLE
        left, top, width, height
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def create_title_slide(prs, title: str):
    slide_layout = prs.slide_layouts[6]  # blank
    slide = prs.slides.add_slide(slide_layout)
    slide.shapes._spTree.remove(slide.shapes._spTree[2]) if len(slide.shapes) > 0 else None

    _set_slide_bg(slide, COLOR_BG_DARK)

    # Top accent bar
    _add_gradient_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.07), COLOR_ACCENT)

    # Bottom accent bar
    _add_gradient_bar(slide, Inches(0), Inches(7.43), SLIDE_W, Inches(0.07), COLOR_ACCENT2)

    # Side accent bar
    _add_gradient_bar(slide, Inches(0), Inches(0), Inches(0.07), SLIDE_H, COLOR_ACCENT2)

    # Decorative circle (large, faint)
    shape = slide.shapes.add_shape(9, Inches(8.5), Inches(1.5), Inches(5), Inches(5))
    shape.fill.solid()
    shape.fill.fore_color.rgb = RGBColor(0x35, 0x8E, 0xF1)
    shape.line.fill.background()
    # Set transparency via XML hack
    # No additional XML manipulation needed — solid fill with fore_color is sufficient

    # Title
    _add_text_box(
        slide, title,
        left=Inches(0.8), top=Inches(2.5),
        width=Inches(8), height=Inches(1.8),
        font_size=52, bold=True, color=COLOR_WHITE,
        align=PP_ALIGN.LEFT
    )

    # Subtitle line
    _add_gradient_bar(slide, Inches(0.8), Inches(4.35), Inches(3), Pt(3), COLOR_ACCENT)

    # Tagline
    _add_text_box(
        slide, "AI-Powered Presentation",
        left=Inches(0.8), top=Inches(4.5),
        width=Inches(7), height=Inches(0.6),
        font_size=18, bold=False,
        color=RGBColor(0x92, 0xBC, 0xF5),
        align=PP_ALIGN.LEFT, italic=True
    )


def create_content_slide(prs, slide_title: str, content: list, slide_num: int):
    slide_layout = prs.slide_layouts[6]  # blank
    slide = prs.slides.add_slide(slide_layout)

    _set_slide_bg(slide, COLOR_BG_DARK)

    # Alternating accent color for variety
    accent = COLOR_ACCENT if slide_num % 2 == 0 else COLOR_ACCENT2

    # Top accent bar (full width)
    _add_gradient_bar(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.08), accent)

    # Left sidebar
    _add_gradient_bar(slide, Inches(0), Inches(0), Inches(0.4), SLIDE_H, accent)

    # Slide title
    _add_text_box(
        slide, slide_title,
        left=Inches(0.7), top=Inches(0.25),
        width=Inches(12.3), height=Inches(0.9),
        font_size=34, bold=True, color=COLOR_WHITE,
        align=PP_ALIGN.LEFT
    )

    # Divider under title
    _add_gradient_bar(slide, Inches(0.7), Inches(1.15), Inches(11.5), Pt(2), accent)

    # Slide number badge
    _add_gradient_bar(slide, Inches(12.3), Inches(0.25), Inches(0.8), Inches(0.6), accent)
    _add_text_box(
        slide, str(slide_num).zfill(2),
        left=Inches(12.3), top=Inches(0.25),
        width=Inches(0.8), height=Inches(0.6),
        font_size=16, bold=True, color=COLOR_WHITE,
        align=PP_ALIGN.CENTER
    )

    # Bullet points
    y_start = Inches(1.4)
    bullet_h = Inches(0.7)
    for i, point in enumerate(content[:6]):  # Max 6 bullets
        y = y_start + i * bullet_h

        # Bullet background pill
        _add_gradient_bar(slide, Inches(0.7), y, Inches(11.5), Inches(0.58), COLOR_BULLET_BG)

        # Bullet dot
        _add_gradient_bar(slide, Inches(0.85), y + Inches(0.2), Inches(0.12), Inches(0.18), accent)

        # Bullet text
        _add_text_box(
            slide, point,
            left=Inches(1.15), top=y + Pt(2),
            width=Inches(11), height=Inches(0.55),
            font_size=18, bold=False, color=COLOR_LIGHT_GRAY,
            align=PP_ALIGN.LEFT
        )


def create_presentation(title: str, slide_data: list):
    prs = Presentation()
    prs.slide_width  = SLIDE_W
    prs.slide_height = SLIDE_H

    # Title slide
    create_title_slide(prs, title)

    # Content slides
    for i, slide_content in enumerate(slide_data):
        create_content_slide(
            prs,
            slide_title=slide_content.get("title", "Slide"),
            content=slide_content.get("content", []),
            slide_num=i + 1
        )

    output_dir = "generated_ppts"
    os.makedirs(output_dir, exist_ok=True)
    safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)
    file_path = os.path.join(output_dir, f"{safe_title.replace(' ', '_')}.pptx")
    prs.save(file_path)
    return file_path
