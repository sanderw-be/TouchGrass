import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, Alert, ScrollView,
} from 'react-native';
import { upsertKnownLocation, deleteKnownLocation, KnownLocation } from '../storage/database';
import { colors, spacing, radius, shadows } from '../utils/theme';
import { t } from '../i18n';

interface Props {
  visible: boolean;
  location: KnownLocation | null;
  onClose: () => void;
  onSave: () => void;
}

export default function EditLocationSheet({ visible, location, onClose, onSave }: Props) {
  const [label, setLabel] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('100');
  const [isIndoor, setIsIndoor] = useState(true);

  useEffect(() => {
    if (location) {
      setLabel(location.label);
      setRadiusMeters(location.radiusMeters.toString());
      setIsIndoor(location.isIndoor);
    } else {
      setLabel('');
      setRadiusMeters('100');
      setIsIndoor(true);
    }
  }, [location]);

  const handleSave = () => {
    if (!location) return;

    const radius = parseInt(radiusMeters, 10);
    if (!label.trim()) {
      Alert.alert(t('location_edit_error_title'), t('location_edit_error_label'));
      return;
    }
    if (isNaN(radius) || radius < 10 || radius > 1000) {
      Alert.alert(t('location_edit_error_title'), t('location_edit_error_radius'));
      return;
    }

    try {
      upsertKnownLocation({
        ...location,
        label: label.trim(),
        radiusMeters: radius,
        isIndoor,
      });
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert(t('location_edit_error_title'), t('location_edit_error_save'));
    }
  };

  const handleDelete = () => {
    if (!location?.id) return;

    Alert.alert(
      t('location_delete_confirm_title'),
      t('location_delete_confirm_body'),
      [
        { text: t('settings_clear_cancel'), style: 'cancel' },
        {
          text: t('location_delete_btn'),
          style: 'destructive',
          onPress: () => {
            if (!location.id) return;
            try {
              deleteKnownLocation(location.id);
              onSave();
              onClose();
            } catch (error) {
              console.error('Error deleting location:', error);
              Alert.alert(t('location_edit_error_title'), t('location_edit_error_delete'));
            }
          },
        },
      ]
    );
  };

  if (!location) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelBtn}>{t('goals_cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('settings_location_edit_title')}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.saveBtn}>{t('goals_save')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {/* Location Name */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('location_edit_label')}</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder={t('location_edit_label_placeholder')}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Radius */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('location_edit_radius')}</Text>
            <View style={styles.radiusRow}>
              <TextInput
                style={[styles.input, styles.radiusInput]}
                value={radiusMeters}
                onChangeText={setRadiusMeters}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.radiusUnit}>meters</Text>
            </View>
            <Text style={styles.hint}>{t('location_edit_radius_hint')}</Text>
          </View>

          {/* Indoor/Outdoor Toggle */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('location_edit_type')}</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, isIndoor && styles.toggleBtnActive]}
                onPress={() => setIsIndoor(true)}
              >
                <Text style={[styles.toggleText, isIndoor && styles.toggleTextActive]}>
                  🏠 {t('settings_location_indoor')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, !isIndoor && styles.toggleBtnActive]}
                onPress={() => setIsIndoor(false)}
              >
                <Text style={[styles.toggleText, !isIndoor && styles.toggleTextActive]}>
                  🌳 {t('settings_location_outdoor')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Delete Button */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>{t('location_delete_btn')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.mist },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.textInverse,
    borderBottomWidth: 1,
    borderBottomColor: colors.fog,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  cancelBtn: { fontSize: 16, color: colors.textMuted },
  saveBtn: { fontSize: 16, color: colors.grass, fontWeight: '600' },

  content: { flex: 1 },
  contentInner: { padding: spacing.md },

  section: { marginBottom: spacing.lg },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.textInverse,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    ...shadows.soft,
  },

  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  radiusInput: { flex: 1 },
  radiusUnit: { fontSize: 16, color: colors.textSecondary },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },

  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleBtn: {
    flex: 1,
    backgroundColor: colors.textInverse,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.soft,
  },
  toggleBtnActive: {
    backgroundColor: colors.grassPale,
    borderWidth: 2,
    borderColor: colors.grass,
  },
  toggleText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  toggleTextActive: { color: colors.grass, fontWeight: '700' },

  deleteBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 16, color: colors.error, fontWeight: '600' },
});
