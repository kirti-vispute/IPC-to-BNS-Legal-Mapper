import json
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "evaluation" / "expert-review-package"
CASES_PATH = ROOT / "evaluation" / "cases" / "candidate-cases.jsonl"
OUTPUT_PATH = PACKAGE / "IPC_BNS_Blind_Expert_Review_Packet.docx"

NAVY = "17365D"
PALE_BLUE = "EAF1F8"
PALE_GRAY = "F4F5F7"
BORDER = "D9D9D9"


def load_cases():
    return [json.loads(line) for line in CASES_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shading = tc_pr.find(qn("w:shd"))
    if shading is None:
        shading = OxmlElement("w:shd")
        tc_pr.append(shading)
    shading.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=90, start=110, bottom=90, end=110):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for edge, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{edge}"))
        if node is None:
            node = OxmlElement(f"w:{edge}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = borders.find(qn(f"w:{edge}"))
        if element is None:
            element = OxmlElement(f"w:{edge}")
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "6")
        element.set(qn("w:color"), BORDER)


def style_table(table, widths=None, header=True, font_size=8.5):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    for row_index, row in enumerate(table.rows):
        for column_index, cell in enumerate(row.cells):
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cell)
            if widths:
                cell.width = widths[column_index]
            if header and row_index == 0:
                set_cell_shading(cell, NAVY)
            elif row_index % 2 == 0:
                set_cell_shading(cell, PALE_GRAY)
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_after = Pt(0)
                paragraph.paragraph_format.space_before = Pt(0)
                for run in paragraph.runs:
                    run.font.name = "Arial"
                    run.font.size = Pt(font_size)
                    if header and row_index == 0:
                        run.font.bold = True
                        run.font.color.rgb = RGBColor(255, 255, 255)


def add_heading(document, text, level=1):
    paragraph = document.add_paragraph(style=f"Heading {level}")
    paragraph.add_run(text)
    return paragraph


def add_body(document, text, bold_lead=None):
    paragraph = document.add_paragraph()
    if bold_lead:
        paragraph.add_run(bold_lead).bold = True
    paragraph.add_run(text)
    return paragraph


def add_blank_lines(cell, count=2):
    cell.text = "\n".join("________________________________________________________________" for _ in range(count))


def add_checkbox_line(document, options):
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(3)
    paragraph.add_run("   ".join(f"[ ] {option}" for option in options))
    return paragraph


def keep_with_next(paragraph):
    paragraph.paragraph_format.keep_with_next = True


def configure_styles(document):
    styles = document.styles
    normal = styles["Normal"]
    normal.font.name = "Arial"
    normal.font.size = Pt(9.5)
    normal.font.color.rgb = RGBColor(24, 24, 24)
    normal.paragraph_format.space_after = Pt(5)
    normal.paragraph_format.line_spacing = 1.08

    title = styles["Title"]
    title.font.name = "Arial"
    title.font.size = Pt(25)
    title.font.bold = True
    title.font.color.rgb = RGBColor(0, 0, 0)
    title.paragraph_format.space_after = Pt(12)

    for style_name, size in (("Heading 1", 16), ("Heading 2", 12), ("Heading 3", 10)):
        style = styles[style_name]
        style.font.name = "Arial"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0, 0, 0)
        style.paragraph_format.space_before = Pt(7)
        style.paragraph_format.space_after = Pt(4)
        style.paragraph_format.keep_with_next = True


def add_header_footer(section):
    header = section.header.paragraphs[0]
    header.text = "IPC and BNS Blind Expert Review"
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    header.runs[0].font.name = "Arial"
    header.runs[0].font.size = Pt(8)
    header.runs[0].font.color.rgb = RGBColor(85, 85, 85)

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = footer.add_run("Confidential evaluation material  |  Case labels must be completed independently")
    run.font.name = "Arial"
    run.font.size = Pt(7.5)
    run.font.color.rgb = RGBColor(85, 85, 85)


def add_cover(document):
    title = document.add_paragraph(style="Title")
    title.add_run("IPC and BNS Blind Expert Review Packet")
    subtitle = document.add_paragraph()
    subtitle.add_run("Independent legal labeling and quality review for 10 evaluation cases").bold = True
    subtitle.paragraph_format.space_after = Pt(16)

    add_body(
        document,
        "This packet asks a qualified lawyer or law professor to establish independent reference answers before any model output is disclosed. It then provides a separate rubric for reviewing citations, grounding, and IRAC quality after the gold labels have been locked.",
    )
    add_body(
        document,
        "No model prediction, retrieved provision, citation, or generated IRAC text appears in this packet. Do not request or open those materials during Phase A.",
        bold_lead="Blind-review rule. ",
    )

    add_heading(document, "Reviewer Details", 2)
    table = document.add_table(rows=4, cols=2)
    labels = ["Reviewer name", "Professional role and qualifications", "Institution or practice", "Review date"]
    for index, label in enumerate(labels):
        table.cell(index, 0).text = label
        table.cell(index, 1).text = ""
    style_table(table, [Inches(2.0), Inches(4.75)], header=False, font_size=9)

    add_heading(document, "Independent Review Declaration", 2)
    add_checkbox_line(document, ["I did not view model predictions before completing Phase A"])
    add_checkbox_line(document, ["I used independent legal judgment and authoritative materials"])
    add_checkbox_line(document, ["I identified uncertainty instead of guessing missing facts"])
    add_body(document, "Signature: ____________________________________    Date: ____________________")

    add_heading(document, "What To Return", 2)
    add_body(document, "Return this completed packet and the two completed JSONL forms supplied with it. The project coordinator will run the automated comparison only after both review phases are complete.")
    document.add_page_break()


