import io
import base64
from fpdf import FPDF
from typing import List, Optional

from shared.themes import THEME_DATA

# ── Themes ─────────────────────────────────────────────────────────────────────
THEMES = {
    k: {
        "bg": v["white"] if k == "dark" else v["text"], # Swapped logic from original for consistency
        "text": v["white"],
        "accent": v["main"],
        "muted": v["slate"]
    } for k, v in THEME_DATA.items()
}

# Fix specific mappings for PDF generator which has its own logic
for k in THEMES:
    if k == "dark":
        THEMES[k]["bg"] = THEME_DATA[k]["white"] # (15, 23, 42)
        THEMES[k]["text"] = THEME_DATA[k]["text"] # (248, 250, 252)
    else:
        THEMES[k]["bg"] = THEME_DATA[k]["text"]
        THEMES[k]["text"] = THEME_DATA[k]["white"]

class SkynetPDF(FPDF):
    def __init__(self, theme_name="neon"):
        # 16:9 ratio in mm (297x167)
        super().__init__(orientation='landscape', format=(167, 297))
        self.theme = THEMES.get(theme_name, THEMES["neon"])
        self.set_auto_page_break(auto=False)

    def header(self):
        self.set_fill_color(*self.theme["bg"])
        self.rect(0, 0, 297, 167, 'F')
        
        # Grid/Scanline effect (Subtle lines)
        self.set_draw_color(*self.theme["muted"])
        self.set_line_width(0.1)
        for i in range(0, 300, 20):
            self.line(i, 0, i, 167)
        for j in range(0, 170, 20):
            self.line(0, j, 297, j)

        # Skynet Brand
        self.set_font('Courier', 'B', 10)
        self.set_text_color(*self.theme["accent"])
        self.text(10, 10, "SKYNET // PPT_GEN v2.4.0")
        
    def footer(self):
        self.set_y(-15)
        self.set_font('Courier', 'I', 8)
        self.set_text_color(*self.theme["muted"])
        self.cell(0, 10, f"PAGE {self.page_no()} // SYSTEM_PROTECTED", 0, 0, 'R')

    def add_title_slide(self, title: str):
        self.add_page()
        self.set_y(60)
        self.set_font('Helvetica', 'B', 42)
        self.set_text_color(*self.theme["accent"])
        self.multi_cell(0, 15, title.upper(), 0, 'C')
        
        # Decorative line
        self.set_draw_color(*self.theme["accent"])
        self.set_line_width(1)
        self.line(70, 95, 227, 95)
        
    def add_content_slide(self, title: str, bullets: List[str], image_base64: Optional[str] = None):
        self.add_page()
        
        # Title
        self.set_y(15)
        self.set_font('Helvetica', 'B', 24)
        self.set_text_color(*self.theme["accent"])
        self.cell(0, 15, title.upper(), 0, 1, 'L')
        
        # Horizontal accent
        self.set_draw_color(*self.theme["accent"])
        self.set_line_width(0.5)
        self.line(10, 30, 287, 30)

        curr_y = 40
        content_width = 277
        if image_base64:
            content_width = 160
            try:
                # Decode image
                header, data = image_base64.split(',', 1)
                img_data = base64.b64decode(data)
                img_io = io.BytesIO(img_data)
                # Position image on the right
                self.image(img_io, x=180, y=40, w=100)
            except Exception:
                pass

        # Bullets
        self.set_y(curr_y)
        self.set_font('Helvetica', '', 16)
        self.set_text_color(*self.theme["text"])
        for bullet in bullets:
            self.set_x(15)
            # Bullet point symbol
            self.set_text_color(*self.theme["accent"])
            self.write(10, "// ")
            self.set_text_color(*self.theme["text"])
            self.multi_cell(content_width - 15, 10, bullet, 0, 'L')
            self.ln(4)

    def add_code_slide(self, title: str, code: str, language: str = "CODE"):
        self.add_page()
        
        # Title
        self.set_y(15)
        self.set_font('Helvetica', 'B', 24)
        self.set_text_color(*self.theme["accent"])
        self.cell(0, 15, title.upper(), 0, 1, 'L')
        
        # Code Box
        self.set_fill_color(30, 30, 46) # Terminal BG
        self.rect(10, 35, 277, 115, 'F')
        self.set_draw_color(*self.theme["accent"])
        self.rect(10, 35, 277, 115, 'D')
        
        # Language Badge
        self.set_font('Courier', 'B', 8)
        self.set_text_color(*self.theme["muted"])
        self.text(260, 40, language.upper())

        # Code content
        self.set_y(45)
        self.set_x(15)
        self.set_font('Courier', '', 12)
        self.set_text_color(203, 214, 246) # Light blue text
        self.multi_cell(267, 7, code, 0, 'L')

def create_pdf_presentation(title: str, slides: List[dict], theme: str = "neon") -> io.BytesIO:
    pdf = SkynetPDF(theme_name=theme)
    pdf.add_title_slide(title)
    
    for slide in slides:
        if slide.get("code"):
            pdf.add_code_slide(slide["title"], slide["code"], slide.get("language", "CODE"))
        else:
            pdf.add_content_slide(slide["title"], slide["content"], slide.get("image_base64"))
            
    # Output to stream
    pdf_output = io.BytesIO()
    pdf_output.write(pdf.output())
    pdf_output.seek(0)
    return pdf_output
