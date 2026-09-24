import type { NotificationPort } from "../../application/ports";
import { isDesktop, loadNotif } from "./runtime";

// Best-effort native phase-complete notification. Permission is requested inside
// (on first enabled send), so macOS shows the system prompt only when needed.
export const notificationAdapter: NotificationPort = {
  async notifyPhaseDone(title, body) {
    if (!isDesktop()) return;
    try {
      const { isPermissionGranted, requestPermission, sendNotification } = await loadNotif();
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      if (!granted) return;
      sendNotification({ title, body });
    } catch {
      /* notifications are best-effort */
    }
  },
};
