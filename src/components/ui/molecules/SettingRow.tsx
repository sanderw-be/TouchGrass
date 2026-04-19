import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { spacing } from '../../../utils/theme';
import { useTheme } from '../../../hooks/useTheme';

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: React.ReactNode;
  hint?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function SettingRow({
  icon,
  label,
  sublabel,
  hint,
  right,
  style,
  disabled,
}: SettingRowProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, style, disabled && styles.disabled]}>
      <View style={styles.rowIconContainer}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        {sublabel &&
          (typeof sublabel === 'string' ? (
            <Text style={[styles.rowSublabel, { color: colors.textMuted }]}>{sublabel}</Text>
          ) : (
            sublabel
          ))}
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
  disabled: { opacity: 0.5 },
});
