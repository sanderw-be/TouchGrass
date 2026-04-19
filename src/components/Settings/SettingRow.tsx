import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ThemeColors, spacing } from '../../utils/theme';

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  hint?: string;
  right?: React.ReactNode;
  colors: ThemeColors;
}

export function SettingRow({ icon, label, sublabel, hint, right, colors }: SettingRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIconContainer}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        {sublabel && (
          <Text style={[styles.rowSublabel, { color: colors.textMuted }]}>{sublabel}</Text>
        )}
        {hint && <Text style={[styles.rowHint, { color: colors.grass }]}>{hint}</Text>}
      </View>
      {right && <View style={styles.rowRight}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  rowIconContainer: {
    width: 28,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSublabel: { fontSize: 12, marginTop: 2 },
  rowHint: { fontSize: 12, marginTop: 2 },
  rowRight: { marginLeft: spacing.sm },
});
