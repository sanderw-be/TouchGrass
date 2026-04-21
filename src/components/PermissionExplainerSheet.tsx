import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, ThemeColors, Shadows } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';
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
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  // Tracks whether a positive action (open / disable) triggered the dismiss
  const actionTakenRef = useRef(false);

  useEffect(() => {
    if (visible) {
      actionTakenRef.current = false;
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      bottomSheetRef.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        if (!actionTakenRef.current) {
          onCancel?.();
        }
        onClose();
      }
    },
    [onCancel, onClose]
  );

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    []
  );

  const handleOpen = () => {
    actionTakenRef.current = true;
    onOpenSettings();
    bottomSheetRef.current?.dismiss();
  };

  const handleDisable = () => {
    actionTakenRef.current = true;
    onDisable?.();
    bottomSheetRef.current?.dismiss();
  };

  const handleCancel = () => {
    bottomSheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      enableDynamicSizing
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.fog }}
    >
      <BottomSheetView
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xs,
          paddingBottom: Math.max(insets.bottom, spacing.md),
        }}
        testID="permission-explainer-sheet"
      >
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
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function makeStyles(colors: ThemeColors, shadows: Shadows) {
  return StyleSheet.create({
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
