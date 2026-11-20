import { describe, expect, it } from "vitest";
import { appendComment, COMMENT_MAX, commentProblem } from "./commentBank";

describe("appendComment", () => {
  it("adds the comment on a line of its own at the end", () => {
    expect(appendComment("Clear diagram.", "Label every relationship.")).toBe("Clear diagram.\nLabel every relationship.");
    expect(appendComment("Clear diagram.\n\n  ", "Label every relationship.")).toBe("Clear diagram.\nLabel every relationship.");
  });

  it("is just the comment when there is no feedback yet", () => {
    expect(appendComment("", "Label every relationship.")).toBe("Label every relationship.");
    expect(appendComment("  \n", "Label every relationship.")).toBe("Label every relationship.");
  });
});

describe("commentProblem", () => {
  it("refuses an empty comment and one over the server's limit", () => {
    expect(commentProblem("   ")).toBe("Write the comment first.");
    expect(commentProblem("x".repeat(COMMENT_MAX + 1))).toBe(`A saved comment can be at most ${COMMENT_MAX} characters. This one has ${COMMENT_MAX + 1}.`);
  });

  it("accepts up to the limit, counting without the spaces around it", () => {
    expect(commentProblem("x".repeat(COMMENT_MAX))).toBeNull();
    expect(commentProblem(`  ${"x".repeat(COMMENT_MAX)}  `)).toBeNull();
  });
});
