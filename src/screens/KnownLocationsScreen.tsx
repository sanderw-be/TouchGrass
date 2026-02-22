import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Alert, TextInput, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  KnownLocation,
  getAllKnownLocations,
  approveKnownLocation,
  denyKnownLocation,
  getSetting,
  setSetting,
} from '../storage/database';
import { getDetectionStatus } from '../detection/index';
import { colors, spacing, radius, shadows } from '../utils/theme';
import { t } from '../i18n';
import EditLocationSheet from '../components/EditLocationSheet';

export default function KnownLocationsScreen() {
  const insets = useSafeAreaInsets();
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);
  const [gpsActive, setGpsActive] = useState(false);
  const [suggested, setSuggested] = useState<KnownLocation[]>([]);
  const [active, setActive] = useState<KnownLocation[]>([]);
  const [editingLocation, setEditingLocation] = useState<KnownLocation | null>(null);
  const [approvingLocation, setApprovingLocation] = useState<KnownLocation | null>(null);
  const [approveLabel, setApproveLabel] = useState('');

  const loadData = useCallback(() => {
    setSuggestionsEnabled(getSetting('location_suggestions_enabled', '1') === '1');
    const status = getDetectionStatus();
    setGpsActive(status.gps);
    const all = getAllKnownLocations();
    setSuggested(all.filter(l => l.status === 'suggested'));
    setActive(all.filter(l => l.status === 'active'));
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  const toggleSuggestions = (value: boolean) => {
    setSetting('location_suggestions_enabled', value ? '1' : '0');
    setSuggestionsEnabled(value);
  };

  const handleApprove = (loc: KnownLocation) => {
    setApproveLabel(loc.label || '');
    setApprovingLocation(loc);
  };

  const handleApproveConfirm = () => {
    if (!approvingLocation?.id) return;
    const label = approveLabel.trim() || t('location_suggestion_default_label');
    approveKnownLocation(approvingLocation.id, label);
    setApprovingLocation(null);
    loadData();
  };

  const handleDeny = (loc: KnownLocation) => {
    if (!loc.id) return;
    Alert.alert(
      t('settings_location_deny_title'),
      t('settings_location_deny_body'),
      [
        { text: t('settings_location_deny_cancel'), style: 'cancel' },
        {
          text: t('settings_location_deny_confirm'),
          style: 'destructive',
          onPress: () => {
            denyKnownLocation(loc.id!);
            loadData();
          },
        },
      ]
    );
  };

  return (
    <>
      <EditLocationSheet
        visible={editingLocation !== null}
        location={editingLocation}
        onClose={() => setEditingLocation(null)}
        onSave={() => {
          loadData();
          setEditingLocation(null);
        }}
      />

      {/* Approve modal */}
      <Modal
        visible={approvingLocation !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setApprovingLocation(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('settings_location_approve_title')}</Text>
            <Text style={styles.modalLabel}>{t('settings_location_approve_name_label')}</Text>
            <TextInput
              style={styles.modalInput}
              value={approveLabel}
              onChangeText={setApproveLabel}
              placeholder={t('location_edit_label_placeholder')}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setApprovingLocation(null)}
              >
                <Text style={styles.modalCancelText}>{t('goals_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleApproveConfirm}
              >
                <Text style={styles.modalConfirmText}>{t('settings_location_approve_confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {/* Suggestions toggle (only useful when GPS is active) */}
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
          {suggested.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>{t('settings_location_no_suggestions')}</Text>
              <Text style={styles.emptyHint}>{t('settings_location_no_suggestions_hint')}</Text>
            </View>
          ) : (
            suggested.map((loc, i) => (
              <View key={loc.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.row}>
                  <Text style={styles.rowIcon}>🔍</Text>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>{loc.label || t('location_suggestion_default_label')}</Text>
                    <Text style={styles.rowSublabel}>
                      {t('settings_location_radius', {
                        radius: loc.radiusMeters,
                        type: loc.isIndoor ? t('settings_location_indoor') : t('settings_location_outdoor'),
                      })}
                    </Text>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>{t('settings_location_suggested_badge')}</Text>
                    </View>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApprove(loc)}
                    >
                      <Text style={styles.approveBtnText}>{t('settings_location_approve')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.denyBtn}
                      onPress={() => handleDeny(loc)}
                    >
                      <Text style={styles.denyBtnText}>{t('settings_location_deny')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Active locations */}
        <Text style={styles.sectionHeader}>{t('settings_locations_section_active')}</Text>
        <View style={styles.card}>
          {active.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>{t('settings_location_no_active')}</Text>
              <Text style={styles.emptyHint}>{t('settings_location_no_active_hint')}</Text>
            </View>
          ) : (
            active.map((loc, i) => (
              <View key={loc.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.row}>
                  <Text style={styles.rowIcon}>
                    {loc.label === 'Home' ? '🏠' : loc.label === 'Work' ? '🏢' : '📌'}
                  </Text>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>{loc.label}</Text>
                    <Text style={styles.rowSublabel}>
                      {t('settings_location_radius', {
                        radius: loc.radiusMeters,
                        type: loc.isIndoor ? t('settings_location_indoor') : t('settings_location_outdoor'),
                      })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => setEditingLocation(loc)}
                  >
                    <Text style={styles.editBtnText}>{t('settings_location_edit')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.textInverse,
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
    backgroundColor: '#FEF3C7',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pendingBadgeText: { fontSize: 11, color: '#92400E', fontWeight: '600' },

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
    backgroundColor: '#FEE2E2',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignItems: 'center',
  },
  denyBtnText: { fontSize: 12, color: colors.error, fontWeight: '600' },

  editBtn: {
    backgroundColor: colors.grassPale,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  editBtnText: { fontSize: 12, color: colors.grass, fontWeight: '600' },

  // Approve modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.textInverse,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    ...shadows.medium,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  modalLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: {
    backgroundColor: colors.mist,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalCancel: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.fog,
  },
  modalCancelText: { fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
  modalConfirm: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.grass,
  },
  modalConfirmText: { fontSize: 15, color: colors.textInverse, fontWeight: '700' },
});
