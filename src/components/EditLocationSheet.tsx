import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  upsertKnownLocationAsync,
  deleteKnownLocationAsync,
  KnownLocation,
} from '../storage/database';
import { spacing, radius } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { t } from '../i18n';
import { isImperialUnits, metersToYards } from '../utils/units';
import { clampRadiusMeters } from '../detection/gpsDetection';

// Radius step values in metres that the slider snaps to.
// Range: 25–250 m, which matches the configurable geofence range.
export const RADIUS_STEPS_METERS = [25, 50, 75, 100, 125, 150, 175, 200, 225, 250];

function findRadiusIdx(r: number): number {
  const clamped = clampRadiusMeters(r);
  let best = 0;
  let bestDiff = Math.abs(RADIUS_STEPS_METERS[0] - clamped);
  for (let i = 1; i < RADIUS_STEPS_METERS.length; i++) {
    const diff = Math.abs(RADIUS_STEPS_METERS[i] - clamped);
    if (diff < bestDiff) {
      best = i;
      bestDiff = diff;
    }
  }
  return best;
}

interface Coords {
  latitude: number;
  longitude: number;
}

interface AddressSuggestion {
  /** Human-readable display text */
  display: string;
  coords: Coords;
}

interface Props {
  visible: boolean;
  /** Existing location to edit (or suggested location to approve). Pass null to create new. */
  location: KnownLocation | null;
  /** Coordinates to use when creating a new location (location === null). */
  initialCoords?: Coords;
  /** Label to pre-fill when creating a new location (location === null). */
  initialLabel?: string;
  onClose: () => void;
  onSave: () => void;
}

