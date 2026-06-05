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

export function CornerDramaCover({ dna, title, subtitle }: Props) {
  const { colors, fonts, decoration } = dna;
  const density = decoration.density;

  // Decorative elements based on density
  const decorations = [] as React.ReactNode[];
  if (density === 'moderate' || density === 'rich') {
    decorations.push(
      <rect key="cd1" x="8.5" y="0" width="5" height="5" fill={`#${colors.accent}`} opacity="0.08" />,
      <ellipse key="cd2" cx="11.75" cy="1.75" rx="1.25" ry="1.25" fill={`#${colors.accentSecondary}`} opacity="0.12" />,
    );
  }
  if (density === 'rich') {
    decorations.push(
      <line key="cd3" x1="8.5" y1="5" x2="8.5" y2="7.5" stroke={`#${colors.accent}`} strokeWidth="0.015" opacity="0.6" />,
      <line key="cd4" x1="8.5" y1="5" x2="13.33" y2="5" stroke={`#${colors.accent}`} strokeWidth="0.015" opacity="0.6" />,
    );
  }

  return (
    <g>
      {/* Background */}
      <rect x="0" y="0" width="13.33" height="7.5" fill={`#${colors.coverBg}`} />

      {/* Top-right corner drama */}
      {decorations}

      {/* Small corner indicator bottom-left */}
      <rect x="0" y="6.5" width="0.8" height="1.0" fill={`#${colors.accent}`} opacity="0.15" />

      {/* Tag */}
      <text
        x="1.0"
        y="1.2"
        fontSize={ptToInch(11)}
        fontFamily={fonts.en}
        fill={`#${colors.accent}`}
        letterSpacing="0.03"
      >
        {tagline(subtitle)}
      </text>

      {/* Title (left, away from corner drama) */}
      <text
        x="1.0"
        y="2.5"
        fontSize={ptToInch(fonts.headingSize)}
        fontFamily={fonts.headingStack || fonts.heading}
        fill={`#${colors.textOnDark}`}
        fontWeight="bold"
      >
        {title}
      </text>

      {/* Subtitle */}
      <text
        x="1.0"
        y="4.3"
        fontSize={ptToInch(15)}
        fontFamily={fonts.bodyStack || fonts.body}
        fill={`#${colors.textMuted}`}
      >
        {subtitle}
      </text>

      {/* Date bottom-left */}
      <text
        x="1.0"
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
