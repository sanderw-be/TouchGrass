'use no memo';

import React from 'react';
import type { ColorProp } from 'react-native-android-widget';
import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { t } from '../i18n';

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

/** Format an epoch-ms timestamp as HH:MM for the widget display. */
export function formatStartTime(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Size of the SVG ring in dp.
 * A 3×2 widget is roughly 220×146 dp on most devices; the ring fills
 * the height so it dominates the widget visually.
 */
const RING_SIZE = 130;
const STROKE_WIDTH = 10;

/**
 * Build an SVG string for a circular progress ring with a filled centre.
 *
 *   1. Filled circle (card background) so the interior is opaque while
 *      the widget itself is transparent.
 *   2. Track circle in fog color.
 *   3. Foreground arc using stroke-dasharray / stroke-dashoffset,
 *      rotated -90° so progress starts at 12 o'clock, with round caps.
 */
export function buildRingSvg(pct: number, ringColor: string): string {
  const r = (RING_SIZE - STROKE_WIDTH) / 2;
  const c = RING_SIZE / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const fillR = r - STROKE_WIDTH / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${RING_SIZE}" height="${RING_SIZE}" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">`,
    // Inner filled background
    `<circle cx="${c}" cy="${c}" r="${fillR}" fill="${COLORS.card}"/>`,
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
  /** Epoch-ms when the timer was started — used to display "started HH:MM". */
  timerStartMs?: number;
}

export function ProgressWidget({
  current,
  target,
  timerRunning,
  timerStartMs,
}: ProgressWidgetProps) {
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  const ringColor = progressColor(pct);
  const ringSvg = buildRingSvg(pct, ringColor);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      clickAction="OPEN_APP"
      accessibilityLabel="TouchGrass progress widget"
    >
      {/* Ring + centred content */}
      <OverlapWidget style={{ width: RING_SIZE, height: RING_SIZE }}>
        <SvgWidget svg={ringSvg} style={{ width: RING_SIZE, height: RING_SIZE }} />

        {/* Tappable centre area */}
        <FlexWidget
          style={{
            width: RING_SIZE,
            height: RING_SIZE,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          clickAction="TOGGLE_TIMER"
          accessibilityLabel={timerRunning ? 'Stop timer' : 'Start timer'}
        >
          {timerRunning ? (
            <FlexWidget
              style={{
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <TextWidget
                text={`${t('widget_started')} ${timerStartMs ? formatStartTime(timerStartMs) : '--:--'}`}
                style={{
                  fontSize: 13,
                  color: COLORS.textSecondary,
                }}
              />
              <TextWidget
                text="⏹"
                style={{
                  fontSize: 28,
                  color: COLORS.sun,
                  marginTop: 2,
                }}
              />
              <TextWidget
                text={t('widget_back_inside')}
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: COLORS.grass,
                  marginTop: 2,
                }}
              />
            </FlexWidget>
          ) : (
            <FlexWidget
              style={{
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <TextWidget
                text="▶"
                style={{
                  fontSize: 28,
                  color: COLORS.grass,
                }}
              />
              <TextWidget
                text={t('widget_start_outside')}
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: COLORS.textSecondary,
                  textAlign: 'center',
                  marginTop: 2,
                }}
              />
            </FlexWidget>
          )}
        </FlexWidget>
      </OverlapWidget>
    </FlexWidget>
  );
}
