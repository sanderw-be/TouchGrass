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
    (Database.insertSession as jest.Mock).mockReturnValue(1);
    (Database.deleteSession as jest.Mock).mockImplementation(() => undefined);
  });

  it('inserts a new session when there are no overlapping sessions', () => {
    (Database.getSessionsForRange as jest.Mock).mockReturnValue([]);

    const candidate = makeSession();
    submitSession(candidate);

    expect(Database.insertSession).toHaveBeenCalledWith(candidate);
    expect(Database.deleteSession).not.toHaveBeenCalled();
  });

  it('merges two overlapping sessions into one spanning the full range', () => {
    const existing = makeSession({
      id: 1,
      startTime: BASE_TIME,
      endTime: BASE_TIME + 20 * 60 * 1000,
      confidence: 0.8,
    });
    (Database.getSessionsForRange as jest.Mock).mockReturnValue([existing]);

    const candidate = makeSession({
      startTime: BASE_TIME + 15 * 60 * 1000, // overlaps with existing
      endTime: BASE_TIME + 40 * 60 * 1000,
      confidence: 0.8,
    });
    submitSession(candidate);

    expect(Database.deleteSession).toHaveBeenCalledWith(1);
    expect(Database.insertSession).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: BASE_TIME,                       // min of both
        endTime: BASE_TIME + 40 * 60 * 1000,        // max of both
        durationMinutes: 40,
        confidence: 0.8,
      }),
    );
  });

  it('merges consecutive periodic GPS sessions into one growing session', () => {
    // Simulates the periodic flush pattern: sessions logged every 5 min
    const T0 = BASE_TIME;
    const T5 = T0 + FIVE_MIN;
    const T10 = T0 + 2 * FIVE_MIN;

    // First session submitted — no existing → insert
    (Database.getSessionsForRange as jest.Mock).mockReturnValueOnce([]);
    submitSession(makeSession({ startTime: T0, endTime: T5 }));

    // Second session submitted — finds first session overlapping
    const firstSession = makeSession({ id: 1, startTime: T0, endTime: T5 });
    (Database.getSessionsForRange as jest.Mock).mockReturnValueOnce([firstSession]);
    submitSession(makeSession({ startTime: T5, endTime: T10 }));

    // The merged session should span T0 → T10
    const mergedCall = (Database.insertSession as jest.Mock).mock.calls[1][0];
    expect(mergedCall.startTime).toBe(T0);
    expect(mergedCall.endTime).toBe(T10);
    expect(mergedCall.durationMinutes).toBe(10);
  });

  it('uses the higher confidence when merging sessions from different sources', () => {
    const existing = makeSession({ id: 1, confidence: 0.7 });
    (Database.getSessionsForRange as jest.Mock).mockReturnValue([existing]);

    submitSession(makeSession({ confidence: 0.95 }));

    const inserted = (Database.insertSession as jest.Mock).mock.calls[0][0];
    expect(inserted.confidence).toBe(0.95);
  });

  it('preserves userConfirmed from existing session when merging', () => {
    const existing = makeSession({ id: 1, userConfirmed: 1 }); // user said yes
    (Database.getSessionsForRange as jest.Mock).mockReturnValue([existing]);

    submitSession(makeSession({ userConfirmed: null }));

    const inserted = (Database.insertSession as jest.Mock).mock.calls[0][0];
    expect(inserted.userConfirmed).toBe(1);
  });

  it('preserves userConfirmed=0 (denied) from existing session when merging non-manual sessions', () => {
    const existing = makeSession({ id: 1, userConfirmed: 0 }); // user said no
    (Database.getSessionsForRange as jest.Mock).mockReturnValue([existing]);

    submitSession(makeSession({ userConfirmed: null })); // GPS candidate

    const inserted = (Database.insertSession as jest.Mock).mock.calls[0][0];
    expect(inserted.userConfirmed).toBe(0);
  });

  it('inserts a manual session directly without merging, even when overlapping sessions exist', () => {
    const candidate = makeSession({
      source: 'manual',
      userConfirmed: 1,
      startTime: BASE_TIME + 5 * 60 * 1000,
      endTime: BASE_TIME + 10 * 60 * 1000,
    });
    submitSession(candidate);

    // Should not touch the existing session
    expect(Database.deleteSession).not.toHaveBeenCalled();
    // Should insert the manual session as-is
    expect(Database.insertSession).toHaveBeenCalledWith(candidate);
    // getSessionsForRange should not even be called for manual sessions
    expect(Database.getSessionsForRange).not.toHaveBeenCalled();
  });

  it('inserts a manual session directly even when a rejected session overlaps', () => {
    const rejected = makeSession({ id: 2, userConfirmed: 0 });
    (Database.getSessionsForRange as jest.Mock).mockReturnValue([rejected]);

    const candidate = makeSession({ source: 'manual', userConfirmed: 1 });
    submitSession(candidate);

    expect(Database.deleteSession).not.toHaveBeenCalled();
    expect(Database.insertSession).toHaveBeenCalledWith(candidate);
  });

  it('merges multiple overlapping sessions at once', () => {
    const e1 = makeSession({ id: 1, startTime: BASE_TIME, endTime: BASE_TIME + 10 * 60 * 1000 });
    const e2 = makeSession({ id: 2, startTime: BASE_TIME + 8 * 60 * 1000, endTime: BASE_TIME + 20 * 60 * 1000 });
    (Database.getSessionsForRange as jest.Mock).mockReturnValue([e1, e2]);

    const candidate = makeSession({
      startTime: BASE_TIME + 18 * 60 * 1000,
      endTime: BASE_TIME + 30 * 60 * 1000,
    });
    submitSession(candidate);

    expect(Database.deleteSession).toHaveBeenCalledWith(1);
    expect(Database.deleteSession).toHaveBeenCalledWith(2);
    const inserted = (Database.insertSession as jest.Mock).mock.calls[0][0];
    expect(inserted.startTime).toBe(BASE_TIME);
    expect(inserted.endTime).toBe(BASE_TIME + 30 * 60 * 1000);
  });
});
