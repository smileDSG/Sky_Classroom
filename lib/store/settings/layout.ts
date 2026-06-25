export interface LayoutSliceState {
  timelineCollapsed: boolean;
  chatAreaCollapsed: boolean;
  chatAreaWidth: number;
}

export interface LayoutSliceActions {
  setTimelineCollapsed: (collapsed: boolean) => void;
  setChatAreaCollapsed: (collapsed: boolean) => void;
  setChatAreaWidth: (width: number) => void;
}

export function getDefaultLayoutState() {
  return {
    timelineCollapsed: true,
    chatAreaCollapsed: true,
    chatAreaWidth: 320,
  };
}

export function createLayoutActions(
  set: (
    partial: Partial<LayoutSliceState> | ((state: LayoutSliceState) => Partial<LayoutSliceState>),
  ) => void,
): LayoutSliceActions {
  return {
    setTimelineCollapsed: (collapsed) => set({ timelineCollapsed: collapsed }),
    setChatAreaCollapsed: (collapsed) => set({ chatAreaCollapsed: collapsed }),
    setChatAreaWidth: (width) => set({ chatAreaWidth: width }),
  };
}
