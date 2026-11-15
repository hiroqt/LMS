import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { useRoleNavigation } from "./useRoleNavigation";
import { isRole, matchRole, roleTitle } from "./roles";

const at = (pathname: string, search = "", hash = "") => ({ pathname, search, hash });

describe("matchRole", () => {
  it.each([
    [at("/"), "student"],
    [at("/instructor"), "instructor"],
    [at("/admin.html"), "admin"],
    [at("/", "?role=instructor"), "instructor"],
    [at("/", "", "#/admin"), "admin"],
  ])("resolves %o to %s", (location, role) => {
    expect(matchRole(location)).toEqual({ role, unknownPath: null });
  });

  it("reports unknown paths", () => {
    expect(matchRole(at("/nope"))).toEqual({ role: null, unknownPath: "/nope" });
  });
});

describe("role helpers", () => {
  it("narrows only known roles", () => {
    expect(isRole("student")).toBe(true);
    expect(isRole("teacher")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });

  it("builds the workspace title", () => {
    expect(roleTitle("instructor")).toBe("TMCC LMS · Instructor Workspace");
  });
});

describe("useRoleNavigation", () => {
  function Probe({ target }: { target: string }) {
    const navigateRole = useRoleNavigation();
    const location = useLocation();
    return (
      <>
        <output>{location.pathname}</output>
        <button type="button" onClick={() => navigateRole(target)}>go</button>
      </>
    );
  }

  it("navigates to a known role and updates the title", () => {
    render(<MemoryRouter initialEntries={["/student"]}><Probe target="admin" /></MemoryRouter>);
    act(() => screen.getByRole("button", { name: "go" }).click());
    expect(screen.getByRole("status")).toHaveTextContent("/admin");
    expect(document.title).toBe("TMCC LMS · Admin Workspace");
  });

  it("ignores unknown roles", () => {
    render(<MemoryRouter initialEntries={["/student"]}><Probe target="teacher" /></MemoryRouter>);
    act(() => screen.getByRole("button", { name: "go" }).click());
    expect(screen.getByRole("status")).toHaveTextContent("/student");
  });
});
