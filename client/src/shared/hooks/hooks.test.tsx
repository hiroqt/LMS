import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NetworkBanner } from "../layout/NetworkBanner";

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
  act(() => {
    window.dispatchEvent(new Event(value ? "online" : "offline"));
  });
}

afterEach(() => vi.restoreAllMocks());

describe("NetworkBanner", () => {
  it("announces going offline and clears when the connection returns", () => {
    render(<NetworkBanner />);
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();

    setOnline(false);
    expect(region).toHaveTextContent("You’re offline.");

    setOnline(true);
    expect(region).toBeEmptyDOMElement();
  });

  it("shows a dismissible notice on slow connections", () => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: Object.assign(new EventTarget(), { effectiveType: "2g", saveData: false }),
    });
    render(<NetworkBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("Slow connection.");
    act(() => screen.getByRole("button", { name: "Dismiss slow connection notice" }).click());
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    Reflect.deleteProperty(navigator, "connection");
  });
});
