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
  const cleaned = subtitle
    .toUpperCase()
    .replace(/[^A-Za-z\s]/g, '')
    .slice(0, 30);
  return cleaned || 'TEACHING COURSEWARE';
}

export function MinimalTypeCover({ dna, title, subtitle }: Props) {
  const { colors, fonts, decoration } = dna;
  const density = decoration.density;

  // Even minimal has a thin separator line
  const showSeparator = density !== 'sparse';
  const showTag = density === 'rich';

  return (
    <g>
      {/* Background */}
      <rect x="0" y="0" width="13.33" height="7.5" fill={`#${colors.coverBg}`} />

      {/* Large centered title */}
      <text
        x="6.665"
        y="3.0"
        fontSize={ptToInch(fonts.headingSize + 8)}
        fontFamily={fonts.headingStack || fonts.heading}
        fill={`#${colors.textOnDark}`}
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {title}
      </text>

      {/* Thin separator line */}
      {showSeparator && (
        <line
          x1="5.5"
          y1="4.3"
          x2="7.83"
          y2="4.3"
          stroke={`#${colors.accent}`}
          strokeWidth="0.014"
        />
      )}

      {/* Subtitle */}
      <text
        x="6.665"
        y="4.8"
        fontSize={ptToInch(15)}
        fontFamily={fonts.bodyStack || fonts.body}
        fill={`#${colors.textMuted}`}
        textAnchor="middle"
      >
        {subtitle}
      </text>

      {/* Tag (only for rich) */}
      {showTag && (
        <text
          x="6.665"
          y="5.6"
          fontSize={ptToInch(10)}
          fontFamily={fonts.en}
          fill={`#${colors.textMuted}`}
          letterSpacing="0.05"
          textAnchor="middle"
        >
          {tagline(subtitle)}
        </text>
      )}

      {/* Date */}
      <text
        x="6.665"
        y="6.6"
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
