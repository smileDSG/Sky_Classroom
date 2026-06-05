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

export function FrameBorderCover({ dna, title, subtitle }: Props) {
  const { colors, fonts, decoration } = dna;
  const density = decoration.density;
  const m = 0.6;

  // Corner dots based on density
  const cornerDots = [] as React.ReactNode[];
  if (density === 'moderate' || density === 'rich') {
    const corners = [
      [m, m], [13.33 - m, m], [m, 7.5 - m], [13.33 - m, 7.5 - m],
    ];
    corners.forEach(([cx, cy], i) => (
      cornerDots.push(
        <circle key={`fd${i}`} cx={cx} cy={cy} r="0.12" fill={`#${colors.accent}`} />,
      )
    ));
  }

  return (
    <g>
      {/* Background */}
      <rect x="0" y="0" width="13.33" height="7.5" fill={`#${colors.coverBg}`} />

      {/* Double-frame border */}
      <rect
        x={m}
        y={m}
        width={13.33 - 2 * m}
        height={7.5 - 2 * m}
        fill="none"
        stroke={`#${colors.accent}`}
        strokeWidth="0.012"
        opacity="0.6"
      />
      <rect
        x={m + 0.15}
        y={m + 0.15}
        width={13.33 - 2 * (m + 0.15)}
        height={7.5 - 2 * (m + 0.15)}
        fill="none"
        stroke={`#${colors.accent}`}
        strokeWidth="0.008"
        opacity="0.4"
      />

      {/* Corner dots */}
      {cornerDots}

      {/* Tag */}
      <text
        x="6.665"
        y="1.6"
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
        y="3.0"
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
        y="4.5"
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
        y="5.5"
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
