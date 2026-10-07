import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "evaluation" / "expert-review-package"
CASES_PATH = ROOT / "evaluation" / "cases" / "candidate-cases.jsonl"
OUTPUT_PATH = PACKAGE / "IPC_BNS_Blind_Expert_Review_Packet.pdf"

NAVY = colors.HexColor("#17365D")
PALE_BLUE = colors.HexColor("#EAF1F8")
PALE_GRAY = colors.HexColor("#F4F5F7")
BORDER = colors.HexColor("#D9D9D9")
TEXT = colors.HexColor("#181818")
MUTED = colors.HexColor("#555555")
STOP = colors.HexColor("#8E3030")


def load_cases():
    return [json.loads(line) for line in CASES_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("PacketTitle", parent=base["Title"], fontName="Helvetica-Bold", fontSize=23, leading=27, textColor=colors.black, spaceAfter=14, alignment=TA_LEFT),
        "subtitle": ParagraphStyle("PacketSubtitle", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=TEXT, spaceAfter=14),
        "h1": ParagraphStyle("PacketH1", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=colors.black, spaceBefore=5, spaceAfter=6),
        "h2": ParagraphStyle("PacketH2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=10.5, leading=13, textColor=colors.black, spaceBefore=5, spaceAfter=3),
        "body": ParagraphStyle("PacketBody", parent=base["BodyText"], fontName="Helvetica", fontSize=8.8, leading=11.2, textColor=TEXT, spaceAfter=5),
        "small": ParagraphStyle("PacketSmall", parent=base["BodyText"], fontName="Helvetica", fontSize=7.5, leading=9.3, textColor=TEXT),
        "table": ParagraphStyle("PacketTable", parent=base["BodyText"], fontName="Helvetica", fontSize=7.2, leading=8.7, textColor=TEXT),
        "table_header": ParagraphStyle("PacketTableHeader", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=7.2, leading=8.7, textColor=colors.white),
        "stop": ParagraphStyle("PacketStop", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=8.2, leading=10, textColor=STOP, alignment=TA_CENTER, spaceBefore=3, spaceAfter=3),
        "center": ParagraphStyle("PacketCenter", parent=base["BodyText"], fontName="Helvetica", fontSize=8, leading=10, textColor=TEXT, alignment=TA_CENTER),
    }


def p(text, style):
    return Paragraph(text, style)


def table(data, widths, style_map, header=True, row_heights=None):
    converted = []
    for row_index, row in enumerate(data):
        row_style = style_map["table_header"] if header and row_index == 0 else style_map["table"]
        converted.append([value if hasattr(value, "wrap") else p(str(value), row_style) for value in row])
    result = Table(converted, colWidths=widths, rowHeights=row_heights, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.45, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        commands.extend([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("BACKGROUND", (0, 2), (-1, 2), PALE_GRAY),
        ])
    result.setStyle(TableStyle(commands))
    return result


def header_footer(canvas, document):
    canvas.saveState()
    width, height = A4
    canvas.setFont("Helvetica", 7.2)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(width - 0.62 * inch, height - 0.32 * inch, "IPC and BNS Blind Expert Review")
    canvas.drawCentredString(width / 2, 0.28 * inch, f"Confidential evaluation material  |  Page {document.page}")
    canvas.restoreState()


def add_cover(story, s):
    story.extend([
        Spacer(1, 0.32 * inch),
        p("IPC and BNS Blind Expert Review Packet", s["title"]),
        p("Independent legal labeling and quality review for 10 evaluation cases", s["subtitle"]),
        p("This packet asks a qualified lawyer or law professor to establish independent reference answers before any model output is disclosed. It then provides a separate rubric for reviewing citations, grounding, and IRAC quality after the gold labels have been locked.", s["body"]),
        p("<b>Blind-review rule.</b> No model prediction, retrieved provision, citation, or generated IRAC text appears in this packet. Do not request or open those materials during Phase A.", s["body"]),
        p("Reviewer Details", s["h2"]),
        table([
            ["Reviewer name", ""],
            ["Professional role and qualifications", ""],
            ["Institution or practice", ""],
            ["Review date", ""],
        ], [1.9 * inch, 4.65 * inch], s, header=False, row_heights=[0.42 * inch] * 4),
        Spacer(1, 8),
        p("Independent Review Declaration", s["h2"]),
        p("[ ] I did not view model predictions before completing Phase A", s["body"]),
        p("[ ] I used independent legal judgment and authoritative materials", s["body"]),
        p("[ ] I identified uncertainty instead of guessing missing facts", s["body"]),
        Spacer(1, 10),
        p("Signature: ____________________________________    Date: ____________________", s["body"]),
        p("What To Return", s["h2"]),
        p("Return this completed packet and the two completed JSONL forms supplied with it. The project coordinator will run the automated comparison only after both review phases are complete.", s["body"]),
        PageBreak(),
    ])


def add_instructions(story, s):
    story.extend([p("Review Procedure", s["h1"]), p("Phase A Independent Gold Labels", s["h2"])])
    steps = [
        "Read only the case facts in this packet. Treat omitted facts as unknown and do not infer them from a likely model answer.",
        "Consult authoritative legal materials and decide the applicable framework: IPC only, BNS primary, multi-period review, or clarification required.",
        "Record the single best provision and up to three acceptable retrieval targets. Include the Top-1 provision in the Top-3 list.",
        "Explain ambiguity, assumptions, missing facts, or alternate acceptable provisions in Comments and Corrections.",
        "Complete Phase A for all 10 cases, sign the declaration, and return or lock a dated copy before seeing any model output.",
    ]
    for index, step in enumerate(steps, 1):
        story.append(p(f"<b>{index}.</b> {step}", s["body"]))
    story.extend([
        p("Phase B Output Quality Review", s["h2"]),
        p("Phase B starts only after the Phase A answers have been preserved. The coordinator may then provide a separate case-matched output excerpt. The sealed prediction file itself is not part of this packet.", s["body"]),
        p("For each case, verify the cited document, page, section, and support for the generated statement. Rate each IRAC component from 0 to 2, assess grounding, and write a correction where needed.", s["body"]),
        p("Rating Definitions", s["h2"]),
        table([
            ["Area", "Rating", "Meaning"],
            ["Citation", "Correct / Partly correct / Incorrect", "Check document, page, provision, and claimed support."],
            ["IRAC", "0 / 1 / 2", "0 incorrect or unsupported; 1 partly correct or incomplete; 2 correct and sufficiently supported."],
            ["Grounding", "Grounded / Partly grounded / Ungrounded", "Check whether the answer remains within authoritative cited text."],
        ], [1.0 * inch, 1.95 * inch, 3.6 * inch], s),
        p("Authoritative Materials", s["h2"]),
        p("- The Indian Penal Code, 1860 - Ministry of Home Affairs, Government of India<br/>- The Bharatiya Nyaya Sanhita, 2023 - Gazette of India, Ministry of Law and Justice<br/>- BNS Commencement Notification S.O. 850(E) - Gazette of India, Ministry of Home Affairs<br/>- Comparative Chart of Commonly Used Sections of IPC vis-a-vis BNS - Bureau of Police Research and Development", s["body"]),
        p("Use the governing statute and commencement notification as primary authorities. A comparative chart may assist navigation but should not replace verification against the statutory text.", s["body"]),
        PageBreak(),
    ])


def add_case(story, s, case):
    phase_a = [
        p(f"Case {case['caseId']}", s["h1"]),
        p(f"<b>Case facts.</b> {case['facts']}", s["body"]),
        p("<b>Scope.</b> Base the answer only on these facts. Record legally material missing information instead of assuming it.", s["body"]),
        p("Phase A Independent Gold Label", s["h2"]),
        p("<b>Correct applicable law</b>", s["body"]),
        p("[ ] IPC only     [ ] BNS primary     [ ] Multi-period review     [ ] Clarification required", s["body"]),
        table([
            ["Decision field", "Expert response"],
            ["Correct Top-1 provision", "Code: __________   Section: __________<br/>Provision title or description: __________________________________________"],
            ["Material clarification needed", "________________________________________________________________<br/>________________________________________________________________"],
        ], [1.55 * inch, 5.0 * inch], s),
        Spacer(1, 4),
        p("<b>Acceptable Top-3 provisions</b>", s["body"]),
        table([
            ["Rank", "Code", "Section", "Why this is an acceptable retrieval target"],
            ["1", "", "", ""],
            ["2", "", "", ""],
            ["3", "", "", ""],
        ], [0.4 * inch, 0.65 * inch, 0.75 * inch, 4.75 * inch], s, row_heights=[None, 0.28 * inch, 0.28 * inch, 0.28 * inch]),
        Spacer(1, 4),
        p("<b>Comments and corrections</b>", s["body"]),
        table([["________________________________________________________________________________________<br/>________________________________________________________________________________________"]], [6.55 * inch], s, header=False),
        p("STOP HERE UNTIL PHASE A HAS BEEN RETURNED OR LOCKED", s["stop"]),
    ]
    phase_b = [
        p("Phase B Citation Grounding and IRAC Review", s["h2"]),
        table([
            ["Review area", "Expert decision"],
            ["Citation correctness", "[ ] Correct   [ ] Partly correct   [ ] Incorrect<br/>Correct citation or correction: _________________________________________"],
            ["Grounding", "[ ] Grounded   [ ] Partly grounded   [ ] Ungrounded"],
            ["Expert comments", "________________________________________________________________<br/>________________________________________________________________"],
        ], [1.4 * inch, 5.15 * inch], s),
        Spacer(1, 4),
        table([
            ["IRAC component", "Score", "Reason or correction"],
            ["Issue", "[ ] 0  [ ] 1  [ ] 2", ""],
            ["Rule", "[ ] 0  [ ] 1  [ ] 2", ""],
            ["Application", "[ ] 0  [ ] 1  [ ] 2", ""],
            ["Conclusion", "[ ] 0  [ ] 1  [ ] 2", ""],
        ], [1.15 * inch, 1.2 * inch, 4.2 * inch], s, row_heights=[None, 0.25 * inch, 0.25 * inch, 0.25 * inch, 0.25 * inch]),
    ]
    story.extend(phase_a)
    story.extend(phase_b)
    story.append(PageBreak())


def add_checklist(story, s, cases):
    story.extend([
        p("Return Checklist", s["h1"]),
        p("Confirm that every case has a Phase A applicable-law decision and provision assessment. Complete Phase B only after Phase A has been preserved and the coordinator has supplied case-matched output excerpts.", s["body"]),
    ])
    rows = [["Case", "Phase A complete", "Phase B complete", "Comments added if needed"]]
    rows.extend([[case["caseId"], "[ ]", "[ ]", "[ ]"] for case in cases])
    story.append(table(rows, [1.15 * inch, 1.65 * inch, 1.65 * inch, 2.1 * inch], s, row_heights=[None] + [0.28 * inch] * len(cases)))
    story.extend([
        p("Final Confirmation", s["h2"]),
        p("[ ] All Phase A labels were completed before prediction disclosure", s["body"]),
        p("[ ] All Phase B ratings reflect independent expert judgment", s["body"]),
        Spacer(1, 10),
        p("Reviewer signature: ______________________________    Date: ____________________", s["body"]),
    ])


def build():
    cases = load_cases()
    if len(cases) != 10 or len({case["caseId"] for case in cases}) != 10:
        raise ValueError("Expected exactly 10 unique blind cases.")
    PACKAGE.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=A4,
        rightMargin=0.62 * inch,
        leftMargin=0.62 * inch,
        topMargin=0.52 * inch,
        bottomMargin=0.5 * inch,
        title="IPC and BNS Blind Expert Review Packet",
        author="",
        subject="Independent legal labeling and model output quality review",
    )
    style_map = styles()
    story = []
    add_cover(story, style_map)
    add_instructions(story, style_map)
    for case in cases:
        add_case(story, style_map, case)
    add_checklist(story, style_map, cases)
    document.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    build()
