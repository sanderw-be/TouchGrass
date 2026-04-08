import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius } from '../../utils/theme';
import { t } from '../../i18n';

export const CATCHUP_REMINDERS_OPTIONS = [0, 1, 2, 3] as const;
export type CatchupRemindersOption = (typeof CATCHUP_REMINDERS_OPTIONS)[number];

export function SettingRow({
  icon,
  label,
  sublabel,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
}) {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  return (
    <View style={styles.row}>
      <View style={styles.rowIconContainer}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
      </View>
      {right && <View style={styles.rowRight}>{right}</View>}
    </View>
  );
}

export function Divider() {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  return <View style={styles.divider} />;
}

/**
 * A toggle row that mirrors the `DetectionSettingRow` pattern from SettingsScreen.
 * When the feature is enabled but the required permission is missing, the desc
 * text is replaced by a tappable red "Permissions missing — tap to fix" label.
 */
export function PermissionToggleRow({
  icon,
  label,
  desc,
  permissionMissingLabel,
  enabled,
  permissionGranted,
  onToggle,
  onPermissionFix,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  permissionMissingLabel: string;
  enabled: boolean;
  permissionGranted: boolean;
  onToggle: (value: boolean) => void;
  onPermissionFix?: () => void;
}) {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const hasError = enabled && !permissionGranted;

  return (
    <View style={styles.row}>
      <View style={styles.rowIconContainer}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
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
          <Text style={styles.rowSublabel}>{desc}</Text>
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

export function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  shadows: ReturnType<typeof useTheme>['shadows']
) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.mist },
    content: { padding: spacing.md, paddingBottom: spacing.xxl },

    header: {
      backgroundColor: colors.mist,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.md,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    sectionHeader: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
      marginLeft: spacing.xs,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadows.soft,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 13,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    cardValue: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 2,
      letterSpacing: -1,
    },

    editButton: {
      backgroundColor: colors.grassPale,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    editButtonText: { fontSize: 13, fontWeight: '600', color: colors.grass },

    editor: {
      marginTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.fog,
      paddingTop: spacing.lg,
    },
    editorLabel: {
      fontSize: 12,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },

    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
    preset: {
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.fog,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    presetActive: { backgroundColor: colors.grass, borderColor: colors.grass },
    presetText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
    presetTextActive: { color: colors.textInverse, fontWeight: '700' },

    customRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    input: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.fog,
      borderRadius: radius.md,
      padding: spacing.sm,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.mist,
    },
    saveButton: {
      backgroundColor: colors.grass,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    saveButtonText: { color: colors.textInverse, fontWeight: '700', fontSize: 15 },

    tipCard: {
      flexDirection: 'row',
      backgroundColor: colors.grassPale,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    tipIcon: { marginTop: 1 },
    tipText: { flex: 1, fontSize: 13, color: colors.grassDark, lineHeight: 20 },

    settingsCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      overflow: 'hidden',
      ...shadows.soft,
    },
    settingsCardDisabled: {
      opacity: 0.5,
    },

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
    rowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
    rowSublabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    rowRight: { marginLeft: spacing.sm },

    divider: { height: 1, backgroundColor: colors.fog, marginLeft: spacing.md + 28 + spacing.md },
    disabledRow: { opacity: 0.5 },

    chevron: { fontSize: 24, color: colors.textMuted, fontWeight: '300' },

    valueChip: {
      fontSize: 13,
      color: colors.grass,
      fontWeight: '600',
      backgroundColor: colors.grassPale,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
    permissionWarning: {
      backgroundColor: colors.warningSurface,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    permissionWarningText: { fontSize: 12, color: colors.warningText, lineHeight: 18 },
  });
}
