import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { t } from '../i18n';

export interface PermissionSheetConfig {
  title: string;
  body: string;
  openLabel?: string;
  onOpen: () => void;
  /** Optional callback to disable the feature requiring this permission. */
  onDisable?: () => void;
  /** Label for the disable button – defaults to t('settings_permission_disable') */
  disableLabel?: string;
  /**
   * Optional callback invoked when the sheet is dismissed via Cancel or the
   * backdrop without the user taking a positive action (open settings / disable).
   * Use this to revert any state change that triggered the sheet.
   */
  onCancel?: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  title: string;
  body: string;
  /** Button label – defaults to t('settings_permission_open') */
  openSettingsLabel?: string;
  /** Optional callback to disable the feature requiring this permission. */
  onDisable?: () => void;
  /** Label for the disable button – defaults to t('settings_permission_disable') */
  disableLabel?: string;
  /**
   * Optional callback invoked when the sheet is dismissed via Cancel or the
   * backdrop without the user taking a positive action (open settings / disable).
   * Use this to revert any state change that triggered the sheet.
   */
  onCancel?: () => void;
}

export default function PermissionExplainerSheet({
  visible,
  onClose,
  onOpenSettings,
  title,
  body,
  openSettingsLabel,
  onDisable,
  disableLabel,
  onCancel,
}: Props) {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const insets = useSafeAreaInsets();

  const handleOpen = () => {
    onOpenSettings();
    onClose();
  };

  const handleDisable = () => {
    onDisable?.();
    onClose();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleCancel} />

      <View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
        testID="permission-explainer-sheet"
      >
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Icon */}
        <View style={styles.iconRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed-outline" size={28} color={colors.grass} />
          </View>
        </View>

        {/* Title & body */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        {/* Primary action */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleOpen}
          testID="permission-open-settings-btn"
        >
          <Text style={styles.primaryBtnText}>
            {openSettingsLabel ?? t('settings_permission_open')}
          </Text>
        </TouchableOpacity>

        {/* Disable feature */}
        {onDisable && (
          <TouchableOpacity
            style={styles.disableBtn}
            onPress={handleDisable}
            testID="permission-disable-btn"
          >
            <Text style={styles.disableBtnText}>
              {disableLabel ?? t('settings_permission_disable')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Cancel */}
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={handleCancel}
          testID="permission-cancel-btn"
        >
          <Text style={styles.cancelBtnText}>{t('settings_permission_cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  shadows: ReturnType<typeof useTheme>['shadows']
) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      ...shadows.medium,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.fog,
      borderRadius: radius.full,
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    iconRow: {
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    iconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.grassPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    body: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: spacing.lg,
    },
    primaryBtn: {
      backgroundColor: colors.grass,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    primaryBtnText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '700',
    },
    cancelBtn: {
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    cancelBtnText: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: '500',
    },
    disableBtn: {
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.sm,
      borderWidth: 1.5,
      borderColor: colors.error,
    },
    disableBtnText: {
      color: colors.error,
      fontSize: 15,
      fontWeight: '600',
    },
  });
}
