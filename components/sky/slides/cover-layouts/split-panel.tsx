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

export function SplitPanelCover({ dna, title, subtitle }: Props) {
  const { colors, fonts, decoration } = dna;
  const density = decoration.density;

  // Right side decorative shapes
  const decorations = [] as React.ReactNode[];
  if (density === 'moderate' || density === 'rich') {
    decorations.push(
      <circle key="sp1" cx="10.0" cy="2.5" r="1.5" fill={`#${colors.accent}`} opacity="0.08" />,
    );
  }
  if (density === 'rich') {
    decorations.push(
      <circle
        key="sp2"
        cx="11.0"
        cy="5.0"
        r="1.0"
        fill={`#${colors.accentSecondary}`}
        opacity="0.06"
      />,
      <circle key="sp3" cx="9.0" cy="4.0" r="0.6" fill={`#${colors.accent}`} opacity="0.1" />,
    );
  }

  return (
    <g>
      {/* Light background */}
      <rect x="0" y="0" width="13.33" height="7.5" fill={`#${colors.contentBg}`} />

      {/* Dark left panel */}
      <rect x="0" y="0" width="6" height="7.5" fill={`#${colors.coverBg}`} />

      {/* Accent stripe at split */}
      <rect x="6" y="0" width="0.04" height="7.5" fill={`#${colors.accent}`} />

      {/* Right side decorative shapes */}
      {decorations}

      {/* Tag on left */}
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

      {/* Title on left panel */}
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
        y="3.8"
        fontSize={ptToInch(14)}
        fontFamily={fonts.bodyStack || fonts.body}
        fill={`#${colors.textMuted}`}
      >
        {subtitle}
      </text>

      {/* Date on right panel */}
      <text
        x="7.0"
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
