import { describe, expect, it } from "vitest";
import { moduleChoices, modulePath, moduleTree, reorderSiblings, type TreeModule } from "./moduleTree";

const modules: TreeModule[] = [
  { id: "3", title: "2.1 Joins", parentId: "2", order: 1 },
  { id: "2", title: "Unit 2", order: 2 },
  { id: "1", title: "Unit 1", order: 1 },
  { id: "5", title: "1.2 Keys", parentId: "1", order: 2 },
  { id: "4", title: "1.1 Tables", parentId: "1", order: 1 },
];

describe("moduleTree", () => {
  it("nests submodules under their module, both in sort order", () => {
    expect(moduleTree(modules).map(({ module, submodules }) => [module.title, submodules.map((item) => item.title)])).toEqual([
      ["Unit 1", ["1.1 Tables", "1.2 Keys"]],
      ["Unit 2", ["2.1 Joins"]],
    ]);
  });

  it("shows a submodule whose module is missing as a module", () => {
    expect(moduleTree([{ id: "9", title: "Orphan", parentId: "404" }]).map(({ module }) => module.title)).toEqual(["Orphan"]);
  });

  it("breaks sort-order ties by id", () => {
    expect(moduleTree([{ id: "12", title: "B", order: 1 }, { id: "2", title: "A", order: 1 }]).map(({ module }) => module.title)).toEqual(["A", "B"]);
  });
});

describe("moduleChoices and modulePath", () => {
  it("lists modules with their submodules after them, labeled with the module", () => {
    expect(moduleChoices(modules).map((item) => item.label)).toEqual(["Unit 1", "Unit 1 › 1.1 Tables", "Unit 1 › 1.2 Keys", "Unit 2", "Unit 2 › 2.1 Joins"]);
    expect(modulePath(modules, "3")).toBe("Unit 2 › 2.1 Joins");
    expect(modulePath(modules, "2")).toBe("Unit 2");
  });
});

describe("reorderSiblings", () => {
  const subs = modules.filter((item) => item.parentId === "1");

  it("swaps a submodule with its neighbor", () => {
    expect(reorderSiblings(subs, "5", -1)).toEqual([{ id: "5", order: 1 }, { id: "4", order: 2 }]);
    expect(reorderSiblings(subs, "4", 1)).toEqual([{ id: "5", order: 1 }, { id: "4", order: 2 }]);
  });

  it("does nothing past either end", () => {
    expect(reorderSiblings(subs, "4", -1)).toEqual([]);
    expect(reorderSiblings(subs, "5", 1)).toEqual([]);
  });

  it("renumbers siblings that share an order so the move still happens", () => {
    const tied = [{ id: "7", title: "A", order: 1 }, { id: "8", title: "B", order: 1 }];
    // "8" keeps order 1 and now wins over "7", which moves to 2.
    expect(reorderSiblings(tied, "8", -1)).toEqual([{ id: "7", order: 2 }]);
  });
});
