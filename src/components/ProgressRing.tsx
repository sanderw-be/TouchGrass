import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { progressColor } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { formatMinutes, formatTimer } from '../utils/helpers';
import { t } from '../i18n';

interface Props {
  current: number; // minutes
  target: number; // minutes
  size?: number;
  strokeWidth?: number;
  label?: string;
  /** When provided, the ring centre becomes an interactive timer button. */
  onTimerPress?: () => void;
  timerRunning?: boolean;
  timerSeconds?: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ProgressRing({
  current,
  target,
  size = 180,
  strokeWidth = 14,
  label = 'today',
  onTimerPress,
  timerRunning = false,
  timerSeconds = 0,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const percent = Math.min(current / Math.max(target, 1), 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedPercent = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animatedPercent, {
      toValue: percent,
      tension: 40,
      friction: 8,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const strokeDashoffset = animatedPercent.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const ringColor = progressColor(percent);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={colors.fog}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      {/* Center content */}
      {onTimerPress ? (
        <TouchableOpacity
          style={[styles.center, { width: size, height: size }]}
          onPress={onTimerPress}
          activeOpacity={0.7}
          testID="ring-timer-center"
        >
          {timerRunning ? (
            <View style={styles.innerBlock}>
              <Text style={styles.timerValue}>{formatTimer(timerSeconds)}</Text>
              <Text style={styles.timerOutside}>{t('ring_timer_outside')}</Text>
              <Text style={styles.timerHint}>{t('ring_timer_tap_stop')}</Text>
              <Text style={styles.stopIcon}>⬛</Text>
            </View>
          ) : (
            <View style={styles.innerBlock}>
              <Text style={styles.value}>{formatMinutes(current)}</Text>
              <Text style={styles.target}>
                {t('of')} {formatMinutes(target)}
              </Text>
              <Text style={styles.startHint}>{t('ring_timer_start')}</Text>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <View style={[styles.center, { width: size, height: size }]}>
          <Text style={styles.value}>{formatMinutes(current)}</Text>
          <Text style={styles.target}>
            {t('of')} {formatMinutes(target)}
          </Text>
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Inner block is shifted slightly upward so the play/stop icon below the text
    // doesn't make the group feel bottom-heavy inside the ring.
    innerBlock: {
      alignItems: 'center',
      marginTop: -8,
    },
    value: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.textPrimary,
      letterSpacing: -1,
    },
    target: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    label: {
      fontSize: 11,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginTop: 4,
    },
    startHint: {
      fontSize: 11,
      color: colors.grass,
      letterSpacing: 0.5,
      marginTop: 6,
      fontWeight: '600',
    },
    playIcon: {
      fontSize: 28,
      color: colors.grass,
      marginTop: 6,
      lineHeight: 32,
    },
    timerValue: {
      fontSize: 36,
      fontWeight: '200',
      color: colors.textPrimary,
      letterSpacing: -1,
    },
    timerOutside: {
      fontSize: 12,
      color: colors.grass,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginTop: 2,
    },
    timerHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
    },
    stopIcon: {
      fontSize: 28,
      color: colors.grass,
      marginTop: 8,
      lineHeight: 32,
    },
  });
}
