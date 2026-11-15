# Screen-reader checklist

Automated checks (axe, focus, names, 320px, forced colors) run in CI, but they cannot tell
whether the experience *makes sense* when heard. A person runs this checklist before
cutover and after any major screen change, and records the result in `LEARNINGS.md`.

**Pairs to test** (most common combinations for our users):

| Device | Screen reader | Browser |
| --- | --- | --- |
| iPhone | VoiceOver (triple-click side button) | Safari |
| Android phone | TalkBack | Chrome |
| Windows laptop | NVDA (free) | Chrome or Edge |
| Mac | VoiceOver (Cmd+F5) | Safari |

Preview the rebuilt UI with `?ui=new`. Do each journey **without looking at the screen**
for at least one pair.

## Student

- [ ] On Today, the page announces "Good morning, Alex" as the main heading; the skip link
      ("Skip to main content") is the first thing reached.
- [ ] Bottom bar (phone) or sidebar: each destination is announced with its name, and the
      current one as "current page".
- [ ] Tasks: the status filters announce as toggle buttons with counts ("Missing 1, pressed").
- [ ] Open a quiz. The question, each answer as a radio button ("A Primary key, radio button,
      1 of 4"), and "1 answered" are announced; arrow keys move between answers.
- [ ] The timer is **not** read every second; you hear "30 seconds left", "10 seconds
      left", and "Time is up for this question".
- [ ] Submit: the dialog announces its title and "You answered 1 of 5 questions"; focus is
      trapped inside; Escape returns to the quiz.
- [ ] Turn in an assignment with an empty filename: the error is announced with the field.
- [ ] Turn off Wi-Fi: "You're offline" is announced once, and turning it back on clears it.

## Instructor

- [ ] Overview: the main heading is "Your teaching day"; "Review student work" is reachable.
- [ ] Phone: "Open menu" opens the drawer; choosing a class closes it and announces the
      class name as the new heading.
- [ ] Class tabs announce as tabs with counts ("Submissions, 1, tab, 6 of 7").
- [ ] Post an announcement with an empty message: both errors are announced; the character
      counts are read as hints.
- [ ] Grade a submission: the score field announces its range ("Score 0–40"), an
      out-of-range value announces the error, and saving announces "Grade saved".
- [ ] Delete a material: the confirmation names the material, and focus starts on a safe
      choice ("Keep material").

## Record the result

Add a `LEARNINGS.md` entry: date, who, device/screen reader/browser, what passed, and
anything confusing (even if not a bug). Fix issues before cutover.
