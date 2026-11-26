import { describe, expect, it } from "vitest";
import { demoSignIn, MOCK_ACCOUNTS } from "./demoAccount";

describe("demoSignIn", () => {
  it("authenticates student and returns only the student workspace", async () => {
    const result = await demoSignIn({ email: "student@tmcc.edu.ph", password: "student123" });
    expect(result).toEqual({ roles: ["student"] });
  });

  it("authenticates instructor and returns only the instructor workspace", async () => {
    const result = await demoSignIn({ email: "instructor@tmcc.edu.ph", password: "instructor123" });
    expect(result).toEqual({ roles: ["instructor"] });
  });

  it("authenticates admin and returns only the admin workspace", async () => {
    const result = await demoSignIn({ email: "admin@tmcc.edu.ph", password: "admin123" });
    expect(result).toEqual({ roles: ["admin"] });
  });

  it("returns all workspaces for the multi-role demo account", async () => {
    const result = await demoSignIn({ email: "alex@example.com", password: "any" });
    expect(result).toEqual({ roles: ["student", "instructor", "admin"] });
  });

  it("rejects wrong passwords with a clear error message", async () => {
    await expect(demoSignIn({ email: "student@tmcc.edu.ph", password: "wrong" })).rejects.toThrow(
      "Invalid password for Student account. Use student123.",
    );
  });

  it("rejects unregistered accounts", async () => {
    await expect(demoSignIn({ email: "unknown@nowhere.com", password: "123" })).rejects.toThrow(
      "Account not found. Use student@tmcc.edu.ph, instructor@tmcc.edu.ph, or admin@tmcc.edu.ph.",
    );
  });

  it("exports the 3 mockup accounts for Student, Instructor, and Admin", () => {
    expect(MOCK_ACCOUNTS).toHaveLength(3);
    const roles = MOCK_ACCOUNTS.map((a) => a.role);
    expect(roles).toEqual(["student", "instructor", "admin"]);
  });
});
