import { describe, expect, it } from "vitest";
import { resolveShortcut } from "./useAppShortcuts";

/** Minimal stand-ins for KeyboardEvent / EventTarget (no DOM needed). */
function key(
  over: Partial<{
    key: string;
    code: string;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
  }> = {}
) {
  return { key: "", code: "", metaKey: false, ctrlKey: false, altKey: false, ...over };
}
function el(tagName: string, over: { isContentEditable?: boolean; role?: string } = {}) {
  return {
    tagName,
    isContentEditable: over.isContentEditable ?? false,
    getAttribute: (n: string) => (n === "role" ? (over.role ?? null) : null),
  };
}

describe("resolveShortcut", () => {
  it("maps the three documented shortcuts", () => {
    expect(resolveShortcut(key({ code: "Space" }), el("DIV"))).toBe("toggle");
    expect(resolveShortcut(key({ key: "r" }), el("DIV"))).toBe("reset");
    expect(resolveShortcut(key({ key: "R" }), el("DIV"))).toBe("reset");
    expect(resolveShortcut(key({ key: "s" }), el("DIV"))).toBe("skip");
    expect(resolveShortcut(key({ key: "S" }), el("DIV"))).toBe("skip");
  });

  it("ignores unrelated keys and a null target", () => {
    expect(resolveShortcut(key({ key: "q" }), el("DIV"))).toBeNull();
    expect(resolveShortcut(key({ key: "r" }), null)).toBe("reset");
    expect(resolveShortcut(key({ code: "Space" }), null)).toBe("toggle");
  });

  it("never fires while typing in a field", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(resolveShortcut(key({ code: "Space" }), el(tag))).toBeNull();
      expect(resolveShortcut(key({ key: "r" }), el(tag))).toBeNull();
    }
    expect(resolveShortcut(key({ key: "s" }), el("DIV", { isContentEditable: true }))).toBeNull();
  });

  it("ignores modifier combos so browser shortcuts survive", () => {
    expect(resolveShortcut(key({ key: "r", metaKey: true }), el("DIV"))).toBeNull();
    expect(resolveShortcut(key({ key: "s", ctrlKey: true }), el("DIV"))).toBeNull();
    expect(resolveShortcut(key({ code: "Space", altKey: true }), el("DIV"))).toBeNull();
  });

  it("leaves Space to a focused activatable control", () => {
    // Regression: Space must activate the focused button, not the timer behind it.
    expect(resolveShortcut(key({ code: "Space" }), el("BUTTON"))).toBeNull();
    expect(resolveShortcut(key({ code: "Space" }), el("A"))).toBeNull();
    expect(resolveShortcut(key({ code: "Space" }), el("DIV", { role: "button" }))).toBeNull();
    // The task "done" box is a focusable <span role="checkbox"> toggled by Space.
    expect(resolveShortcut(key({ code: "Space" }), el("SPAN", { role: "checkbox" }))).toBeNull();
    expect(resolveShortcut(key({ code: "Space" }), el("SPAN", { role: "switch" }))).toBeNull();
    // R/S are unaffected — they never collide with native activation.
    expect(resolveShortcut(key({ key: "r" }), el("BUTTON"))).toBe("reset");
  });
});
