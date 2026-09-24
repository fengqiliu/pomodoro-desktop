// Composition root: wires plugins, contexts, commands and window lifecycle.
// Business logic lives in `timer` and `tray`; this module only assembles.

mod timer;
mod tray;

use timer::engine::NativeTimer;
use tauri::WindowEvent;

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
