export interface LayoutSliceState {
  sidebarCollapsed: boolean;
  chatAreaCollapsed: boolean;
  chatAreaWidth: number;
}

export interface LayoutSliceActions {
  setSidebarCollapsed: (collapsed: boolean) => void;
  setChatAreaCollapsed: (collapsed: boolean) => void;
  setChatAreaWidth: (width: number) => void;
}

export function getDefaultLayoutState() {
  return {
    sidebarCollapsed: true,
    chatAreaCollapsed: false,
    chatAreaWidth: 320,
  };
}

export function createLayoutActions(
  set: (
    partial:
      | Partial<LayoutSliceState>
      | ((state: LayoutSliceState) => Partial<LayoutSliceState>),
  ) => void,
): LayoutSliceActions {
  return {
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    setChatAreaCollapsed: (collapsed) => set({ chatAreaCollapsed: collapsed }),
    setChatAreaWidth: (width) => set({ chatAreaWidth: width }),
  };
}
