"""
Writes the demo files for the seeded class materials (D-067) into
server/src/Lms.Api/Demo/files. All content is original and fictional.

    python3 server/tools/demo-files/make_demo_files.py

Needs Pillow, python-pptx, python-docx and openpyxl. The Office files' PDF copies
(*.preview.pdf) are made by LibreOffice, as the API makes them for an upload:

    soffice --headless --convert-to pdf --outdir <dir> <file>
    (then rename <name>.pdf to <name>.preview.pdf)

Without LibreOffice installed, a container works too; see Demo/files/README.md.
"""
from __future__ import annotations

import os
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[2] / "src" / "Lms.Api" / "Demo" / "files"
GREEN = (22, 101, 52)
INK = (28, 33, 31)
MUTED = (88, 98, 93)
LINE = (214, 222, 217)
SOFT = (236, 245, 239)


# --------------------------------------------------------------------------- PDF

def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def write_pdf(path: Path, title: str, pages: list[list[tuple[str, str]]]) -> None:
    """A small text PDF. Each page is a list of (style, text): h1, h2, p, li, code."""
    styles = {"h1": ("F2", 20, 30), "h2": ("F2", 14, 24), "p": ("F1", 11, 16), "li": ("F1", 11, 16), "code": ("F3", 10, 14)}
    widths = {"F1": 92, "F2": 70, "F3": 86}
    contents = []
    for number, blocks in enumerate(pages, start=1):
        y = 770
        ops = []
        for style, text in blocks:
            font, size, lead = styles[style]
            width = widths[font] if style != "h1" else 46
            lines = textwrap.wrap(text, width=width if style != "li" else width - 4) or [""]
            if style in ("h1", "h2") and y < 770:
                y -= 8
            for index, line in enumerate(lines):
                x = 72
                if style == "li":
                    x = 90
                    if index == 0:
                        ops.append(f"0.11 0.13 0.12 rg BT /F1 {size} Tf 76 {y} Td (-) Tj ET")
                color = "0.086 0.396 0.204 rg" if style in ("h1", "h2") else "0.11 0.13 0.12 rg"
                ops.append(f"{color} BT /{font} {size} Tf {x} {y} Td ({_escape(line)}) Tj ET")
                y -= lead
            y -= 6 if style in ("p", "code") else 2
        ops.append(f"0.35 0.38 0.36 rg BT /F1 9 Tf 72 40 Td ({_escape(f'{title} - page {number} of {len(pages)}')}) Tj ET")
        contents.append("\n".join(ops).encode("latin-1"))

    objects: list[bytes] = []
    def add(body: bytes) -> int:
        objects.append(body)
        return len(objects)

    catalog = add(b"")
    pages_id = add(b"")
    f1 = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    f2 = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
    f3 = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>")
    kids = []
    for stream in contents:
        content = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        kids.append(add(f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 612 792] /Contents {content} 0 R "
                        f"/Resources << /Font << /F1 {f1} 0 R /F2 {f2} 0 R /F3 {f3} 0 R >> >> >>".encode()))
    info = add(f"<< /Title ({_escape(title)}) /Producer (TMCC LMS demo files) >>".encode("latin-1"))
    objects[catalog - 1] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode()
    objects[pages_id - 1] = f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {len(kids)} >>".encode()

    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets)
    out += f"trailer\n<< /Size {len(objects) + 1} /Root {catalog} 0 R /Info {info} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    path.write_bytes(bytes(out))


