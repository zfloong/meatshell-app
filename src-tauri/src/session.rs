//! Session manager — bridges meatshell backend sessions with the Tauri
//! frontend via event emissions.

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use meatshell::config::{PortForward, Session as SessionConfig, SessionKind};
use meatshell::serial::spawn_serial_session;
use meatshell::sftp::{self, SftpCommand, SftpHandle};
use meatshell::ssh::{self, PortForwardInfo, SessionCommand, SessionEvent, SessionHandle};
use meatshell::telnet::spawn_telnet_session;
use tokio::task::JoinHandle;

use crate::prompts::PromptManager;

/// Manages the tokio runtime and active SSH/Serial/Telnet sessions.
pub struct SessionManager {
    pub runtime: tokio::runtime::Runtime,
    pub sessions: Arc<Mutex<HashMap<String, SessionHandle>>>,
    pub sftp_handles: Arc<Mutex<HashMap<String, SftpHandle>>>,
    /// Runtime port-forward tasks, keyed by tab_id.
    pub forward_tasks: Arc<Mutex<HashMap<String, Vec<(PortForwardInfo, JoinHandle<()>)>>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            runtime: tokio::runtime::Runtime::new()
                .expect("failed to create tokio runtime"),
            sessions: Arc::new(Mutex::new(HashMap::new())),
            sftp_handles: Arc::new(Mutex::new(HashMap::new())),
            forward_tasks: Arc::new(Mutex::new(HashMap::new())),
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
            return Err("session already exists".into());
        }

        let tab_id_owned = tab_id.to_string();

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

        // Store the handle
        self.sessions
            .lock()
            .insert(tab_id_owned.clone(), handle);

        // Spawn a task that forwards SessionEvents to Tauri events
        let sessions = self.sessions.clone();
        let tid = tab_id_owned.clone();
        self.runtime.spawn(async move {
            forward_events(app, sessions, tid, rx, prompts).await;
        });

        Ok(())
    }

    /// Spawn an SFTP worker for an existing SSH session.
    pub fn spawn_sftp(
        &self,
        app: AppHandle,
        tab_id: &str,
        session: SessionConfig,
    ) -> Result<(), String> {
        if self.sftp_handles.lock().contains_key(tab_id) {
            return Ok(()); // already open
        }

        let (events_tx, events_rx) = mpsc::unbounded_channel();
        let handle = sftp::spawn_sftp(self.runtime.handle(), session, events_tx);

        self.sftp_handles
            .lock()
            .insert(tab_id.to_string(), handle);

        let tid = tab_id.to_string();
        self.runtime.spawn(async move {
            forward_sftp_events(app, tid, events_rx).await;
        });

        Ok(())
    }

    /// Send a command to the SFTP worker for a tab.
    pub fn sftp_send(&self, tab_id: &str, cmd: SftpCommand) -> Result<(), String> {
        let handles = self.sftp_handles.lock();
        let handle = handles
            .get(tab_id)
            .ok_or_else(|| format!("SFTP not open for tab {tab_id}"))?;
        let _ = handle.commands.send(cmd);
        Ok(())
    }

    /// Send raw bytes to a session's PTY.
    pub fn send_input(&self, tab_id: &str, data: Vec<u8>) -> Result<(), String> {
        let sessions = self.sessions.lock();
        let handle = sessions
            .get(tab_id)
            .ok_or_else(|| format!("session {tab_id} not found"))?;
        handle.send_raw(data);
        Ok(())
    }

    /// Resize a session's PTY.
    pub fn resize(&self, tab_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        let sessions = self.sessions.lock();
        let handle = sessions
            .get(tab_id)
            .ok_or_else(|| format!("session {tab_id} not found"))?;
        let _ = handle
            .commands
            .send(SessionCommand::Resize(cols, rows));
        Ok(())
    }

    /// Disconnect and remove a session.
    pub fn disconnect(&self, tab_id: &str) -> Result<(), String> {
        // Close SFTP first
        if let Some(handle) = self.sftp_handles.lock().remove(tab_id) {
            let _ = handle.commands.send(SftpCommand::Close);
        }
        // Abort port-forward tasks
        if let Some(tasks) = self.forward_tasks.lock().remove(tab_id) {
            for (_, task) in tasks {
                task.abort();
            }
        }
        // Close terminal session
        let mut sessions = self.sessions.lock();
        if let Some(handle) = sessions.remove(tab_id) {
            let _ = handle.commands.send(SessionCommand::Close);
        }
        Ok(())
    }

    /// Start a new port forward (local or dynamic) on an active SSH session.
    pub fn start_forward(
        &self,
        app: &AppHandle,
        tab_id: &str,
        fwd: PortForward,
    ) -> Result<PortForwardInfo, String> {
        let sessions = self.sessions.lock();
        let handle = sessions
            .get(tab_id)
            .ok_or_else(|| format!("session {tab_id} not found"))?;

        let ssh_handle = handle
            .ssh_handle
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| "SSH session not fully established yet".to_string())?;

        let events = handle.events.clone();

        // Validate kind
        if fwd.kind == "remote" {
            return Err("remote (-R) forwards must be configured in the session before connecting".into());
        }

        // The bind address:port pair is unique — no two listeners on the same port.
        let id = format!("{}:{}:{}", fwd.kind, fwd.bind_addr, fwd.bind_port);
        let info = PortForwardInfo {
            id,
            kind: fwd.kind.clone(),
            name: if fwd.name.is_empty() {
                format!("{}→{}:{}", fwd.bind_port, fwd.host, fwd.host_port)
            } else {
                fwd.name.clone()
            },
            bind_addr: if fwd.bind_addr.trim().is_empty() {
                "127.0.0.1".to_string()
            } else {
                fwd.bind_addr.trim().to_string()
            },
            bind_port: fwd.bind_port,
            host: fwd.host.clone(),
            host_port: fwd.host_port,
        };

        // Spawn the listener
        let task: JoinHandle<()> = match fwd.kind.as_str() {
            "local" => meatshell::forward::spawn_local(
                ssh_handle,
                info.bind_addr.clone(),
                info.bind_port,
                info.host.clone(),
                info.host_port,
                events,
            ),
            "dynamic" => meatshell::forward::spawn_dynamic(
                ssh_handle,
                info.bind_addr.clone(),
                info.bind_port,
                events,
            ),
            _ => return Err(format!("unsupported forward kind: {}", fwd.kind)),
        };

        drop(sessions);

        // Store the task
        self.forward_tasks
            .lock()
            .entry(tab_id.to_string())
            .or_default()
            .push((info.clone(), task));

        // Notify the frontend
        let _ = app.emit(
            &format!("forward-started:{tab_id}"),
            serde_json::json!(info),
        );

        Ok(info)
    }

    /// Stop a running port forward.
    pub fn stop_forward(&self, app: &AppHandle, tab_id: &str, forward_id: &str) -> Result<(), String> {
        let mut tasks = self.forward_tasks.lock();
        let tab_tasks = tasks
            .get_mut(tab_id)
            .ok_or_else(|| format!("no active forwards for tab {tab_id}"))?;

        if let Some(pos) = tab_tasks.iter().position(|(info, _)| info.id == forward_id) {
            let (info, task) = tab_tasks.remove(pos);
            task.abort();
            let _ = app.emit(
                &format!("forward-stopped:{tab_id}"),
                serde_json::json!(info),
            );
            Ok(())
        } else {
            Err(format!("forward {forward_id} not found"))
        }
    }

    /// List active port forwards for a session.
    pub fn list_forwards(&self, tab_id: &str) -> Vec<PortForwardInfo> {
        self.forward_tasks
            .lock()
            .get(tab_id)
            .map(|tasks| tasks.iter().map(|(info, _)| info.clone()).collect())
            .unwrap_or_default()
    }
}

