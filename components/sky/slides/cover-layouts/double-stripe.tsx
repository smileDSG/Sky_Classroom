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

export function DoubleStripeCover({ dna, title, subtitle }: Props) {
  const { colors, fonts, decoration } = dna;
  const density = decoration.density;

  // Thin accent stripe based on density
  const showThinStripe = density !== 'sparse';

  return (
    <g>
      {/* Background */}
      <rect x="0" y="0" width="13.33" height="7.5" fill={`#${colors.coverBg}`} />

      {/* Top thick stripe */}
      <rect x="0" y="1.3" width="13.33" height="0.06" fill={`#${colors.accent}`} opacity="0.7" />

      {/* Bottom thick stripe */}
      <rect x="0" y="4.8" width="13.33" height="0.06" fill={`#${colors.accent}`} opacity="0.7" />

      {/* Thin accent stripe above title */}
      {showThinStripe && (
        <rect x="1.0" y="1.6" width="3.0" height="0.03" fill={`#${colors.accentSecondary}`} opacity="0.6" />
      )}

      {/* Tag */}
      <text
        x="1.0"
        y="0.6"
        fontSize={ptToInch(10)}
        fontFamily={fonts.en}
        fill={`#${colors.accent}`}
        letterSpacing="0.03"
      >
        {tagline(subtitle)}
      </text>

      {/* Title between stripes */}
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

      {/* Subtitle below bottom stripe */}
      <text
        x="1.0"
        y="5.2"
        fontSize={ptToInch(15)}
        fontFamily={fonts.bodyStack || fonts.body}
        fill={`#${colors.textMuted}`}
      >
        {subtitle}
      </text>

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