def programming_logic() -> None:
    write_pdf(OUT / "programming-logic-and-pseudocode.pdf", "Programming Logic and Pseudocode", [
        [
            ("h1", "Programming Logic and Pseudocode"),
            ("p", "IT101 Introduction to Programming - Study guide, Module 1"),
            ("h2", "What an algorithm is"),
            ("p", "An algorithm is a finite list of clear steps that turns an input into an output. Before writing code, "
                  "describe the steps in plain words so you can check the logic without worrying about syntax."),
            ("h2", "Writing pseudocode"),
            ("li", "Write one action per line, in the order it happens."),
            ("li", "Use capital keywords for structure: INPUT, OUTPUT, IF, ELSE, WHILE, FOR, END."),
            ("li", "Indent the steps that belong to a decision or a loop."),
            ("li", "Name values the way you would name variables: total, count, average."),
            ("h2", "Example: the average of three scores"),
            ("code", "INPUT score1, score2, score3"),
            ("code", "SET total TO score1 + score2 + score3"),
            ("code", "SET average TO total / 3"),
            ("code", "OUTPUT average"),
        ],
        [
            ("h2", "Decisions"),
            ("p", "A decision chooses between paths. Each path ends before the next step of the algorithm starts."),
            ("code", "IF average >= 75 THEN"),
            ("code", "    OUTPUT \"Passed\""),
            ("code", "ELSE"),
            ("code", "    OUTPUT \"Needs review\""),
            ("code", "END IF"),
            ("h2", "Loops"),
            ("p", "A loop repeats steps while a condition holds. Always check that something inside the loop moves it "
                  "toward the end, or it will never stop."),
            ("code", "SET count TO 1"),
            ("code", "WHILE count <= 5"),
            ("code", "    OUTPUT count"),
            ("code", "    SET count TO count + 1"),
            ("code", "END WHILE"),
            ("h2", "Check your understanding"),
            ("li", "Write pseudocode that reads a number and says whether it is even or odd."),
            ("li", "Change the loop above so it counts down from 10 to 1."),
            ("li", "Trace the average example with the scores 80, 72 and 91."),
        ],
    ])


def css_lab() -> None:
    write_pdf(OUT / "responsive-css-layout-lab.pdf", "Responsive CSS Layout Lab", [
        [
            ("h1", "Responsive CSS Layout Lab"),
            ("p", "IT212 Web Application Development - Practice set"),
            ("h2", "Goal"),
            ("p", "Build one page that reads well on a 320 px phone and a 1280 px laptop, using grid, flexbox and one breakpoint."),
            ("h2", "Part 1: flexbox"),
            ("li", "Lay out a header with the site name on the left and three links on the right."),
            ("li", "Let the links wrap below the name when the screen is narrow."),
            ("code", ".site-header { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; }"),
            ("h2", "Part 2: grid"),
            ("li", "Show six cards: one column on phones, three columns on wide screens."),
            ("code", ".cards { display: grid; gap: 1rem; grid-template-columns: 1fr; }"),
            ("code", "@media (min-width: 48rem) { .cards { grid-template-columns: repeat(3, 1fr); } }"),
            ("h2", "Part 3: check it"),
            ("li", "Nothing scrolls sideways at 320 px."),
            ("li", "Text stays at least 16 px, and links are easy to tap."),
            ("li", "Write two sentences on what changed between the two widths and why."),
        ],
    ])


def networking() -> None:
    write_pdf(OUT / "networking-models-overview.pdf", "Networking Models Overview", [
        [
            ("h1", "Networking Models Overview"),
            ("p", "IT230 Computer Networking - Study guide"),
            ("h2", "Why models"),
            ("p", "A model splits the job of moving data into layers. Each layer offers a service to the one above it, "
                  "so a change in one layer does not break the others."),
            ("h2", "The OSI model, top to bottom"),
            ("li", "7 Application - what the user's program asks for, such as a web page."),
            ("li", "6 Presentation - formats and encryption."),
            ("li", "5 Session - starting and ending a conversation."),
            ("li", "4 Transport - reliable delivery (TCP) or quick delivery (UDP)."),
            ("li", "3 Network - addresses and routes (IP)."),
            ("li", "2 Data link - frames on one link (Ethernet, Wi-Fi)."),
            ("li", "1 Physical - signals on cables and radio."),
            ("h2", "The TCP/IP model"),
            ("p", "TCP/IP uses four layers: Application, Transport, Internet and Link. It is the model the internet "
                  "actually runs on; OSI is the common vocabulary for describing it."),
        ],
        [
            ("h2", "Following one request"),
            ("p", "When a browser loads a page, the request is wrapped by each layer on the way down and unwrapped on "
                  "the way up at the server. This wrapping is called encapsulation."),
            ("h2", "Review questions"),
            ("li", "Which layer decides the route a packet takes?"),
            ("li", "Name one protocol at the transport layer and say when you would choose it."),
            ("li", "Match each TCP/IP layer to the OSI layers it covers."),
        ],
    ])


