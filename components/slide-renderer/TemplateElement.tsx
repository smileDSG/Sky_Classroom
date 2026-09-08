'use client';

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { findIconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { TemplateElement as TElement } from '@/lib/templates/pptd-types';
import { VariableResolver } from '@/lib/templates/variable-resolver';

interface Props {
  element: TElement;
  resolver: VariableResolver;
  scale?: number;
}

export function TemplateElement({ element, resolver, scale = 1 }: Props) {
  const [x, y, w, h] = element.bounds;

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: x * scale,
    top: y * scale,
    width: w * scale,
    height: h * scale,
  };

  // Diagnostic logging for first few elements
  if (element.elementId <= 'title' || element.elementId?.includes('title')) {
    // eslint-disable-next-line no-console
    console.log('[TemplateElement] Rendering:', {
      id: element.elementId,
      type: element.elementType,
      bounds: [x, y, w, h],
      scaledBounds: [x * scale, y * scale, w * scale, h * scale],
      hasText: !!element.content?.text,
      textPreview: element.content?.text?.slice(0, 50),
    });
  }

  switch (element.elementType) {
    case 'text':
      return (
        <TemplateTextElement
          element={element}
          resolver={resolver}
          style={baseStyle}
          scale={scale}
        />
      );
    case 'shape':
      return <TemplateShapeElement element={element} resolver={resolver} style={baseStyle} />;
    case 'icon':
      return <TemplateIconElement element={element} resolver={resolver} style={baseStyle} />;
    case 'image':
      return <TemplateImageElement element={element} style={baseStyle} />;
    case 'line':
      return <TemplateLineElement element={element} resolver={resolver} style={baseStyle} />;
    default:
      return null;
  }
}

function TemplateTextElement({
  element,
  resolver,
  style,
  scale,
}: {
  element: TElement;
  resolver: VariableResolver;
  style: React.CSSProperties;
  scale: number;
}) {
  const styleRef = element.content?.style;
  const resolvedStyle = styleRef ? resolver.resolveStyle(styleRef) : null;
  const color = element.content?.color
    ? resolver.resolveColor(element.content.color)
    : resolver.resolveColor(resolvedStyle?.color ?? '$text');
  const align = element.content?.align ?? ['left', 'top'];

  const alignMap: Record<string, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
    top: 'flex-start',
    middle: 'center',
    bottom: 'flex-end',
  };

  return (
    <div
      style={{
        ...style,
        color,
        fontSize: (resolvedStyle?.fontSize ?? 18) * scale,
        fontFamily: resolvedStyle?.fontFamily ?? 'Liter, MiSans, sans-serif',
        lineHeight: resolvedStyle?.lineHeight ?? 1.6,
        textAlign: align[0] as React.CSSProperties['textAlign'],
        display: 'flex',
        alignItems: alignMap[align[1]] as React.CSSProperties['alignItems'],
        overflow: 'hidden',
        wordBreak: 'break-word',
      }}
      dangerouslySetInnerHTML={{ __html: element.content?.text ?? '' }}
    />
  );
}

function TemplateShapeElement({
  element,
  resolver,
  style,
}: {
  element: TElement;
  resolver: VariableResolver;
  style: React.CSSProperties;
}) {
  const fillColor = element.fill ? resolver.resolveColor(element.fill.color) : 'transparent';
  const borderColor = element.border ? resolver.resolveColor(element.border.color) : 'transparent';

  const isEllipse = element.shapeName === 'ellipse';
  const isRoundRect = element.shapeName === 'roundRect';

  let borderRadius = '0';
  if (isEllipse) borderRadius = '50%';
  else if (isRoundRect) borderRadius = '8px';

  return (
    <div
      style={{
        ...style,
        backgroundColor: fillColor,
        borderRadius,
        border: element.border
          ? `${element.border.width}px ${element.border.style} ${borderColor}`
          : undefined,
        boxShadow: element.shadow
          ? `${element.shadow.offset[0]}px ${element.shadow.offset[1]}px ${element.shadow.blur}px ${resolver.resolveColor(element.shadow.color)}`
          : undefined,
      }}
    />
  );
}

function TemplateIconElement({
  element,
  resolver,
  style,
}: {
  element: TElement;
  resolver: VariableResolver;
  style: React.CSSProperties;
}) {
  const iconName = element.iconName ?? '';
  const color = element.fill
    ? resolver.resolveColor(element.fill.color)
    : resolver.resolveColor('$accent');
  const [prefix, name] = iconName.split(':') as [string, string];

  const size = Math.min(style.width as number, style.height as number);

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        fontSize: size * 0.6,
      }}
    >
      <FontAwesomeIconWrapper prefix={prefix} iconName={name} />
    </div>
  );
}

function FontAwesomeIconWrapper({ prefix, iconName }: { prefix: string; iconName: string }) {
  const iconDef = findIconDefinition({ prefix: prefix as any, iconName: iconName as any });

  if (!iconDef) {
    return (
      <span style={{ fontSize: '0.5em', opacity: 0.5 }}>
        [{prefix}:{iconName}]
      </span>
    );
  }

  return <FontAwesomeIcon icon={iconDef} />;
}

function TemplateImageElement({
  element,
  style,
}: {
  element: TElement;
  style: React.CSSProperties;
}) {
  return (
    <img
      src={element.src}
      alt=""
      style={{
        ...style,
        objectFit: 'cover',
        borderRadius: '8px',
      }}
      draggable={false}
    />
  );
}

function TemplateLineElement({
  element,
  resolver,
  style,
}: {
  element: TElement;
  resolver: VariableResolver;
  style: React.CSSProperties;
}) {
  const borderColor = element.border ? resolver.resolveColor(element.border.color) : '#000';

  return (
    <div
      style={{
        ...style,
        borderTop: element.border
          ? `${element.border.width}px ${element.border.style} ${borderColor}`
          : undefined,
      }}
    />
  );
}
