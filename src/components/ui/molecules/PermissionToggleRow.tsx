import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { spacing } from '../../../utils/theme';
import { useTheme } from '../../../hooks/useTheme';
import { t } from '../../../i18n';

interface PermissionToggleRowProps {
  icon: React.ReactNode;
  label: string;
  desc: string;
  permissionMissingLabel: string;
  enabled: boolean;
  permissionGranted: boolean;
  onToggle: (value: boolean) => void;
  onPermissionFix?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function PermissionToggleRow({
  icon,
  label,
  desc,
  permissionMissingLabel,
  enabled,
  permissionGranted,
  onToggle,
  onPermissionFix,
  style,
}: PermissionToggleRowProps) {
  const { colors } = useTheme();
  const hasError = enabled && !permissionGranted;

  return (
    <View style={[styles.row, style]}>
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
      <View style={styles.rowRight}>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.fog, true: colors.grassLight }}
          thumbColor={enabled ? colors.grass : colors.inactive}
        />
      </View>
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
  rowRight: { marginLeft: spacing.sm },
});