def ipv4() -> None:
    write_pdf(OUT / "ipv4-addressing-practice.pdf", "IPv4 Addressing Practice", [
        [
            ("h1", "IPv4 Addressing Practice"),
            ("p", "IT230 Computer Networking - Practice set"),
            ("h2", "Reminder"),
            ("p", "An IPv4 address has 32 bits, written as four numbers from 0 to 255. The prefix length (/24, /26) says "
                  "how many of the first bits name the network; the rest name a host on it."),
            ("h2", "Exercises"),
            ("li", "192.168.10.37/24 - write the network address and the broadcast address."),
            ("li", "10.4.0.129/25 - how many usable host addresses does this network have?"),
            ("li", "172.16.5.200/26 - which addresses are the first and last usable hosts?"),
            ("li", "Split 192.168.50.0/24 into four equal subnets and list each network address."),
            ("h2", "Show your work"),
            ("p", "Write each address in binary before you answer, and mark where the network part ends."),
        ],
    ])


# --------------------------------------------------------------------------- PNG

def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    for name in (["Arial Bold.ttf", "DejaVuSans-Bold.ttf"] if bold else ["Arial.ttf", "DejaVuSans.ttf"]):
        for folder in ("/System/Library/Fonts/Supplemental", "/usr/share/fonts/truetype/dejavu", "/Library/Fonts"):
            if os.path.exists(os.path.join(folder, name)):
                return ImageFont.truetype(os.path.join(folder, name), size)
    return ImageFont.load_default(size=size)


