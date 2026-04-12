import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { updateSessionNotesAsync, OutsideSession } from '../storage/database';
import { spacing, radius } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { t } from '../i18n';

interface Props {
  visible: boolean;
  session: OutsideSession | null;
  onClose: () => void;
  onNoteSaved: () => void;
}

export default function SessionNotesSheet({ visible, session, onClose, onNoteSaved }: Props) {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [notes, setNotes] = useState('');

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

  useEffect(() => {
    if (visible && session) {
      setNotes(session.notes ?? '');
    }
  }, [visible, session]);

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

  const handleSave = async () => {
    try {
      await updateSessionNotesAsync(session!.id!, notes);
      onNoteSaved();
      onClose();
    } catch (error) {
      console.error('[SessionNotesSheet.handleSave] Error:', error);
    }
  };

  if (!session) return null;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      enableDynamicSizing
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.mist }}
      handleIndicatorStyle={{ backgroundColor: colors.fog }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetView
        style={{ paddingBottom: Math.max(insets.bottom, spacing.sm) }}
        testID="session-notes-sheet"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('session_notes_title')}</Text>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => bottomSheetRef.current?.dismiss()}
            testID="notes-sheet-close-btn"
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Notes input */}
        <BottomSheetTextInput
          style={styles.textInput}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('session_notes_placeholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          autoFocus
          testID="notes-text-input"
        />

        {/* Save button */}
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} testID="notes-save-btn">
          <Text style={styles.primaryBtnText}>{t('session_notes_save')}</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  shadows: ReturnType<typeof useTheme>['shadows']
) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      paddingBottom: spacing.sm,
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
    textInput: {
      marginHorizontal: spacing.md,
      minHeight: 100,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: 15,
      color: colors.textPrimary,
      textAlignVertical: 'top',
    },
    primaryBtn: {
      backgroundColor: colors.grass,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
      margin: spacing.md,
    },
    primaryBtnText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
