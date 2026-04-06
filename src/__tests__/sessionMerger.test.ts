jest.mock('../storage/database');

import * as Database from '../storage/database';
import { submitSession, buildSession } from '../detection/sessionMerger';
import { OutsideSession } from '../storage/database';

const BASE_TIME = 1_700_000_000_000;
const FIVE_MIN = 5 * 60 * 1000;

function makeSession(overrides: Partial<OutsideSession> = {}): OutsideSession {
  const startTime = overrides.startTime ?? BASE_TIME;
  const endTime = overrides.endTime ?? startTime + 30 * 60 * 1000;
  return {
    startTime,
    endTime,
    durationMinutes: (endTime - startTime) / 60000,
    source: 'gps',
    confidence: 0.8,
    userConfirmed: null,
    discarded: 0,
    ...overrides,
  };
}

describe('buildSession', () => {
  it('builds a session with correct duration', () => {
    const start = BASE_TIME;
    const end = BASE_TIME + 30 * 60 * 1000;
    const session = buildSession(start, end, 'gps', 0.8, 'test');
    expect(session.durationMinutes).toBe(30);
    expect(session.startTime).toBe(start);
    expect(session.endTime).toBe(end);
    expect(session.source).toBe('gps');
    expect(session.confidence).toBe(0.8);
    expect(session.notes).toBe('test');
  });

  it('auto-confirms manual sessions', () => {
    const session = buildSession(BASE_TIME, BASE_TIME + 30 * 60 * 1000, 'manual', 1.0);
    expect(session.userConfirmed).toBe(1);
  });

  it('leaves userConfirmed null for non-manual sessions', () => {
    const session = buildSession(BASE_TIME, BASE_TIME + 30 * 60 * 1000, 'gps', 0.8);
    expect(session.userConfirmed).toBeNull();
  });
});

