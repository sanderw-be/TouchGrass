import React, { useState, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import {
  KnownLocation,
  getAllKnownLocationsAsync,
  denyKnownLocationAsync,
  getSettingAsync,
  setSettingAsync,
} from '../storage/database';
import { getDetectionStatus } from '../detection/index';
import { spacing, radius } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { t } from '../i18n';
import EditLocationSheet from '../components/EditLocationSheet';
import type { SettingsStackParamList } from '../navigation/AppNavigator';

export default function KnownLocationsScreen() {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const navigation = useNavigation<StackNavigationProp<SettingsStackParamList>>();
  const insets = useSafeAreaInsets();
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);
  const [gpsActive, setGpsActive] = useState(false);
  const [suggested, setSuggested] = useState<KnownLocation[]>([]);
  const [active, setActive] = useState<KnownLocation[]>([]);
  const [editingLocation, setEditingLocation] = useState<KnownLocation | null>(null);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newLocationCoords, setNewLocationCoords] = useState<
    { latitude: number; longitude: number } | undefined
  >();
  const isFetchingRef = useRef(false);

  const loadData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setSuggestionsEnabled((await getSettingAsync('location_suggestions_enabled', '1')) === '1');
      const status = getDetectionStatus();
      setGpsActive(status.gps);
      const all = await getAllKnownLocationsAsync();
      setSuggested(all.filter((l) => l.status === 'suggested'));
      setActive(all.filter((l) => l.status === 'active'));
    } catch (error) {
      console.error('[KnownLocationsScreen.loadData] Error:', error);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleAddLocation = useCallback(async () => {
    try {
      // Try last known position first (instant), fall back to a fresh fix
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setNewLocationCoords({ latitude: last.coords.latitude, longitude: last.coords.longitude });
        setIsCreatingLocation(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setNewLocationCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setIsCreatingLocation(true);
    } catch {
      Alert.alert(t('location_position_error_title'), t('location_position_error_body'));
    }
  }, []);

  // Add "+" button to the stack navigator header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleAddLocation}
          style={styles.headerAddBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.headerAddBtnText}>＋</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleAddLocation, styles.headerAddBtn, styles.headerAddBtnText]);

  const closeSheet = useCallback(() => {
    setEditingLocation(null);
    setIsCreatingLocation(false);
    setNewLocationCoords(undefined);
  }, []);

  const afterSave = useCallback(() => {
    loadData();
    closeSheet();
  }, [loadData, closeSheet]);

  const toggleSuggestions = async (value: boolean) => {
    try {
      await setSettingAsync('location_suggestions_enabled', value ? '1' : '0');
      setSuggestionsEnabled(value);
    } catch (error) {
      console.error('[KnownLocationsScreen.toggleSuggestions] Error:', error);
    }
  };

  const handleDeny = (loc: KnownLocation) => {
    if (!loc.id) return;
    Alert.alert(t('settings_location_deny_title'), t('settings_location_deny_body'), [
      { text: t('settings_location_deny_cancel'), style: 'cancel' },
      {
        text: t('settings_location_deny_confirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await denyKnownLocationAsync(loc.id!);
            loadData();
          } catch (error) {
            console.error('[KnownLocationsScreen.handleDeny] Error:', error);
          }
        },
      },
    ]);
  };

  const sheetVisible = editingLocation !== null || isCreatingLocation;
  const sheetLocation = isCreatingLocation ? null : editingLocation;

  return (
    <>
      <EditLocationSheet
        visible={sheetVisible}
        location={sheetLocation}
        initialCoords={isCreatingLocation ? newLocationCoords : undefined}
        onClose={closeSheet}
        onSave={afterSave}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {/* Suggestions toggle */}
        <Text style={styles.sectionHeader}>{t('settings_section_detection')}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowIcon}>📍</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{t('settings_locations_suggestions_enabled')}</Text>
              <Text style={styles.rowSublabel}>
                {gpsActive
                  ? t('settings_locations_suggestions_desc')
                  : t('settings_gps_permission')}
              </Text>
            </View>
            <Switch
              value={suggestionsEnabled && gpsActive}
              onValueChange={toggleSuggestions}
              disabled={!gpsActive}
              trackColor={{ false: colors.fog, true: colors.grassLight }}
              thumbColor={suggestionsEnabled && gpsActive ? colors.grass : colors.inactive}
            />
          </View>
        </View>

        {/* Suggested locations */}
        <Text style={styles.sectionHeader}>{t('settings_locations_section_suggested')}</Text>
        <View style={styles.card}>
          {!isLoading && suggested.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>{t('settings_location_no_suggestions')}</Text>
              <Text style={styles.emptyHint}>{t('settings_location_no_suggestions_hint')}</Text>
            </View>
          ) : (
            suggested.map((loc, i) => (
              <View key={loc.id}>
                {i > 0 && <View style={styles.divider} />}
                <TouchableOpacity onPress={() => setEditingLocation(loc)}>
                  <View style={styles.row}>
                    <Text style={styles.rowIcon}>🔍</Text>
                    <View style={styles.rowContent}>
                      <Text style={styles.rowLabel}>
                        {loc.label || t('location_suggestion_default_label')}
                      </Text>
                      <Text style={styles.rowSublabel}>
                        {t('settings_location_radius', {
                          radius: loc.radiusMeters,
                          type: loc.isIndoor
                            ? t('settings_location_indoor')
                            : t('settings_location_outdoor'),
                        })}
                      </Text>
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>
                          {t('settings_location_suggested_badge')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => setEditingLocation(loc)}
                      >
                        <Text style={styles.approveBtnText}>{t('settings_location_approve')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.denyBtn} onPress={() => handleDeny(loc)}>
                        <Text style={styles.denyBtnText}>{t('settings_location_deny')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Active locations */}
        <Text style={styles.sectionHeader}>{t('settings_locations_section_active')}</Text>
        <View style={styles.card}>
          {!isLoading && active.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>{t('settings_location_no_active')}</Text>
              <Text style={styles.emptyHint}>{t('settings_location_no_active_hint')}</Text>
            </View>
          ) : (
            active.map((loc, i) => (
              <View key={loc.id}>
                {i > 0 && <View style={styles.divider} />}
                <TouchableOpacity onPress={() => setEditingLocation(loc)}>
                  <View style={styles.row}>
                    <Text style={styles.rowIcon}>
                      {loc.label === 'Home' ? '🏠' : loc.label === 'Work' ? '🏢' : '📌'}
                    </Text>
                    <View style={styles.rowContent}>
                      <Text style={styles.rowLabel}>{loc.label}</Text>
                      <Text style={styles.rowSublabel}>
                        {t('settings_location_radius', {
                          radius: loc.radiusMeters,
                          type: loc.isIndoor
                            ? t('settings_location_indoor')
                            : t('settings_location_outdoor'),
                        })}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  shadows: ReturnType<typeof useTheme>['shadows']
) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.mist },
    content: { padding: spacing.md },

    sectionHeader: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
      marginLeft: spacing.xs,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      overflow: 'hidden',
      ...shadows.soft,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
    },
    rowIcon: { fontSize: 20, marginRight: spacing.md, width: 28, textAlign: 'center' },
    rowContent: { flex: 1 },
    rowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
    rowSublabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

    divider: { height: 1, backgroundColor: colors.fog, marginLeft: spacing.md + 28 + spacing.md },

    emptyBox: { padding: spacing.md },
    emptyTitle: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', marginBottom: 4 },
    emptyHint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },

    pendingBadge: {
      alignSelf: 'flex-start',
      marginTop: 4,
      backgroundColor: colors.warningSurface,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    pendingBadgeText: { fontSize: 11, color: colors.warningText, fontWeight: '600' },

    actionButtons: {
      flexDirection: 'column',
      gap: spacing.xs,
      marginLeft: spacing.sm,
    },
    approveBtn: {
      backgroundColor: colors.grassPale,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      alignItems: 'center',
    },
    approveBtnText: { fontSize: 12, color: colors.grass, fontWeight: '600' },
    denyBtn: {
      backgroundColor: colors.errorSurface,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      alignItems: 'center',
    },
    denyBtnText: { fontSize: 12, color: colors.error, fontWeight: '600' },

    chevron: { fontSize: 24, color: colors.textMuted, fontWeight: '300' },

    headerAddBtn: { marginRight: spacing.md },
    headerAddBtnText: { fontSize: 24, color: colors.grass, fontWeight: '400', lineHeight: 28 },
  });
}
