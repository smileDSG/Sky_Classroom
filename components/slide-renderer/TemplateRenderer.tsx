'use client';

import React from 'react';
import type { TemplatePage, PPTDManifest } from '@/lib/templates/pptd-types';
import { VariableResolver } from '@/lib/templates/variable-resolver';
import { TemplateElement } from './TemplateElement';

interface Props {
  page: TemplatePage;
  manifestTheme: PPTDManifest['theme'];
  scale?: number;
}

export function TemplateRenderer({ page, manifestTheme, scale = 1 }: Props) {
  const resolver = new VariableResolver({
    title: '',
    size: [1280, 720],
    theme: manifestTheme,
    pages: [],
  });

  // Diagnostic logging
  // eslint-disable-next-line no-console
  console.log('[TemplateRenderer] Rendering page:', {
    pageType: page.pageType,
    elementCount: page.elements?.length ?? 0,
    bgType: page.background?.type ?? 'none',
    scale,
  });

  const bgStyle: React.CSSProperties = {};
  if (page.background?.type === 'solid') {
    bgStyle.backgroundColor = resolver.resolveColor(page.background.color ?? '$background');
  } else if (page.background?.type === 'gradient') {
    const stops = page.background.stops
      ?.map((s) => `${resolver.resolveColor(s.color)} ${s.position * 100}%`)
      .join(', ');
    bgStyle.background = `linear-gradient(${page.background.angle ?? 90}deg, ${stops})`;
  } else if (page.background?.type === 'image') {
    bgStyle.backgroundImage = `url(${page.background.color ?? ''})`;
    bgStyle.backgroundSize = 'cover';
    bgStyle.backgroundPosition = 'center';
  }

  // Log resolved background for debugging
  // eslint-disable-next-line no-console
  console.log('[TemplateRenderer] Background style:', bgStyle);

  return (
    <div
      style={{
        position: 'relative',
        width: 1280 * scale,
        height: 720 * scale,
        overflow: 'hidden',
        ...bgStyle,
      }}
    >
      {page.elements?.map((el, idx) => (
        <TemplateElement
          key={el.elementId ?? idx}
          element={el}
          resolver={resolver}
          scale={scale}
        />
      ))}
    </div>
  );
}