describe('submitSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Database.insertSessionAsync as jest.Mock).mockResolvedValue(1);
    (Database.deleteSessionAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('inserts a new session when there are no overlapping sessions', async () => {
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([]);

    const candidate = makeSession();
    await submitSession(candidate);

    expect(Database.insertSessionAsync).toHaveBeenCalledWith(candidate);
    expect(Database.deleteSessionAsync).not.toHaveBeenCalled();
  });

  it('merges two overlapping sessions into one spanning the full range', async () => {
    const existing = makeSession({
      id: 1,
      startTime: BASE_TIME,
      endTime: BASE_TIME + 20 * 60 * 1000,
      confidence: 0.8,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([existing]);

    const candidate = makeSession({
      startTime: BASE_TIME + 15 * 60 * 1000, // overlaps with existing
      endTime: BASE_TIME + 40 * 60 * 1000,
      confidence: 0.8,
    });
    await submitSession(candidate);

    expect(Database.deleteSessionAsync).toHaveBeenCalledWith(1);
    expect(Database.insertSessionAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: BASE_TIME, // min of both
        endTime: BASE_TIME + 40 * 60 * 1000, // max of both
        durationMinutes: 40,
        confidence: 0.8,
      })
    );
  });

  it('merges consecutive periodic GPS sessions into one growing session', async () => {
    // Simulates the periodic flush pattern: sessions logged every 5 min
    const T0 = BASE_TIME;
    const T5 = T0 + FIVE_MIN;
    const T10 = T0 + 2 * FIVE_MIN;

    // First session submitted — no existing → insert
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValueOnce([]);
    await submitSession(makeSession({ startTime: T0, endTime: T5 }));

    // Second session submitted — finds first session overlapping
    const firstSession = makeSession({ id: 1, startTime: T0, endTime: T5 });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValueOnce([firstSession]);
    await submitSession(makeSession({ startTime: T5, endTime: T10 }));

    // The merged session should span T0 → T10
    const mergedCall = (Database.insertSessionAsync as jest.Mock).mock.calls[1][0];
    expect(mergedCall.startTime).toBe(T0);
    expect(mergedCall.endTime).toBe(T10);
    expect(mergedCall.durationMinutes).toBe(10);
  });

  it('uses the higher confidence when merging sessions from different sources', async () => {
    const existing = makeSession({ id: 1, confidence: 0.7 });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([existing]);

    await submitSession(makeSession({ confidence: 0.95 }));

    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.confidence).toBe(0.95);
  });

  it('aggregates step counts from Health Connect sessions when merging', async () => {
    const hcSession = makeSession({
      id: 1,
      source: 'health_connect',
      steps: 996,
      notes: undefined,
      userConfirmed: null,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([hcSession]);

    const gpsCandidate = makeSession({
      source: 'gps',
      notes: 'GPS geofence exit/return',
      steps: undefined,
      userConfirmed: null,
    });
    await submitSession(gpsCandidate);

    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.steps).toBe(996);
  });

  it('sums step counts when multiple step sessions are merged', async () => {
    const hc1 = makeSession({ id: 1, source: 'health_connect', steps: 500, userConfirmed: null });
    const hc2 = makeSession({
      id: 2,
      source: 'health_connect',
      steps: 300,
      userConfirmed: null,
      startTime: BASE_TIME + 3 * 60 * 1000,
      endTime: BASE_TIME + 25 * 60 * 1000,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([hc1, hc2]);

    const candidate = makeSession({ source: 'health_connect', steps: 200, userConfirmed: null });
    await submitSession(candidate);

    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.steps).toBe(1000);
  });

  it('generates a single aggregated HC note when many tiny steps records are merged', async () => {
    // Simulate 3 tiny HC records that all merge into one window (30 min total)
    const hc1 = makeSession({
      id: 1,
      source: 'health_connect',
      steps: 100,
      notes: 'Health Connect, 100 steps at 1.5 km/h.',
      userConfirmed: null,
    });
    const hc2 = makeSession({
      id: 2,
      source: 'health_connect',
      steps: 200,
      notes: 'Health Connect, 200 steps at 3.0 km/h.',
      userConfirmed: null,
      startTime: BASE_TIME + 10 * 60 * 1000,
      endTime: BASE_TIME + 30 * 60 * 1000,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([hc1, hc2]);

    const candidate = makeSession({
      source: 'health_connect',
      steps: 700,
      notes: 'Health Connect, 700 steps at 4.5 km/h.',
      userConfirmed: null,
    });
    await submitSession(candidate);

    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.steps).toBe(1000);
    // Notes must be a SINGLE sentence with the aggregated total, not a concatenation
    expect(inserted.notes).toMatch(/^Health Connect,\s*1,000 steps at \d+\.\d+ (?:km\/h|mph)\.$/);
  });

  it('combines GPS notes and aggregated HC steps note when sources are mixed', async () => {
    const hcSession = makeSession({
      id: 1,
      source: 'health_connect',
      steps: 3000,
      notes: 'Health Connect, 3,000 steps at 4.5 km/h.',
      userConfirmed: null,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([hcSession]);

    const gpsCandidate = makeSession({
      source: 'gps',
      notes: 'GPS detection, 2.1 km at 4.2 km/h.',
      steps: undefined,
      userConfirmed: null,
    });
    await submitSession(gpsCandidate);

    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    // GPS note should appear first, followed by the aggregated HC note
    expect(inserted.notes).toMatch(/GPS detection/);
    expect(inserted.notes).toMatch(/Health Connect,.*steps at.*(?:km\/h|mph)/);
    // Must be a combined single string, not duplicated per-record notes
    const hcMatchCount = (inserted.notes.match(/Health Connect,/g) ?? []).length;
    expect(hcMatchCount).toBe(1);
  });

  it('does not duplicate notes when merging sessions with identical notes', async () => {
    const existing = makeSession({
      id: 1,
      notes: 'GPS detection, 1.0 km at 4.0 km/h.',
      userConfirmed: null,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([existing]);

    const candidate = makeSession({
      notes: 'GPS detection, 1.0 km at 4.0 km/h.',
      userConfirmed: null,
    });
    await submitSession(candidate);

    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.notes).toBe('GPS detection, 1.0 km at 4.0 km/h.');
  });

  it('produces undefined notes when no session has notes', async () => {
    const existing = makeSession({ id: 1, notes: undefined, userConfirmed: null });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([existing]);

    const candidate = makeSession({ notes: undefined, userConfirmed: null });
    await submitSession(candidate);

    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.notes).toBeUndefined();
  });

  it('does not merge a new GPS session with an existing confirmed GPS session', async () => {
    // Both cover the same time range — the confirmed session should stay intact,
    // and the candidate (fully covered by the confirmed session) produces no new segment.
    const existing = makeSession({ id: 1, userConfirmed: 1 }); // user said yes
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([existing]);

    await submitSession(makeSession({ userConfirmed: null }));

    // The confirmed session must not be deleted
    expect(Database.deleteSessionAsync).not.toHaveBeenCalledWith(1);
    // No new segment to propose — the confirmed session already covers the range
    expect(Database.insertSessionAsync).not.toHaveBeenCalled();
  });

  it('preserves userConfirmed=0 (denied) from existing session when merging non-manual sessions', async () => {
    const existing = makeSession({ id: 1, userConfirmed: 0 }); // user said no
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([existing]);

    await submitSession(makeSession({ userConfirmed: null })); // GPS candidate

    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.userConfirmed).toBe(0);
  });

  it('inserts a manual session directly without merging, even when overlapping sessions exist', async () => {
    const candidate = makeSession({
      source: 'manual',
      userConfirmed: 1,
      startTime: BASE_TIME + 5 * 60 * 1000,
      endTime: BASE_TIME + 10 * 60 * 1000,
    });
    await submitSession(candidate);

    // Should not touch the existing session
    expect(Database.deleteSessionAsync).not.toHaveBeenCalled();
    // Should insert the manual session as-is
    expect(Database.insertSessionAsync).toHaveBeenCalledWith(candidate);
    // getSessionsForRangeAsync should not even be called for manual sessions
    expect(Database.getSessionsForRangeAsync).not.toHaveBeenCalled();
  });

  it('inserts a manual session directly even when a rejected session overlaps', async () => {
    const rejected = makeSession({ id: 2, userConfirmed: 0 });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([rejected]);

    const candidate = makeSession({ source: 'manual', userConfirmed: 1 });
    await submitSession(candidate);

    expect(Database.deleteSessionAsync).not.toHaveBeenCalled();
    expect(Database.insertSessionAsync).toHaveBeenCalledWith(candidate);
  });

  it('merges multiple overlapping sessions at once', async () => {
    const e1 = makeSession({ id: 1, startTime: BASE_TIME, endTime: BASE_TIME + 10 * 60 * 1000 });
    const e2 = makeSession({
      id: 2,
      startTime: BASE_TIME + 8 * 60 * 1000,
      endTime: BASE_TIME + 20 * 60 * 1000,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([e1, e2]);

    const candidate = makeSession({
      startTime: BASE_TIME + 18 * 60 * 1000,
      endTime: BASE_TIME + 30 * 60 * 1000,
    });
    await submitSession(candidate);

    expect(Database.deleteSessionAsync).toHaveBeenCalledWith(1);
    expect(Database.deleteSessionAsync).toHaveBeenCalledWith(2);
    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.startTime).toBe(BASE_TIME);
    expect(inserted.endTime).toBe(BASE_TIME + 30 * 60 * 1000);
  });

  // ── Manual-session protection ─────────────────────────────

  it('does not delete a manual session when a GPS session spans it', async () => {
    const manual = makeSession({
      id: 10,
      source: 'manual',
      userConfirmed: 1,
      startTime: BASE_TIME + 10 * 60 * 1000,
      endTime: BASE_TIME + 20 * 60 * 1000,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([manual]);

    // GPS session fully spans the manual session
    const candidate = makeSession({
      startTime: BASE_TIME,
      endTime: BASE_TIME + 30 * 60 * 1000,
    });
    await submitSession(candidate);

    expect(Database.deleteSessionAsync).not.toHaveBeenCalledWith(10);
  });

  it('splits a GPS session around a contained manual session into two segments', async () => {
    const manual = makeSession({
      id: 10,
      source: 'manual',
      userConfirmed: 1,
      startTime: BASE_TIME + 10 * 60 * 1000,
      endTime: BASE_TIME + 20 * 60 * 1000,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([manual]);

    const candidate = makeSession({
      startTime: BASE_TIME,
      endTime: BASE_TIME + 30 * 60 * 1000,
    });
    await submitSession(candidate);

    // Two GPS segments: before and after the manual session
    expect(Database.insertSessionAsync).toHaveBeenCalledTimes(2);
    const calls = (Database.insertSessionAsync as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          startTime: BASE_TIME,
          endTime: BASE_TIME + 10 * 60 * 1000,
          durationMinutes: 10,
        }),
        expect.objectContaining({
          startTime: BASE_TIME + 20 * 60 * 1000,
          endTime: BASE_TIME + 30 * 60 * 1000,
          durationMinutes: 10,
        }),
      ])
    );
  });

  it('trims a GPS session that overlaps the start of a manual session', async () => {
    // GPS: [T0, T20], Manual: [T10, T30]  →  GPS segment [T0, T10]
    const manual = makeSession({
      id: 10,
      source: 'manual',
      userConfirmed: 1,
      startTime: BASE_TIME + 10 * 60 * 1000,
      endTime: BASE_TIME + 30 * 60 * 1000,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([manual]);

    const candidate = makeSession({
      startTime: BASE_TIME,
      endTime: BASE_TIME + 20 * 60 * 1000,
    });
    await submitSession(candidate);

    expect(Database.insertSessionAsync).toHaveBeenCalledTimes(1);
    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.startTime).toBe(BASE_TIME);
    expect(inserted.endTime).toBe(BASE_TIME + 10 * 60 * 1000);
    expect(inserted.durationMinutes).toBe(10);
  });

  it('trims a GPS session that overlaps the end of a manual session', async () => {
    // GPS: [T10, T30], Manual: [T0, T20]  →  GPS segment [T20, T30]
    const manual = makeSession({
      id: 10,
      source: 'manual',
      userConfirmed: 1,
      startTime: BASE_TIME,
      endTime: BASE_TIME + 20 * 60 * 1000,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([manual]);

    const candidate = makeSession({
      startTime: BASE_TIME + 10 * 60 * 1000,
      endTime: BASE_TIME + 30 * 60 * 1000,
    });
    await submitSession(candidate);

    expect(Database.insertSessionAsync).toHaveBeenCalledTimes(1);
    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.startTime).toBe(BASE_TIME + 20 * 60 * 1000);
    expect(inserted.endTime).toBe(BASE_TIME + 30 * 60 * 1000);
    expect(inserted.durationMinutes).toBe(10);
  });

  it('does not insert a GPS session entirely covered by a manual session', async () => {
    // Manual: [T0, T60], GPS: [T10, T50]  →  nothing to insert
    const manual = makeSession({
      id: 10,
      source: 'manual',
      userConfirmed: 1,
      startTime: BASE_TIME,
      endTime: BASE_TIME + 60 * 60 * 1000,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([manual]);

    const candidate = makeSession({
      startTime: BASE_TIME + 10 * 60 * 1000,
      endTime: BASE_TIME + 50 * 60 * 1000,
    });
    await submitSession(candidate);

    expect(Database.insertSessionAsync).not.toHaveBeenCalled();
  });

  it('does not touch a manual session adjacent to (but not overlapping) a GPS session', async () => {
    // Manual: [T20, T30], GPS candidate: [T0, T15] — manual is in the MERGE_GAP_MS
    // buffer but does not actually overlap the GPS range
    const manual = makeSession({
      id: 10,
      source: 'manual',
      userConfirmed: 1,
      startTime: BASE_TIME + 20 * 60 * 1000,
      endTime: BASE_TIME + 30 * 60 * 1000,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([manual]);

    const candidate = makeSession({
      startTime: BASE_TIME,
      endTime: BASE_TIME + 15 * 60 * 1000,
    });
    await submitSession(candidate);

    expect(Database.deleteSessionAsync).not.toHaveBeenCalledWith(10);
    // GPS session should be inserted as-is (manual is outside its range)
    expect(Database.insertSessionAsync).toHaveBeenCalledTimes(1);
    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.startTime).toBe(BASE_TIME);
    expect(inserted.endTime).toBe(BASE_TIME + 15 * 60 * 1000);
  });

  it('GPS session pending approval (userConfirmed null) after being split around a manual', async () => {
    const manual = makeSession({
      id: 10,
      source: 'manual',
      userConfirmed: 1,
      startTime: BASE_TIME + 10 * 60 * 1000,
      endTime: BASE_TIME + 20 * 60 * 1000,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([manual]);

    const candidate = makeSession({ startTime: BASE_TIME, endTime: BASE_TIME + 30 * 60 * 1000 });
    await submitSession(candidate);

    const calls = (Database.insertSessionAsync as jest.Mock).mock.calls.map((c) => c[0]);
    calls.forEach((s) => expect(s.userConfirmed).toBeNull());
  });

  // ── Confirmed-session protection (any source) ─────────────

  it('does not merge an unconfirmed health_connect session with an existing confirmed health_connect session', async () => {
    const existing = makeSession({ id: 1, source: 'health_connect', userConfirmed: 1 });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([existing]);

    await submitSession(makeSession({ source: 'health_connect', userConfirmed: null }));

    expect(Database.deleteSessionAsync).not.toHaveBeenCalledWith(1);
    expect(Database.insertSessionAsync).not.toHaveBeenCalled();
  });

  it('splits an unconfirmed health_connect session around a confirmed GPS session', async () => {
    // Confirmed GPS: [T10, T20], Health Connect: [T0, T30] → two HC segments
    const confirmedGps = makeSession({
      id: 5,
      source: 'gps',
      userConfirmed: 1,
      startTime: BASE_TIME + 10 * 60 * 1000,
      endTime: BASE_TIME + 20 * 60 * 1000,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([confirmedGps]);

    const candidate = makeSession({
      source: 'health_connect',
      userConfirmed: null,
      startTime: BASE_TIME,
      endTime: BASE_TIME + 30 * 60 * 1000,
    });
    await submitSession(candidate);

    expect(Database.deleteSessionAsync).not.toHaveBeenCalledWith(5);
    expect(Database.insertSessionAsync).toHaveBeenCalledTimes(2);
    const calls = (Database.insertSessionAsync as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ startTime: BASE_TIME, endTime: BASE_TIME + 10 * 60 * 1000 }),
        expect.objectContaining({
          startTime: BASE_TIME + 20 * 60 * 1000,
          endTime: BASE_TIME + 30 * 60 * 1000,
        }),
      ])
    );
  });

  it('does not insert a health_connect session entirely covered by a confirmed GPS session', async () => {
    const confirmedGps = makeSession({
      id: 5,
      source: 'gps',
      userConfirmed: 1,
      startTime: BASE_TIME,
      endTime: BASE_TIME + 60 * 60 * 1000,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([confirmedGps]);

    const candidate = makeSession({
      source: 'health_connect',
      userConfirmed: null,
      startTime: BASE_TIME + 10 * 60 * 1000,
      endTime: BASE_TIME + 50 * 60 * 1000,
    });
    await submitSession(candidate);

    expect(Database.insertSessionAsync).not.toHaveBeenCalled();
  });

  it('health_connect segments produced after splitting around a confirmed session are unconfirmed', async () => {
    const confirmedGps = makeSession({
      id: 5,
      source: 'gps',
      userConfirmed: 1,
      startTime: BASE_TIME + 10 * 60 * 1000,
      endTime: BASE_TIME + 20 * 60 * 1000,
    });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([confirmedGps]);

    const candidate = makeSession({
      source: 'health_connect',
      userConfirmed: null,
      startTime: BASE_TIME,
      endTime: BASE_TIME + 30 * 60 * 1000,
    });
    await submitSession(candidate);

    const calls = (Database.insertSessionAsync as jest.Mock).mock.calls.map((c) => c[0]);
    calls.forEach((s) => expect(s.userConfirmed).toBeNull());
  });

  // ── Confidence-based discard ──────────────────────────────

  it('marks a very short GPS session (≤ 5 min) as discarded=1', async () => {
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([]);

    const candidate = makeSession({
      startTime: BASE_TIME,
      endTime: BASE_TIME + 5 * 60 * 1000, // exactly 5 min
      confidence: 0.8,
    });
    await submitSession(candidate);

    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.discarded).toBe(1);
  });

  it('marks a very long GPS session (> 4 h) as discarded=1', async () => {
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([]);

    const candidate = makeSession({
      startTime: BASE_TIME,
      endTime: BASE_TIME + 5 * 60 * 60 * 1000, // 5 hours
      confidence: 0.8,
    });
    await submitSession(candidate);

    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.discarded).toBe(1);
  });

  it('does not discard a standard 30-minute GPS session', async () => {
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([]);

    const candidate = makeSession({
      startTime: BASE_TIME,
      endTime: BASE_TIME + 30 * 60 * 1000,
      confidence: 0.8,
    });
    await submitSession(candidate);

    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.discarded).toBe(0);
  });

  it('does not discard a re-detected session that was previously denied by the user', async () => {
    // User denied this session previously; re-detection should never override that
    // with discarded=1 — the explicit rejection must remain visible in the Standard tab.
    const denied = makeSession({ id: 1, userConfirmed: 0 });
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([denied]);

    // A short re-detected candidate that would normally be discarded
    const candidate = makeSession({
      startTime: BASE_TIME,
      endTime: BASE_TIME + 5 * 60 * 1000, // short — would be discarded if unreviewed
      confidence: 0.8,
    });
    await submitSession(candidate);

    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.userConfirmed).toBe(0); // preserved denial
    expect(inserted.discarded).toBe(0); // NOT discarded
  });

  it('stores the computed confidence score instead of the raw detection confidence', async () => {
    (Database.getSessionsForRangeAsync as jest.Mock).mockResolvedValue([]);

    // 5-hour session: duration factor = 0.40, score = 0.8 × 0.40 × 1.0 = 0.32
    const candidate = makeSession({
      startTime: BASE_TIME,
      endTime: BASE_TIME + 5 * 60 * 60 * 1000,
      confidence: 0.8,
    });
    await submitSession(candidate);

    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.confidence).toBeLessThan(0.8); // lower than raw GPS confidence
  });

  it('manual sessions are never scored for discard (inserted as-is)', async () => {
    const candidate = makeSession({
      source: 'manual',
      userConfirmed: 1,
      startTime: BASE_TIME,
      endTime: BASE_TIME + 5 * 60 * 1000, // 5 min — would be discarded if GPS
    });
    await submitSession(candidate);

    // Manual sessions bypass confidence scoring
    expect(Database.insertSessionAsync).toHaveBeenCalledWith(candidate);
    const inserted = (Database.insertSessionAsync as jest.Mock).mock.calls[0][0];
    expect(inserted.discarded).toBe(0);
  });
});
