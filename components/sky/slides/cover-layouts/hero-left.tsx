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

export function HeroLeftCover({ dna, title, subtitle }: Props) {
  const { colors, fonts, decoration } = dna;
  const density = decoration.density;

  // Decorative elements based on density
  const decorations = [] as React.ReactNode[];
  if (density === 'moderate' || density === 'rich') {
    decorations.push(
      <circle key="c1" cx="10.2" cy="5.5" r="0.8" fill={`#${colors.accent}`} opacity="0.12" />,
    );
  }
  if (density === 'rich') {
    decorations.push(
      <circle key="c2" cx="11.5" cy="2.0" r="1.2" fill={`#${colors.accentSecondary}`} opacity="0.08" />,
      <circle key="c3" cx="9.5" cy="1.5" r="0.5" fill={`#${colors.accent}`} opacity="0.15" />,
    );
  }

  return (
    <g>
      {/* Background */}
      <rect x="0" y="0" width="13.33" height="7.5" fill={`#${colors.coverBg}`} />

      {/* Right accent area */}
      <rect x="7.5" y="0" width="5.83" height="7.5" fill={`#${colors.accent}`} opacity="0.05" />

      {/* Diagonal line */}
      <line x1="7.5" y1="7.5" x2="13.33" y2="0" stroke={`#${colors.accent}`} strokeWidth="0.02" opacity="0.6" />

      {/* Decorative circles */}
      {decorations}

      {/* Tag */}
      <text
        x="1.0"
        y="1.2"
        fontSize={ptToInch(12)}
        fontFamily={fonts.en}
        fill={`#${colors.accent}`}
        letterSpacing="0.04"
      >
        {tagline(subtitle)}
      </text>

      {/* Accent line */}
      <line x1="1.0" y1="1.85" x2="2.2" y2="1.85" stroke={`#${colors.accent}`} strokeWidth="0.035" />

      {/* Title */}
      <text
        x="1.0"
        y="2.9"
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
        y="4.1"
        fontSize={ptToInch(16)}
        fontFamily={fonts.bodyStack || fonts.body}
        fill={`#${colors.textMuted}`}
      >
        {subtitle}
      </text>

      {/* Date */}
      <text
        x="1.0"
        y="6.6"
        fontSize={ptToInch(11)}
        fontFamily={fonts.bodyStack || fonts.body}
        fill={`#${colors.textMuted}`}
      >
        {todayDate()}
      </text>
    </g>
  );
}
