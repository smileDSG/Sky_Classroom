'use client';

import { ScreenElement } from './ScreenElement';
import { HighlightOverlay } from './HighlightOverlay';
import { SpotlightOverlay } from './SpotlightOverlay';
import { LaserOverlay } from './LaserOverlay';
import { useSlideBackgroundStyle } from '@/lib/hooks/use-slide-background-style';
import { useCanvasStore } from '@/lib/store';
import { useSceneSelector } from '@/lib/contexts/scene-context';
import { findElementGeometry } from '@/lib/utils/geometry';
import { polishSlideElements } from '@/lib/generation/scene-content/slide-polish';
import type { PPTElement, SlideBackground } from '@/lib/types/slides';
import type { SlideContent } from '@/lib/types/stage';
import type { PercentageGeometry } from '@/lib/types/action';
import { useViewportSize } from './Canvas/hooks/useViewportSize';
import { useRef, useMemo } from 'react';
import { AnimatePresence } from 'motion/react';
import { TemplateCanvas } from '../TemplateCanvas';
import type { TemplateSlideData } from '@/lib/templates/pptd-types';

export function ScreenCanvas() {
  const canvasScale = useCanvasStore.use.canvasScale();
  const elements = useSceneSelector<SlideContent, PPTElement[]>(
    (content) => content.canvas.elements,
  );
  const sceneTitle = useSceneSelector<SlideContent, string | undefined>(
    (content) =>
      content.canvas.elements
        .filter((element) => element.type === 'text' && element.top < 170)
        .map((element) =>
          String((element as { content?: string }).content ?? '').replace(/<[^>]+>/g, ''),
        )[0],
  );
  const displayElements = useMemo(
    () => polishSlideElements(elements, { title: sceneTitle, decorate: false }),
    [elements, sceneTitle],
  );
  const canvasRef = useRef<HTMLDivElement>(null);

  // Viewport size and positioning
  const { viewportStyles } = useViewportSize(canvasRef);

  // Get background style
  const background = useSceneSelector<SlideContent, SlideBackground | undefined>(
    (content) => content.canvas.background,
  );
  const { backgroundStyle } = useSlideBackgroundStyle(background);
  const templateData = useSceneSelector<SlideContent, TemplateSlideData | undefined>(
    (content) => content.canvas.templateData,
  );

  // Get visual effect state
  const laserElementId = useCanvasStore.use.laserElementId();
  const laserOptions = useCanvasStore.use.laserOptions();
  const zoomTarget = useCanvasStore.use.zoomTarget();

  // Compute laser pointer geometry
  const laserGeometry = useMemo<PercentageGeometry | null>(() => {
    if (!laserElementId) return null;
    const element = displayElements.find((el) => el.id === laserElementId);
    if (!element) return null;
    return findElementGeometry(
      { type: 'slide', content: { canvas: { elements: displayElements } } } as Record<
        string,
        unknown
      >,
      laserElementId,
    );
  }, [laserElementId, displayElements]);

  // Compute zoom target geometry
  const zoomGeometry = useMemo<PercentageGeometry | null>(() => {
    if (!zoomTarget) return null;
    const element = displayElements.find((el) => el.id === zoomTarget.elementId);
    if (!element) return null;
    return findElementGeometry(
      { type: 'slide', content: { canvas: { elements: displayElements } } } as Record<
        string,
        unknown
      >,
      zoomTarget.elementId,
    );
  }, [zoomTarget, displayElements]);

  return (
    <div className="relative h-full w-full overflow-hidden select-none" ref={canvasRef}>
      <div
        className="absolute shadow-[0_0_0_1px_rgba(0,0,0,0.01),0_0_12px_0_rgba(0,0,0,0.1)] rounded-lg overflow-hidden transition-transform duration-700"
        style={{
          width: `${viewportStyles.width * canvasScale}px`,
          height: `${viewportStyles.height * canvasScale}px`,
          left: `${viewportStyles.left}px`,
          top: `${viewportStyles.top}px`,
          ...(zoomTarget && zoomGeometry
            ? {
                transform: `scale(${zoomTarget.scale})`,
                transformOrigin: `${zoomGeometry.centerX}% ${zoomGeometry.centerY}%`,
              }
            : {}),
        }}
      >
        {/* Background layer */}
        {!templateData && (
          <div
            className="w-full h-full bg-position-center rounded-lg"
            style={{ ...backgroundStyle }}
          />
        )}

        {/* Content layer - scaled */}
        {templateData ? (
          <TemplateCanvas
            page={templateData.page}
            manifestTheme={templateData.theme}
            canvasWidth={viewportStyles.width * canvasScale}
            canvasHeight={viewportStyles.height * canvasScale}
          />
        ) : (
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{
              width: `${viewportStyles.width}px`,
              height: `${viewportStyles.height}px`,
              transform: `scale(${canvasScale})`,
            }}
          >
            {displayElements.map((element, index) => (
              <ScreenElement key={element.id} elementInfo={element} elementIndex={index + 1} />
            ))}
            {/* Highlight overlay - stacked above elements */}
            <HighlightOverlay />
          </div>
        )}

        {/* Spotlight overlay - covers the entire slide, positioned via DOM measurement */}
        <SpotlightOverlay />

        {/* Visual effects layer - outside the scale layer, using percentage coordinates */}
        <div className="absolute inset-0 pointer-events-none" style={{ padding: '5%' }}>
          <div className="relative w-full h-full">
            {/* Laser pointer overlay */}
            <AnimatePresence>
              {laserElementId && laserGeometry && (
                <LaserOverlay
                  key={`laser-${laserElementId}`}
                  geometry={laserGeometry}
                  color={laserOptions?.color}
                  duration={laserOptions?.duration}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
