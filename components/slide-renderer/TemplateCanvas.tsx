'use client';

import React from 'react';
import type { TemplatePage, PPTDManifest } from '@/lib/templates/pptd-types';
import { TemplateRenderer } from './TemplateRenderer';

interface Props {
  page: TemplatePage;
  manifestTheme: PPTDManifest['theme'];
  canvasWidth?: number;
  canvasHeight?: number;
}

export function TemplateCanvas({
  page,
  manifestTheme,
  canvasWidth = 1000,
  canvasHeight = 562.5,
}: Props) {
  const scaleX = canvasWidth / 1280;
  const scaleY = canvasHeight / 720;
  const scale = Math.min(scaleX, scaleY);

  return (
    <div
      style={{
        width: canvasWidth,
        height: canvasHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <TemplateRenderer page={page} manifestTheme={manifestTheme} scale={scale} />
    </div>
  );
}
