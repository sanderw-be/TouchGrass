import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getApprovedSessions, getStandardSessions, getAllSessionsIncludingDiscarded,
  confirmSession, deleteSession, unDiscardSession, OutsideSession,
} from '../storage/database';
import { colors, spacing, radius, shadows } from '../utils/theme';
import { formatMinutes } from '../utils/helpers';
import { t, formatLocalDate, formatLocalTime } from '../i18n';
import ManualSessionSheet from '../components/ManualSessionSheet';
import { updateTimeSlotProbability } from '../detection/sessionConfidence';

type Tab = 'approved' | 'standard' | 'all';

const FOUR_WEEKS_AGO = () => Date.now() - 28 * 24 * 60 * 60 * 1000;

/** Group a flat list of sessions by calendar day. */
function groupByDay(sessions: OutsideSession[]): { dayMs: number; sessions: OutsideSession[] }[] {
  const map = new Map<number, OutsideSession[]>();
  for (const s of sessions) {
    const d = new Date(s.startTime);
    const dayMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (!map.has(dayMs)) map.set(dayMs, []);
    map.get(dayMs)!.push(s);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([dayMs, daySessions]) => ({ dayMs, sessions: daySessions }));
}

export default function EventsScreen() {
  const [tab, setTab] = useState<Tab>('standard');
  const [approvedSessions, setApprovedSessions] = useState<OutsideSession[]>([]);
  const [standardSessions, setStandardSessions] = useState<OutsideSession[]>([]);
  const [allSessions, setAllSessions] = useState<OutsideSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadData = useCallback(() => {
    const from = FOUR_WEEKS_AGO();
    const to = Date.now();
    setApprovedSessions(getApprovedSessions(from, to));
    setStandardSessions(getStandardSessions(from, to));
    setAllSessions(getAllSessionsIncludingDiscarded(from, to));
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  };

  const handleConfirm = (id: number, startTime: number, confirmed: boolean) => {
    confirmSession(id, confirmed);
    const d = new Date(startTime);
    updateTimeSlotProbability(d.getHours(), d.getDay(), confirmed);
    setExpandedId(null);
    loadData();
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      t('session_delete_confirm_title'),
      t('session_delete_confirm_body'),
      [
        { text: t('session_delete_cancel'), style: 'cancel' },
        {
          text: t('session_delete'),
          style: 'destructive',
          onPress: () => {
            deleteSession(id);
            setExpandedId(null);
            loadData();
          },
        },
      ]
    );
  };

  const handleReReview = (id: number) => {
    confirmSession(id, null);
    setExpandedId(null);
    loadData();
  };

  const handleUnDiscard = (id: number) => {
    unDiscardSession(id);
    setExpandedId(null);
    loadData();
  };

  const sessions =
    tab === 'approved' ? approvedSessions :
    tab === 'standard' ? standardSessions :
    allSessions;

  // standardSessions never contains discarded sessions (getStandardSessions filters them out),
  // but we guard explicitly so the intent is clear.
  const pendingCount = standardSessions.filter(s => s.userConfirmed === null && s.discarded !== 1).length;

  const grouped = groupByDay(sessions);

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
          style={[styles.tab, tab === 'approved' && styles.tabActive]}
          onPress={() => setTab('approved')}
        >
          <Text style={[styles.tabText, tab === 'approved' && styles.tabTextActive]}>
            {t('events_tab_approved')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'standard' && styles.tabActive]}
          onPress={() => setTab('standard')}
        >
          <Text style={[styles.tabText, tab === 'standard' && styles.tabTextActive]}>
            {t('events_tab_standard')}{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'all' && styles.tabActive]}
          onPress={() => setTab('all')}
        >
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>
            {t('events_tab_all')}
          </Text>
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
            <Text style={styles.emptyIcon}>🌿</Text>
            <Text style={styles.emptyText}>{t('events_none_recorded')}</Text>
          </View>
        )}

        {grouped.map(({ dayMs, sessions: daySessions }) => (
          <View key={dayMs}>
            <Text style={styles.dayHeader}>
              {formatLocalDate(dayMs, { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            {daySessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                expanded={expandedId === session.id}
                onToggle={() => setExpandedId(expandedId === session.id ? null : session.id!)}
                onConfirm={(confirmed) => handleConfirm(session.id!, session.startTime, confirmed)}
                onDelete={() => handleDelete(session.id!)}
                onReReview={() => handleReReview(session.id!)}
                onUnDiscard={() => handleUnDiscard(session.id!)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function SessionRow({
  session,
  expanded,
  onToggle,
  onConfirm,
  onDelete,
  onReReview,
  onUnDiscard,
}: {
  session: OutsideSession;
  expanded: boolean;
  onToggle: () => void;
  onConfirm: (confirmed: boolean) => void;
  onDelete: () => void;
  onReReview: () => void;
  onUnDiscard: () => void;
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

  const isConfirmed = session.userConfirmed === 1;
  const isRejected = session.userConfirmed === 0;
  const isDiscarded = session.discarded === 1;
  const confidencePct = Math.round(session.confidence * 100);

  const statusLabel = isDiscarded
    ? t('events_discarded')
    : isConfirmed
    ? t('events_confirmed')
    : isRejected
    ? t('events_rejected')
    : t('events_proposed');

  const statusStyle = isDiscarded
    ? styles.badgeDiscarded
    : isConfirmed
    ? styles.badgeConfirmed
    : isRejected
    ? styles.badgeRejected
    : styles.badgeProposed;

  const statusTextStyle = isDiscarded
    ? styles.badgeDiscardedText
    : isConfirmed
    ? styles.badgeConfirmedText
    : isRejected
    ? styles.badgeRejectedText
    : styles.badgeProposedText;

  return (
    <View style={[styles.rowCard, (isRejected || isDiscarded) && styles.rowCardMuted]}>
      {/* Collapsed row */}
      <TouchableOpacity style={styles.rowSummary} onPress={onToggle} activeOpacity={0.7}>
        <Text style={styles.rowTime}>
          {formatLocalTime(session.startTime)}–{formatLocalTime(session.endTime)}
        </Text>
        <View style={[styles.statusBadge, statusStyle]}>
          <Text style={[styles.statusBadgeText, statusTextStyle]}>{statusLabel}</Text>
        </View>
        <Text style={styles.rowIcon}>{sourceIcon[session.source] ?? '🌿'}</Text>
        <Text style={styles.rowChevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.rowDetail}>
          {/* Top info */}
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

          {/* Actions for pending sessions */}
          {!isConfirmed && !isRejected && !isDiscarded && (
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

          {/* Actions for confirmed/rejected */}
          {(isConfirmed || isRejected) && !isDiscarded && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionSecondary]}
                onPress={onDelete}
              >
                <Text style={styles.actionSecondaryText}>{t('session_delete')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionConfirm]}
                onPress={onReReview}
              >
                <Text style={styles.actionConfirmText}>{t('session_review_again')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Actions for discarded sessions */}
          {isDiscarded && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionSecondary]}
                onPress={onDelete}
              >
                <Text style={styles.actionSecondaryText}>{t('session_delete')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionConfirm]}
                onPress={onUnDiscard}
              >
                <Text style={styles.actionConfirmText}>{t('session_review_anyway')}</Text>
              </TouchableOpacity>
            </View>
          )}
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
  tabText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
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
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.sm },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { fontSize: 15, color: colors.textSecondary },

  dayHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },

  rowCard: {
    backgroundColor: colors.textInverse,
    borderRadius: radius.md,
    marginBottom: 6,
    ...shadows.soft,
  },
  rowCardMuted: { opacity: 0.6 },

  rowSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rowTime: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    minWidth: 110,
  },
  statusBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  badgeConfirmed: { backgroundColor: colors.grassPale },
  badgeConfirmedText: { color: colors.grass },
  badgeRejected: { backgroundColor: colors.fog },
  badgeRejectedText: { color: colors.textMuted },
  badgeProposed: { backgroundColor: colors.grassPale },
  badgeProposedText: { color: colors.grass },
  badgeDiscarded: { backgroundColor: colors.fog },
  badgeDiscardedText: { color: colors.textMuted },

  rowIcon: { fontSize: 18, marginLeft: 'auto' },
  rowChevron: { fontSize: 10, color: colors.textMuted },

  rowDetail: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.fog,
  },

  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, marginTop: spacing.sm },
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
  actionSecondary: { backgroundColor: '#FEE2E2' },
  actionRejectText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  actionConfirmText: { fontSize: 14, color: colors.textInverse, fontWeight: '600' },
  actionSecondaryText: { fontSize: 14, color: colors.error, fontWeight: '600' },
});