def variables_sheet() -> None:
    width, height = 1400, 900
    image = Image.new("RGB", (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(image)
    draw.text((70, 60), "Variables and Data Types", font=_font(48, bold=True), fill=GREEN)
    draw.text((70, 128), "IT101 Introduction to Programming - Reference sheet", font=_font(26), fill=MUTED)
    columns = [(70, "Type"), (330, "Holds"), (800, "Example")]
    rows = [
        ("int", "Whole numbers", "count = 12"),
        ("float", "Numbers with decimals", "price = 49.95"),
        ("str", "Text", "name = \"Ana\""),
        ("bool", "True or False", "passed = True"),
        ("list", "An ordered group of values", "scores = [80, 72, 91]"),
        ("dict", "Values looked up by a key", "ages = {\"Ana\": 19}"),
    ]
    top = 210
    draw.rectangle((60, top, width - 60, top + 70), fill=SOFT)
    for x, label in columns:
        draw.text((x + 10, top + 18), label, font=_font(30, bold=True), fill=INK)
    for index, row in enumerate(rows):
        y = top + 70 + index * 90
        draw.line((60, y, width - 60, y), fill=LINE, width=2)
        for (x, _), value in zip(columns, row):
            draw.text((x + 10, y + 26), value, font=_font(30, bold=(x == 70)), fill=INK)
    draw.line((60, top + 70 + len(rows) * 90, width - 60, top + 70 + len(rows) * 90), fill=LINE, width=2)
    draw.text((70, height - 70), "A variable is a name for a value. Its type decides what you can do with it.", font=_font(26), fill=MUTED)
    image.save(OUT / "variables-and-data-types.png", optimize=True)


# --------------------------------------------------------------------------- TXT

def control_flow() -> None:
    (OUT / "control-flow-practice.txt").write_text(textwrap.dedent("""\
        Control Flow Practice
        IT101 Introduction to Programming - Practice set

        Trace each program by hand. Write the value of every variable after each line,
        then write what the program prints.

        1. Decisions
           score = 68
           if score >= 75:
               print("Passed")
           elif score >= 60:
               print("Almost there")
           else:
               print("Needs review")

        2. A counting loop
           total = 0
           for n in range(1, 6):
               total = total + n
           print(total)

        3. A loop that stops early
           numbers = [4, 9, 15, 2, 21]
           for n in numbers:
               if n > 10:
                   print("First over 10:", n)
                   break

        4. Your turn
           Write a loop that prints the even numbers from 2 to 20.
           Then change it so it prints them from 20 down to 2.

        Bring your traces to the next lab session.
        """), encoding="utf-8")


# --------------------------------------------------------------------------- Office

def database_deck() -> None:
    from pptx import Presentation
    from pptx.util import Pt

    deck = Presentation()
    title = deck.slides.add_slide(deck.slide_layouts[0])
    title.shapes.title.text = "Relational Database Design"
    title.placeholders[1].text = "IT204 Database Management Systems - Study guide"
    slides = [
        ("Entities and attributes", ["An entity is a thing we keep data about: Student, Course, Enrollment.",
                                     "Attributes describe it: a Student has an id, a name, and a program.",
                                     "Each entity becomes a table; each attribute becomes a column."]),
        ("Keys", ["A primary key identifies one row: student_id.",
                  "A foreign key points at a row in another table: enrollment.student_id.",
                  "Choose keys that never change and are never empty."]),
        ("Relationships", ["One to many: one Course has many Enrollments.",
                           "Many to many: Students and Courses, joined by Enrollment.",
                           "Draw them in an ER diagram before creating tables."]),
        ("Normal forms", ["1NF: one value per cell, no repeating groups.",
                          "2NF: every column depends on the whole key.",
                          "3NF: no column depends on another non-key column."]),
        ("Practice", ["Draw an ER diagram for a small library: Book, Member, Loan.",
                      "Mark the primary and foreign keys.",
                      "Check your tables against 3NF."]),
    ]
    for heading, points in slides:
        slide = deck.slides.add_slide(deck.slide_layouts[1])
        slide.shapes.title.text = heading
        body = slide.placeholders[1].text_frame
        body.text = points[0]
        for point in points[1:]:
            body.add_paragraph().text = point
        for paragraph in body.paragraphs:
            for run in paragraph.runs:
                run.font.size = Pt(24)
    deck.save(OUT / "relational-database-design.pptx")


def sql_workbook() -> None:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    book = Workbook()
    sheet = book.active
    sheet.title = "Customers"
    rows = [
        ("customer_id", "name", "city", "joined"),
        (1, "Mara Santos", "Tacloban", "2026-01-14"),
        (2, "Jun Dela Cruz", "Ormoc", "2026-02-03"),
        (3, "Lea Bautista", "Tacloban", "2026-02-21"),
        (4, "Rico Villanueva", "Palo", "2026-03-09"),
        (5, "Ivy Ramos", "Ormoc", "2026-04-17"),
    ]
    for row in rows:
        sheet.append(row)
    orders = book.create_sheet("Orders")
    for row in [("order_id", "customer_id", "total"), (101, 1, 1250), (102, 3, 480), (103, 1, 2300), (104, 5, 760), (105, 2, 150)]:
        orders.append(row)
    exercises = book.create_sheet("Exercises")
    for row in [
        ("#", "Write a query that..."),
        (1, "lists every customer from Tacloban."),
        (2, "counts customers per city, largest first."),
        (3, "shows each order with the customer's name (JOIN)."),
        (4, "gives the total spent per customer, including those with no orders."),
    ]:
        exercises.append(row)
    for ws in (sheet, orders, exercises):
        for cell in ws[1]:
            cell.font = Font(bold=True)
            cell.fill = PatternFill("solid", fgColor="E6F2EA")
        for column in ws.columns:
            ws.column_dimensions[column[0].column_letter].width = max(12, max(len(str(c.value)) for c in column) + 2)
    book.save(OUT / "sql-query-workbook.xlsx")


def html_reference() -> None:
    from docx import Document

    doc = Document()
    doc.add_heading("Semantic HTML Reference", level=0)
    doc.add_paragraph("IT212 Web Application Development - Study guide")
    doc.add_heading("Why it matters", level=1)
    doc.add_paragraph("Semantic elements say what content is, not how it looks. Screen readers, search engines and "
                      "other developers all rely on that meaning.")
    doc.add_heading("Elements to reach for", level=1)
    table = doc.add_table(rows=1, cols=2)
    table.style = "Light Grid Accent 1"
    table.rows[0].cells[0].text = "Element"
    table.rows[0].cells[1].text = "Use it for"
    for element, use in [
        ("<header>", "The introduction of a page or section"),
        ("<nav>", "A group of main links"),
        ("<main>", "The one main content area of the page"),
        ("<article>", "Content that stands on its own, like a post"),
        ("<section>", "A themed group of content with a heading"),
        ("<footer>", "Closing information for a page or section"),
        ("<button>", "Anything the user clicks to do something"),
    ]:
        cells = table.add_row().cells
        cells[0].text = element
        cells[1].text = use
    doc.add_heading("Quick checks", level=1)
    for item in ["There is exactly one <main> on the page.",
                 "Headings go in order: h1, then h2, then h3.",
                 "Every image has alt text that says what it shows.",
                 "Links go somewhere; buttons do something."]:
        doc.add_paragraph(item, style="List Bullet")
    doc.save(OUT / "semantic-html-reference.docx")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    programming_logic()
    css_lab()
    networking()
    ipv4()
    variables_sheet()
    control_flow()
    database_deck()
    sql_workbook()
    html_reference()
    for path in sorted(OUT.iterdir()):
        print(f"{path.stat().st_size:>8}  {path.name}")


if __name__ == "__main__":
    main()