def add_instructions(document):
    add_heading(document, "Review Procedure", 1)
    add_heading(document, "Phase A Independent Gold Labels", 2)
    steps = [
        "Read only the case facts in this packet. Treat omitted facts as unknown and do not infer them from a likely model answer.",
        "Consult authoritative legal materials and decide the applicable framework: IPC only, BNS primary, multi-period review, or clarification required.",
        "Record the single best provision and up to three acceptable retrieval targets. Include the Top-1 provision in the Top-3 list.",
        "Explain ambiguity, assumptions, missing facts, or alternate acceptable provisions in Comments and Corrections.",
        "Complete Phase A for all 10 cases, sign the declaration, and return or lock a dated copy before seeing any model output.",
    ]
    for index, step in enumerate(steps, 1):
        add_body(document, step, bold_lead=f"{index}. ")

    add_heading(document, "Phase B Output Quality Review", 2)
    add_body(document, "Phase B starts only after the Phase A answers have been preserved. The coordinator may then provide a separate case-matched output excerpt. The sealed prediction file itself is not part of this packet.")
    add_body(document, "For each case, verify the cited document, page, section, and support for the generated statement. Rate each IRAC component from 0 to 2, assess grounding, and write a correction where needed.")

    add_heading(document, "Rating Definitions", 2)
    table = document.add_table(rows=4, cols=3)
    rows = [
        ("Area", "Rating", "Meaning"),
        ("Citation", "Correct / Partly correct / Incorrect", "Document, page, provision, and claimed support are checked."),
        ("IRAC", "0 / 1 / 2", "0 incorrect or unsupported; 1 partly correct or incomplete; 2 correct and sufficiently supported."),
        ("Grounding", "Grounded / Partly grounded / Ungrounded", "Measures whether the answer stays within and is supported by authoritative cited text."),
    ]
    for row_index, values in enumerate(rows):
        for column_index, value in enumerate(values):
            table.cell(row_index, column_index).text = value
    style_table(table, [Inches(1.15), Inches(2.05), Inches(3.55)], font_size=8.5)

    add_heading(document, "Authoritative Materials", 2)
    sources = [
        "The Indian Penal Code, 1860 - Ministry of Home Affairs, Government of India",
        "The Bharatiya Nyaya Sanhita, 2023 - Gazette of India, Ministry of Law and Justice",
        "BNS Commencement Notification S.O. 850(E) - Gazette of India, Ministry of Home Affairs",
        "Comparative Chart of Commonly Used Sections of IPC vis-a-vis BNS - Bureau of Police Research and Development",
    ]
    for source in sources:
        paragraph = document.add_paragraph(style="List Bullet")
        paragraph.add_run(source)
    add_body(document, "Use the governing statute and commencement notification as primary authorities. A comparative chart may assist navigation but should not replace verification against the statutory text.")
    document.add_page_break()


