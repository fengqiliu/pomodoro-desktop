use serde::Serialize;
use std::{
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

pub const COMPLETED_EVENT: &str = "native-timer-completed";

trait Clock: Send + Sync {
    fn now_ms(&self) -> u64;
}

#[derive(Default)]
struct SystemClock;

impl Clock for SystemClock {
    fn now_ms(&self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
            .min(u64::MAX as u128) as u64
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerSnapshot {
    pub running: bool,
    pub remaining_ms: u64,
    pub generation: u64,
}

#[derive(Debug, Clone, Copy)]
pub struct TimerTicket {
    generation: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimerPoll {
    Pending(u64),
    Completed(TimerSnapshot),
    Cancelled,
}

#[derive(Debug, Default)]
struct TimerState {
    generation: u64,
    running: bool,
    end_at_ms: Option<u64>,
    remaining_ms: u64,
}

#[derive(Clone)]
pub struct NativeTimer {
    state: Arc<Mutex<TimerState>>,
    clock: Arc<dyn Clock>,
}

impl Default for NativeTimer {
    fn default() -> Self {
        Self {
            state: Arc::new(Mutex::new(TimerState::default())),
            clock: Arc::new(SystemClock),
        }
    }
}

impl NativeTimer {
    #[cfg(test)]
    fn with_clock(clock: Arc<dyn Clock>) -> Self {
        Self {
            state: Arc::new(Mutex::new(TimerState::default())),
            clock,
        }
    }

    fn lock_state(&self) -> std::sync::MutexGuard<'_, TimerState> {
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn snapshot_at(state: &TimerState, now_ms: u64) -> TimerSnapshot {
        let remaining_ms = if state.running {
            state.end_at_ms.unwrap_or(now_ms).saturating_sub(now_ms)
        } else {
            state.remaining_ms
        };

        TimerSnapshot {
            running: state.running,
            remaining_ms,
            generation: state.generation,
        }
    }

    pub fn start(&self, duration_ms: u64) -> (TimerSnapshot, TimerTicket) {
        let now_ms = self.clock.now_ms();
        let duration_ms = duration_ms.max(1);
        let mut state = self.lock_state();
        state.generation = state.generation.wrapping_add(1);
        state.running = true;
        state.remaining_ms = duration_ms;
        state.end_at_ms = Some(now_ms.saturating_add(duration_ms));

        let snapshot = Self::snapshot_at(&state, now_ms);
        let ticket = TimerTicket {
            generation: state.generation,
        };
        (snapshot, ticket)
    }

    pub fn pause(&self) -> TimerSnapshot {
        let now_ms = self.clock.now_ms();
        let mut state = self.lock_state();
        let remaining_ms = Self::snapshot_at(&state, now_ms).remaining_ms;
        state.generation = state.generation.wrapping_add(1);
        state.running = false;
        state.end_at_ms = None;
        state.remaining_ms = remaining_ms;
        Self::snapshot_at(&state, now_ms)
    }

    pub fn cancel(&self, expected_generation: Option<u64>) -> TimerSnapshot {
        let now_ms = self.clock.now_ms();
        let mut state = self.lock_state();
        if expected_generation.is_some_and(|generation| generation != state.generation) {
            return Self::snapshot_at(&state, now_ms);
        }
        state.generation = state.generation.wrapping_add(1);
        state.running = false;
        state.end_at_ms = None;
        state.remaining_ms = 0;
        Self::snapshot_at(&state, now_ms)
    }

    pub fn poll(&self, ticket: TimerTicket) -> TimerPoll {
        let now_ms = self.clock.now_ms();
        let mut state = self.lock_state();

        if !state.running || state.generation != ticket.generation {
            return TimerPoll::Cancelled;
        }

        let remaining_ms = state.end_at_ms.unwrap_or(now_ms).saturating_sub(now_ms);
        if remaining_ms > 0 {
            return TimerPoll::Pending(remaining_ms);
        }

        state.running = false;
        state.end_at_ms = None;
        state.remaining_ms = 0;
        TimerPoll::Completed(Self::snapshot_at(&state, now_ms))
    }

    pub fn spawn_completion_worker<F>(&self, ticket: TimerTicket, on_complete: F)
    where
        F: FnOnce(TimerSnapshot) + Send + 'static,
    {
        let timer = self.clone();
        std::thread::spawn(move || loop {
            match timer.poll(ticket) {
                TimerPoll::Pending(remaining_ms) => {
                    std::thread::sleep(Duration::from_millis(remaining_ms.min(1_000)));
                }
                TimerPoll::Completed(snapshot) => {
                    on_complete(snapshot);
                    break;
                }
                TimerPoll::Cancelled => break,
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    #[derive(Default)]
    struct TestClock(AtomicU64);

    impl TestClock {
        fn set(&self, now_ms: u64) {
            self.0.store(now_ms, Ordering::SeqCst);
        }
    }

    impl Clock for TestClock {
        fn now_ms(&self) -> u64 {
            self.0.load(Ordering::SeqCst)
        }
    }

    #[test]
    fn pause_preserves_wall_clock_remaining_time() {
        let clock = Arc::new(TestClock::default());
        clock.set(1_000);
        let timer = NativeTimer::with_clock(clock.clone());

        timer.start(100_000);
        clock.set(31_000);

        let snapshot = timer.pause();
        assert!(!snapshot.running);
        assert_eq!(snapshot.remaining_ms, 70_000);
    }

    #[test]
    fn only_the_latest_generation_can_complete() {
        let clock = Arc::new(TestClock::default());
        let timer = NativeTimer::with_clock(clock.clone());

        let (_, stale_ticket) = timer.start(10_000);
        let (_, current_ticket) = timer.start(20_000);
        clock.set(20_000);

        assert_eq!(timer.poll(stale_ticket), TimerPoll::Cancelled);
        assert!(matches!(
            timer.poll(current_ticket),
            TimerPoll::Completed(TimerSnapshot {
                running: false,
                remaining_ms: 0,
                ..
            })
        ));
    }

    #[test]
    fn cancel_invalidates_the_active_timer() {
        let clock = Arc::new(TestClock::default());
        let timer = NativeTimer::with_clock(clock);
        let (_, ticket) = timer.start(10_000);

        let snapshot = timer.cancel(None);

        assert!(!snapshot.running);
        assert_eq!(snapshot.remaining_ms, 0);
        assert_eq!(timer.poll(ticket), TimerPoll::Cancelled);
    }

    #[test]
    fn stale_targeted_cancel_does_not_stop_a_newer_timer() {
        let clock = Arc::new(TestClock::default());
        let timer = NativeTimer::with_clock(clock);
        let (stale, _) = timer.start(10_000);
        let (current, current_ticket) = timer.start(20_000);

        let snapshot = timer.cancel(Some(stale.generation));

        assert!(snapshot.running);
        assert_eq!(snapshot.generation, current.generation);
        assert!(matches!(timer.poll(current_ticket), TimerPoll::Pending(20_000)));
    }

    #[test]
    fn worker_delivers_completion_after_the_wall_clock_deadline() {
        let timer = NativeTimer::default();
        let (started, ticket) = timer.start(20);
        let (sender, receiver) = std::sync::mpsc::channel();

        timer.spawn_completion_worker(ticket, move |snapshot| {
            sender.send(snapshot).expect("completion receiver should exist");
        });

        let completed = receiver
            .recv_timeout(Duration::from_secs(1))
            .expect("worker should complete within the timeout");
        assert!(!completed.running);
        assert_eq!(completed.remaining_ms, 0);
        assert_eq!(completed.generation, started.generation);
    }
}