// ── Terminal session event forwarding ──────────────────────────────────

/// Forward events from the meatshell session event stream to Tauri's event bus.
async fn forward_events(
    app: AppHandle,
    sessions: Arc<Mutex<HashMap<String, SessionHandle>>>,
    tab_id: String,
    mut rx: tokio::sync::mpsc::UnboundedReceiver<SessionEvent>,
    prompts: Arc<PromptManager>,
) {
    while let Some(event) = rx.recv().await {
        match event {
            SessionEvent::Output(text) => {
                let _ = app.emit(&format!("terminal-output:{tab_id}"), text);
            }
            SessionEvent::Status(status) => {
                let _ = app.emit(&format!("terminal-status:{tab_id}"), status);
            }
            SessionEvent::Connected => {
                let _ = app.emit(&format!("terminal-connected:{tab_id}"), true);
            }
            SessionEvent::Closed(reason) => {
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
            SessionEvent::SftpStatus(status) => {
                let _ = app.emit(&format!("sftp-status:{tab_id}"), status);
            }
            _ => {
                // Other events handled by SFTP forwarder
            }
        }
    }
}

// ── SFTP event forwarding ──────────────────────────────────────────────

async fn forward_sftp_events(
    app: AppHandle,
    tab_id: String,
    mut rx: mpsc::UnboundedReceiver<SessionEvent>,
) {
    while let Some(event) = rx.recv().await {
        match event {
            SessionEvent::SftpEntries { path, entries } => {
                let _ = app.emit(
                    &format!("sftp-entries:{tab_id}"),
                    serde_json::json!({
                        "path": path,
                        "entries": entries,
                    }),
                );
            }
            SessionEvent::SftpStatus(status) => {
                let _ = app.emit(&format!("sftp-status:{tab_id}"), status);
            }
            SessionEvent::SftpError(msg) => {
                let _ = app.emit(&format!("sftp-error:{tab_id}"), msg);
            }
            SessionEvent::SftpTransfer {
                id,
                name,
                is_upload,
                transferred,
                total,
                state,
                msg,
            } => {
                let _ = app.emit(
                    &format!("sftp-transfer:{tab_id}"),
                    serde_json::json!({
                        "id": id,
                        "name": name,
                        "is_upload": is_upload,
                        "transferred": transferred,
                        "total": total,
                        "state": state,
                        "msg": msg,
                    }),
                );
            }
            _ => {
                // ignore non-SFTP events
            }
        }
    }
}
