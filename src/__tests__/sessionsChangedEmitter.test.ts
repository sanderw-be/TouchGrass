import { emitSessionsChanged, onSessionsChanged } from '../utils/sessionsChangedEmitter';

describe('sessionsChangedEmitter', () => {
  it('calls a registered listener when sessions change', () => {
    const listener = jest.fn();
    const unsubscribe = onSessionsChanged(listener);

    emitSessionsChanged();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('does not call the listener after unsubscribing', () => {
    const listener = jest.fn();
    const unsubscribe = onSessionsChanged(listener);

    unsubscribe();
    emitSessionsChanged();

    expect(listener).not.toHaveBeenCalled();
  });

  it('calls multiple listeners independently', () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    const unsubA = onSessionsChanged(listenerA);
    const unsubB = onSessionsChanged(listenerB);

    emitSessionsChanged();

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);

    unsubA();
    unsubB();
  });

  it('does not call an already-removed listener while other listeners still receive events', () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    const unsubA = onSessionsChanged(listenerA);
    const unsubB = onSessionsChanged(listenerB);

    unsubA();
    emitSessionsChanged();

    expect(listenerA).not.toHaveBeenCalled();
    expect(listenerB).toHaveBeenCalledTimes(1);

    unsubB();
  });

  it('continues emitting to remaining listeners when one throws', () => {
    const throwing = jest.fn(() => {
      throw new Error('test error');
    });
    const safe = jest.fn();

    const unsubThrowing = onSessionsChanged(throwing);
    const unsubSafe = onSessionsChanged(safe);

    // Should not propagate the error
    expect(() => emitSessionsChanged()).not.toThrow();
    expect(safe).toHaveBeenCalledTimes(1);

    unsubThrowing();
    unsubSafe();
  });
});
