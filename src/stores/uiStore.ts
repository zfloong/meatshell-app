import { create } from "zustand";

/**
 * Central UI state store.
 *
 * - `isSidebarOpen` controls sidebar collapse/expand (with 200ms CSS transition).
 * - `bottomPanelHeight` is the resizable bottom panel height in pixels,
 *   clamped between `MIN_PANEL_HEIGHT` and `MAX_PANEL_HEIGHT`.
 */
interface UIState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  bottomPanelHeight: number;
  setBottomPanelHeight: (height: number) => void;
}

export const MIN_PANEL_HEIGHT = 100;
export const MAX_PANEL_HEIGHT = 500;
const DEFAULT_PANEL_HEIGHT = 200;

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

  bottomPanelHeight: DEFAULT_PANEL_HEIGHT,
  setBottomPanelHeight: (height) =>
    set({
      bottomPanelHeight: Math.max(
        MIN_PANEL_HEIGHT,
        Math.min(MAX_PANEL_HEIGHT, Math.round(height)),
      ),
    }),
}));
