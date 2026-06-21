import { useSessionStore } from "@/stores/sessionStore";

export default function StatusBar() {
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <footer className="flex h-6 items-center justify-between bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] px-3 flex-shrink-0">
      <div className="flex items-center gap-2">
        {/* Connection status */}
        {activeTab ? (
          <>
            <span
              className={`status-dot ${
                activeTab.status === "connected" ? "connected" : "connecting"
              }`}
            />
            <span className="text-[11px] text-[var(--text-secondary)]">
              {activeTab.session.name || activeTab.session.host}
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              — {activeTab.statusText}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-[var(--text-muted)]">Ready</span>
        )}
      </div>

      <span className="text-[11px] text-[var(--text-muted)]">
        {tabs.length > 0 &&
          `${tabs.length} session${tabs.length > 1 ? "s" : ""}`}
      </span>
    </footer>
  );
}
