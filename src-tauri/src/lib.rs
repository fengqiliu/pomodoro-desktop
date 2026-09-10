mod native_timer;

use native_timer::{NativeTimer, TimerSnapshot, COMPLETED_EVENT};
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_notification::NotificationExt;

// Tray menu item ids.
const ID_TOGGLE: &str = "toggle";
const ID_QUIT: &str = "quit";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompletionNotification {
    title: String,
    body: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TimerCompletedEvent {
    #[serde(flatten)]
    snapshot: TimerSnapshot,
    notification_sent: bool,
}

fn toggle_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.unminimize();
            let _ = win.set_focus();
        }
    }
}

#[tauri::command]
fn native_timer_start(
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
fn native_timer_pause(timer: State<'_, NativeTimer>) -> TimerSnapshot {
    timer.pause()
}

#[tauri::command]
fn native_timer_cancel(
    timer: State<'_, NativeTimer>,
    generation: Option<u64>,
) -> TimerSnapshot {
    timer.cancel(generation)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(NativeTimer::default())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            native_timer_start,
            native_timer_pause,
            native_timer_cancel
        ])
        .setup(|app| {
            let toggle = MenuItem::with_id(app, ID_TOGGLE, "显示/隐藏", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, ID_QUIT, "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle, &quit])?;

            // Reuse the window icon embedded from tauri.conf.json `bundle.icon`
            // (the 32x32.png is listed first). No image-png feature needed — the
            // image is baked in at build time by tauri-build.
            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or("missing default window icon for tray")?;

            TrayIconBuilder::with_id("main")
                .icon(icon)
                .tooltip("Pomodoro")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    ID_TOGGLE => toggle_window(app),
                    ID_QUIT => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Intercept the close (×) button: hide to tray instead of quitting.
            // The timer keeps running in the frontend while hidden.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
