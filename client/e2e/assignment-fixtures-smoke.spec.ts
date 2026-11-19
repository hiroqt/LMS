import { INSTRUCTOR, STUDENT, callApi, expect, test } from "./fixtures";
import { flaggedFile, pdfFile, pngFile, renamedProgram, seedAssignment, seedTurnedInAssignment, textFile, uploadWorkFile } from "./assignmentFixtures";

// The assignment specs set journeys up through these helpers, so they are checked once here
// against the Demo-mode API: real files are stored, and what the server refuses is refused.
test("assignment helpers hand in real files, and the server refuses what it should", async ({ page, sandbox }) => {
  const seeded = await seedTurnedInAssignment(page, sandbox, { text: "See the diagram.", files: [pdfFile(), pngFile(), textFile()] });
  expect(seeded.submission.status).toBe("submitted");
  expect(seeded.submission.files.map((file) => file.name)).toEqual(["er-diagram.pdf", "photo.png", "notes.txt"]);
  const list = await callApi<{ items: Array<{ files: Array<{ code: string }> }> }>(page, sandbox, INSTRUCTOR, "GET", `/api/classes/biology/coursework/${seeded.courseworkId}/submissions`);
  expect(list.items[0]!.files.map((file) => file.code)).toEqual(seeded.submission.files.map((file) => file.code));

  const other = await seedAssignment(page, sandbox, { title: "Second" });
  for (const [file, reason] of [[flaggedFile(), "virus scan flagged"], [renamedProgram(), "not accepted"]] as const) {
    const response = await page.request.post(`http://localhost:${process.env.E2E_API_PORT ?? 5299}/api/classes/biology/coursework/${other.courseworkId}/draft/files`, {
      headers: { "X-Demo-Sandbox": sandbox, "X-Demo-User-Id": STUDENT.id, "X-Demo-Role": STUDENT.role }, multipart: { file },
    });
    expect(response.status()).toBe(422);
    expect(await response.text()).toContain(reason);
  }
  const draft = await uploadWorkFile(page, sandbox, "biology", other.courseworkId, pdfFile("only.pdf", "different"));
  expect(draft.status).toBe("in_progress");
});
