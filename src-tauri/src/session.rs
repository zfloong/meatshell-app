//! Session manager — bridges meatshell backend sessions with the Tauri
//! frontend via event emissions.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::sync::Arc;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use meatshell::config::{Session as SessionConfig, SessionKind};
use meatshell::serial::spawn_serial_session;
use meatshell::ssh::{self, SessionCommand, SessionEvent, SessionHandle};
use meatshell::telnet::spawn_telnet_session;

use crate::prompts::PromptManager;

/// Tracks an active rclone FUSE mount.
#[derive(Debug, Clone)]
pub struct MountInfo {
    pub drive_letter: String,
    pub pid: u32,
    /// Temp rclone config file used by this mount.
    pub config_path: String,
    /// Persisted record so only this app's stale rclone processes are reaped.
    pub record_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct MountRecord {
    pid: u32,
    config_path: String,
}

/// Manages the tokio runtime and active SSH/Serial/Telnet sessions.
pub struct SessionManager {
    pub runtime: tokio::runtime::Runtime,
    pub sessions: Arc<Mutex<HashMap<String, SessionHandle>>>,
    /// Session configs stored for mount auth (keyed by tab_id)
    pub session_configs: Arc<Mutex<HashMap<String, SessionConfig>>>,
    /// Active rclone mounts: tab_id -> MountInfo
    pub mounts: Arc<Mutex<HashMap<String, MountInfo>>>,
    /// Path to rclone.exe (discovered at startup)
    pub rclone_path: String,
    runtime_dir: PathBuf,
}

impl SessionManager {
    pub fn new(rclone_path: String) -> Self {
        let runtime_dir = std::env::temp_dir().join("opentermo-rclone");
        if let Err(err) = fs::create_dir_all(&runtime_dir) {
            tracing::warn!(path = %runtime_dir.display(), error = %err, "创建 rclone 运行目录失败");
        }
        cleanup_stale_mounts(&runtime_dir);
        Self {
            runtime: tokio::runtime::Runtime::new()
                .expect("failed to create tokio runtime"),
            sessions: Arc::new(Mutex::new(HashMap::new())),
            session_configs: Arc::new(Mutex::new(HashMap::new())),
            mounts: Arc::new(Mutex::new(HashMap::new())),
            rclone_path,
            runtime_dir,
        }
    }

    pub fn runtime_dir(&self) -> &Path {
        &self.runtime_dir
    }

    pub fn remember_mount(
        &self,
        tab_id: &str,
        drive_letter: String,
        pid: u32,
        config_path: PathBuf,
    ) -> Result<(), String> {
        let record_path = self.runtime_dir.join(format!("{}.json", sanitize_tab_id(tab_id)));
        let record = MountRecord {
            pid,
            config_path: config_path.display().to_string(),
        };
        let json = serde_json::to_vec(&record)
            .map_err(|e| format!("序列化挂载记录失败: {e}"))?;
        fs::write(&record_path, json)
            .map_err(|e| format!("写入挂载记录失败: {e}"))?;
        self.mounts.lock().insert(
            tab_id.to_string(),
            MountInfo {
                drive_letter,
                pid,
                config_path: config_path.display().to_string(),
                record_path: record_path.display().to_string(),
            },
        );
        Ok(())
    }

    pub fn cleanup_mount(&self, mount: &MountInfo) {
        kill_process(mount.pid);
        std::thread::sleep(std::time::Duration::from_millis(300));
        if let Err(err) = fs::remove_file(&mount.config_path) {
            if err.kind() != std::io::ErrorKind::NotFound {
                tracing::warn!(path = %mount.config_path, error = %err, "删除 rclone 配置失败");
            }
        }
        if let Err(err) = fs::remove_file(&mount.record_path) {
            if err.kind() != std::io::ErrorKind::NotFound {
                tracing::warn!(path = %mount.record_path, error = %err, "删除 rclone 挂载记录失败");
            }
        }
    }

