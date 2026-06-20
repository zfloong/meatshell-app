/// Tauri 2 backend entry point.
///
/// Currently contains no custom commands — the meatshell SSH backend will be
/// integrated here in a future iteration.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
