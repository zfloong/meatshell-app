import { useCallback, useEffect, useRef } from "react";
import { useUIStore, MIN_PANEL_HEIGHT, MAX_PANEL_HEIGHT } from "@/stores/uiStore";
import FileExplorer from "./FileExplorer";

/**
 * Bottom panel with a draggable split bar at the top.
 * Height is controlled via `uiStore.bottomPanelHeight`.
 */
export default function ResizablePanel() {
  const height = useUIStore((s) => s.bottomPanelHeight);
  const setBottomPanelHeight = useUIStore((s) => s.setBottomPanelHeight);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startY.current = e.clientY;
      startHeight.current = height;
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [height],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - e.clientY;
      setBottomPanelHeight(startHeight.current + delta);
    };

    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [setBottomPanelHeight]);

  return (
    <div
      ref={panelRef}
      className="flex flex-col flex-shrink-0"
      style={{ height }}
    >
      {/* Draggable split bar — 4px, accent on hover */}
      <div
        onMouseDown={onMouseDown}
        className="h-1 bg-transparent hover:bg-[var(--accent)] cursor-row-resize transition-colors flex-shrink-0"
      />

      {/* Panel body */}
      <div className="flex-1 bg-[var(--bg-surface)] overflow-hidden">
        <FileExplorer />
      </div>
    </div>
  );
}
