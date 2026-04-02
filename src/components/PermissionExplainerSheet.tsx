import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, shadows } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { t } from '../i18n';

export interface PermissionSheetConfig {
  title: string;
  body: string;
  openLabel?: string;
  onOpen: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  title: string;
  body: string;
  /** Button label – defaults to t('settings_permission_open') */
  openSettingsLabel?: string;
}

export default function PermissionExplainerSheet({
  visible,
  onClose,
  onOpenSettings,
  title,
  body,
  openSettingsLabel,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const handleOpen = () => {
    onOpenSettings();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

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

        {/* Cancel */}
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} testID="permission-cancel-btn">
          <Text style={styles.cancelBtnText}>{t('settings_permission_cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
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
  });
}
