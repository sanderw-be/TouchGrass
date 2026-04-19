import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemeColors, spacing } from '../../utils/theme';

interface DividerProps {
  colors: ThemeColors;
}

export function Divider({ colors }: DividerProps) {
  return <View style={[styles.divider, { backgroundColor: colors.fog }]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    marginLeft: spacing.md + 28 + spacing.md,
  },
});
