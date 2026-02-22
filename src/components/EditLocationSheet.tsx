import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { upsertKnownLocation, deleteKnownLocation, KnownLocation } from '../storage/database';
import { colors, spacing, radius, shadows } from '../utils/theme';
import { t } from '../i18n';

// Radius step values in metres that the slider snaps to
const RADIUS_STEPS = [25, 50, 75, 100, 150, 200, 300, 500, 750, 1000];

function findRadiusIdx(r: number): number {
  let best = 0;
  let bestDiff = Math.abs(RADIUS_STEPS[0] - r);
  for (let i = 1; i < RADIUS_STEPS.length; i++) {
    const diff = Math.abs(RADIUS_STEPS[i] - r);
    if (diff < bestDiff) { best = i; bestDiff = diff; }
  }
  return best;
}

interface Coords {
  latitude: number;
  longitude: number;
}

interface Props {
  visible: boolean;
  /** Existing location to edit (or suggested location to approve). Pass null to create new. */
  location: KnownLocation | null;
  /** Coordinates to use when creating a new location (location === null). */
  initialCoords?: Coords;
  onClose: () => void;
  onSave: () => void;
}

export default function EditLocationSheet({
  visible, location, initialCoords, onClose, onSave,
}: Props) {
  const [label, setLabel] = useState('');
  const [radiusIdx, setRadiusIdx] = useState(findRadiusIdx(100));
  const [isIndoor, setIsIndoor] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);

  // Derive working coordinates: existing location or provided initial coords
  const coords: Coords | null = location
    ? { latitude: location.latitude, longitude: location.longitude }
    : initialCoords ?? null;

  const isNew = location === null;
  const isSuggested = location?.status === 'suggested';

  // Populate fields when the sheet opens or location changes
  useEffect(() => {
    if (visible) {
      setLabel(location?.label ?? '');
      setRadiusIdx(findRadiusIdx(location?.radiusMeters ?? 100));
      setIsIndoor(location?.isIndoor ?? true);
      setAddress(null);
    }
  }, [visible, location]);

  // Reverse-geocode coordinates to a human-readable address
  useEffect(() => {
    if (!visible || !coords) return;
    let cancelled = false;
    setAddressLoading(true);
    setAddress(null);
    Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude })
      .then((results) => {
        if (cancelled) return;
        const r = results[0];
        if (r) {
          const street = [r.street, r.streetNumber].filter(Boolean).join(' ');
          const parts = [street, r.city].filter(Boolean);
          setAddress(parts.length > 0 ? parts.join(', ') : t('location_edit_address_unavailable'));
        } else {
          setAddress(t('location_edit_address_unavailable'));
        }
      })
      .catch(() => {
        if (!cancelled) setAddress(t('location_edit_address_unavailable'));
      })
      .finally(() => {
        if (!cancelled) setAddressLoading(false);
      });
    return () => { cancelled = true; };
  }, [visible, coords?.latitude, coords?.longitude]);

  const handleSave = () => {
    if (!label.trim()) {
      Alert.alert(t('location_edit_error_title'), t('location_edit_error_label'));
      return;
    }
    if (!coords) return; // shouldn't happen but guard anyway

    try {
      upsertKnownLocation({
        id: location?.id,
        label: label.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusMeters: RADIUS_STEPS[radiusIdx],
        isIndoor,
        status: 'active', // always active when saved through this sheet
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
            if (!location?.id) return;
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

  const title = isNew
    ? t('location_add_title')
    : (isSuggested ? t('location_edit_approve_title') : t('settings_location_edit_title'));

  const saveLabel = (isNew || isSuggested)
    ? t('location_edit_approve_confirm')
    : t('goals_save');

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
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.saveBtn}>{saveLabel}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>

          {/* Address display */}
          {coords && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('location_edit_address')}</Text>
              <View style={styles.addressCard}>
                <Text style={styles.addressIcon}>📍</Text>
                {addressLoading ? (
                  <ActivityIndicator size="small" color={colors.grass} style={{ marginLeft: spacing.sm }} />
                ) : (
                  <Text style={styles.addressText}>{address ?? t('location_edit_address_unavailable')}</Text>
                )}
              </View>
              <Text style={styles.hint}>
                {`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`}
              </Text>
            </View>
          )}

          {/* Location name */}
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

          {/* Radius slider */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('location_edit_radius')}</Text>
            <View style={styles.radiusValueRow}>
              <Text style={styles.radiusValue}>{RADIUS_STEPS[radiusIdx]} m</Text>
            </View>
            <RadiusSlider idx={radiusIdx} onChange={setRadiusIdx} />
            <Text style={styles.hint}>{t('location_edit_radius_hint')}</Text>
          </View>

          {/* Indoor/Outdoor toggle */}
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

          {/* Delete button — only for existing saved locations */}
          {!isNew && location?.id && (
            <View style={styles.section}>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Text style={styles.deleteBtnText}>{t('location_delete_btn')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Radius step slider ──────────────────────────────────

function RadiusSlider({ idx, onChange }: { idx: number; onChange: (i: number) => void }) {
  const last = RADIUS_STEPS.length - 1;
  const fillPercent = Math.round((idx / last) * 100);
  return (
    <View style={sliderStyles.wrapper}>
      {/* Background track */}
      <View style={sliderStyles.track} />
      {/* Filled track up to active step */}
      <View style={[sliderStyles.trackFill, { width: `${fillPercent}%` as `${number}%` }]} />
      {/* Step dots */}
      <View style={sliderStyles.dotsRow}>
        {RADIUS_STEPS.map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => onChange(i)}
            hitSlop={{ top: 14, bottom: 14, left: 4, right: 4 }}
          >
            <View style={[
              sliderStyles.dot,
              i <= idx && sliderStyles.dotFilled,
              i === idx && sliderStyles.dotActive,
            ]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  wrapper: {
    height: 40,
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.fog,
    borderRadius: 2,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    backgroundColor: colors.grass,
    borderRadius: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.fog,
    borderWidth: 2,
    borderColor: colors.fog,
  },
  dotFilled: {
    backgroundColor: colors.grassPale,
    borderColor: colors.grass,
  },
  dotActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.grass,
    borderColor: colors.grassDark,
  },
});

// ── Sheet styles ─────────────────────────────────────────

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

  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.textInverse,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.soft,
  },
  addressIcon: { fontSize: 16, marginRight: spacing.sm },
  addressText: { flex: 1, fontSize: 15, color: colors.textPrimary },

  input: {
    backgroundColor: colors.textInverse,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    ...shadows.soft,
  },

  radiusValueRow: { alignItems: 'center', marginBottom: spacing.xs },
  radiusValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.grass,
  },

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

