'use client';

import { FeedbackPanel } from './feedback-panel';

export function BetaChrome() {
  if (process.env.NEXT_PUBLIC_BETA_MODE !== 'true') {
    return null;
  }

  return (
    <>
      <div className="fixed top-3 left-3 z-[60] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/90 text-white text-xs font-bold shadow-sm backdrop-blur-sm">
        <span>BETA</span>
        <span className="opacity-75">v0.2.1</span>
      </div>
      <FeedbackPanel />
    </>
  );
}
