import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible && session) {
      setNotes(session.notes ?? '');
    }
  }, [visible, session]);

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kavWrapper}
      >
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
          testID="session-notes-sheet"
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('session_notes_title')}</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              testID="notes-sheet-close-btn"
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Notes input */}
          <TextInput
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
        </View>
      </KeyboardAvoidingView>
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
    kavWrapper: {
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.mist,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      ...shadows.medium,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.fog,
      borderRadius: radius.full,
      alignSelf: 'center',
      marginTop: spacing.sm,
    },
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
