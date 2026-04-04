'use no memo';

import React from 'react';
import type { ColorProp } from 'react-native-android-widget';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

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

/** Pick a ring color based on progress percentage. */
function progressColor(pct: number): ColorProp {
  if (pct >= 1) return COLORS.grassLight;
  if (pct >= 0.6) return COLORS.grass;
  if (pct >= 0.3) return COLORS.sun;
  return COLORS.sky;
}

function formatMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r > 0 ? `${h} h ${r} min` : `${h} h`;
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
  // Use flex weights to simulate a percentage-based progress bar.
  // Minimum 1 for the filled portion so the bar is always visible when > 0%.
  const filledFlex = Math.max(Math.round(pct * 100), pct > 0 ? 1 : 0);
  const emptyFlex = 100 - filledFlex;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 16,
        padding: 12,
      }}
      clickAction="OPEN_APP"
      accessibilityLabel="TouchGrass progress widget"
    >
      {/* Title */}
      <TextWidget
        text="TouchGrass"
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: COLORS.grass,
        }}
      />

      {/* Progress bar: flex-based fill */}
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 8,
          flexDirection: 'row',
          backgroundColor: COLORS.fog,
          borderRadius: 4,
          marginTop: 8,
          overflow: 'hidden',
        }}
      >
        {filledFlex > 0 && (
          <FlexWidget
            style={{
              flex: filledFlex,
              height: 'match_parent',
              backgroundColor: ringColor,
              borderRadius: 4,
            }}
          />
        )}
        {emptyFlex > 0 && (
          <FlexWidget
            style={{
              flex: emptyFlex,
              height: 'match_parent',
            }}
          />
        )}
      </FlexWidget>

      {/* Stats row */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 6,
        }}
      >
        <TextWidget
          text={`${formatMinutes(current)} / ${formatMinutes(target)}`}
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: COLORS.textPrimary,
          }}
        />
        <TextWidget
          text={`${pctDisplay}%`}
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: ringColor,
          }}
        />
      </FlexWidget>

      {/* Timer button */}
      <FlexWidget
        style={{
          backgroundColor: timerRunning ? COLORS.sun : COLORS.grass,
          borderRadius: 20,
          paddingHorizontal: 20,
          paddingVertical: 8,
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
            fontSize: 14,
            fontWeight: '700',
            color: COLORS.textInverse,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
