from pathlib import Path
import re, html
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Preformatted, Table, TableStyle
)

src = Path("docs/TECHNICAL_BRIEF.md").read_text(encoding="utf-8")
out = Path("AXiOM_Technical_Brief.pdf")
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="BodySmall", parent=styles["BodyText"],
    fontName="Helvetica", fontSize=6.3, leading=7.2, spaceAfter=1))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"],
    fontSize=15, leading=18, textColor=colors.HexColor("#243b35"), spaceAfter=7))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"],
    fontSize=10, leading=12, textColor=colors.HexColor("#31584b"),
    spaceBefore=2, spaceAfter=1))
styles.add(ParagraphStyle(name="H3x", parent=styles["Heading3"],
    fontSize=8.5, leading=10, spaceBefore=3, spaceAfter=2))
styles.add(ParagraphStyle(name="CodeSmall", parent=styles["Code"],
    fontName="Courier", fontSize=4.8, leading=5.5, leftIndent=5))

def clean(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'\*(.*?)\*', r'<i>\1</i>', s)
    s = re.sub(r'`(.*?)`', r'<font name="Courier">\1</font>', s)
    s = re.sub(r'\$(.*?)\$', r'<i>\1</i>', s)
    return s

story, code, table_rows = [], False, []
def flush_table():
    global table_rows
    if table_rows:
        cells = [[Paragraph(clean(c.strip()), styles["BodySmall"]) for c in row]
                 for row in table_rows]
        t = Table(cells, colWidths=[32*mm, 35*mm, 45*mm, 65*mm],
                  repeatRows=1, hAlign="LEFT")
        t.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#e7eee9")),
            ("GRID",(0,0),(-1,-1),0.35,colors.HexColor("#b8c5bd")),
            ("VALIGN",(0,0),(-1,-1),"TOP"),
            ("LEFTPADDING",(0,0),(-1,-1),3),
            ("RIGHTPADDING",(0,0),(-1,-1),3),
            ("TOPPADDING",(0,0),(-1,-1),2),
            ("BOTTOMPADDING",(0,0),(-1,-1),2),
        ]))
        story.extend([t, Spacer(1,4)])
        table_rows = []

for line in src.splitlines():
    if line.strip().startswith("```"):
        flush_table()
        if code:
            story.append(Preformatted("\n".join(code_lines), styles["CodeSmall"]))
            story.append(Spacer(1,4))
            code = False
        else:
            code, code_lines = True, []
        continue
    if code:
        code_lines.append(line)
        continue
    if line.startswith("## 4."):
        flush_table()
        story.append(PageBreak())
    if line.startswith("|"):
        cells = [c.strip() for c in line.strip("|").split("|")]
        if all(re.fullmatch(r'[-: ]+', c or " ") for c in cells):
            continue
        table_rows.append(cells)
        continue
    flush_table()
    if not line.strip() or line.strip() == "---":
        story.append(Spacer(1,3))
    elif line.startswith("# "):
        story.append(Paragraph(clean(line[2:]), styles["Title"]))
    elif line.startswith("## "):
        story.append(Paragraph(clean(line[3:]), styles["H1x"]))
    elif line.startswith("### "):
        story.append(Paragraph(clean(line[4:]), styles["H2x"]))
    elif re.match(r'^\d+\.\s', line):
        story.append(Paragraph("• " + clean(re.sub(r'^\d+\.\s*', '', line)), styles["BodySmall"]))
    elif line.startswith("- "):
        story.append(Paragraph("• " + clean(line[2:]), styles["BodySmall"]))
    else:
        story.append(Paragraph(clean(line), styles["BodySmall"]))
flush_table()

doc = SimpleDocTemplate(str(out), pagesize=A4,
    rightMargin=14*mm, leftMargin=14*mm,
    topMargin=8*mm, bottomMargin=8*mm,
    title="Multiverse of Monsoon - Technical Brief")
doc.build(story)

data = out.read_bytes()
pages = len(re.findall(rb"/Type\s*/Page\b", data))
print("PDF:", out.resolve())
print("Bytes:", len(data))
print("Signature:", data[:8])
print("Page objects:", pages)
if not data.startswith(b"%PDF") or pages != 2:
    raise SystemExit("PDF verification failed: expected a valid 2-page PDF")
print("PASS: valid two-page PDF generated")
