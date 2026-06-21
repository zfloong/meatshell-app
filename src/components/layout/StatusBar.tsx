import { useEffect, useState } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { getSystemStats, type SystemSnapshot } from "@/lib/tauriCommands";

export default function StatusBar() {
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const sftpStats = useSessionStore((s) => s.sftpStats);
  const lastError = useSessionStore((s) => s.lastError);
  const clearError = useSessionStore((s) => s.clearError);

  const [localStats, setLocalStats] = useState<SystemSnapshot | null>(null);
  const remoteStats = activeTab?.remoteStats ?? null;

  // Poll local stats (always, for fallback and network data)
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const s = await getSystemStats();
        if (active) setLocalStats(s);
      } catch {
        // ignore
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <footer className="flex h-6 items-center bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] px-3 flex-shrink-0 gap-3">
      {/* Error banner */}
      {lastError && (
        <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-red-400">
          <span className="truncate max-w-[400px]">{lastError}</span>
          <button
            onClick={clearError}
            className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Left: connection status */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {activeTab ? (
          <>
            <span
              className={`status-dot ${activeTab.status === "connected" ? "connected" : "connecting"}`}
            />
            <span className="text-[11px] text-[var(--text-secondary)]">
              {activeTab.session.name || activeTab.session.host}
            </span>
            <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
              — {activeTab.statusText}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-[var(--text-muted)]">Ready</span>
        )}
      </div>

      {/* File explorer stats */}
      {sftpStats && (sftpStats.folders > 0 || sftpStats.files > 0) && (
        <div className="flex items-center gap-1 flex-shrink-0 ml-4 text-[11px] text-[var(--text-muted)]">
          <span>
            {sftpStats.folders > 0 && `${sftpStats.folders} folder${sftpStats.folders !== 1 ? "s" : ""}`}
            {sftpStats.folders > 0 && sftpStats.files > 0 && ", "}
            {sftpStats.files > 0 && `${sftpStats.files} file${sftpStats.files !== 1 ? "s" : ""}`}
          </span>
          {sftpStats.selected > 0 ? (
            <span className="text-[var(--accent)]">{sftpStats.selected} selected</span>
          ) : (
            <span className="text-[var(--text-muted)] opacity-40">Ctrl/Shift+Click to select multiple</span>
          )}
        </div>
      )}

      {/* System monitor */}
      <div className="flex items-center gap-3 ml-4 min-w-0 overflow-hidden text-[11px]">
        {remoteStats ? (
          // ── Remote SSH stats ──────────────────────────────────────────
          <>
            <MonitorChip label="CPU" value={`${remoteStats.cpu_percent.toFixed(1)}%`} />
            <MonitorChip
              label="Mem"
              value={kibToGiB(remoteStats.mem_used_kib, remoteStats.mem_total_kib)}
              pct={
                remoteStats.mem_total_kib > 0
                  ? (remoteStats.mem_used_kib / remoteStats.mem_total_kib) * 100
                  : undefined
              }
            />
          </>
        ) : localStats ? (
          // ── Local system stats ───────────────────────────────────────
          <>
            <MonitorChip
              label="CPU"
              value={percent(localStats.cpuPercent)}
              pct={localStats.cpuPercent}
            />
            <MonitorChip
              label="Mem"
              value={mib(localStats.memUsedMib, localStats.memTotalMib)}
              pct={localStats.memPercent}
            />
            {localStats.swapTotalMib > 0 && (
              <MonitorChip
                label="Swap"
                value={mib(localStats.swapUsedMib, localStats.swapTotalMib)}
                pct={localStats.swapPercent}
              />
            )}
            <MonitorChip label="↓" value={formatBytes(localStats.netRxPerSec)} />
            <MonitorChip label="↑" value={formatBytes(localStats.netTxPerSec)} />
          </>
        ) : null}
      </div>

      {/* Right: session count */}
      <div className="flex-1" />
      <span className="text-[11px] text-[var(--text-muted)] flex-shrink-0">
        {tabs.length > 0 &&
          `${tabs.length} session${tabs.length > 1 ? "s" : ""}`}
      </span>
    </footer>
  );
}

// ── Inline monitor chip ────────────────────────────────────────────────────

function MonitorChip({
  label,
  value,
  pct,
}: {
  label: string;
  value: string;
  pct?: number;
}) {
  return (
    <span
      className="flex items-center gap-1 flex-shrink-0"
      style={{ color: pct != null ? colorForPercent(pct) : "var(--text-secondary)" }}
    >
      <span className="opacity-60">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </span>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function colorForPercent(pct: number): string {
  if (pct >= 85) return "var(--color-danger)";
  if (pct >= 60) return "var(--color-warning)";
  return "var(--color-success)";
}

function percent(v: number) {
  return `${v.toFixed(1)}%`;
}

function mib(used: number, total: number) {
  if (total === 0) return "—";
  return `${(used / 1024).toFixed(1)}/${(total / 1024).toFixed(1)}G`;
}

function kibToGiB(usedKib: number, totalKib: number) {
  if (totalKib === 0) return "—";
  const usedG = usedKib / 1024 / 1024;
  const totalG = totalKib / 1024 / 1024;
  return `${usedG.toFixed(1)}/${totalG.toFixed(1)}G`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes.toFixed(0)}B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K/s`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M/s`;
}