def add_case_page(document, case):
    heading = add_heading(document, f"Case {case['caseId']}", 1)
    keep_with_next(heading)
    add_body(document, case["facts"], bold_lead="Case facts. ")
    add_body(document, "Base the answer only on these facts. Record any legally material missing information instead of assuming it.", bold_lead="Scope. ")

    add_heading(document, "Phase A Independent Gold Label", 2)
    add_body(document, "Correct applicable law")
    add_checkbox_line(document, ["IPC only", "BNS primary", "Multi-period review", "Clarification required"])

    table = document.add_table(rows=3, cols=2)
    table.cell(0, 0).text = "Decision field"
    table.cell(0, 1).text = "Expert response"
    table.cell(1, 0).text = "Correct Top-1 provision"
    table.cell(1, 1).text = "Code: __________   Section: __________\nProvision title or description: __________________________________________"
    table.cell(2, 0).text = "Material clarification needed"
    add_blank_lines(table.cell(2, 1), 2)
    style_table(table, [Inches(1.75), Inches(5.0)], font_size=8.5)

    add_body(document, "Acceptable Top-3 provisions")
    top3 = document.add_table(rows=4, cols=4)
    headers = ["Rank", "Code", "Section", "Why this is an acceptable retrieval target"]
    for index, header in enumerate(headers):
        top3.cell(0, index).text = header
    for row in range(1, 4):
        top3.cell(row, 0).text = str(row)
        top3.cell(row, 1).text = ""
        top3.cell(row, 2).text = ""
        top3.cell(row, 3).text = ""
    style_table(top3, [Inches(0.45), Inches(0.7), Inches(0.8), Inches(4.8)], font_size=8)

    add_body(document, "Comments and corrections")
    comments = document.add_table(rows=1, cols=1)
    add_blank_lines(comments.cell(0, 0), 2)
    style_table(comments, [Inches(6.75)], header=False, font_size=8.5)

    stop = document.add_paragraph()
    stop.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = stop.add_run("STOP HERE UNTIL PHASE A HAS BEEN RETURNED OR LOCKED")
    run.bold = True
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(142, 48, 48)

    add_heading(document, "Phase B Citation Grounding and IRAC Review", 2)
    phase_b = document.add_table(rows=4, cols=2)
    phase_b.cell(0, 0).text = "Review area"
    phase_b.cell(0, 1).text = "Expert decision"
    phase_b.cell(1, 0).text = "Citation correctness"
    phase_b.cell(1, 1).text = "[ ] Correct   [ ] Partly correct   [ ] Incorrect\nCorrect citation or correction: _________________________________________"
    phase_b.cell(2, 0).text = "Grounding"
    phase_b.cell(2, 1).text = "[ ] Grounded   [ ] Partly grounded   [ ] Ungrounded"
    phase_b.cell(3, 0).text = "Expert comments"
    phase_b.cell(3, 1).text = "________________________________________________________________\n________________________________________________________________"
    style_table(phase_b, [Inches(1.55), Inches(5.2)], font_size=8)

    irac = document.add_table(rows=5, cols=3)
    values = [
        ("IRAC component", "Score", "Reason or correction"),
        ("Issue", "[ ] 0  [ ] 1  [ ] 2", ""),
        ("Rule", "[ ] 0  [ ] 1  [ ] 2", ""),
        ("Application", "[ ] 0  [ ] 1  [ ] 2", ""),
        ("Conclusion", "[ ] 0  [ ] 1  [ ] 2", ""),
    ]
    for row_index, row_values in enumerate(values):
        for column_index, value in enumerate(row_values):
            irac.cell(row_index, column_index).text = value
    style_table(irac, [Inches(1.25), Inches(1.25), Inches(4.25)], font_size=8)
    document.add_page_break()


def add_return_checklist(document, cases):
    add_heading(document, "Return Checklist", 1)
    add_body(document, "Before returning the review, confirm that each case has a Phase A applicable-law decision and provision assessment. Complete Phase B only after Phase A has been preserved and the coordinator has supplied case-matched output excerpts.")
    table = document.add_table(rows=len(cases) + 1, cols=4)
    headers = ["Case", "Phase A complete", "Phase B complete", "Comments added if needed"]
    for column, header in enumerate(headers):
        table.cell(0, column).text = header
    for row, case in enumerate(cases, 1):
        table.cell(row, 0).text = case["caseId"]
        table.cell(row, 1).text = "[ ]"
        table.cell(row, 2).text = "[ ]"
        table.cell(row, 3).text = "[ ]"
    style_table(table, [Inches(1.2), Inches(1.7), Inches(1.7), Inches(2.15)], font_size=8.5)
    add_heading(document, "Final Confirmation", 2)
    add_checkbox_line(document, ["All Phase A labels were completed before prediction disclosure"])
    add_checkbox_line(document, ["All Phase B ratings reflect independent expert judgment"])
    add_body(document, "Reviewer signature: ______________________________    Date: ____________________")


def build():
    cases = load_cases()
    if len(cases) != 10 or len({case["caseId"] for case in cases}) != 10:
        raise ValueError("Expected exactly 10 unique blind cases.")

    PACKAGE.mkdir(parents=True, exist_ok=True)
    document = Document()
    section = document.sections[0]
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)
    section.top_margin = Inches(0.58)
    section.bottom_margin = Inches(0.58)
    section.left_margin = Inches(0.7)
    section.right_margin = Inches(0.7)
    section.header_distance = Inches(0.25)
    section.footer_distance = Inches(0.25)
    configure_styles(document)
    add_header_footer(section)

    document.core_properties.title = "IPC and BNS Blind Expert Review Packet"
    document.core_properties.subject = "Independent legal labeling and model output quality review"
    document.core_properties.author = ""
    document.core_properties.last_modified_by = ""
    document.core_properties.keywords = "IPC, BNS, blind evaluation, expert review"

    add_cover(document)
    add_instructions(document)
    for case in cases:
        add_case_page(document, case)
    add_return_checklist(document, cases)

    # Remove the trailing page break left after the final case page.
    final_case_break = document.paragraphs[-8]
    if final_case_break.text == "":
        pass
    document.save(OUTPUT_PATH)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    build()
