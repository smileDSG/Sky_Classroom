'use client';

import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { AssistantPanel } from './assistant-panel';
import { AssistantConfig } from './assistant-config';

export function AssistantFab() {
  const isOpen = useSkyClassroomStore((s) => s.isOpen);
  const toggleOpen = useSkyClassroomStore((s) => s.toggleOpen);

  if (!isOpen) {
    return (
      <button
        type="button"
        aria-label="打开小镜课堂"
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full shadow-lg transition-transform hover:scale-110 hover:shadow-xl"
      >
        <img src="/avatars/kagami/chibi.png" alt="小镜" className="h-full w-full object-cover" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex w-[380px] flex-col gap-3">
      <AssistantPanel />
      <AssistantConfig />
    </div>
  );
}
