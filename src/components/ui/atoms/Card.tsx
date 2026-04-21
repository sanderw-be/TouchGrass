import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { spacing, radius } from '../../../utils/theme';
import { useTheme } from '../../../hooks/useTheme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'flat' | 'tip';
}

export function Card({ children, style, variant = 'default' }: CardProps) {
  const { colors, shadows } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card },
        variant === 'default' && shadows.soft,
        variant === 'flat' && styles.flat,
        variant === 'tip' && { backgroundColor: colors.grassPale },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  flat: {
    borderWidth: 1,
    borderColor: 'transparent', // can be customized if needed
  },
});
