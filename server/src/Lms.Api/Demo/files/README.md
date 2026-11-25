# Demo material files

Demo mode stores each of these in a sandbox's file store and attaches it to a seeded material
(D-067; the mapping is in `client/scripts/demo-seed.ts`). The content is original and fictional.

`server/tools/demo-files/make_demo_files.py` makes every file except the `*.preview.pdf` copies.
Those are made by LibreOffice, the same way the API makes the preview of an uploaded Office file:

```bash
soffice --headless --convert-to pdf --outdir out relational-database-design.pptx semantic-html-reference.docx sql-query-workbook.xlsx
# then rename out/<name>.pdf to <name>.preview.pdf here
```

Without LibreOffice installed, a throwaway container works (any Ubuntu image with
`libreoffice-writer libreoffice-impress libreoffice-calc` installed). After changing a file,
update the mapping in `demo-seed.ts` if a name changed, and run `npm run demo-seed` in `client/`.
