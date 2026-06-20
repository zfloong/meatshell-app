import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useWindowDrag } from "@/hooks/useWindowDrag";

export default function TitleBar() {
  const startDrag = useWindowDrag();

  const minimize = useCallback(() => getCurrentWindow().minimize(), []);
  const toggleMaximize = useCallback(
    () => getCurrentWindow().toggleMaximize(),
    [],
  );
  const close = useCallback(() => getCurrentWindow().close(), []);

  return (
    <header
      data-tauri-drag-region
      onMouseDown={startDrag}
      className="flex h-10 items-center justify-between bg-[var(--surface-bright)] select-none flex-shrink-0"
    >
      {/* left: app title */}
      <div className="flex items-center gap-2 px-3">
        <span className="text-sm font-medium text-[var(--text)] tracking-wide">
          Meatshell
        </span>
      </div>

      {/* right: window controls */}
      <div className="no-drag flex h-full">
        <button
          onClick={minimize}
          className="flex h-full w-11 items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover)] hover:text-[var(--text)] transition-colors"
          aria-label="Minimize"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={toggleMaximize}
          className="flex h-full w-11 items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--hover)] hover:text-[var(--text)] transition-colors"
          aria-label="Maximize"
        >
          <Square size={14} />
        </button>
        <button
          onClick={close}
          className="flex h-full w-11 items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--error)] hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  );
}
