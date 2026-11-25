# Class materials plan: real files, previews, and a clearer student view

A material is a learning guide the instructor shares with the class: a file, with a title and a
description, that students come back to whenever they need it (like a Google Classroom material).
Instructors upload the real file. Students and instructors see the same preview of it inside the
LMS, on a phone or a computer. A student's Materials tab is grouped by module, and each material
page shows everything about the file. Decision: D-067 in
[`ui-memory/DECISIONS.md`](ui-memory/DECISIONS.md). Approved 2026-11-25; the offline plan, not yet
approved, moves to D-068.

## Where materials are today (2026-11-25)

| Area | Today |
|---|---|
| Upload | The form takes a file, but only its name, type, and size are saved. No bytes reach the server ("The demo keeps the file name and size only") |
| Server | `materials` has `FileName`, `FileType`, `FileSize` text columns. Real files exist only for assignment turn-ins (`stored_files`, D-055) |
| Instructor download | Makes a text file named like the upload, holding the title and description |
| Instructor card | Shows "1.8 MB" and "0 downloads" when nothing is known; neither is real |
| Student list | A flat grid of every material in the class: title, description, type, "x min read", date. No module, file type, or size |
| Student page | Title, description, then the same description again as "Learning goal". "Key ideas" is always empty. The file is never mentioned and can't be opened |
| Read time | Worked out from the description's length, so a 40-slide deck reads as "1 min read" |
| Mark as reviewed | A button on the material page, forgotten on reload and never seen by the instructor |
| Demo | The 9 seeded materials have no files |

## What people get

**Instructors**
1. Upload the actual file when adding a material, with a progress bar. It is checked and
   virus-scanned like student uploads.
2. Replace or remove a material's file later.
3. Open any material to see exactly what students see, preview included.
4. See the real file type and size on each card.

**Students**
1. **Materials tab grouped by module**, then submodule, in the instructor's order, with how many
   materials each holds.
2. **Each material in the list** shows its resource type, file type, size, and the date added.
3. **Search and filter** by resource type (Study guide, Lecture Slides, and so on), and sort by
   module or newest.
4. **The material page** shows a preview of the file, a Download button, the description, and
   the details: module, added by and when, file name, type, size, and page count for PDFs.
5. **Previous and next** links move through the class's materials in module order, so students
   don't go back to the list each time.

**Removed:** "x min read" (the list and the page), "Mark as reviewed", the repeated "Learning
goal", and the empty "Key ideas".

## The two pages

Student material page, wide screen:

```
‹ Back to Programming 1
Programming 1 › Module 2: Control flow › Loops
Loops and iteration                                   [Study guide]
Added 20 Nov by Ms. Reyes

┌──────────────────────────────────────────┐  About
│                                          │  How for and while loops repeat a
│            PDF preview                   │  block, and when to use each.
│      (pages scroll, fit to width)        │
│                                          │  File
│                                          │  loops-guide.pdf
│                                [⤢ Full]  │  PDF · 2.4 MB · 12 pages
└──────────────────────────────────────────┘  [Download]

‹ Previous: Conditions        Next: Arrays ›
```

On a phone the same page stacks: title, preview (tap for full screen), Download, About, then File
details. Nothing scrolls sideways at 320 px. The preview takes the width; the About text keeps the
reading line length (D-025).

Student Materials tab:

```
Class materials        9 materials          [Search…] [All types ▾] [By module ▾]

Module 1: Introduction                                                  3
  [PDF]  Programming logic and pseudocode   Study guide · PDF · 1.2 MB · 12 Nov
  [IMG]  Flowchart symbols                  Reference sheet · PNG · 340 KB · 12 Nov
Module 2: Control flow                                                  4
  Loops (submodule)
  [PDF]  Loops and iteration                Study guide · PDF · 2.4 MB · 20 Nov
  [PPT]  Lecture 4 slides                   Lecture Slides · PPTX · 6.1 MB · 21 Nov
```

## What can be previewed

