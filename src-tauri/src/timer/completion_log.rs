//! Completion audit log — optional native-side persistence of finished timer
//! sessions (port of the `timer` bounded context).
//!
//! `engine.rs` stays pure: it reports completion through a callback, and
//! recording is wired at the composition root (`lib.rs`) via the
//! `CompletionLog` trait, injected into the command that spawns the worker.

use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

/// Name of the JSON-lines file inside the app data directory.
pub const LOG_FILE_NAME: &str = "completion-log.jsonl";

/// One completed native timer session, serialized as a single JSON line.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionEntry {
    pub completed_at_ms: u64,
    pub duration_ms: u64,
    pub generation: u64,
    pub notification_sent: bool,
}

/// Current wall-clock time in milliseconds since the Unix epoch.
pub fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u64::MAX as u128) as u64
}

/// Port for persisting completion events. Injected at the composition root so
/// the timer engine stays pure and unit-testable. Implementations must be
/// best-effort: a failed write must never fail the timer or its wrapper.
pub trait CompletionLog: Send + Sync {
    fn record(&self, entry: &CompletionEntry);
}

/// No-op implementation — the default until the composition root wires a real
/// backend, and the fallback when no app data directory is resolvable.
pub struct NullCompletionLog;

impl CompletionLog for NullCompletionLog {
    fn record(&self, _entry: &CompletionEntry) {}
}

/// Appends JSON lines to a single file (creating parent directories on
/// demand). All failures are swallowed: this is a diagnostic/audit log, never a
/// source of user-visible errors.
pub struct FileCompletionLog {
    path: PathBuf,
}

impl FileCompletionLog {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    /// Target path `dir/completion-log.jsonl`.
    pub fn at_app_data_dir(dir: &Path) -> Self {
        Self::new(dir.join(LOG_FILE_NAME))
    }
}

impl CompletionLog for FileCompletionLog {
    fn record(&self, entry: &CompletionEntry) {
        let Ok(line) = serde_json::to_string(entry) else {
            return;
        };
        if let Some(parent) = self.path.parent() {
            if std::fs::create_dir_all(parent).is_err() {
                return;
            }
        }
        use std::io::Write;
        let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
        else {
            return;
        };
        let _ = writeln!(file, "{line}");
    }
}

/// Managed-state wrapper so the composition root can inject any
/// `CompletionLog` implementation into the Tauri commands.
#[derive(Clone)]
pub struct CompletionLogHandle(pub Arc<dyn CompletionLog>);

impl CompletionLogHandle {
    pub fn new(log: Arc<dyn CompletionLog>) -> Self {
        Self(log)
    }
}

impl CompletionLog for CompletionLogHandle {
    fn record(&self, entry: &CompletionEntry) {
        self.0.record(entry);
    }
}

impl Default for CompletionLogHandle {
    fn default() -> Self {
        Self::new(Arc::new(NullCompletionLog))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(generation: u64) -> CompletionEntry {
        CompletionEntry {
            completed_at_ms: generation * 1_000,
            duration_ms: 25 * 60 * 1_000,
            generation,
            notification_sent: true,
        }
    }

    #[test]
    fn null_log_is_a_silent_no_op() {
        NullCompletionLog.record(&entry(1));
        // Nothing observable to assert beyond "must not panic".
    }

    #[test]
    fn file_log_creates_dirs_and_appends_json_lines() {
        let dir = std::env::temp_dir().join(format!(
            "pomodoro-completion-log-test-{}",
            std::process::id()
        ));
        let path = dir.join(LOG_FILE_NAME);
        let _ = std::fs::remove_dir_all(&dir);

        let log = FileCompletionLog::new(&path);
        log.record(&entry(7));
        log.record(&CompletionEntry {
            completed_at_ms: 2_000,
            duration_ms: 300_000,
            generation: 8,
            notification_sent: false,
        });

        let raw = std::fs::read_to_string(&path).expect("log file should exist");
        let lines: Vec<&str> = raw.lines().collect();
        assert_eq!(lines.len(), 2);
        assert_eq!(
            lines[0],
            r#"{"completedAtMs":7000,"durationMs":1500000,"generation":7,"notificationSent":true}"#
        );
        assert!(lines[1].contains(r#""durationMs":300000"#));
        assert!(lines[1].contains(r#""notificationSent":false"#));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn app_data_dir_target_is_the_log_file() {
        let log = FileCompletionLog::at_app_data_dir(Path::new("/tmp/pomodoro-test-app"));
        assert_eq!(
            log.path,
            Path::new("/tmp/pomodoro-test-app").join(LOG_FILE_NAME)
        );
    }

    #[test]
    fn handle_defaults_to_a_null_impl() {
        CompletionLogHandle::default().0.record(&entry(1));
    }
}
