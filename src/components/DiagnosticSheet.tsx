import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import * as Application from 'expo-application';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { t } from '../i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function DiagnosticSheet({ visible, onClose }: Props) {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const insets = useSafeAreaInsets();

  const channel = Updates.channel ?? t('diagnostic_unknown');
  const nativeVersion = Application.nativeApplicationVersion ?? '—';
  const nativeBuildVersion = Application.nativeBuildVersion ?? '—';
  const launchType = Updates.isEmbeddedLaunch
    ? t('diagnostic_launch_embedded')
    : t('diagnostic_launch_ota');
  const updateId = Updates.updateId ?? t('diagnostic_none');

  type CheckState = 'idle' | 'checking' | 'done';
  const [checkState, setCheckState] = useState<CheckState>('idle');

  const handleCheckForUpdate = async () => {
    if (checkState !== 'idle' || !Updates.isEnabled) return;
    setCheckState('checking');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
        return;
      }
      setCheckState('done');
    } catch {
      setCheckState('done');
    }
  };

  const handleShare = async () => {
    const text = [
      '--- App Diagnostics ---',
      `${t('diagnostic_environment')}: ${channel}`,
      `${t('diagnostic_native_version')}: ${nativeVersion} (${nativeBuildVersion})`,
      `${t('diagnostic_launch_type')}: ${launchType}`,
      `${t('diagnostic_update_id')}: ${updateId}`,
    ].join('\n');

    try {
      await Share.share({ message: text });
    } catch {
      // share cancelled or not supported — silently ignore
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
        testID="diagnostic-sheet"
      >
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('diagnostic_title')}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} testID="diagnostic-close-btn">
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Diagnostic rows */}
        <View style={styles.body}>
          <DiagnosticRow label={t('diagnostic_environment')} value={channel} styles={styles} />
          <DiagnosticRow
            label={t('diagnostic_native_version')}
            value={`${nativeVersion} (${nativeBuildVersion})`}
            styles={styles}
          />
          <DiagnosticRow label={t('diagnostic_launch_type')} value={launchType} styles={styles} />
          <DiagnosticRow
            label={t('diagnostic_update_id')}
            value={updateId}
            mono
            styles={styles}
            action={
              Updates.isEnabled ? (
                <TouchableOpacity
                  onPress={handleCheckForUpdate}
                  disabled={checkState !== 'idle'}
                  style={styles.updateCheckBtn}
                  testID="diagnostic-check-update-btn"
                  accessibilityLabel={t('diagnostic_check_update')}
                >
                  {checkState === 'checking' ? (
                    <ActivityIndicator size="small" color={colors.grass} />
                  ) : checkState === 'done' ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.grass} />
                  ) : (
                    <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              ) : undefined
            }
          />
        </View>

        {/* Share / copy diagnostics */}
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShare}
          testID="diagnostic-share-btn"
        >
          <Text style={styles.shareBtnText}>{t('diagnostic_share')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function DiagnosticRow({
  label,
  value,
  mono,
  styles,
  action,
}: {
  label: string;
  value: string;
  mono?: boolean;
  styles: ReturnType<typeof makeStyles>;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.rowValueMono]} selectable>
        {value}
      </Text>
      {action}
    </View>
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
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.fog,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    body: {
      marginBottom: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.fog,
    },
    rowLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
      flex: 1,
    },
    rowValue: {
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: '500',
      flex: 2,
      textAlign: 'right',
    },
    rowValueMono: {
      fontFamily: 'monospace',
      fontSize: 11,
      color: colors.textMuted,
    },
    shareBtn: {
      backgroundColor: colors.grassPale,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    shareBtnText: {
      color: colors.grass,
      fontSize: 15,
      fontWeight: '600',
    },
    updateCheckBtn: {
      marginLeft: spacing.sm,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
