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

/** Format an epoch timestamp as HH:MM. */
function formatStartTime(epoch: number): string {
  const d = new Date(epoch);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export interface ProgressWidgetProps {
  current: number;
  target: number;
  timerRunning: boolean;
  timerStartEpoch?: number;
}

export function ProgressWidget({
  current,
  target,
  timerRunning,
  timerStartEpoch,
}: ProgressWidgetProps) {
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  const pctDisplay = Math.round((current / Math.max(target, 1)) * 100);
  const ringColor = progressColor(pct);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        padding: 8,
      }}
      clickAction="OPEN_APP"
      accessibilityLabel="TouchGrass progress widget"
    >
      {/* Outer ring: background color represents progress level */}
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 'match_parent',
          borderRadius: 999,
          backgroundColor: ringColor,
          padding: 12,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Inner circle: content area */}
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 'match_parent',
            borderRadius: 999,
            backgroundColor: COLORS.card,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {timerRunning ? (
            /* Running state: start time + stop button + back inside */
            <>
              <TextWidget
                text={`Started ${timerStartEpoch && !isNaN(timerStartEpoch) ? formatStartTime(timerStartEpoch) : '--:--'}`}
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: COLORS.textPrimary,
                }}
              />
              <FlexWidget
                style={{
                  backgroundColor: COLORS.sun,
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  marginTop: 8,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                clickAction="TOGGLE_TIMER"
                accessibilityLabel="Stop timer"
              >
                <TextWidget
                  text="⏹  Stop"
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: COLORS.textInverse,
                  }}
                />
              </FlexWidget>
              <TextWidget
                text="back inside"
                style={{
                  fontSize: 11,
                  color: COLORS.textMuted,
                  marginTop: 6,
                }}
              />
            </>
          ) : (
            /* Idle state: play button + start outside session */
            <>
              <FlexWidget
                style={{
                  backgroundColor: COLORS.grass,
                  borderRadius: 24,
                  padding: 10,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                clickAction="TOGGLE_TIMER"
                accessibilityLabel="Start timer"
              >
                <TextWidget
                  text="▶"
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: COLORS.textInverse,
                  }}
                />
              </FlexWidget>
              <TextWidget
                text="start outside session"
                style={{
                  fontSize: 11,
                  color: COLORS.textSecondary,
                  marginTop: 8,
                }}
              />
              <TextWidget
                text={`${pctDisplay}% today`}
                style={{
                  fontSize: 11,
                  color: COLORS.textMuted,
                  marginTop: 2,
                }}
              />
            </>
          )}
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
