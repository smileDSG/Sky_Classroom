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

export function BigNumberCover({ dna, title, subtitle }: Props) {
  const { colors, fonts, decoration } = dna;
  const density = decoration.density;
  const big = title.length <= 6 ? title : title.slice(0, 4);

  // Decorative elements based on density
  const decorations = [] as React.ReactNode[];
  if (density === 'moderate' || density === 'rich') {
    decorations.push(
      <circle
        key="bn1"
        cx="11.5"
        cy="1.5"
        r="0.8"
        fill={`#${colors.accentSecondary}`}
        opacity="0.08"
      />,
    );
  }
  if (density === 'rich') {
    decorations.push(
      <circle key="bn2" cx="1.5" cy="6.0" r="0.5" fill={`#${colors.accent}`} opacity="0.1" />,
      <circle
        key="bn3"
        cx="12.5"
        cy="6.5"
        r="0.4"
        fill={`#${colors.accentSecondary}`}
        opacity="0.06"
      />,
    );
  }

  return (
    <g>
      {/* Background */}
      <rect x="0" y="0" width="13.33" height="7.5" fill={`#${colors.coverBg}`} />

      {/* Huge background text (watermark) */}
      <text
        x="6.665"
        y="3.5"
        fontSize={ptToInch(120)}
        fontFamily={fonts.en}
        fill={`#${colors.accent}`}
        opacity="0.06"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {big}
      </text>

      {/* Decorative circles */}
      {decorations}

      {/* Tag */}
      <text
        x="6.665"
        y="0.9"
        fontSize={ptToInch(10)}
        fontFamily={fonts.en}
        fill={`#${colors.accent}`}
        letterSpacing="0.04"
        textAnchor="middle"
      >
        {tagline(subtitle)}
      </text>

      {/* Bottom info bar */}
      <rect
        x="0"
        y="5.5"
        width="13.33"
        height="2.0"
        fill={`#${colors.textPrimary}`}
        opacity="0.15"
      />

      {/* Title */}
      <text
        x="6.665"
        y="6.0"
        fontSize={ptToInch(36)}
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
        y="6.7"
        fontSize={ptToInch(14)}
        fontFamily={fonts.bodyStack || fonts.body}
        fill={`#${colors.textMuted}`}
        textAnchor="middle"
      >
        {subtitle}
      </text>
    </g>
  );
}
