// Composition root: wires plugins, contexts, commands and window lifecycle.
// Business logic lives in `timer` and `tray`; this module only assembles.

mod timer;
mod tray;

use std::sync::Arc;
use timer::completion_log::{CompletionLog, CompletionLogHandle, FileCompletionLog, NullCompletionLog};
use timer::engine::NativeTimer;
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(NativeTimer::default())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            timer::commands::native_timer_start,
            timer::commands::native_timer_pause,
            timer::commands::native_timer_cancel
        ])
        .setup(|app| {
            tray::build_tray(app)?;
            // Inject the completion audit log at the composition root. If no app
            // data directory can be resolved, fall back to a no-op log.
            let completion_log: Arc<dyn CompletionLog> = match app.path().app_data_dir() {
                Ok(dir) => Arc::new(FileCompletionLog::at_app_data_dir(&dir)),
                Err(_) => Arc::new(NullCompletionLog),
            };
            let _ = app.manage(CompletionLogHandle::new(completion_log));
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