    /// Spawn an SSH, serial, or telnet session and start forwarding events to
    /// the frontend via `app.emit(...)`.
    pub fn connect(
        &self,
        app: AppHandle,
        tab_id: &str,
        session: SessionConfig,
        prompts: Arc<PromptManager>,
    ) -> Result<(), String> {
        if self.sessions.lock().contains_key(tab_id) {
            tracing::warn!(tab_id, "连接失败：会话已存在");
            return Err("会话已存在".into());
        }

        let kind = format!("{:?}", session.kind);
        tracing::info!(tab_id, kind, host = %session.host, "会话连接开始");

        let tab_id_owned = tab_id.to_string();
        let session_config = session.clone();

        let (handle, rx) = match &session.kind {
            SessionKind::Ssh => {
                ssh::spawn_session(
                    self.runtime.handle(),
                    tab_id_owned.clone(),
                    session,
                    80,
                    24,
                )
            }
            SessionKind::Serial => {
                spawn_serial_session(
                    self.runtime.handle(),
                    tab_id_owned.clone(),
                    session,
                )
            }
            SessionKind::Telnet => {
                spawn_telnet_session(
                    self.runtime.handle(),
                    tab_id_owned.clone(),
                    session,
                    80,
                    24,
                )
            }
        };

        // Store the handle and config
        self.sessions
            .lock()
            .insert(tab_id_owned.clone(), handle);
        tracing::info!(tab_id = %tab_id_owned, kind, host = %session_config.host, "会话已连接");
        self.session_configs
            .lock()
            .insert(tab_id_owned.clone(), session_config);

        // Spawn a task that forwards SessionEvents to Tauri events
        let sessions = self.sessions.clone();
        let tid = tab_id_owned.clone();
        self.runtime.spawn(async move {
            forward_events(app, sessions, tid, rx, prompts).await;
        });

        Ok(())
    }


    /// Send raw bytes to a session's PTY.
    pub fn send_input(&self, tab_id: &str, data: Vec<u8>) -> Result<(), String> {
        let sessions = self.sessions.lock();
        let handle = sessions
            .get(tab_id)
            .ok_or_else(|| format!("会话 {tab_id} 未找到"))?;
        handle.send_raw(data);
        Ok(())
    }

    /// Resize a session's PTY.
    pub fn resize(&self, tab_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        let sessions = self.sessions.lock();
        let handle = sessions
            .get(tab_id)
            .ok_or_else(|| format!("会话 {tab_id} 未找到"))?;
        let _ = handle
            .commands
            .send(SessionCommand::Resize(cols, rows));
        Ok(())
    }

    /// Disconnect and remove a session.
    pub fn disconnect(&self, tab_id: &str) -> Result<(), String> {
        tracing::info!(tab_id, "请求断开连接");
        // Unmount rclone if mounted for this tab
        if let Some(mount) = self.mounts.lock().remove(tab_id) {
            tracing::info!(tab_id, drive = %mount.drive_letter, "断开时卸载 rclone");
            self.cleanup_mount(&mount);
        }
        // Close terminal session
        let mut sessions = self.sessions.lock();
        if let Some(handle) = sessions.remove(tab_id) {
            let _ = handle.commands.send(SessionCommand::Close);
        }
        self.session_configs.lock().remove(tab_id);
        Ok(())
    }