| File | Preview | How |
|---|---|---|
| PDF | Yes | The browser's own PDF viewer where it has one (computers, iPhones). Where it doesn't (most Android phones), a PDF viewer loads the first time (decision 2) |
| JPG, PNG | Yes | Shown fitted to the width; tap for full screen |
| TXT | Yes | Shown as text; the first 200 KB, with "Download for the rest" past that |
| Word, PowerPoint, Excel | Yes (decision 1) | The server turns the file into a PDF once, after the upload, and the preview shows that PDF in the same viewer. Download still gives the original file. Until it is ready the page says "Preparing the preview…" |
| Office file whose preview could not be made | No | A file card with type, size, and Download, and "A preview isn't available for this file". Instructors are told to replace it or upload a PDF |
| Old material with a name only | No | Students see "No file attached". Instructors see "Upload the file" |

Previews of files over 5 MB, or with the phone's data saver on, wait for "Load preview (12.4 MB)"
(decision 4). Offline, the preview says it needs a connection; the rest of the page still shows.

## How it works

- **Files are stored the way turn-ins are.** The same file store, byte check (`FileSniffer`),
  virus scan, 25 MB limit, and cleaned file names (D-055). `stored_files` gets a nullable
  `CourseworkId`, and `materials` gets a nullable `FileId`. The old name and size columns stay for
  materials made before this, so nothing is lost.
- **A material and its file are saved together.** Adding a material with a file is one upload
  request carrying the fields and the file. If the upload or scan fails, nothing is saved and the
  form keeps what the instructor typed. Replacing a file deletes the old bytes only after the
  database change commits. Deleting a material deletes its file.
- **Who can open the file.** The material's own download route checks the class: its instructor
  always, and a student on the class list only while the material is active. Anyone else gets the
  same 404 as for a missing file, so ids can't be probed. `/api/files/{id}` stays as it is for
  turn-ins.
- **The browser never runs the file.** The server still sends files as downloads only
  (`nosniff`, `sandbox`). The page fetches the bytes with the viewer's headers (L-075) and shows
  them itself: an image tag, text, or a PDF viewer. The response carries the file's hash as an
  `ETag`, so opening a material again costs a quick check, not the whole file.
- **Office files get a PDF copy for the preview** (decision 1). A background worker on the server
  runs LibreOffice (`soffice --headless --convert-to pdf`) on each new Word, PowerPoint, or Excel
  material, one file at a time. Each run gets its own throwaway profile and folder, has 60 seconds,
  and is stopped after that. The result must pass the same PDF byte check before it is kept as the
  material's preview file. A material is saved and downloadable straight away; its preview is
  `pending`, then `ready` or `failed`. Pending work survives a restart. Macros and remote templates
  are already refused at upload. Where LibreOffice isn't installed (`Lms:Files:Converter = none`),
  Office files show the download card and the server logs that previews are off.
- **Retention leaves materials alone.** The turn-in retention job (contract §7) only ever touches
  files that belong to coursework.
- **Demo mode** seeds a few small original files (a PDF study guide, a PNG diagram, a TXT reference
  sheet, and a PowerPoint with its preview already made) onto the demo materials, so previews work
  out of the box, even without LibreOffice.
- **One migration**, `MaterialFiles`: `stored_files.CourseworkId` becomes nullable, and `materials`
  gains `FileId`, `PreviewFileId`, and `PreviewStatus`. You apply it the same way as the others still
  waiting.

## Decisions (approved 2026-11-25)

| # | Decision | Why |
|---|---|---|
| 1 | Word, PowerPoint, and Excel files can be previewed: the server makes a PDF copy with LibreOffice. Download gives the original | Lecture slides are usually PowerPoint. Browsers can't show Office files, and a server-made PDF looks like the original far more closely than drawing the file in the browser. Sending files to an outside viewer (Microsoft's) would need public links to class files |
| 2 | On phones without a built-in PDF viewer, a PDF viewer (pdf.js) loads the first time a PDF is opened: about 500 KB gzipped, kept by the app afterwards and never downloaded by anyone else. It goes over the 40 KB per-screen budget, so it is a recorded exception | Android is most of the phones students use, and a typical lecture PDF is several MB anyway. The other choice is "download only" on those phones |
| 3 | One file per material, up to 25 MB, in the types students can already upload: PDF, DOCX, PPTX, XLSX, JPG, PNG, TXT. ZIP and old .doc/.ppt are not accepted | Same checks and scan as turn-ins. An instructor with several files adds several materials |
| 4 | A preview loads by itself up to 5 MB. Bigger files, or data saver on, wait for a tap that shows the size | Students on prepaid mobile data |

