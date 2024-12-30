use tauri::{Manager, WindowEvent, PhysicalPosition, PhysicalSize, Runtime};
use tauri_plugin_store::{Store, StoreBuilder};
use serde::{Serialize, Deserialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct WindowState {
    width: f64,
    height: f64,
    x: i32,
    y: i32,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            
            #[cfg(desktop)]
            {
                // Initialize store
                let path = PathBuf::from("window.dat");
                let store = StoreBuilder::new(app.handle(), path)
                    .build();
                
                let window = app.get_webview_window("main").unwrap();
                
                // Restore window state
                if let Ok(store) = store {
                    if let Some(state) = store.get("window_state") {
                        if let Ok(window_state) = serde_json::from_value::<WindowState>(state) {
                            window.set_position(PhysicalPosition::new(
                                window_state.x,
                                window_state.y,
                            ))?;
                            window.set_size(PhysicalSize::new(
                                window_state.width as u32,
                                window_state.height as u32,
                            ))?;
                        }
                    }
                    
                    // Save window state when window is moved or resized
                    let store_clone = store.clone();
                    let window_clone = window.clone();
                    window.on_window_event(move |event| {
                        match event {
                            WindowEvent::Moved(position) => {
                                if let Ok(size) = window_clone.outer_size() {
                                    save_window_state(&store_clone, position.x, position.y, size.width as f64, size.height as f64);
                                }
                            },
                            WindowEvent::Resized(size) => {
                                if let Ok(position) = window_clone.outer_position() {
                                    save_window_state(&store_clone, position.x, position.y, size.width as f64, size.height as f64);
                                }
                            },
                            _ => {}
                        }
                    });
                }
            }
            
            Ok(())
        });

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn save_window_state<R: Runtime>(store: &Store<R>, x: i32, y: i32, width: f64, height: f64) {
    let window_state = WindowState {
        width,
        height,
        x,
        y,
    };
    
    let _ = store.set("window_state", serde_json::to_value(window_state).unwrap());
    let _ = store.save();
}
