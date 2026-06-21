import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { downloadDir } from "@tauri-apps/api/path";
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  FileArchive,
  FileImage,
  FileAudio,
  FileVideo,
  FileBinary,
  FolderPlus,
  Trash2,
  Upload,
  Download,
  ArrowUp,
  RefreshCw,
  Edit3,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { useSessionStore } from "@/stores/sessionStore";
import {
  sftpSpawn,
  sftpListDir,
  sftpDownload,
  sftpUpload,
  sftpDelete,
  sftpMkdir,
  sftpRename,
  type RemoteEntry,
  type SftpEntriesPayload,
  type SftpTransferPayload,
} from "@/lib/tauriCommands";
import ContextMenu, { type ContextMenuItem } from "@/components/ui/context-menu";

type SortColumn = "name" | "size" | "modified" | "mode";
type SortDir = "asc" | "desc";

interface TransferState {
  name: string;
  transferred: number;
  total: number;
  isUpload: boolean;
  done: boolean;
}

interface CtxState {
  items: (ContextMenuItem | null)[];
  x: number;
  y: number;
}

const EMPTY_TRANSFER: TransferState = { name: "", transferred: 0, total: 0, isUpload: false, done: true };

export default function FileExplorer() {
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const [cwd, setCwd] = useState("/");
  const [entries, setEntries] = useState<RemoteEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [pathInput, setPathInput] = useState("/");
  const [editingPath, setEditingPath] = useState(false);

  const [sortCol, setSortCol] = useState<SortColumn>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [transfer, setTransfer] = useState<TransferState>(EMPTY_TRANSFER);
  const transferTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);

  // ── Auto-spawn SFTP ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTab || activeTab.status !== "connected") return;
    if (activeTab.session.kind !== "ssh") return;
    setEntries([]);
    setTransfer(EMPTY_TRANSFER);
    sftpSpawn(activeTabId!, activeTab.session).then(() => {
      sftpListDir(activeTabId!, "/");
    });
    setCwd("/");
    setPathInput("/");
  }, [activeTab?.status, activeTabId]);

  // ── Event listeners ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTabId) return;
    let ul: UnlistenFn | null = null;
    let ut: UnlistenFn | null = null;
    const uls: UnlistenFn[] = [];

    listen<SftpEntriesPayload>(`sftp-entries:${activeTabId}`, (ev) => {
      setCwd(ev.payload.path);
      setPathInput(ev.payload.path);
      setEntries(ev.payload.entries);
      setLoading(false);
    }).then((fn) => { ul = fn; });

    listen<SftpTransferPayload>(`sftp-transfer:${activeTabId}`, (ev) => {
      const { name, transferred, total, is_upload, state } = ev.payload;
      const done = state === 1 || state === 2;
      setTransfer({ name, transferred, total, isUpload: is_upload, done });
      if (done && transferTimer.current) {
        clearTimeout(transferTimer.current);
        transferTimer.current = setTimeout(() => {
          setTransfer(EMPTY_TRANSFER);
          refresh();
        }, done ? 3000 : 0);
      }
    }).then((fn) => { ut = fn; });

    listen<string>(`sftp-status:${activeTabId}`, (ev) => {
      setStatus(ev.payload);
    }).then((fn) => uls.push(fn));

    listen<string>(`sftp-error:${activeTabId}`, (ev) => {
      setStatus(`Error: ${ev.payload}`);
      setLoading(false);
    }).then((fn) => uls.push(fn));

    return () => {
      ul?.();
      ut?.();
      uls.forEach((f) => f());
    };
  }, [activeTabId]);

  // ── Navigation ─────────────────────────────────────────────────────────
  const navigate = useCallback(
    (path: string) => {
      if (!activeTabId) return;
      setLoading(true);
      sftpListDir(activeTabId, path);
    },
    [activeTabId],
  );

  const goUp = useCallback(() => {
    if (cwd === "/") return;
    const parent = cwd.replace(/\/[^/]*$/, "") || "/";
    navigate(parent);
  }, [cwd, navigate]);

  const refresh = useCallback(() => {
    navigate(cwd);
  }, [cwd, navigate]);

  const onPathSubmit = useCallback(() => {
    setEditingPath(false);
    const trimmed = pathInput.trim();
    if (trimmed && trimmed !== cwd) {
      navigate(trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
    }
  }, [pathInput, cwd, navigate]);

  // When entering edit mode, focus and select all
  useEffect(() => {
    if (editingPath && pathInputRef.current) {
      pathInputRef.current.select();
    }
  }, [editingPath]);

  // ── Upload / Download ──────────────────────────────────────────────────
  const upload = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0 || !activeTabId) return;
      Array.from(files).forEach((f) => {
        const localPath = (f as any).path || f.name;
        sftpUpload(activeTabId, localPath, cwd);
      });
      if (fileInput.current) fileInput.current.value = "";
    },
    [activeTabId, cwd],
  );

  const download = useCallback(
    async (entry: RemoteEntry) => {
      if (!activeTabId) return;
      const dir = await downloadDir();
      sftpDownload(activeTabId, entry.full_path, dir);
    },
    [activeTabId],
  );

  // ── Sorting ────────────────────────────────────────────────────────────
  const toggleSort = useCallback(
    (col: SortColumn) => {
      if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else { setSortCol(col); setSortDir("asc"); }
    },
    [sortCol],
  );

  const sortIndicator = (col: SortColumn) => {
    if (sortCol !== col) return <ArrowUpDown size={10} className="inline opacity-30" />;
    return <span className="text-[var(--accent)]">{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  const sortedEntries = useMemo(() => {
    const sorted = [...entries];
    sorted.sort((a, b) => {
      if (a.name === "..") return -1;
      if (b.name === "..") return 1;
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      let cmp = 0;
      if (sortCol === "name") cmp = a.name.localeCompare(b.name);
      else if (sortCol === "size") cmp = a.size - b.size;
      else if (sortCol === "modified") cmp = a.modified - b.modified;
      else if (sortCol === "mode") cmp = a.mode - b.mode;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [entries, sortCol, sortDir]);

  // ── Breadcrumb ─────────────────────────────────────────────────────────
  const crumbs = useMemo(() => {
    if (cwd === "/") return [{ label: "/", path: "/" }];
    const parts = cwd.split("/").filter(Boolean);
    const result: { label: string; path: string }[] = [{ label: "/", path: "/" }];
    for (let i = 0; i < parts.length; i++) {
      result.push({ label: parts[i], path: "/" + parts.slice(0, i + 1).join("/") });
    }
    return result;
  }, [cwd]);

  // ── Context menus ──────────────────────────────────────────────────────
  const showCtx = (e: React.MouseEvent, items: (ContextMenuItem | null)[]) => {
    e.preventDefault();
    setCtx({ items, x: e.clientX, y: e.clientY });
  };

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
      { label: "Upload File", icon: <Upload size={12} />, onClick: () => fileInput.current?.click() },
    ],
    [activeTabId, cwd, refresh],
  );

  // ── Render helpers ─────────────────────────────────────────────────────
  const isParent = (e: RemoteEntry) => e.is_dir && e.name === "..";
  const isDir = (e: RemoteEntry) => e.is_dir && e.name !== "..";

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-[var(--border-subtle)] flex-shrink-0 flex-wrap">
        <button onClick={goUp} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-sm transition-colors" title="Parent directory">
          <ArrowUp size={14} />
        </button>
        <button onClick={refresh} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-sm transition-colors" title="Refresh">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          onClick={() => {
            const name = prompt("Folder name:");
            if (name) sftpMkdir(activeTabId!, `${cwd.replace(/\/$/, "")}/${name}`).then(refresh);
          }}
          className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-sm transition-colors" title="New folder"
        >
          <FolderPlus size={14} />
        </button>
        <button onClick={() => fileInput.current?.click()} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-sm transition-colors" title="Upload file">
          <Upload size={14} />
        </button>
        <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />

        {/* Breadcrumb / path input */}
        {editingPath ? (
          <input
            ref={pathInputRef}
            className="flex-1 ml-1 px-1.5 py-0 text-[11px] font-mono bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--accent-border)] rounded-sm outline-none"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onBlur={onPathSubmit}
            onKeyDown={(e) => { if (e.key === "Enter") onPathSubmit(); else if (e.key === "Escape") { setPathInput(cwd); setEditingPath(false); } }}
          />
        ) : (
          <button
            className="flex items-center gap-0 text-[11px] font-mono ml-1 overflow-x-auto hover:bg-[var(--surface-hover)] rounded-sm px-0.5 transition-colors"
            onClick={() => setEditingPath(true)}
            title="Click to edit path"
          >
            {crumbs.map((c, i) => (
              <span key={c.path} className="flex items-center gap-0 flex-shrink-0">
                {i > 0 && <ChevronRight size={10} className="text-[var(--text-muted)] mx-0.5 flex-shrink-0" />}
                <span
                  onClick={(e) => { e.stopPropagation(); navigate(c.path); }}
                  className={`hover:text-[var(--accent)] hover:underline transition-colors ${
                    i === crumbs.length - 1 ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  {c.label}
                </span>
              </span>
            ))}
          </button>
        )}

        {status && (
          <span className="ml-auto text-[10px] text-[var(--text-secondary)] truncate max-w-[100px]">{status}</span>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto" onContextMenu={(e) => showCtx(e, isEmptyCtx())}>
        {loading && (
          <div className="flex items-center justify-center py-12 text-[11px] text-[var(--text-muted)]">
            Loading...
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-1">
            <Folder size={28} className="text-[var(--text-muted)] opacity-40" />
            <span className="text-[11px] text-[var(--text-muted)]">This folder is empty</span>
            <span className="text-[10px] text-[var(--text-muted)] opacity-60">
              Right-click → New Folder / Upload File
            </span>
          </div>
        )}

        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-surface)]">
              <th className="w-5" />
              <th className="text-left py-1.5 cursor-pointer select-none hover:text-[var(--accent)] transition-colors" onClick={() => toggleSort("name")}>
                <span className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">Name {sortIndicator("name")}</span>
              </th>
              <th className="text-right pr-2 w-16 cursor-pointer select-none hover:text-[var(--accent)] transition-colors" onClick={() => toggleSort("size")}>
                <span className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">Size {sortIndicator("size")}</span>
              </th>
              <th className="text-right pr-2 w-28 cursor-pointer select-none hover:text-[var(--accent)] transition-colors" onClick={() => toggleSort("modified")}>
                <span className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">Modified {sortIndicator("modified")}</span>
              </th>
              <th className="text-left pr-2 w-20 cursor-pointer select-none hover:text-[var(--accent)] transition-colors" onClick={() => toggleSort("mode")}>
                <span className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">Perm {sortIndicator("mode")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((e) => (
              <tr
                key={e.full_path}
                className="hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                onClick={() => { if (isDir(e)) navigate(e.full_path); else if (isParent(e)) goUp(); }}
                onDoubleClick={() => { if (!isDir(e) && !isParent(e)) download(e); }}
                onContextMenu={(ev) => showCtx(ev, isParent(e) ? [] : entryCtx(e))}
              >
                <td className="pl-2 py-1">
                  {isParent(e) ? (
                    <ArrowUp size={13} className="text-[var(--text-secondary)]" />
                  ) : isDir(e) ? (
                    <Folder size={13} className="text-[var(--accent)]" />
                  ) : (
                    fileIcon(e.name)
                  )}
                </td>
                <td className={`pr-2 ${isDir(e) ? "text-[var(--accent)]" : "text-[var(--text-primary)]"} max-w-[120px] truncate`}>
                  {e.name}
                </td>
                <td className="pr-2 text-right tabular-nums text-[var(--text-secondary)]">
                  {e.is_dir ? "" : formatSize(e.size)}
                </td>
                <td className="pr-2 text-right tabular-nums text-[var(--text-secondary)]">
                  {formatTime(e.modified)}
                </td>
                <td className="pr-2 text-left tabular-nums text-[var(--text-muted)] font-mono text-[10px]">
                  {formatMode(e.mode)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Transfer progress bar */}
      {!transfer.done && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
            <span>{transfer.isUpload ? <Upload size={11} /> : <Download size={11} />}</span>
            <span className="truncate flex-1">{transfer.name}</span>
            <span className="tabular-nums flex-shrink-0">
              {transfer.total > 0
                ? `${Math.round((transfer.transferred / transfer.total) * 100)}%`
                : formatSize(transfer.transferred)}
            </span>
          </div>
          <div className="mt-1 h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
              style={{ width: transfer.total > 0 ? `${Math.min((transfer.transferred / transfer.total) * 100, 100)}%` : "30%" }}
            />
          </div>
        </div>
      )}

      {ctx && <ContextMenu items={ctx.items} x={ctx.x} y={ctx.y} onClose={() => setCtx(null)} />}
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

/** Convert POSIX mode bits (e.g. 0o755) to `-rwxr-xr-x` string. */
function formatMode(mode: number): string {
  if (!mode) return "----------";
  const types: Record<number, string> = { 0o040000: "d", 0o120000: "l", 0o010000: "p", 0o140000: "s", 0o060000: "b", 0o020000: "c" };
  let s = types[mode & 0o170000] || "-";
  const rwx = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
  s += rwx[(mode >> 6) & 7] + rwx[(mode >> 3) & 7] + rwx[mode & 7];
  return s;
}

/** Return a file-type–aware icon for a filename. */
function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const codeExts = ["sh","bash","zsh","py","js","ts","jsx","tsx","rs","go","java","c","cpp","h","hpp","rb","php","pl","lua","sql","yaml","yml","json","toml","xml","css","scss","html","htm","vue","svelte","dockerfile","makefile","cmake"];
  const textExts = ["txt","md","log","cfg","conf","ini","env","readme","license"];
  const archiveExts = ["zip","tar","gz","xz","bz2","7z","rar","tgz"];
  const imageExts = ["png","jpg","jpeg","gif","svg","webp","bmp","ico"];
  const audioExts = ["mp3","wav","ogg","flac","aac","m4a"];
  const videoExts = ["mp4","mkv","avi","mov","webm"];
  if (codeExts.includes(ext)) return <FileCode size={13} className="text-[var(--color-warning)]" />;
  if (textExts.includes(ext)) return <FileText size={13} className="text-[var(--color-info)]" />;
  if (archiveExts.includes(ext)) return <FileArchive size={13} className="text-[var(--color-danger)]" />;
  if (imageExts.includes(ext)) return <FileImage size={13} className="text-[var(--color-success)]" />;
  if (audioExts.includes(ext)) return <FileAudio size={13} className="text-[var(--text-secondary)]" />;
  if (videoExts.includes(ext)) return <FileVideo size={13} className="text-[var(--text-secondary)]" />;
  if (name.startsWith(".")) return <FileBinary size={13} className="text-[var(--text-muted)]" />;
  return <File size={13} className="text-[var(--text-secondary)]" />;
}
