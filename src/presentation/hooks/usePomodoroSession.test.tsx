import { createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NativeTimerCompletion, NativeTimerNotification } from "../../application/ports";
import { DEFAULT_SETTINGS, type Settings } from "../../domain/settings";
import type { History } from "../../domain/stats";
import type { Task } from "../../domain/tasks";
import type { DailyProgress } from "../../domain/timer";
import { usePomodoroSession } from "./usePomodoroSession";

const native = vi.hoisted(() => ({
  starts: [] as (NativeTimerNotification | undefined)[],
  complete: null as ((c: NativeTimerCompletion) => void) | null,
}));

vi.mock("../../infrastructure/platform", () => ({
  isDesktop: () => true,
  notificationAdapter: { notifyPhaseDone: async () => {} },
  nativeTimerAdapter: {
    start: async (seconds: number, notification?: NativeTimerNotification) => {
      native.starts.push(notification);
      return { generation: native.starts.length, running: true, remainingMs: seconds * 1000 };
    },
    pause: async () => null,
    cancel: async () => {},
    listenCompleted: async (handler: (c: NativeTimerCompletion) => void) => {
      native.complete = handler;
      return () => {};
    },
  },
}));
vi.mock("../../infrastructure/storage", () => ({ historyStore: { save: () => {} } }));

type Session = ReturnType<typeof usePomodoroSession>;

/** Echoes the key and the `next` param, so assertions read the i18n keys. */
const tr = (key: string, params?: Record<string, string | number>) =>
  params?.next ? `${key}>${params.next}` : key;

function Harness({ settings, expose }: { settings: Settings; expose: (s: Session) => void }) {
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>({
    date: "2026-1-1",
    completedToday: 0,
    focusMinutesToday: 0,
  });
  const [cycleFocusCount, setCycleFocusCount] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<History>({});
  expose(
    usePomodoroSession({
      settings,
      dailyProgress,
      cycleFocusCount,
      tasks,
      activeTaskId: null,
      history,
      tr,
      setCycleFocusCount,
      setDailyProgress,
      setHistory,
      setTasks,
    })
  );
  return null;
}

/** Lets React flush scheduled renders/effects and pending promise chains. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

// The hook renders no host elements, so a stub container is all React needs.
function stubContainer() {
  const noop = () => {};
  const ownerDocument = { addEventListener: noop, removeEventListener: noop };
  return {
    nodeType: 1,
    tagName: "DIV",
    ownerDocument,
    addEventListener: noop,
    removeEventListener: noop,
  } as unknown as Element;
}

describe("usePomodoroSession — native completion notification", () => {
  let root: ReturnType<typeof createRoot>;
  let session: Session;

  beforeEach(async () => {
    // React DOM reads these two globals while scheduling and committing.
    vi.stubGlobal("window", { event: undefined, HTMLIFrameElement: class {} });
    native.starts.length = 0;
    native.complete = null;
    root = createRoot(stubContainer());
    root.render(
      createElement(Harness, {
        settings: { ...DEFAULT_SETTINGS, sound: false, autoStartBreaks: true },
        expose: (s) => (session = s),
      })
    );
    await settle();
  });

  afterEach(async () => {
    root.unmount();
    await settle();
    vi.unstubAllGlobals();
  });

  it("describes the auto-started phase, not the one that just finished", async () => {
    await session.toggle();
    expect(native.starts[0]?.title).toBe("notif.title");

    // The native worker reports the focus done; the short break auto-starts.
    native.complete?.({ generation: 1, running: false, remainingMs: 0, notificationSent: true });
    await settle();

    expect(session.phase).toBe("short");
    expect(native.starts).toHaveLength(2);
    // FR-N1: when this break ends the notice must read "break over → focus".
    expect(native.starts[1]).toEqual({
      title: "notif.title.break",
      body: "notif.body>phase.focus",
    });
  });
});
