import { useCallback, useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  Folder,
  FolderOpen,
  File,
  FolderPlus,
  Trash2,
  Upload,
  Download,
  ArrowUp,
  RefreshCw,
  Edit3,
} from "lucide-react";
import { useSessionStore } from "@/stores/sessionStore";
import {
  sftpSpawn,
  sftpListDir,
  sftpDownload,
  sftpDelete,
  sftpMkdir,
  sftpRename,
  type RemoteEntry,
  type SftpEntriesPayload,
} from "@/lib/tauriCommands";
import { Button } from "@/components/ui/button";
import ContextMenu, { type ContextMenuItem } from "@/components/ui/context-menu";

interface CtxState {
  items: (ContextMenuItem | null)[];
  x: number;
  y: number;
}

/**
 * SFTP file browser embedded in the bottom ResizablePanel.
 * Listens for `sftp-entries:{tabId}` events and renders a flat file list.
 */
export default function FileExplorer() {
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const [cwd, setCwd] = useState("/");
  const [entries, setEntries] = useState<RemoteEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [ctx, setCtx] = useState<CtxState | null>(null);

  // Auto-spawn SFTP when connected to an SSH tab
  useEffect(() => {
    if (!activeTab || activeTab.status !== "connected") return;
    if (activeTab.session.kind !== "ssh") return;
    sftpSpawn(activeTabId!, activeTab.session).then(() => {
      sftpListDir(activeTabId!, "/");
    });
    setCwd("/");
  }, [activeTab?.status, activeTabId]);

  // Listen for directory listing events
  useEffect(() => {
    if (!activeTabId) return;
    let ul: UnlistenFn | null = null;
    listen<SftpEntriesPayload>(`sftp-entries:${activeTabId}`, (ev) => {
      setCwd(ev.payload.path);
      setEntries(ev.payload.entries);
      setLoading(false);
    }).then((fn) => { ul = fn; });

    const uls: UnlistenFn[] = [];
    listen<string>(`sftp-status:${activeTabId}`, (ev) => {
      setStatus(ev.payload);
    }).then((fn) => uls.push(fn));
    listen<string>(`sftp-error:${activeTabId}`, (ev) => {
      setStatus(`Error: ${ev.payload}`);
      setLoading(false);
    }).then((fn) => uls.push(fn));

    return () => {
      ul?.();
      uls.forEach((f) => f());
    };
  }, [activeTabId]);

  // Navigate to a directory
  const navigate = useCallback(
    (path: string) => {
      if (!activeTabId) return;
      setLoading(true);
      sftpListDir(activeTabId, path);
    },
    [activeTabId],
  );

  // Go up one level
  const goUp = useCallback(() => {
    if (cwd === "/") return;
    const parent = cwd.replace(/\/[^/]*$/, "") || "/";
    navigate(parent);
  }, [cwd, navigate]);

  // Refresh current directory
  const refresh = useCallback(() => {
    navigate(cwd);
  }, [cwd, navigate]);

  // Download a file
  const download = useCallback(
    (entry: RemoteEntry) => {
      if (!activeTabId) return;
      sftpDownload(activeTabId, entry.full_path, "");
    },
    [activeTabId],
  );

  // Context menu builders
  const showCtx = useCallback(
    (e: React.MouseEvent, items: (ContextMenuItem | null)[]) => {
      e.preventDefault();
      setCtx({ items, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const entryCtx = useCallback(
    (entry: RemoteEntry): (ContextMenuItem | null)[] => {
      const items: (ContextMenuItem | null)[] = [];
      if (entry.is_dir) {
        items.push({ label: "Open", icon: <FolderOpen size={12} />, onClick: () => navigate(entry.full_path) });
      } else {
        items.push({ label: "Download", icon: <Download size={12} />, onClick: () => download(entry) });
      }
      items.push(
        { label: "Rename", icon: <Edit3 size={12} />, onClick: () => {
          const newName = prompt("New name:", entry.name);
          if (newName && newName !== entry.name) {
            const parent = entry.full_path.replace(/\/[^/]*$/, "") || "/";
            sftpRename(activeTabId!, entry.full_path, `${parent}/${newName}`).then(refresh);
          }
        }},
        null,
        { label: "Delete", icon: <Trash2 size={12} />, onClick: () => {
          if (confirm(`Delete ${entry.name}?`)) {
            sftpDelete(activeTabId!, entry.full_path).then(refresh);
          }
        }, danger: true },
      );
      return items;
    },
    [activeTabId, navigate, download, refresh],
  );

  const isEmptyCtx = useCallback(
    (): (ContextMenuItem | null)[] => [
      { label: "New Folder", icon: <FolderPlus size={12} />, onClick: () => {
        const name = prompt("Folder name:");
        if (name) {
          sftpMkdir(activeTabId!, `${cwd.replace(/\/$/, "")}/${name}`).then(refresh);
        }
      }},
    ],
    [activeTabId, cwd, refresh],
  );

  // Render helpers
  const isParent = (e: RemoteEntry) => e.is_dir && e.name === "..";
  const isDir = (e: RemoteEntry) => e.is_dir && e.name !== "..";

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--border-subtle)] flex-shrink-0">
        <button
          onClick={goUp}
          className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-sm transition-colors"
          title="Parent directory"
        >
          <ArrowUp size={14} />
        </button>
        <button
          onClick={refresh}
          className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-sm transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          onClick={() => {
            const name = prompt("Folder name:");
            if (name) {
              sftpMkdir(activeTabId!, `${cwd.replace(/\/$/, "")}/${name}`).then(refresh);
            }
          }}
          className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-sm transition-colors"
          title="New folder"
        >
          <FolderPlus size={14} />
        </button>
        <span className="flex-1 pl-2 text-[11px] text-[var(--text-muted)] font-mono truncate">
          {cwd}
        </span>
        {status && (
          <span className="text-[10px] text-[var(--text-secondary)] truncate max-w-[120px]">
            {status}
          </span>
        )}
      </div>

      {/* File list */}
      <div
        className="flex-1 overflow-y-auto"
        onContextMenu={(e) => showCtx(e, isEmptyCtx())}
      >
        {loading && (
          <div className="flex items-center justify-center py-8 text-[11px] text-[var(--text-muted)]">
            Loading...
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex items-center justify-center py-8 text-[11px] text-[var(--text-muted)]">
            Empty directory
          </div>
        )}

        <table className="w-full text-[11px]">
          <tbody>
            {entries.map((e) => (
              <tr
                key={e.full_path}
                className="hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                onClick={() => { if (isDir(e)) navigate(e.full_path); else if (isParent(e)) goUp(); }}
                onDoubleClick={() => { if (!isDir(e) && !isParent(e)) download(e); }}
                onContextMenu={(ev) => showCtx(ev, isParent(e) ? [] : entryCtx(e))}
              >
                <td className="pl-2 py-1 w-5">
                  {isParent(e) ? (
                    <ArrowUp size={13} className="text-[var(--text-secondary)]" />
                  ) : isDir(e) ? (
                    <Folder size={13} className="text-[var(--accent)]" />
                  ) : (
                    <File size={13} className="text-[var(--text-secondary)]" />
                  )}
                </td>
                <td className={`pr-3 ${isDir(e) ? "text-[var(--accent)]" : "text-[var(--text-primary)]"} max-w-[140px] truncate`}>
                  {e.name}
                </td>
                <td className="pr-3 text-right tabular-nums text-[var(--text-secondary)] w-16">
                  {e.is_dir ? "" : formatSize(e.size)}
                </td>
                <td className="pr-2 text-right tabular-nums text-[var(--text-secondary)] w-24">
                  {formatTime(e.modified)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Context menu */}
      {ctx && (
        <ContextMenu
          items={ctx.items}
          x={ctx.x}
          y={ctx.y}
          onClose={() => setCtx(null)}
        />
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}G`;
}

function formatTime(unix: number): string {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