    /// Kill all active rclone mounts. Called on app close.
    pub fn unmount_all(&self) {
        tracing::info!("应用关闭，卸载所有 rclone 挂载");
        let mounts: Vec<MountInfo> = self.mounts.lock().drain().map(|(_, m)| m).collect();
        tracing::info!(count = mounts.len(), "待卸载的挂载点");
        for mount in &mounts {
            self.cleanup_mount(mount);
        }
        tracing::info!("所有挂载已清理");
    }
}

fn sanitize_tab_id(tab_id: &str) -> String {
    tab_id
        .chars()
        .map(|ch| match ch {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' => ch,
            _ => '_',
        })
        .collect()
}

fn kill_process(pid: u32) {
    let _ = Command::new("taskkill")
        .creation_flags(0x08000000)
        .args(["/F", "/PID", &pid.to_string()])
        .output();
}

fn cleanup_stale_mounts(runtime_dir: &Path) {
    let entries = match fs::read_dir(runtime_dir) {
        Ok(entries) => entries,
        Err(err) => {
            tracing::warn!(path = %runtime_dir.display(), error = %err, "读取 rclone 运行目录失败");
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }

        let record = fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<MountRecord>(&bytes).ok());

        if let Some(record) = record {
            tracing::info!(pid = record.pid, record = %path.display(), "清理上次运行遗留的 rclone 进程");
            kill_process(record.pid);
            std::thread::sleep(std::time::Duration::from_millis(300));
            if let Err(err) = fs::remove_file(&record.config_path) {
                if err.kind() != std::io::ErrorKind::NotFound {
                    tracing::warn!(path = %record.config_path, error = %err, "删除遗留 rclone 配置失败");
                }
            }
        }

        if let Err(err) = fs::remove_file(&path) {
            if err.kind() != std::io::ErrorKind::NotFound {
                tracing::warn!(path = %path.display(), error = %err, "删除遗留挂载记录失败");
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Terminal session event forwarding
// ---------------------------------------------------------------------------

/// Forward events from the meatshell session event stream to Tauri's event bus.
async fn forward_events(
    app: AppHandle,
    sessions: Arc<Mutex<HashMap<String, SessionHandle>>>,
    tab_id: String,
    mut rx: tokio::sync::mpsc::UnboundedReceiver<SessionEvent>,
    prompts: Arc<PromptManager>,
) {
    tracing::info!(tab_id, "事件转发器已启动");
    while let Some(event) = rx.recv().await {
        match event {
            SessionEvent::Output(text) => {
                let _ = app.emit(&format!("terminal-output:{tab_id}"), text);
            }
            SessionEvent::Status(status) => {
                tracing::debug!(tab_id, status, "会话状态");
                let _ = app.emit(&format!("terminal-status:{tab_id}"), status);
            }
            SessionEvent::Connected => {
                tracing::info!(tab_id, "会话已连接事件");
                let _ = app.emit(&format!("terminal-connected:{tab_id}"), true);
            }
            SessionEvent::Closed(reason) => {
                tracing::info!(tab_id, reason, "会话已关闭");
                let _ = app.emit(&format!("terminal-closed:{tab_id}"), reason);
                sessions.lock().remove(&tab_id);
                break;
            }
            SessionEvent::HostKeyPrompt {
                host,
                port,
                key_type,
                fingerprint,
                changed,
                responder,
            } => {
                let prompt_id = prompts.register_host_key(responder);
                let _ = app.emit(
                    "host-key-prompt",
                    serde_json::json!({
                        "tab_id": tab_id,
                        "prompt_id": prompt_id,
                        "host": host,
                        "port": port,
                        "key_type": key_type,
                        "fingerprint": fingerprint,
                        "changed": changed,
                    }),
                );
            }
            SessionEvent::CredentialPrompt {
                session_id,
                host,
                user,
                need_user,
                need_password,
                responder,
            } => {
                let prompt_id = prompts.register_credential(responder);
                let _ = app.emit(
                    "credential-prompt",
                    serde_json::json!({
                        "tab_id": tab_id,
                        "prompt_id": prompt_id,
                        "session_id": session_id,
                        "host": host,
                        "user": user,
                        "need_user": need_user,
                        "need_password": need_password,
                    }),
                );
            }
            SessionEvent::ResourceStats {
                cpu_percent,
                mem_used_kib,
                mem_total_kib,
                ..
            } => {
                let _ = app.emit(
                    &format!("remote-stats:{tab_id}"),
                    serde_json::json!({
                        "cpu_percent": cpu_percent,
                        "mem_used_kib": mem_used_kib,
                        "mem_total_kib": mem_total_kib,
                    }),
                );
            }
            SessionEvent::CwdChanged(path) => {
                let _ = app.emit(&format!("terminal-cwd:{tab_id}"), path);
            }
            _ => {}
        }
    }
}