Already decided by you (2026-11-25): no read time and no "Mark as reviewed". A material is a guide
to come back to, not a task to finish.

## Phases

| Phase | Scope | Visible change |
|---|---|---|
| 0 | This plan and D-067 | None |
| 1 | Server: migration, upload with the material, replace and remove, the download and preview routes with their access rules and `ETag`, the Office-to-PDF worker, demo files, the server API table | None in the UI yet; API tests show it |
| 2 | Shared material viewer and the instructor side: real upload with progress, the instructor material page, real type and size on cards, the fake download and "1.8 MB" removed | Instructors upload and preview real files |
| 3 | Student side: the grouped Materials tab, the new material page with preview, previous and next. Read time, "Mark as reviewed", "Learning goal", and "Key ideas" removed | Students preview and download files |

## Tests

- **Server (xUnit):** who can download (instructor, enrolled student, archived material, another
  class, not enrolled); type, size, and scan refusals; a failed upload saves nothing; replace and
  delete remove the old bytes; `ETag` gives 304; retention skips material files; the worker marks
  previews ready or failed and picks pending ones up after a restart (with a stand-in converter).
  A real LibreOffice test turns one Word, PowerPoint, and Excel file into PDFs; API CI installs
  LibreOffice for it. Each test is checked once against a broken version.
- **Vitest:** the viewer chooses the right preview per type; the 5 MB and data-saver gate; blob
  URLs are released when the page closes; grouping by module and submodule; previous and next
  order.
- **Playwright:**
  - an instructor uploads a PDF, a student opens it from the grouped list and sees the preview,
    then downloads the same bytes;
  - an image and a text file preview; the seeded PowerPoint shows its preview; an Office file
    whose preview failed shows the download card;
  - an archived material disappears for students and its file returns 404;
  - 320 px with no sideways scroll, and zero axe violations on both pages.
- **One journey changes:** `student-flow`'s "open a material from Stream, mark it reviewed, go
  back" becomes "open a material from Stream, see its file, go back", and `FLOW_PARITY` row MD1
  changes with it. Recorded in D-067 as your decision. Every other spec stays unchanged.
- **Every PR:** lint, typecheck, unit, server tests, e2e (dev and `E2E_PREVIEW=1`), build, budget,
  `style:check`, `memory:check`.

## Risks

- **Data on phones:** a preview downloads the whole file. Decision 4 limits surprises, and Download
  stays one tap away.
- **The PDF viewer's size:** measured at 132 KB + 369 KB gzipped (pdfjs-dist 6.5.438). It is kept
  out of the app's install cache, so only students who need it download it.
- **Pages a screen reader can't read:** PDF pages drawn by the viewer get a text layer, so text can
  be read aloud and selected. Images use the material's title as their description.
- **LibreOffice on the server:** it is a large install (about 1 GB on a Mac with
  `brew install --cask libreoffice`; less on Linux without the extras). It reads files instructors
  upload, so it runs one file at a time, with a time limit, and in production inside the API's
  container with no outside network. A preview can differ slightly from the original (fonts the
  server doesn't have); Download always gives the original.
- **Disk use:** 25 MB per material with no quota per class. A quota can come later if needed.
- **Virus scan:** the real ClamAV setup has still never been tried outside tests; production
  refuses to start without it.

## Later

Several files per material, ZIP files for
programming classes, editing a material's title and description, a storage quota per class, and
saving materials for offline reading (with the offline plan).
