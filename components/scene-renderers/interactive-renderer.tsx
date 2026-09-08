'use client';

import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { InteractiveContent } from '@/lib/types/stage';
import { useWidgetIframeStore } from '@/lib/store/widget-iframe';
import { patchHtmlForIframe } from '@/lib/utils/iframe';
import { postProcessInteractiveHtml } from '@/lib/generation/interactive-post-processor';
import { cn } from '@/lib/utils';

interface InteractiveRendererProps {
  readonly content: InteractiveContent;
  readonly sceneId: string;
}

export function InteractiveRenderer({ content, sceneId }: InteractiveRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const registerIframe = useWidgetIframeStore((state) => state.registerIframe);
  const setActiveScene = useWidgetIframeStore((state) => state.setActiveScene);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Re-process persisted HTML at render time so existing widgets also get the
  // layout baseline + adaptive proportion fixer (post-processing is idempotent).
  const patchedHtml = useMemo(() => {
    if (!content.html) return undefined;
    return patchHtmlForIframe(postProcessInteractiveHtml(content.html));
  }, [content.html]);

  // Create iframe messaging callback
  const sendMessageToIframe = useCallback((type: string, payload: Record<string, unknown>) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type, ...payload }, '*');
    }
  }, []);

  // Register iframe messaging callback on mount, unregister on unmount
  // Key by sceneId to prevent race conditions on scene switch
  useEffect(() => {
    registerIframe(sceneId, sendMessageToIframe);
    setActiveScene(sceneId);
    return () => {
      registerIframe(sceneId, null);
    };
  }, [sceneId, registerIframe, sendMessageToIframe, setActiveScene]);

  // Sync fullscreen state with document fullscreenchange events
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-black">
      <iframe
        ref={iframeRef}
        srcDoc={patchedHtml}
        src={patchedHtml ? undefined : content.url}
        className="absolute inset-0 w-full h-full border-0"
        title={`Interactive Scene ${sceneId}`}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />

      <button
        type="button"
        onClick={toggleFullscreen}
        className={cn(
          'absolute bottom-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full',
          'bg-slate-900/70 text-white shadow-lg backdrop-blur-sm transition-colors',
          'hover:bg-slate-800/90 active:scale-95',
        )}
        aria-label={isFullscreen ? '退出全屏' : '全屏'}
        title={isFullscreen ? '退出全屏' : '全屏'}
      >
        {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
      </button>
    </div>
  );
}
