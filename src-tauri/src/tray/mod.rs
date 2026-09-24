// Tray context: system tray menu, window show/hide toggling.

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, AppHandle, Manager,
};

const ID_TOGGLE: &str = "toggle";
const ID_QUIT: &str = "quit";

pub fn toggle_window(app: &AppHandle) {
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

pub fn build_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
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
}
