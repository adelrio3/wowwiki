//! Native side of the helper: the tray menu, "is the game running", where the
//! game is installed, and the computer's name. Everything else is TypeScript
//! shared with the site (docs/04, D-0018).
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent, Wry};

struct Tray {
    status: MenuItem<Wry>,
    pause: MenuItem<Wry>,
    signin: MenuItem<Wry>,
}

#[tauri::command]
fn set_tray(state: State<Mutex<Option<Tray>>>, status: String, paused: bool, signed_in: bool) -> Result<(), String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    if let Some(t) = guard.as_ref() {
        t.status.set_text(status).map_err(|e| e.to_string())?;
        t.pause.set_text(if paused { "Resume syncing" } else { "Pause syncing" }).map_err(|e| e.to_string())?;
        t.signin.set_text(if signed_in { "Signed in (open status)" } else { "Sign in…" }).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn game_running() -> bool {
    let sys = sysinfo::System::new_all();
    sys.processes().values().any(|p| {
        let name = p.name().to_string_lossy().to_ascii_lowercase();
        matches!(name.as_str(), "wow.exe" | "wowclassic.exe" | "wowclassict.exe" | "wow-64.exe")
    })
}

#[tauri::command]
fn host_name() -> String {
    sysinfo::System::host_name().unwrap_or_default()
}

#[tauri::command]
fn started_minimized() -> bool {
    std::env::args().any(|a| a == "--minimized")
}

/// The World of Warcraft root: the folder that holds `_classic_era_`, `_retail_`, ...
#[tauri::command]
fn detect_wow_folder() -> Option<String> {
    let mut candidates: Vec<String> = Vec::new();
    #[cfg(windows)]
    {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        for key in ["SOFTWARE\\WOW6432Node\\Blizzard Entertainment\\World of Warcraft", "SOFTWARE\\Blizzard Entertainment\\World of Warcraft"] {
            if let Ok(k) = hklm.open_subkey(key) {
                if let Ok(p) = k.get_value::<String, _>("InstallPath") {
                    candidates.push(p);
                }
            }
        }
    }
    for p in ["C:\\Program Files (x86)\\World of Warcraft", "C:\\Program Files\\World of Warcraft", "C:\\Games\\World of Warcraft", "D:\\World of Warcraft", "D:\\Games\\World of Warcraft", "D:\\Program Files (x86)\\World of Warcraft"] {
        candidates.push(p.to_string());
    }
    for c in candidates {
        let mut path = std::path::PathBuf::from(c.trim_end_matches(['\\', '/']));
        // A launcher entry may point inside one flavor folder; step up to the root.
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('_') && name.ends_with('_') {
                path.pop();
            }
        }
        if path.join("_classic_era_").is_dir() || path.join("_retail_").is_dir() || path.join("_classic_").is_dir() || path.join("_anniversary_").is_dir() {
            return path.to_str().map(|s| s.to_string());
        }
    }
    None
}

fn show_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<Tray> {
    let status = MenuItem::with_id(app, "status", "Starting…", false, None::<&str>)?;
    let sync = MenuItem::with_id(app, "sync", "Sync now", true, None::<&str>)?;
    let install = MenuItem::with_id(app, "install", "Install or update the add-on", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pause syncing", true, None::<&str>)?;
    let folder = MenuItem::with_id(app, "folder", "Choose game folder…", true, None::<&str>)?;
    let signin = MenuItem::with_id(app, "signin", "Sign in…", true, None::<&str>)?;
    let site = MenuItem::with_id(app, "site", "Open WoW Compendium", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Status window", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&status, &sep, &sync, &install, &pause, &folder, &signin, &site, &show, &sep2, &quit])?;
    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().cloned().expect("window icon"))
        .tooltip("WoW Compendium Helper")
        .menu(&menu)
        // Windows convention: right click for the menu, double click to open the window.
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } = event {
                show_window(tray.app_handle());
            }
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                // a single left click also opens it; the menu stays on the right button
                show_window(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref().to_string();
            if id == "quit" {
                app.exit(0);
            } else {
                let _ = app.emit("tray", id);
            }
        })
        .build(app)?;
    Ok(Tray { status, pause, signin })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .manage(Mutex::new(None::<Tray>))
        .invoke_handler(tauri::generate_handler![set_tray, game_running, host_name, started_minimized, detect_wow_folder])
        .setup(|app| {
            let tray = build_tray(app.handle())?;
            *app.state::<Mutex<Option<Tray>>>().lock().unwrap() = Some(tray);
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window hides it; the tray keeps the helper alive.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running the helper");
}
