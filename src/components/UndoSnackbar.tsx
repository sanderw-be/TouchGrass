import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { t } from '../i18n';
import { spacing, radius } from '../utils/theme';

interface UndoSnackbarProps {
  visible: boolean;
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export default function UndoSnackbar({
  visible,
  message,
  onUndo,
  onDismiss,
  duration = 4000,
}: UndoSnackbarProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, duration);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <View style={styles.snackbar} testID="undo-snackbar">
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity
        onPress={() => {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          onUndo();
          onDismiss();
        }}
        testID="undo-snackbar-button"
        accessibilityRole="button"
      >
        <Text style={styles.undoText}>{t('undo')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    snackbar: {
      position: 'absolute',
      bottom: spacing.lg,
      left: spacing.md,
      right: spacing.md,
      backgroundColor: colors.textPrimary,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
    },
    message: {
      color: colors.textInverse,
      fontSize: 14,
      flex: 1,
    },
    undoText: {
      color: colors.grassLight,
      fontSize: 14,
      fontWeight: '700',
      marginLeft: spacing.md,
    },
  });
}
