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

export function HeroCenteredCover({ dna, title, subtitle }: Props) {
  const { colors, fonts, decoration } = dna;
  const density = decoration.density;
  const cx = 6.665; // center x
  const cy = 3.2;   // center y

  // Decorative circles scattered around center
  const decorations = [] as React.ReactNode[];
  const baseCircles = [
    { dx: -4.5, dy: -1.8, r: 1.25 },
    { dx: 4.8, dy: -2.2, r: 1.5 },
    { dx: -3.5, dy: 2.5, r: 0.75 },
    { dx: 4.2, dy: 2.0, r: 1.0 },
    { dx: 0.5, dy: -2.8, r: 0.5 },
    { dx: -1.0, dy: 3.0, r: 0.4 },
  ];

  const count = density === 'sparse' ? 2 : density === 'moderate' ? 4 : 6;
  for (let i = 0; i < count && i < baseCircles.length; i++) {
    const c = baseCircles[i];
    decorations.push(
      <circle
        key={`hc-${i}`}
        cx={cx + c.dx}
        cy={cy + c.dy}
        r={c.r}
        fill={`#${colors.accent}`}
        opacity={0.06 + i * 0.01}
      />,
    );
  }

  // Subtle center ring for moderate/rich
  if (density !== 'sparse') {
    decorations.push(
      <ellipse
        key="ring"
        cx={cx}
        cy={cy - 0.3}
        rx="2.3"
        ry="1.5"
        fill="none"
        stroke={`#${colors.accent}`}
        strokeWidth="0.007"
        opacity="0.15"
      />,
    );
  }

  return (
    <g>
      {/* Background */}
      <rect x="0" y="0" width="13.33" height="7.5" fill={`#${colors.coverBg}`} />

      {/* Decorative circles */}
      {decorations}

      {/* Tag */}
      <text
        x="6.665"
        y="1.2"
        fontSize={ptToInch(11)}
        fontFamily={fonts.en}
        fill={`#${colors.accent}`}
        letterSpacing="0.06"
        textAnchor="middle"
      >
        {tagline(subtitle)}
      </text>

      {/* Title */}
      <text
        x="6.665"
        y={cy + 0.2}
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
        y={cy + 1.5}
        fontSize={ptToInch(14)}
        fontFamily={fonts.bodyStack || fonts.body}
        fill={`#${colors.textMuted}`}
        textAnchor="middle"
      >
        {subtitle}
      </text>

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
