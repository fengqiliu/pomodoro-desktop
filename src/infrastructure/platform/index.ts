export { isDesktop } from "./runtime";
export { windowAdapter } from "./windowAdapter";
export { shortcutAdapter } from "./shortcutAdapter";
export { notificationAdapter } from "./notificationAdapter";
export { nativeTimerAdapter } from "./nativeTimerAdapter";
export type {
  NativeTimerCompletion,
  NativeTimerNotification,
  NativeTimerSnapshot,
} from "../../application/ports";
