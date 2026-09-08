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

export function BoldAccentCover({ dna, title, subtitle }: Props) {
  const { colors, fonts, decoration } = dna;
  const density = decoration.density;

  // Bottom accent bar for moderate/rich
  const showBottomBar = density !== 'sparse';

  return (
    <g>
      {/* Background */}
      <rect x="0" y="0" width="13.33" height="7.5" fill={`#${colors.coverBg}`} />

      {/* Thick top accent bar */}
      <rect x="0" y="0" width="13.33" height="1.2" fill={`#${colors.accent}`} opacity="0.4" />

      {/* Second thinner bar */}
      <rect x="0" y="1.2" width="13.33" height="0.008" fill={`#${colors.accent}`} />

      {/* Tag in top bar */}
      <text
        x="1.0"
        y="0.55"
        fontSize={ptToInch(11)}
        fontFamily={fonts.en}
        fill={`#${colors.textOnDark}`}
        letterSpacing="0.03"
      >
        {tagline(subtitle)}
      </text>

      {/* Title below bars */}
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

      {/* Left accent bar next to title */}
      <rect
        x="0.3"
        y="2.5"
        width="0.04"
        height={ptToInch(fonts.headingSize)}
        fill={`#${colors.accent}`}
      />

      {/* Subtitle */}
      <text
        x="1.0"
        y="4.2"
        fontSize={ptToInch(15)}
        fontFamily={fonts.bodyStack || fonts.body}
        fill={`#${colors.textMuted}`}
      >
        {subtitle}
      </text>

      {/* Bottom accent bar */}
      {showBottomBar && (
        <rect x="0" y="6.2" width="13.33" height="0.006" fill={`#${colors.accent}`} opacity="0.6" />
      )}

      {/* Date */}
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
