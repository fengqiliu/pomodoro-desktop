use super::engine::{NativeTimer, TimerSnapshot, COMPLETED_EVENT};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};
use tauri_plugin_notification::NotificationExt;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionNotification {
    pub title: String,
    pub body: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TimerCompletedEvent {
    #[serde(flatten)]
    snapshot: TimerSnapshot,
    notification_sent: bool,
}

// Command adapters: thin translation between IPC payloads and the engine.
// No business logic lives here — the engine owns timing, generation
// cancellation and the completion worker.

#[tauri::command]
pub fn native_timer_start(
    app: tauri::AppHandle,
    timer: State<'_, NativeTimer>,
    duration_ms: u64,
    notification: Option<CompletionNotification>,
) -> TimerSnapshot {
    let (snapshot, ticket) = timer.start(duration_ms);
    let timer = timer.inner().clone();
    timer.spawn_completion_worker(ticket, move |snapshot| {
        let notification_sent = if let Some(notification) = notification {
            app
                .notification()
                .builder()
                .title(notification.title)
                .body(notification.body)
                .show()
                .is_ok()
        } else {
            false
        };
        let _ = app.emit(
            COMPLETED_EVENT,
            TimerCompletedEvent {
                snapshot,
                notification_sent,
            },
        );
    });

    snapshot
}

#[tauri::command]
pub fn native_timer_pause(timer: State<'_, NativeTimer>) -> TimerSnapshot {
    timer.pause()
}

#[tauri::command]
pub fn native_timer_cancel(
    timer: State<'_, NativeTimer>,
    generation: Option<u64>,
) -> TimerSnapshot {
    timer.cancel(generation)
}
