import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  getAllSessionsIncludingDiscarded,
  autoCloseOldProposedSessions,
  confirmSession,
  deleteSession,
  unDiscardSession,
  OutsideSession,
} from '../storage/database';
import { spacing, radius, shadows } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { formatMinutes } from '../utils/helpers';
import { t, formatLocalDate, formatLocalTime } from '../i18n';
import ManualSessionSheet from '../components/ManualSessionSheet';
import EditSessionSheet from '../components/EditSessionSheet';
import { updateTimeSlotProbability } from '../detection/sessionConfidence';
import { onSessionsChanged, emitSessionsChanged } from '../utils/sessionsChangedEmitter';
import { cancelRemindersIfGoalReached } from '../notifications/notificationManager';

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [includeConfirmed, setIncludeConfirmed] = useState(true);
  const [includeReview, setIncludeReview] = useState(true);
  const [includeRejected, setIncludeRejected] = useState(false);
  const [allSessions, setAllSessions] = useState<OutsideSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editSession, setEditSession] = useState<OutsideSession | null>(null);

  const loadData = useCallback(() => {
    autoCloseOldProposedSessions();
    const from = FOUR_WEEKS_AGO();
    const to = Date.now();
    setAllSessions(getAllSessionsIncludingDiscarded(from, to));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Refresh whenever background work (e.g. Health Connect sync) inserts new sessions.
  useEffect(() => onSessionsChanged(loadData), [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  };

  const handleConfirm = async (id: number, startTime: number, confirmed: boolean) => {
    confirmSession(id, confirmed);
    const d = new Date(startTime);
    updateTimeSlotProbability(d.getHours(), d.getDay(), confirmed);
    emitSessionsChanged();
    loadData();
    if (confirmed) {
      await cancelRemindersIfGoalReached();
    }
    setExpandedId(null);
  };

  const handleDelete = (id: number) => {
    Alert.alert(t('session_delete_confirm_title'), t('session_delete_confirm_body'), [
      { text: t('session_delete_cancel'), style: 'cancel' },
      {
        text: t('session_delete'),
        style: 'destructive',
        onPress: () => {
          deleteSession(id);
          emitSessionsChanged();
          setExpandedId(null);
          loadData();
        },
      },
    ]);
  };

  const handleReReview = (id: number) => {
    confirmSession(id, null);
    emitSessionsChanged();
    setExpandedId(null);
    loadData();
  };

  const handleUnDiscard = (id: number) => {
    unDiscardSession(id);
    emitSessionsChanged();
    setExpandedId(null);
    loadData();
  };

  const reviewCount = allSessions.filter(
    (s) => s.userConfirmed === null && s.discarded !== 1
  ).length;

  const sessions = allSessions.filter((s) => {
    if (s.userConfirmed === 1) return includeConfirmed; // approved — shown when Confirmed toggle is on
    if (s.userConfirmed === null && s.discarded !== 1) return includeReview; // proposed/in-review
    return includeRejected; // rejected (userConfirmed = 0) or discarded
  });

  const grouped = groupByDay(sessions);

  return (
    <View style={styles.container}>
      <ManualSessionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSessionLogged={loadData}
      />
      <EditSessionSheet
        visible={editSession !== null}
        session={editSession}
        onClose={() => setEditSession(null)}
        onSessionUpdated={() => {
          setExpandedId(null);
          loadData();
        }}
      />

      {/* Filter toggles */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.toggle, includeConfirmed && styles.toggleActive]}
          onPress={() => setIncludeConfirmed((v) => !v)}
          testID="toggle-confirmed"
        >
          <Text style={[styles.toggleText, includeConfirmed && styles.toggleTextActive]}>
            {t('events_toggle_confirmed')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggle, includeReview && styles.toggleActive]}
          onPress={() => setIncludeReview((v) => !v)}
          testID="toggle-review"
        >
          <Text style={[styles.toggleText, includeReview && styles.toggleTextActive]}>
            {t('events_toggle_review')}
            {reviewCount > 0 ? (
              <Text style={[styles.toggleBadge, includeReview && styles.toggleBadgeActive]}>
                {' '}
                {reviewCount}
              </Text>
            ) : null}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggle, includeRejected && styles.toggleActive]}
          onPress={() => setIncludeRejected((v) => !v)}
          testID="toggle-rejected"
        >
          <Text style={[styles.toggleText, includeRejected && styles.toggleTextActive]}>
            {t('events_toggle_rejected')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => setSheetVisible(true)}>
          <Ionicons name="add" size={24} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.grass} />
        }
      >
        {sessions.length === 0 && (
          <View style={styles.empty}>
            <Image
              source={require('../../assets/herb.png')}
              style={styles.emptyIcon}
              resizeMode="contain"
            />
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
                onEditTimes={() => setEditSession(session)}
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
  onEditTimes,
}: {
  session: OutsideSession;
  expanded: boolean;
  onToggle: () => void;
  onConfirm: (confirmed: boolean) => void;
  onDelete: () => void;
  onReReview: () => void;
  onUnDiscard: () => void;
  onEditTimes: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const swipeableRef = useRef<Swipeable>(null);
  const sourceIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
    health_connect: 'fitness-outline',
    gps: 'location-outline',
    manual: 'pencil-outline',
    timeline: 'calendar-outline',
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

  const isPending = !isConfirmed && !isRejected && !isDiscarded;

  const renderConfirmAction = () => (
    <TouchableOpacity
      style={[styles.swipeAction, styles.swipeConfirm]}
      onPress={() => {
        swipeableRef.current?.close();
        onConfirm(true);
      }}
      testID="swipe-confirm-action"
    >
      <Ionicons name="checkmark" size={22} color={colors.textInverse} />
      <Text style={styles.swipeConfirmLabel}>{t('events_confirm')}</Text>
    </TouchableOpacity>
  );

  const renderRejectAction = () => (
    <TouchableOpacity
      style={[styles.swipeAction, styles.swipeReject]}
      onPress={() => {
        swipeableRef.current?.close();
        onConfirm(false);
      }}
      testID="swipe-reject-action"
    >
      <Ionicons name="close" size={22} color={colors.textSecondary} />
      <Text style={styles.swipeRejectLabel}>{t('events_not_outside')}</Text>
    </TouchableOpacity>
  );

  const rowContent = (
    <View style={[styles.rowCard, (isRejected || isDiscarded) && styles.rowCardMuted]}>
      {/* Collapsed row */}
      <TouchableOpacity style={styles.rowSummary} onPress={onToggle} activeOpacity={0.7}>
        <Text style={styles.rowTime}>
          {formatLocalTime(session.startTime)}–{formatLocalTime(session.endTime)}
        </Text>
        <View style={[styles.statusBadge, statusStyle]}>
          <Text style={[styles.statusBadgeText, statusTextStyle]}>{statusLabel}</Text>
        </View>
        <View style={styles.rowIconContainer}>
          <Ionicons
            name={sourceIcon[session.source] ?? 'leaf-outline'}
            size={18}
            color={colors.textSecondary}
          />
        </View>
        <Text style={styles.rowChevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {isPending && !expanded && (
        <View style={styles.swipeHint} pointerEvents="none" testID="session-swipe-hint">
          <Ionicons name="arrow-back-outline" size={14} color={colors.textMuted} />
          <Text style={styles.swipeHintText}>{t('session_swipe_hint')}</Text>
          <Ionicons name="arrow-forward-outline" size={14} color={colors.textMuted} />
        </View>
      )}

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.rowDetail}>
          {/* Top info */}
          <View style={styles.cardTop}>
            <View style={styles.cardIconContainer}>
              <Ionicons
                name={sourceIcon[session.source] ?? 'leaf-outline'}
                size={22}
                color={colors.grass}
              />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardDate}>
                {formatLocalDate(session.startTime, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
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

          {session.notes && <Text style={styles.notes}>{session.notes}</Text>}

          {/* Edit times — always available */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionEditTimes]}
            onPress={onEditTimes}
          >
            <Text style={styles.actionEditTimesText}>{t('session_edit_times')}</Text>
          </TouchableOpacity>

          {/* Actions for pending sessions */}
          {isPending && (
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

  if (!isPending) {
    return rowContent;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderConfirmAction}
      renderLeftActions={renderRejectAction}
      onSwipeableOpen={(direction) => {
        // direction 'right' = right panel opened = user swiped left = accept
        // direction 'left' = left panel opened = user swiped right = reject
        if (direction === 'right') {
          onConfirm(true);
        } else {
          onConfirm(false);
        }
      }}
    >
      {rowContent}
    </Swipeable>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.mist },

    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.fog,
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    toggle: {
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: colors.fog,
    },
    toggleActive: { backgroundColor: colors.grassPale },
    toggleText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    toggleTextActive: { color: colors.grass },
    toggleBadge: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
    toggleBadgeActive: { color: colors.grass },
    addBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.grass,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 'auto',
      ...shadows.soft,
    },
    addBtnText: { fontSize: 22, color: colors.textInverse, lineHeight: 28, fontWeight: '300' },

    scroll: { flex: 1 },
    content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.sm },

    empty: { alignItems: 'center', paddingVertical: spacing.xxl },
    emptyIcon: { width: 64, height: 64, marginBottom: spacing.md },
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
      backgroundColor: colors.card,
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

    rowIconContainer: { marginLeft: 'auto', width: 24, alignItems: 'center' },
    rowChevron: { fontSize: 10, color: colors.textMuted },

    rowDetail: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.fog,
    },

    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    cardIconContainer: {
      width: 32,
      marginRight: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    actionSecondary: { backgroundColor: colors.errorSurface },
    actionEditTimes: { backgroundColor: colors.fog, marginTop: spacing.sm },
    actionRejectText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
    actionConfirmText: { fontSize: 14, color: colors.textInverse, fontWeight: '600' },
    actionSecondaryText: { fontSize: 14, color: colors.error, fontWeight: '600' },
    actionEditTimesText: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },

    swipeHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    swipeHintText: { fontSize: 12, color: colors.textMuted },
    swipeAction: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 88,
      borderRadius: radius.md,
    },
    swipeConfirm: { backgroundColor: colors.grass },
    swipeConfirmLabel: { fontSize: 11, color: colors.textInverse, fontWeight: '600', marginTop: 2 },
    swipeReject: { backgroundColor: colors.fog },
    swipeRejectLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
      marginTop: 2,
    },
  });
}
