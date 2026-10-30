import { describe, expect, it } from "vitest";
import { wrapFocusIndex } from "./focusTrap";

describe("wrapFocusIndex", () => {
  it("wraps Tab from the last focusable back to the first", () => {
    expect(wrapFocusIndex(4, 5, false)).toBe(0);
  });

  it("wraps Shift+Tab from the first focusable to the last", () => {
    expect(wrapFocusIndex(0, 5, true)).toBe(4);
  });

  it("treats focus on the dialog itself (index -1) as before the first element", () => {
    expect(wrapFocusIndex(-1, 5, true)).toBe(4);
    expect(wrapFocusIndex(-1, 5, false)).toBe(0);
  });

  it("leaves Tab between inner elements to the browser", () => {
    expect(wrapFocusIndex(2, 5, false)).toBeNull();
    expect(wrapFocusIndex(2, 5, true)).toBeNull();
  });

  it("does nothing when the dialog has no focusable elements", () => {
    expect(wrapFocusIndex(-1, 0, false)).toBeNull();
  });
});
