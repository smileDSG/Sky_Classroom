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

export function VerticalPoemCover({ dna, title, subtitle }: Props) {
  const { colors, fonts, decoration } = dna;
  const density = decoration.density;

  // Remove spaces and split into characters for vertical layout
  const chars = title.replace(/\s/g, '').split('');
  const charH = 0.55;
  const totalH = chars.length * charH;
  const startY = (7.5 - totalH) / 2;

  // Decorative elements
  const decorations = [] as React.ReactNode[];
  if (density === 'moderate' || density === 'rich') {
    decorations.push(
      <rect key="vp1" x="0" y="0" width="13.33" height="0.04" fill={`#${colors.accent}`} opacity="0.4" />,
      <rect key="vp2" x="0" y="7.46" width="13.33" height="0.04" fill={`#${colors.accent}`} opacity="0.4" />,
    );
  }
  if (density === 'rich') {
    decorations.push(
      <rect key="vp3" x="10.8" y="1.2" width="1.8" height="1.8" fill={`#${colors.accent}`} opacity="0.12" />,
    );
  }

  return (
    <g>
      {/* Background */}
      <rect x="0" y="0" width="13.33" height="7.5" fill={`#${colors.coverBg}`} />

      {/* Decorative bars */}
      {decorations}

      {/* Right side seal-like square */}
      <rect x="10.8" y="1.2" width="1.8" height="1.8" fill={`#${colors.accent}`} opacity="0.12" />

      {/* Vertical title characters */}
      {chars.map((char, i) => (
        <text
          key={i}
          x="9.5"
          y={startY + i * charH + 0.4}
          fontSize={ptToInch(28)}
          fontFamily={fonts.headingStack || fonts.heading}
          fill={`#${colors.textOnDark}`}
          fontWeight="bold"
          textAnchor="middle"
        >
          {char}
        </text>
      ))}

      {/* Tag top-left */}
      <text
        x="1.0"
        y="1.2"
        fontSize={ptToInch(10)}
        fontFamily={fonts.en}
        fill={`#${colors.accent}`}
        letterSpacing="0.03"
      >
        {tagline(subtitle)}
      </text>

      {/* Subtitle bottom */}
      <text
        x="2.5"
        y="6.0"
        fontSize={ptToInch(13)}
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
