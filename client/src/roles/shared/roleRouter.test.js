import assert from "node:assert/strict";
import test from "node:test";
import {
  VALID_ROLES,
  getBaseUrl,
  parseRoleFromLocation,
} from "./roleRouter.js";

test("VALID_ROLES contains student, instructor, admin", () => {
  assert.deepEqual(VALID_ROLES, ["student", "instructor", "admin"]);
});

test("parseRoleFromLocation handles root and empty path", () => {
  assert.deepEqual(parseRoleFromLocation({ pathname: "/", hash: "", search: "" }), {
    role: "student",
    unknownPath: null,
  });
  assert.deepEqual(parseRoleFromLocation({ pathname: "", hash: "", search: "" }), {
    role: "student",
    unknownPath: null,
  });
});

test("parseRoleFromLocation parses standard role paths", () => {
  assert.deepEqual(parseRoleFromLocation({ pathname: "/instructor", hash: "", search: "" }), {
    role: "instructor",
    unknownPath: null,
  });
  assert.deepEqual(parseRoleFromLocation({ pathname: "/admin", hash: "", search: "" }), {
    role: "admin",
    unknownPath: null,
  });
  assert.deepEqual(parseRoleFromLocation({ pathname: "/student", hash: "", search: "" }), {
    role: "student",
    unknownPath: null,
  });
});

test("parseRoleFromLocation handles trailing slashes and file extensions", () => {
  assert.deepEqual(parseRoleFromLocation({ pathname: "/instructor/", hash: "", search: "" }), {
    role: "instructor",
    unknownPath: null,
  });
  assert.deepEqual(parseRoleFromLocation({ pathname: "/admin.html", hash: "", search: "" }), {
    role: "admin",
    unknownPath: null,
  });
  assert.deepEqual(parseRoleFromLocation({ pathname: "/admin/index.html", hash: "", search: "" }), {
    role: "admin",
    unknownPath: null,
  });
  assert.deepEqual(parseRoleFromLocation({ pathname: "/index.html", hash: "", search: "" }), {
    role: "student",
    unknownPath: null,
  });
});

test("parseRoleFromLocation supports subpaths", () => {
  assert.deepEqual(parseRoleFromLocation({ pathname: "/tmcc-lms/instructor", hash: "", search: "" }), {
    role: "instructor",
    unknownPath: null,
  });
  assert.deepEqual(parseRoleFromLocation({ pathname: "/lms-app/admin", hash: "", search: "" }), {
    role: "admin",
    unknownPath: null,
  });
  assert.deepEqual(parseRoleFromLocation({ pathname: "/lms-app/student/", hash: "", search: "" }), {
    role: "student",
    unknownPath: null,
  });
});

test("parseRoleFromLocation supports hash routing", () => {
  assert.deepEqual(parseRoleFromLocation({ pathname: "/", hash: "#/instructor", search: "" }), {
    role: "instructor",
    unknownPath: null,
  });
  assert.deepEqual(parseRoleFromLocation({ pathname: "/", hash: "#admin", search: "" }), {
    role: "admin",
    unknownPath: null,
  });
  assert.deepEqual(parseRoleFromLocation({ pathname: "/", hash: "#/student", search: "" }), {
    role: "student",
    unknownPath: null,
  });
});

test("parseRoleFromLocation supports query parameters", () => {
  assert.deepEqual(parseRoleFromLocation({ pathname: "/", hash: "", search: "?role=admin" }), {
    role: "admin",
    unknownPath: null,
  });
  assert.deepEqual(parseRoleFromLocation({ pathname: "/", hash: "", search: "?role=instructor" }), {
    role: "instructor",
    unknownPath: null,
  });
});

test("parseRoleFromLocation detects unknown role paths", () => {
  const result = parseRoleFromLocation({ pathname: "/unknown-role", hash: "", search: "" });
  assert.equal(result.role, null);
  assert.equal(result.unknownPath, "/unknown-role");

  const subpathResult = parseRoleFromLocation({ pathname: "/my-lms/unknown-page", hash: "", search: "" });
  assert.equal(subpathResult.role, null);
  assert.equal(subpathResult.unknownPath, "/my-lms/unknown-page");
});

test("getBaseUrl extracts subpath correctly", () => {
  assert.equal(getBaseUrl("/"), "");
  assert.equal(getBaseUrl("/admin"), "");
  assert.equal(getBaseUrl("/tmcc-lms/instructor"), "/tmcc-lms");
  assert.equal(getBaseUrl("/org/project/student"), "/org/project");
});

