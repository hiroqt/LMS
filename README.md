# TMCC LMS

A frontend-only React prototype for a unified student classroom workspace. It runs locally with sample data; no account, API, or server database is required.

## Run it

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates a static build in `dist/`.

## Prototype scope

Students can browse classes, open a class stream, switch between classwork, materials, and people, filter assessments by Quiz, Long Quiz, and Exam, read material details, and take a timed quiz. Quiz answers and completed assessments are saved in this browser with localStorage. Use **Reset demo data** in the profile menu to restore the original state.

The roster and course content are fictional demonstration data. Authentication, teacher actions, cross-device sync, grading services, and backend persistence are outside this prototype.

See [the project brief](docs/PROJECT_BRIEF.md) and [the UI/data architecture](docs/ARCHITECTURE.md).
