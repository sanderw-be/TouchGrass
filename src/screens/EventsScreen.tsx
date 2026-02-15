import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getUnreviewedSessions, getSessionsForRange,
  confirmSession, OutsideSession,
} from '../storage/database';
import { colors, spacing, radius, shadows, formatMinutes } from '../utils/theme';
import { t, formatLocalDate, formatLocalTime } from '../i18n';
import ManualSessionSheet from '../components/ManualSessionSheet';

type Tab = 'review' | 'all';

export default function EventsScreen() {
  const [tab, setTab] = useState<Tab>('review');
  const [unreviewed, setUnreviewed] = useState<OutsideSession[]>([]);
  const [allSessions, setAllSessions] = useState<OutsideSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  const loadData = useCallback(() => {
    setUnreviewed(getUnreviewedSessions());
    const fourWeeksAgo = Date.now() - 28 * 24 * 60 * 60 * 1000;
    setAllSessions(getSessionsForRange(fourWeeksAgo, Date.now()).reverse());
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  };

  const handleConfirm = (id: number, confirmed: boolean) => {
    confirmSession(id, confirmed);
    loadData();
  };

  const sessions = tab === 'review' ? unreviewed : allSessions;

  return (
    <View style={styles.container}>
      <ManualSessionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSessionLogged={loadData}
      />
      {/* Tab switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'review' && styles.tabActive]}
          onPress={() => setTab('review')}
        >
          <Text style={[styles.tabText, tab === 'review' && styles.tabTextActive]}>
            {t('events_tab_review')} {unreviewed.length > 0 && `(${unreviewed.length})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'all' && styles.tabActive]}
          onPress={() => setTab('all')}
        >
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>{t('events_tab_all')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => setSheetVisible(true)}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.grass} />}
      >
        {sessions.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{tab === 'review' ? '✅' : '🌿'}</Text>
            <Text style={styles.emptyText}>
              {tab === 'review' ? t('events_all_reviewed') : t('events_none_recorded')}
            </Text>
          </View>
        )}

        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            showActions={tab === 'review' || session.userConfirmed === null}
            onConfirm={(confirmed) => handleConfirm(session.id!, confirmed)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function SessionCard({
  session,
  showActions,
  onConfirm,
}: {
  session: OutsideSession;
  showActions: boolean;
  onConfirm: (confirmed: boolean) => void;
}) {
  const sourceIcon: Record<string, string> = {
    health_connect: '👟',
    gps: '📍',
    manual: '✏️',
    timeline: '🗓️',
  };

  const sourceLabel: Record<string, string> = {
    health_connect: t('source_health_connect'),
    gps: t('source_gps'),
    manual: t('source_manual'),
    timeline: t('source_timeline'),
  };

  const confidencePct = Math.round(session.confidence * 100);
  const isConfirmed = session.userConfirmed === 1 || session.userConfirmed === true;
  const isRejected = session.userConfirmed === 0 || session.userConfirmed === false;

  return (
    <View style={[styles.card, isRejected && styles.cardRejected]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardIcon}>{sourceIcon[session.source] ?? '🌿'}</Text>
        <View style={styles.cardInfo}>
          <Text style={styles.cardDate}>
            {formatLocalDate(session.startTime, { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
          <Text style={styles.cardTime}>
            {formatLocalTime(session.startTime)} – {formatLocalTime(session.endTime)}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardDuration}>{formatMinutes(session.durationMinutes)}</Text>
          <Text style={styles.cardSource}>{sourceLabel[session.source]}</Text>
        </View>
      </View>

      {/* Confidence bar */}
      <View style={styles.confidenceRow}>
        <Text style={styles.confidenceLabel}>{t('events_confidence')}</Text>
        <View style={styles.confidenceBar}>
          <View style={[styles.confidenceFill, { width: `${confidencePct}%` }]} />
        </View>
        <Text style={styles.confidencePct}>{confidencePct}%</Text>
      </View>

      {session.notes && (
        <Text style={styles.notes}>{session.notes}</Text>
      )}

      {/* Review actions */}
      {showActions && !isConfirmed && !isRejected && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionReject]}
            onPress={() => onConfirm(false)}
          >
            <Text style={styles.actionRejectText}>{t('events_not_outside')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionConfirm]}
            onPress={() => onConfirm(true)}
          >
            <Text style={styles.actionConfirmText}>{t('events_confirm')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Already reviewed badge */}
      {isConfirmed && (
        <View style={styles.confirmedBadge}>
          <Text style={styles.confirmedText}>{t('events_confirmed')}</Text>
        </View>
      )}
      {isRejected && (
        <View style={styles.rejectedBadge}>
          <Text style={styles.rejectedText}>{t('events_rejected')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.mist },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.textInverse,
    borderBottomWidth: 1,
    borderBottomColor: colors.fog,
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.grass },
  tabText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: colors.grass, fontWeight: '700' },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grass,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    ...shadows.soft,
  },
  addBtnText: { fontSize: 22, color: colors.textInverse, lineHeight: 28, fontWeight: '300' },

  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { fontSize: 15, color: colors.textSecondary },

  card: {
    backgroundColor: colors.textInverse,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  cardRejected: { opacity: 0.5 },

  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  cardIcon: { fontSize: 24, marginRight: spacing.sm },
  cardInfo: { flex: 1 },
  cardDate: { fontSize: 13, color: colors.textMuted },
  cardTime: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardDuration: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  cardSource: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  confidenceLabel: { fontSize: 11, color: colors.textMuted, width: 72 },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.fog,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  confidenceFill: { height: '100%', backgroundColor: colors.grass, borderRadius: radius.full },
  confidencePct: { fontSize: 11, color: colors.textMuted, width: 32, textAlign: 'right' },

  notes: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm, fontStyle: 'italic' },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  actionReject: { backgroundColor: colors.fog },
  actionConfirm: { backgroundColor: colors.grass },
  actionRejectText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  actionConfirmText: { fontSize: 14, color: colors.textInverse, fontWeight: '600' },

  confirmedBadge: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.grassPale,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  confirmedText: { fontSize: 12, color: colors.grass, fontWeight: '600' },
  rejectedBadge: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.fog,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  rejectedText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
});