export default function EditLocationSheet({
  visible,
  location,
  initialCoords,
  initialLabel,
  onClose,
  onSave,
}: Props) {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  // Present or dismiss the sheet based on visibility
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
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

  const [label, setLabel] = useState('');
  const [radiusIdx, setRadiusIdx] = useState(findRadiusIdx(100));
  const [isIndoor, setIsIndoor] = useState(true);

  // Address state
  const [address, setAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressEditing, setAddressEditing] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressSearching, setAddressSearching] = useState(false);

  // Manually chosen coords (overrides original coords when user picks an address)
  const [manualCoords, setManualCoords] = useState<Coords | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Working coordinates: manual override > existing location > initial coords
  const baseCoords: Coords | null = useMemo(
    () =>
      location
        ? { latitude: location.latitude, longitude: location.longitude }
        : (initialCoords ?? null),
    [location, initialCoords]
  );
  const coords: Coords | null = useMemo(
    () => manualCoords ?? baseCoords,
    [manualCoords, baseCoords]
  );

  const isNew = location === null;
  const isSuggested = location?.status === 'suggested';

  // Populate fields when the sheet opens or location changes
  useEffect(() => {
    if (visible) {
      setLabel(location?.label ?? initialLabel ?? '');
      setRadiusIdx(findRadiusIdx(location?.radiusMeters ?? 100));
      setIsIndoor(location?.isIndoor ?? true);
      setAddress(null);
      setManualCoords(null);
      setAddressEditing(false);
      setAddressQuery('');
      setAddressSuggestions([]);
    }
  }, [visible, location, initialLabel]);

  // Reverse-geocode coordinates to a human-readable address
  useEffect(() => {
    if (!visible || !coords || addressEditing) return;
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
    return () => {
      cancelled = true;
    };
  }, [visible, coords, addressEditing]);

  // Geocode search with 500ms debounce
  const handleAddressQueryChange = useCallback((text: string) => {
    setAddressQuery(text);
    setAddressSuggestions([]);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!text.trim()) return;
    searchTimerRef.current = setTimeout(async () => {
      setAddressSearching(true);
      try {
        const results = await Location.geocodeAsync(text.trim());
        const suggestions: AddressSuggestion[] = results
          .filter((r) => r.latitude !== 0 || r.longitude !== 0) // exclude null island (0,0)
          .slice(0, 5)
          .map((r) => ({
            // Temporary display text — replaced by reverse-geocode below
            display: text.trim(),
            coords: { latitude: r.latitude, longitude: r.longitude },
          }));

        // Reverse-geocode each suggestion to get a human-readable label
        const labelled = await Promise.all(
          suggestions.map(async (s) => {
            try {
              const rev = await Location.reverseGeocodeAsync(s.coords);
              if (rev[0]) {
                const street = [rev[0].street, rev[0].streetNumber].filter(Boolean).join(' ');
                const parts = [street, rev[0].city, rev[0].country].filter(Boolean);
                return { ...s, display: parts.join(', ') || s.display };
              }
            } catch {
              /* keep original */
            }
            return s;
          })
        );
        setAddressSuggestions(labelled);
      } catch {
        setAddressSuggestions([]);
      } finally {
        setAddressSearching(false);
      }
    }, 500);
  }, []);

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    setManualCoords(suggestion.coords);
    setAddress(suggestion.display);
    setAddressEditing(false);
    setAddressQuery('');
    setAddressSuggestions([]);
  };

  const handleSave = async () => {
    if (!label.trim()) {
      Alert.alert(t('location_edit_error_title'), t('location_edit_error_label'));
      return;
    }
    if (!coords) return;

    try {
      await upsertKnownLocationAsync({
        id: location?.id,
        label: label.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusMeters: RADIUS_STEPS_METERS[radiusIdx],
        isIndoor,
        status: 'active',
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
    Alert.alert(t('location_delete_confirm_title'), t('location_delete_confirm_body'), [
      { text: t('settings_clear_cancel'), style: 'cancel' },
      {
        text: t('location_delete_btn'),
        style: 'destructive',
        onPress: async () => {
          if (!location?.id) return;
          try {
            await deleteKnownLocationAsync(location.id);
            onSave();
            onClose();
          } catch (error) {
            console.error('Error deleting location:', error);
            Alert.alert(t('location_edit_error_title'), t('location_edit_error_delete'));
          }
        },
      },
    ]);
  };

  const title = isNew
    ? t('location_add_title')
    : isSuggested
      ? t('location_edit_approve_title')
      : t('settings_location_edit_title');

  const saveLabel = isNew || isSuggested ? t('location_edit_approve_confirm') : t('goals_save');

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['88%']}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: colors.mist }}
      handleIndicatorStyle={{ backgroundColor: colors.fog }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => bottomSheetRef.current?.dismiss()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <BottomSheetScrollView
        contentContainerStyle={[
          styles.contentInner,
          { paddingTop: spacing.sm, paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Address — view or editable search */}
        {(coords || addressEditing) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('location_edit_address')}</Text>

            {addressEditing ? (
              /* Search input */
              <View>
                <View style={styles.addressSearchRow}>
                  <Text style={styles.addressIcon}>📍</Text>
                  <BottomSheetTextInput
                    style={styles.addressInput}
                    value={addressQuery}
                    onChangeText={handleAddressQueryChange}
                    placeholder={t('location_edit_address_search_placeholder')}
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                  />
                  {addressSearching && <ActivityIndicator size="small" color={colors.grass} />}
                  <TouchableOpacity
                    onPress={() => {
                      setAddressEditing(false);
                      setAddressQuery('');
                      setAddressSuggestions([]);
                    }}
                  >
                    <Text style={styles.cancelSearch}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Suggestions list */}
                {addressSuggestions.length > 0 && (
                  <View style={styles.suggestionsList}>
                    {addressSuggestions.map((s, i) => (
                      <TouchableOpacity
                        key={`${s.coords.latitude}-${s.coords.longitude}`}
                        style={[
                          styles.suggestionRow,
                          i < addressSuggestions.length - 1 && styles.suggestionDivider,
                        ]}
                        onPress={() => handleSelectSuggestion(s)}
                      >
                        <Text style={styles.suggestionIcon}>📍</Text>
                        <Text style={styles.suggestionText} numberOfLines={2}>
                          {s.display}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {!addressSearching && addressQuery.trim() && addressSuggestions.length === 0 && (
                  <Text style={styles.noResults}>{t('location_edit_address_no_results')}</Text>
                )}
              </View>
            ) : (
              /* Display card — tap to edit */
              <TouchableOpacity
                style={styles.addressCard}
                onPress={() => {
                  setAddressQuery(address ?? '');
                  setAddressEditing(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.addressIcon}>📍</Text>
                {addressLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.grass}
                    style={{ marginLeft: spacing.sm }}
                  />
                ) : (
                  <>
                    <Text style={styles.addressText}>
                      {address ?? t('location_edit_address_unavailable')}
                    </Text>
                    <Text style={styles.addressEditHint}>✎</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {coords && !addressEditing && (
              <Text style={styles.hint}>
                {`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`}
              </Text>
            )}
          </View>
        )}

        {/* Location name */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('location_edit_label')}</Text>
          <BottomSheetTextInput
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
            <Text style={styles.radiusValue}>
              {isImperialUnits()
                ? `${Math.round(metersToYards(RADIUS_STEPS_METERS[radiusIdx]))} yd`
                : `${RADIUS_STEPS_METERS[radiusIdx]} m`}
            </Text>
          </View>
          <RadiusSlider idx={radiusIdx} onChange={setRadiusIdx} />
          <Text style={styles.hint}>
            {isImperialUnits()
              ? t('location_edit_radius_hint_imperial')
              : t('location_edit_radius_hint')}
          </Text>
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

        {/* Save button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSave}>
            <Text style={styles.primaryBtnText}>{saveLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* Delete button — only for existing saved locations */}
        {!isNew && location?.id && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>{t('location_delete_btn')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ── Radius step slider ──────────────────────────────────

function RadiusSlider({ idx, onChange }: { idx: number; onChange: (i: number) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeSliderStyles(colors), [colors]);
  const last = RADIUS_STEPS_METERS.length - 1;
  const fillPercent = Math.round((idx / last) * 100);
  return (
    <View style={styles.wrapper}>
      {/* Background track */}
      <View style={styles.track} />
      {/* Filled track up to active step */}
      <View style={[styles.trackFill, { width: `${fillPercent}%` as `${number}%` }]} />
      {/* Step dots */}
      <View style={styles.dotsRow}>
        {RADIUS_STEPS_METERS.map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => onChange(i)}
            hitSlop={{ top: 14, bottom: 14, left: 4, right: 4 }}
          >
            <View
              style={[styles.dot, i <= idx && styles.dotFilled, i === idx && styles.dotActive]}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function makeSliderStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
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
    title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.fog,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },

    contentInner: { padding: spacing.md, paddingBottom: spacing.lg },

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
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      ...shadows.soft,
    },
    addressIcon: { fontSize: 16, marginRight: spacing.sm },
    addressText: { flex: 1, fontSize: 15, color: colors.textPrimary },
    addressEditHint: { fontSize: 16, color: colors.textMuted, marginLeft: spacing.sm },

    addressSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.sm,
      gap: spacing.sm,
      ...shadows.soft,
    },
    addressInput: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
      padding: spacing.xs,
    },
    cancelSearch: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '700',
      paddingHorizontal: 4,
    },

    suggestionsList: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      marginTop: spacing.xs,
      ...shadows.soft,
      overflow: 'hidden',
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      gap: spacing.sm,
    },
    suggestionDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.fog,
    },
    suggestionIcon: { fontSize: 14 },
    suggestionText: { flex: 1, fontSize: 14, color: colors.textPrimary },

    noResults: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: spacing.xs,
      textAlign: 'center',
    },

    input: {
      backgroundColor: colors.card,
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
      backgroundColor: colors.card,
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

    primaryBtn: {
      backgroundColor: colors.grass,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
    },
    primaryBtnText: { fontSize: 16, color: colors.textInverse, fontWeight: '700' },

    deleteBtn: {
      backgroundColor: colors.errorSurface,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
    },
    deleteBtnText: { fontSize: 16, color: colors.error, fontWeight: '600' },
  });
}
