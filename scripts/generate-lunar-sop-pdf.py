from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

output_path = r"eagle\Lunar_Mission\Lunar_Mission_SOP.pdf"

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "Title",
    parent=styles["Heading1"],
    fontName="Helvetica-Bold",
    fontSize=20,
    leading=24,
    textColor=colors.HexColor("#0f4c81"),
    spaceAfter=10,
)
subtitle_style = ParagraphStyle(
    "Subtitle",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=11,
    leading=14,
    textColor=colors.HexColor("#0f172a"),
)
body_style = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=10.5,
    leading=15,
    textColor=colors.HexColor("#0f172a"),
)
section_style = ParagraphStyle(
    "Section",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=13,
    leading=16,
    textColor=colors.HexColor("#1e3a8a"),
    spaceBefore=6,
    spaceAfter=4,
)
mission_box_style = ParagraphStyle(
    "MissionBox",
    parent=body_style,
    fontName="Helvetica-Oblique",
    textColor=colors.HexColor("#1f2937"),
)

story = []

story.append(Paragraph("Mission: Lunar LEM Deployment", title_style))
story.append(Paragraph("Grade 11 • Design Technology • SOP (Mission Format)", subtitle_style))
story.append(Spacer(1, 0.35 * cm))

brief_text = (
    "A student engineering team has been assigned to prepare a Tello-based Lunar Excursion Module (LEM) "
    "prototype for a controlled classroom mission. During the pre-launch review, the payload team reported "
    "that the housing is fragile under poor assembly and that sensor visibility can be blocked by incorrect mount placement."
)
story.append(Paragraph(brief_text, body_style))
story.append(Spacer(1, 0.25 * cm))

signal_table = Table(
    [[Paragraph("Mission Control Signal", subtitle_style)],
     [Paragraph(
         "\"Payload stability uncertain... sensor line-of-sight must remain clear... "
         "assembly quality will determine mission success... proceed with maximum structural efficiency.\"",
         mission_box_style,
     )]],
    colWidths=[16.5 * cm],
)
signal_table.setStyle(
    TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbeafe")),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#93c5fd")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#bfdbfe")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ])
)
story.append(signal_table)
story.append(Spacer(1, 0.35 * cm))

story.append(Paragraph("Mission Objective", section_style))
story.append(
    Paragraph(
        "Design, print, assemble, and validate a Lunar LEM shell around the Tello drone while maintaining "
        "structural integrity, safe handling, and clear sensor exposure for stable operation.",
        body_style,
    )
)

story.append(Paragraph("Provided Design Assets", section_style))
provided_assets = [
    "12 STL files for frame, mounts, legs, panels, ladder, nozzle, and dish components.",
    "Reference images inside the Lunar_Mission/images folder.",
    "This SOP as the mandatory workflow guide.",
]
for idx, item in enumerate(provided_assets, start=1):
    story.append(Paragraph(f"{idx}. {item}", body_style))

story.append(Paragraph("Required Materials & Tools", section_style))
materials = [
    "3D printer with PLA (or equivalent) filament",
    "CA glue / cyanoacrylate",
    "Heavy-duty paperclips (for leg reinforcement)",
    "Small cutters / pliers / deburring tool",
    "Tello drone for fitment testing",
]
for idx, item in enumerate(materials, start=1):
    story.append(Paragraph(f"{idx}. {item}", body_style))

story.append(Paragraph("Assembly SOP (Mission Sequence)", section_style))
steps = [
    "Print all STL components and inspect for warping, weak bridges, or incomplete layers.",
    "Reinforce hollow legs with paperclip rods; verify alignment before adhesive application.",
    "Assemble drone mount sections (A/B/C v2 + D) and confirm secure but non-obstructive fit.",
    "Fix side panels, hatch, dish, and ladder onto the main frame in controlled sequence.",
    "Mount frame to drone and verify camera and sensor visibility from front and bottom.",
    "Run static balance check, then perform low-altitude hover test in safe indoor zone.",
    "Document observed issues, iterate mount orientation if stability or sensing is affected.",
]
for idx, item in enumerate(steps, start=1):
    story.append(Paragraph(f"{idx}. {item}", body_style))

story.append(Paragraph("Safety & Quality Gates", section_style))
quality_rows = [
    ["Gate", "Pass Criteria"],
    ["Structural Integrity", "No loose joints, no cracked print, legs stable on landing."],
    ["Sensor Visibility", "Bottom and forward sensors unobstructed by mount/nozzle/panels."],
    ["Fit Accuracy", "Tello sits securely without forced deformation."],
    ["Flight Readiness", "Stable hover and controlled movement at low altitude."],
    ["Documentation", "Student log includes print settings, assembly order, and design changes."],
]
quality_table = Table(quality_rows, colWidths=[4.4 * cm, 12.1 * cm])
quality_table.setStyle(
    TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#94a3b8")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ])
)
story.append(quality_table)
story.append(Spacer(1, 0.25 * cm))

story.append(Paragraph("Submission Requirement", section_style))
story.append(
    Paragraph(
        "Submit a PDF design report containing: selected STL list, assembly photos/screenshots, identified failure points, "
        "improvements made, and final stability evidence. Maximum mission score is awarded when build quality, "
        "safety compliance, and design rationale are all demonstrated.",
        body_style,
    )
)

story.append(Spacer(1, 0.3 * cm))
story.append(Paragraph("Mission Rule: Maximum Structural Efficiency = Mission Success", subtitle_style))

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=1.2 * cm,
    rightMargin=1.2 * cm,
    topMargin=1.2 * cm,
    bottomMargin=1.2 * cm,
)
doc.build(story)
print(output_path)
