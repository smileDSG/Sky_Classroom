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

export function GradientWashCover({ dna, title, subtitle }: Props) {
  const { colors, fonts, decoration } = dna;
  const density = decoration.density;

  // Decorative circles based on density
  const decorations = [] as React.ReactNode[];
  if (density === 'moderate' || density === 'rich') {
    decorations.push(
      <circle key="gw1" cx="3" cy="2.5" r="0.9" fill={`#${colors.accentLight}`} opacity="0.15" />,
      <circle key="gw2" cx="10.5" cy="5.5" r="1.1" fill={`#${colors.accentLight}`} opacity="0.15" />,
    );
  }
  if (density === 'rich') {
    decorations.push(
      <circle key="gw3" cx="6.5" cy="4.0" r="0.6" fill={`#${colors.accentLight}`} opacity="0.12" />,
    );
  }

  return (
    <g>
      {/* Background */}
      <rect x="0" y="0" width="13.33" height="7.5" fill={`#${colors.coverBg}`} />

      {/* Soft gradient overlays */}
      <rect x="0" y="0" width="13.33" height="4.5" fill={`#${colors.accentSecondary}`} opacity="0.08" />
      <rect x="0" y="3.0" width="13.33" height="4.5" fill={`#${colors.accent}`} opacity="0.06" />

      {/* Decorative circles */}
      {decorations}

      {/* Tag */}
      <text
        x="6.665"
        y="1.0"
        fontSize={ptToInch(11)}
        fontFamily={fonts.en}
        fill={`#${colors.accent}`}
        letterSpacing="0.04"
        textAnchor="middle"
      >
        {tagline(subtitle)}
      </text>

      {/* Title */}
      <text
        x="6.665"
        y="2.8"
        fontSize={ptToInch(fonts.headingSize)}
        fontFamily={fonts.headingStack || fonts.heading}
        fill={`#${colors.textOnDark}`}
        fontWeight="bold"
        textAnchor="middle"
      >
        {title}
      </text>

      {/* Subtitle */}
      <text
        x="6.665"
        y="4.2"
        fontSize={ptToInch(15)}
        fontFamily={fonts.bodyStack || fonts.body}
        fill={`#${colors.textMuted}`}
        textAnchor="middle"
      >
        {subtitle}
      </text>

      {/* Date */}
      <text
        x="6.665"
        y="6.5"
        fontSize={ptToInch(10)}
        fontFamily={fonts.bodyStack || fonts.body}
        fill={`#${colors.textMuted}`}
        textAnchor="middle"
      >
        {todayDate()}
      </text>
    </g>
  );
}
