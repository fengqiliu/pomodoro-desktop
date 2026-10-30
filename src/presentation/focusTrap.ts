// Focus containment for modal dialogs. The index math is kept pure so it can be
// unit-tested; the DOM side (collecting focusables, calling focus()) lives in
// the dialog component.

export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Where Tab should land when it would leave the dialog, or null to let the
 * browser move focus normally. `current` is the focused element's index among
 * the dialog's focusables (-1 when the dialog container itself has focus).
 */
export function wrapFocusIndex(current: number, count: number, backwards: boolean): number | null {
  if (count === 0) return null;
  if (backwards) return current <= 0 ? count - 1 : null;
  return current === -1 || current === count - 1 ? 0 : null;
}
