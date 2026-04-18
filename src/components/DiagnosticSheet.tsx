import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import * as Updates from 'expo-updates';
import * as Application from 'expo-application';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, ThemeColors, Shadows } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';
import { t } from '../i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function DiagnosticSheet({ visible, onClose }: Props) {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
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
        onClose();
      }
    },
    [onClose]
  );

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    []
  );

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
        testID="diagnostic-sheet"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('diagnostic_title')}</Text>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => bottomSheetRef.current?.dismiss()}
            testID="diagnostic-close-btn"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

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

        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShare}
          testID="diagnostic-share-btn"
        >
          <Text style={styles.shareBtnText}>{t('diagnostic_share')}</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheetModal>
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

function makeStyles(colors: ThemeColors, shadows: Shadows) {
  return StyleSheet.create({
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
