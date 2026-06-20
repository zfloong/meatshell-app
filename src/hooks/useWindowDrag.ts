import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Returns a mouse-down handler that starts native OS window dragging.
 * Attach to the title bar element via `onMouseDown={startDrag}`.
 */
export function useWindowDrag() {
  const startDrag = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      // Only trigger on primary (left) button
      if (e.button !== 0) return;
      getCurrentWindow().startDragging();
    },
    [],
  );

  return startDrag;
}
