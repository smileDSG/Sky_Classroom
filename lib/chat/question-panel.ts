export function revealQuestionPanel(
  switchToChatTab: (() => void) | undefined,
  setCollapsed: (collapsed: boolean) => void,
): void {
  switchToChatTab?.();
  setCollapsed(false);
}
