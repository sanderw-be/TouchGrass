import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { spacing } from '../../../utils/theme';
import { useTheme } from '../../../hooks/useTheme';

interface DividerProps {
  style?: StyleProp<ViewStyle>;
  inset?: boolean;
}

export function Divider({ style, inset = true }: DividerProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.divider, { backgroundColor: colors.fog }, inset && styles.inset, style]} />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
  },
  inset: {
    marginLeft: spacing.md + 28 + spacing.md,
  },
});
