import { create } from "zustand";
import {
  type CommandEntry,
  listCommands,
  saveCommand,
  deleteCommand,
} from "@/lib/tauriCommands";

const LS_KEY = "meatshell-empty-folders";

function loadEmptyFolders(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEmptyFolders(paths: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(paths));
}

interface CommandState {
  entries: CommandEntry[];
  emptyFolders: string[];
  loading: boolean;

  load: () => Promise<void>;
  upsert: (entry: CommandEntry) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addEmptyFolder: (path: string) => void;
  removeEmptyFolder: (path: string) => void;
  renameFolder: (oldPath: string, newPath: string) => Promise<void>;
}

export const useCommandStore = create<CommandState>((set, get) => ({
  entries: [],
  emptyFolders: loadEmptyFolders(),
  loading: false,

  async load() {
    set({ loading: true });
    try {
      const entries = await listCommands();
      set({ entries, emptyFolders: loadEmptyFolders() });
    } catch {
      // Backend not ready; keep previous state
    } finally {
      set({ loading: false });
    }
  },

  async upsert(entry) {
    const saved = await saveCommand(entry);
    set((s) => {
      const idx = s.entries.findIndex((e) => e.id === saved.id);
      const copy = idx >= 0
        ? s.entries.map((e, i) => (i === idx ? saved : e))
        : [...s.entries, saved];

      // If this command fills a previously empty folder, prune it
      const cat = (saved.category || "").trim();
      let folders = [...s.emptyFolders];
      if (cat) {
        folders = folders.filter((p) => !isPathUnderOrEqual(p, cat));
      }

      return { entries: copy, emptyFolders: folders };
    });
    // Persist empty-folder pruning
    const cat = (saved.category || "").trim();
    if (cat) {
      const folders = get().emptyFolders.filter((p) => !isPathUnderOrEqual(p, cat));
      saveEmptyFolders(folders);
    }
  },

  async remove(id) {
    const entry = get().entries.find((e) => e.id === id);
    await deleteCommand(id);
    set((s) => ({
      entries: s.entries.filter((e) => e.id !== id),
    }));
    // If the deleted entry was the last in its category, category disappears
    // (no need to create empty folder — user explicitly creates those)
  },

  addEmptyFolder(path: string) {
    const trimmed = path.trim();
    if (!trimmed) return;
    set((s) => {
      if (s.emptyFolders.includes(trimmed)) return s;
      const folders = [...s.emptyFolders, trimmed];
      saveEmptyFolders(folders);
      return { emptyFolders: folders };
    });
  },

  removeEmptyFolder(path: string) {
    set((s) => {
      const folders = s.emptyFolders.filter((p) => p !== path && !p.startsWith(path + "/"));
      saveEmptyFolders(folders);
      return { emptyFolders: folders };
    });
  },

  async renameFolder(oldPath: string, newPath: string) {
    const s = get();
    const toUpdate = s.entries.filter(
      (e) => {
        const cat = e.category.trim();
        return cat === oldPath || cat.startsWith(oldPath + "/");
      },
    );

    // Update commands with new category path
    for (const e of toUpdate) {
      const newCat = newPath + e.category.trim().slice(oldPath.length);
      await saveCommand({ ...e, category: newCat });
    }

    // Update empty folders
    const newEntries = s.entries.map((e) => {
      const cat = e.category.trim();
      if (cat === oldPath || cat.startsWith(oldPath + "/")) {
        return { ...e, category: newPath + cat.slice(oldPath.length) };
      }
      return e;
    });

    const newFolders = s.emptyFolders.map((p) => {
      if (p === oldPath || p.startsWith(oldPath + "/")) {
        return newPath + p.slice(oldPath.length);
      }
      return p;
    });
    saveEmptyFolders(newFolders);

    set({ entries: newEntries, emptyFolders: newFolders });
  },
}));

// ── helpers ────────────────────────────────────────────────────────────────

/** True if `child` equals `parent` or starts with `parent/` */
function isPathUnderOrEqual(parent: string, child: string): boolean {
  return child === parent || child.startsWith(parent + "/");
}
