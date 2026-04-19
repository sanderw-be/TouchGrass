import { StyleSheet } from 'react-native';
import { spacing, radius, ThemeColors, Shadows } from '../../utils/theme';
import { SettingRow, Divider, PermissionToggleRow, Card } from '../ui';

export const CATCHUP_REMINDERS_OPTIONS = [0, 1, 2, 3] as const;
export type CatchupRemindersOption = (typeof CATCHUP_REMINDERS_OPTIONS)[number];

export { SettingRow, Divider, PermissionToggleRow, Card };

export function makeStyles(colors: ThemeColors, shadows: Shadows) {
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
      padding: spacing.lg,
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
      gap: spacing.sm,
      alignItems: 'flex-start',
    },
    tipIcon: { marginTop: 1 },
    tipText: { flex: 1, fontSize: 13, color: colors.grassDark, lineHeight: 20 },

    settingsCard: {
      overflow: 'hidden',
    },
    settingsCardDisabled: {
      opacity: 0.5,
    },

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
