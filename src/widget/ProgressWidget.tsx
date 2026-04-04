'use no memo';

import React from 'react';
import type { ColorProp } from 'react-native-android-widget';
import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

/** Colors from the app theme (widget cannot use React context). */
const COLORS = {
  background: '#F8F9F7' as const,
  card: '#FFFFFF' as const,
  grass: '#4A7C59' as const,
  grassLight: '#6BAF7A' as const,
  sky: '#7EB8D4' as const,
  sun: '#F5C842' as const,
  fog: '#E8EBE6' as const,
  textPrimary: '#1A2E1F' as const,
  textSecondary: '#5A7060' as const,
  textMuted: '#8FA892' as const,
  textInverse: '#FFFFFF' as const,
} satisfies Record<string, ColorProp>;

/** Pick a ring color based on progress percentage — mirrors progressColor() in theme.ts. */
function progressColor(pct: number): string {
  if (pct >= 1) return COLORS.grassLight;
  if (pct >= 0.6) return COLORS.grass;
  if (pct >= 0.3) return COLORS.sun;
  return COLORS.sky;
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r > 0 ? `${h} h ${r} min` : `${h} h`;
}

/** Size of the SVG ring in dp — fits comfortably in a 3×2 widget. */
const RING_SIZE = 86;
const STROKE_WIDTH = 8;

/**
 * Build an SVG string for a circular progress ring.
 * Mirrors the ProgressRing component on the home screen:
 *   - Background track circle in fog color
 *   - Foreground arc using stroke-dasharray / stroke-dashoffset
 *   - Rotated -90° so progress starts at 12 o'clock
 *   - Round stroke-linecap for a polished look
 */
export function buildRingSvg(pct: number, ringColor: string): string {
  const r = (RING_SIZE - STROKE_WIDTH) / 2;
  const c = RING_SIZE / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${RING_SIZE}" height="${RING_SIZE}" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">`,
    // Track
    `<circle cx="${c}" cy="${c}" r="${r}" stroke="${COLORS.fog}" stroke-width="${STROKE_WIDTH}" fill="none"/>`,
    // Progress arc
    `<circle cx="${c}" cy="${c}" r="${r}" stroke="${ringColor}" stroke-width="${STROKE_WIDTH}" fill="none"`,
    ` stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"`,
    ` stroke-linecap="round" transform="rotate(-90 ${c} ${c})"/>`,
    `</svg>`,
  ].join('');
}

export interface ProgressWidgetProps {
  current: number;
  target: number;
  timerRunning: boolean;
}

export function ProgressWidget({ current, target, timerRunning }: ProgressWidgetProps) {
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  const pctDisplay = Math.round((current / Math.max(target, 1)) * 100);
  const ringColor = progressColor(pct);
  const ringSvg = buildRingSvg(pct, ringColor);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 16,
        padding: 12,
      }}
      clickAction="OPEN_APP"
      accessibilityLabel="TouchGrass progress widget"
    >
      {/* Circular progress ring with overlaid center text */}
      <OverlapWidget
        style={{
          width: RING_SIZE,
          height: RING_SIZE,
        }}
      >
        <SvgWidget
          svg={ringSvg}
          style={{
            width: RING_SIZE,
            height: RING_SIZE,
          }}
        />
        <FlexWidget
          style={{
            width: RING_SIZE,
            height: RING_SIZE,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text={formatMinutes(current)}
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: COLORS.textPrimary,
            }}
          />
          <TextWidget
            text={`of ${formatMinutes(target)}`}
            style={{
              fontSize: 9,
              color: COLORS.textSecondary,
            }}
          />
        </FlexWidget>
      </OverlapWidget>

      {/* Right side: percentage + timer button */}
      <FlexWidget
        style={{
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          marginLeft: 12,
        }}
      >
        <TextWidget
          text={`${pctDisplay}%`}
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: ringColor as ColorProp,
          }}
        />

        {/* Timer button */}
        <FlexWidget
          style={{
            backgroundColor: timerRunning ? COLORS.sun : COLORS.grass,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 6,
            marginTop: 8,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          clickAction="TOGGLE_TIMER"
          accessibilityLabel={timerRunning ? 'Stop timer' : 'Start timer'}
        >
          <TextWidget
            text={timerRunning ? '⏹  Stop' : '▶  Start'}
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: COLORS.textInverse,
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
