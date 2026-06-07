'use client';

import type { DesignDNA } from '@/lib/slides/agent/design-dna';
import { ptToInch } from '../cover-svg-renderer';

interface Props {
  dna: DesignDNA;
  title: string;
  subtitle: string;
}

function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tagline(subtitle: string): string {
  const cleaned = subtitle.toUpperCase().replace(/[^A-Za-z\s]/g, '').slice(0, 30);
  return cleaned || 'TEACHING COURSEWARE';
}

export function ImageZoneCover({ dna, title, subtitle }: Props) {
  const { colors, fonts, decoration } = dna;
  const density = decoration.density;

  // Decorative elements based on density
  const decorations = [] as React.ReactNode[];
  if (density === 'moderate' || density === 'rich') {
    decorations.push(
      <circle key="iz1" cx="1.2" cy="6.8" r="0.3" fill={`#${colors.accent}`} opacity="0.1" />,
    );
  }
  if (density === 'rich') {
    decorations.push(
      <circle key="iz2" cx="12.0" cy="0.8" r="0.2" fill={`#${colors.accentSecondary}`} opacity="0.08" />,
    );
  }

  return (
    <g>
      {/* Background */}
      <rect x="0" y="0" width="13.33" height="7.5" fill={`#${colors.coverBg}`} />

      {/* Right image zone with border */}
      <rect
        x="7.5"
        y="1.0"
        width="5.0"
        height="5.5"
        fill={`#${colors.accent}`}
        opacity="0.1"
        stroke={`#${colors.accent}`}
        strokeWidth="0.01"
      />

      {/* Cross lines in image zone (placeholder) */}
      <line x1="7.8" y1="1.3" x2="12.2" y2="6.3" stroke={`#${colors.accent}`} strokeWidth="0.008" opacity="0.3" />
      <line x1="12.2" y1="1.3" x2="7.8" y2="6.3" stroke={`#${colors.accent}`} strokeWidth="0.008" opacity="0.3" />

      {/* Small label in image zone */}
      <text
        x="10.0"
        y="3.8"
        fontSize={ptToInch(14)}
        fontFamily={fonts.headingStack || fonts.heading}
        fill={`#${colors.accent}`}
        opacity="0.5"
        textAnchor="middle"
      >
        [ 插 图 ]
      </text>

      {/* Decorative elements */}
      {decorations}

      {/* Tag */}
      <text
        x="0.8"
        y="1.0"
        fontSize={ptToInch(11)}
        fontFamily={fonts.en}
        fill={`#${colors.accent}`}
        letterSpacing="0.03"
      >
        {tagline(subtitle)}
      </text>

      {/* Accent line */}
      <line x1="0.8" y1="1.6" x2="1.8" y2="1.6" stroke={`#${colors.accent}`} strokeWidth="0.035" />

      {/* Title left */}
      <text
        x="0.8"
        y="2.5"
        fontSize={ptToInch(fonts.headingSize - 4)}
        fontFamily={fonts.headingStack || fonts.heading}
        fill={`#${colors.textOnDark}`}
        fontWeight="bold"
      >
        {title}
      </text>

      {/* Subtitle */}
      <text
        x="0.8"
        y="4.0"
        fontSize={ptToInch(14)}
        fontFamily={fonts.bodyStack || fonts.body}
        fill={`#${colors.textMuted}`}
      >
        {subtitle}
      </text>

      {/* Date */}
      <text
        x="0.8"
        y="6.6"
        fontSize={ptToInch(10)}
        fontFamily={fonts.bodyStack || fonts.body}
        fill={`#${colors.textMuted}`}
      >
        {todayDate()}
      </text>
    </g>
  );
}
