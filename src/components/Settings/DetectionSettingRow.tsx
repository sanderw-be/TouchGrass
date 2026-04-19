import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { ThemeColors, spacing } from '../../utils/theme';
import { t } from '../../i18n';

interface DetectionSettingRowProps {
  enabled: boolean;
  permissionGranted: boolean;
  icon: React.ReactNode;
  label: string;
  desc: string;
  permissionMissingLabel: string;
  onToggle: (value: boolean) => void;
  isLoading?: boolean;
  onPermissionFix?: () => void;
  testID?: string;
  colors: ThemeColors;
}

export function DetectionSettingRow({
  enabled,
  permissionGranted,
  icon,
  label,
  desc,
  permissionMissingLabel,
  onToggle,
  isLoading,
  onPermissionFix,
  testID,
  colors,
}: DetectionSettingRowProps) {
  const hasError = enabled && !permissionGranted;

  return (
    <View style={styles.row}>
      <View style={styles.rowIconContainer}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        {hasError ? (
          <TouchableOpacity
            onPress={onPermissionFix}
            disabled={!onPermissionFix}
            accessibilityRole="button"
            accessibilityLabel={permissionMissingLabel}
            accessibilityHint={t('settings_permission_open')}
          >
            <Text style={[styles.rowSublabel, { color: colors.error }]}>
              {permissionMissingLabel}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.rowSublabel, { color: colors.textMuted }]}>{desc}</Text>
        )}
      </View>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        disabled={isLoading}
        trackColor={{ false: colors.fog, true: colors.grassLight }}
        thumbColor={enabled ? colors.grass : colors.inactive}
        testID={testID}
      />
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
});
